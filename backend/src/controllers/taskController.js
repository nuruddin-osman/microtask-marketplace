const mongoose = require("mongoose");
const Task = require("../models/taskModels");
const TaskSubmission = require("../models/taskSubmissionModels");
const User = require("../models/userModels");
const WalletTransaction = require("../models/walletTransactionModels");

const createTask = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const {
      title,
      description,
      instructions,
      category,
      rewardPerWorker,
      totalSlots,
    } = req.body || {};

    // Validate text fields
    const textFields = {
      title,
      description,
      instructions,
      category,
    };

    for (const [field, value] of Object.entries(textFields)) {
      if (typeof value !== "string" || !value.trim()) {
        return res.status(400).json({
          success: false,
          message: `${field} is required`,
        });
      }
    }

    // Validate numeric fields
    if (
      rewardPerWorker === undefined ||
      rewardPerWorker === null ||
      rewardPerWorker === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Reward per worker is required",
      });
    }

    if (totalSlots === undefined || totalSlots === null || totalSlots === "") {
      return res.status(400).json({
        success: false,
        message: "Total slots are required",
      });
    }

    const reward = Number(rewardPerWorker);
    const slots = Number(totalSlots);

    if (
      !Number.isFinite(reward) ||
      reward < 0.01 ||
      Math.abs(reward * 100 - Math.round(reward * 100)) > 1e-8
    ) {
      return res.status(400).json({
        success: false,
        message: "Reward must be at least 0.01 with maximum 2 decimal places",
      });
    }

    if (!Number.isInteger(slots) || slots < 1) {
      return res.status(400).json({
        success: false,
        message: "Total slots must be a positive integer",
      });
    }

    // Calculate money in cents to reduce floating-point errors
    const rewardCents = Math.round(reward * 100);
    const budgetCents = rewardCents * slots;

    if (!Number.isSafeInteger(budgetCents)) {
      return res.status(400).json({
        success: false,
        message: "Task budget is too large",
      });
    }

    const feeCents = Math.round(budgetCents * 0.05);
    const totalCostCents = budgetCents + feeCents;

    const totalRewardBudget = budgetCents / 100;
    const platformFee = feeCents / 100;
    const totalCost = totalCostCents / 100;

    let createdTask;

    await session.withTransaction(async () => {
      // Atomically deduct the total cost from buyer's wallet
      const updatedBuyer = await User.findOneAndUpdate(
        {
          _id: req.user._id,
          walletBalance: { $gte: totalCost },
        },
        {
          $inc: { walletBalance: -totalCost },
        },
        {
          returnDocument: "after",
          session,
        },
      );

      if (!updatedBuyer) {
        const error = new Error("INSUFFICIENT_BALANCE");
        throw error;
      }

      const balanceAfter = Number(updatedBuyer.walletBalance);
      const balanceBefore = Number((balanceAfter + totalCost).toFixed(2));

      // Create task
      [createdTask] = await Task.create(
        [
          {
            title: title.trim(),
            description: description.trim(),
            instructions: instructions.trim(),
            category: category.trim(),
            rewardPerWorker: reward,
            totalSlots: slots,
            completedSlots: 0,
            advertiser: req.user._id,
            status: "pending",
            totalRewardBudget,
            platformFee,
            totalCost,
          },
        ],
        { session },
      );

      // Record reserved task budget
      await WalletTransaction.create(
        [
          {
            user: req.user._id,
            type: "task_budget",
            amount: totalCost,
            status: "completed",
            balanceBefore,
            balanceAfter,
            relatedTask: createdTask._id,
            note: `Task budget reserved. Reward: ${totalRewardBudget}, Platform fee: ${platformFee}`,
          },
        ],
        { session },
      );
    });

    return res.status(201).json({
      success: true,
      message: "Task created and submitted for approval",
      task: createdTask,
      payment: {
        totalRewardBudget,
        platformFee,
        totalCost,
      },
    });
  } catch (error) {
    console.error("Create task error:", error);

    if (error.message === "INSUFFICIENT_BALANCE") {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance to create this task",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create task",
    });
  } finally {
    await session.endSession();
  }
};

const getTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ status: "active" })
      .populate("advertiser", "name")
      .sort({ createdAt: -1 })
      .lean();

    const updatedTasks = tasks.map((task) => ({
      ...task,
      remainingSlots: Math.max(
        0,
        task.totalSlots - task.completedSlots - (task.reservedSlots || 0),
      ),
    }));

    res.status(200).json({
      success: true,
      count: updatedTasks.length,
      tasks: updatedTasks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch tasks",
      error: error.message,
    });
  }
};

const getPendingTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ status: "pending" })
      .populate("advertiser", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    console.error("Get pending tasks error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const reviewTask = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid task ID",
    });
  }

  if (!["active", "rejected"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Status must be active or rejected",
    });
  }

  const session = await mongoose.startSession();

  try {
    let reviewedTask;

    await session.withTransaction(async () => {
      const task = await Task.findOne({
        _id: id,
        status: "pending",
      }).session(session);

      if (!task) {
        const error = new Error("Pending task not found");
        error.statusCode = 404;
        throw error;
      }

      // If admin rejects the task, refund buyer
      if (status === "rejected") {
        const budgetTransaction = await WalletTransaction.findOne({
          relatedTask: task._id,
          type: "task_budget",
          status: "completed",
        }).session(session);

        if (!budgetTransaction) {
          throw new Error("Task budget transaction not found");
        }

        // Prevent duplicate refund
        const existingRefund = await WalletTransaction.findOne({
          relatedTask: task._id,
          type: "task_refund",
        }).session(session);

        if (existingRefund) {
          throw new Error("Task budget has already been refunded");
        }

        const buyer = await User.findById(task.advertiser).session(session);

        if (!buyer) {
          throw new Error("Buyer not found");
        }

        const refundAmount = Number(task.totalCost);
        const balanceBefore = Number(buyer.walletBalance);

        if (
          !Number.isFinite(refundAmount) ||
          refundAmount <= 0 ||
          !Number.isFinite(balanceBefore) ||
          balanceBefore < 0
        ) {
          throw new Error("Invalid refund calculation");
        }

        const balanceAfter = Number((balanceBefore + refundAmount).toFixed(2));

        buyer.walletBalance = balanceAfter;
        await buyer.save({ session });

        await WalletTransaction.create(
          [
            {
              user: buyer._id,
              type: "task_refund",
              amount: refundAmount,
              status: "completed",
              balanceBefore,
              balanceAfter,
              relatedTask: task._id,
              processedBy: req.user._id,
              note: "Task rejected; full budget and platform fee refunded",
            },
          ],
          { session },
        );
      }

      reviewedTask = await Task.findOneAndUpdate(
        {
          _id: id,
          status: "pending",
        },
        {
          $set: { status },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        },
      );

      if (!reviewedTask) {
        throw new Error("Task review failed");
      }
    });

    return res.status(200).json({
      success: true,
      message:
        status === "active"
          ? "Task approved successfully"
          : "Task rejected and full amount refunded successfully",
      task: reviewedTask,
    });
  } catch (error) {
    console.error("Review task error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to review task",
    });
  } finally {
    await session.endSession();
  }
};

const acceptTask = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    const freelancerId = req.user._id;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID",
      });
    }

    let submission;

    await session.withTransaction(async () => {
      // Check whether this freelancer already accepted the task.
      const existing = await TaskSubmission.findOne({
        task: id,
        freelancer: freelancerId,
      }).session(session);

      if (existing) {
        throw new Error("ALREADY_ACCEPTED");
      }

      // Atomically reserve one available slot.
      const task = await Task.findOneAndUpdate(
        {
          _id: id,
          status: "active",
          $expr: {
            $lt: [
              {
                $add: [
                  { $ifNull: ["$completedSlots", 0] },
                  { $ifNull: ["$reservedSlots", 0] },
                ],
              },
              "$totalSlots",
            ],
          },
        },
        {
          $inc: { reservedSlots: 1 },
        },
        {
          returnDocument: "after",
          session,
        },
      );

      if (!task) {
        throw new Error("TASK_UNAVAILABLE");
      }

      [submission] = await TaskSubmission.create(
        [
          {
            task: id,
            freelancer: freelancerId,
            status: "accepted",
          },
        ],
        { session },
      );
    });

    return res.status(201).json({
      success: true,
      message: "Task accepted successfully",
      submission,
    });
  } catch (error) {
    if (
      error.message === "TASK_UNAVAILABLE" ||
      error.message === "ALREADY_ACCEPTED"
    ) {
      return res.status(409).json({
        success: false,
        message:
          error.message === "ALREADY_ACCEPTED"
            ? "You have already accepted this task"
            : "Task is unavailable or all slots are filled",
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already accepted this task",
      });
    }

    console.error("Accept task error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  } finally {
    await session.endSession();
  }
};

const submitProof = async (req, res) => {
  try {
    const { id } = req.params;
    const { proofText, proofUrl } = req.body;

    // At least one proof is required
    if ((!proofText || !proofText.trim()) && (!proofUrl || !proofUrl.trim())) {
      return res.status(400).json({
        success: false,
        message: "Please provide proof text or proof URL",
      });
    }

    // Find submission belonging to the logged-in freelancer
    const submission = await TaskSubmission.findOne({
      _id: id,
      freelancer: req.user._id,
      status: "accepted",
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message:
          "Accepted submission not found, or proof has already been submitted",
      });
    }

    submission.proofText = proofText?.trim() || "";
    submission.proofUrl = proofUrl?.trim() || "";
    submission.status = "submitted";

    await submission.save();

    return res.status(200).json({
      success: true,
      message: "Proof submitted successfully",
      submission,
    });
  } catch (error) {
    console.error("Submit proof error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit proof",
    });
  }
};

const reviewSubmission = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid submission ID",
    });
  }

  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Status must be approved or rejected",
    });
  }

  const session = await mongoose.startSession();

  try {
    let reviewedSubmission;

    await session.withTransaction(async () => {
      // 1. Find submitted proof
      const submission = await TaskSubmission.findOne({
        _id: id,
        status: "submitted",
      }).session(session);

      if (!submission) {
        const error = new Error("Submission not found or already reviewed");
        error.statusCode = 404;
        throw error;
      }

      // 2. Find related task
      const task = await Task.findById(submission.task).session(session);

      if (!task) {
        const error = new Error("Task not found");
        error.statusCode = 404;
        throw error;
      }

      // 3. Only task owner can review
      if (task.advertiser.toString() !== req.user._id.toString()) {
        const error = new Error(
          "You are not authorized to review this submission",
        );
        error.statusCode = 403;
        throw error;
      }

      // 4. Verify reserved slot exists
      if ((task.reservedSlots || 0) < 1) {
        const error = new Error("No reserved slot found for this submission");
        error.statusCode = 409;
        throw error;
      }

      // 5. Calculate task slot updates
      const updateFields = {
        reservedSlots: -1,
      };

      let nextCompletedSlots = task.completedSlots;

      if (status === "approved") {
        const reward = Number(task.rewardPerWorker);
        const totalRewardBudget = Number(task.totalRewardBudget);

        if (
          !Number.isFinite(reward) ||
          reward <= 0 ||
          !Number.isFinite(totalRewardBudget) ||
          totalRewardBudget < reward
        ) {
          throw new Error("Invalid task reward or budget");
        }

        // Check remaining escrow reward budget
        const remainingBudget = Number(
          (totalRewardBudget - task.completedSlots * reward).toFixed(2),
        );

        if (remainingBudget < reward) {
          throw new Error("Insufficient remaining task budget");
        }

        nextCompletedSlots += 1;

        updateFields.completedSlots = 1;
      }

      // 6. Atomically update task slots
      const taskUpdate = {
        $inc: updateFields,
      };

      if (status === "approved" && nextCompletedSlots >= task.totalSlots) {
        taskUpdate.$set = {
          status: "completed",
        };
      }

      const updatedTask = await Task.findOneAndUpdate(
        {
          _id: task._id,
          reservedSlots: { $gt: 0 },
          completedSlots: task.completedSlots,
        },
        taskUpdate,
        {
          returnDocument: "after",
          runValidators: true,
          session,
        },
      );

      if (!updatedTask) {
        const error = new Error("Task slot update failed. Please try again");
        error.statusCode = 409;
        throw error;
      }

      // 7. Approve or reject submission
      reviewedSubmission = await TaskSubmission.findOneAndUpdate(
        {
          _id: id,
          status: "submitted",
        },
        {
          $set: {
            status,
            reviewedAt: new Date(),
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        },
      );

      if (!reviewedSubmission) {
        const error = new Error("Submission has already been reviewed");
        error.statusCode = 409;
        throw error;
      }

      // 8. Release reward from task escrow on approval
      if (status === "approved") {
        const reward = Number(task.rewardPerWorker);

        // Prevent duplicate reward
        const existingTransaction = await WalletTransaction.findOne({
          relatedSubmission: submission._id,
          type: "task_reward",
        }).session(session);

        if (existingTransaction) {
          throw new Error("Reward already credited for this submission");
        }

        // Atomically credit freelancer wallet
        const updatedFreelancer = await User.findOneAndUpdate(
          {
            _id: submission.freelancer,
          },
          {
            $inc: {
              walletBalance: reward,
            },
          },
          {
            returnDocument: "after",
            session,
          },
        );

        if (!updatedFreelancer) {
          throw new Error("Freelancer not found");
        }

        const balanceAfter = Number(updatedFreelancer.walletBalance);

        const balanceBefore = Number((balanceAfter - reward).toFixed(2));

        // Record reward transaction
        await WalletTransaction.create(
          [
            {
              user: updatedFreelancer._id,
              type: "task_reward",
              amount: reward,
              status: "completed",
              balanceBefore,
              balanceAfter,
              relatedTask: task._id,
              relatedSubmission: submission._id,
              note: "Task reward released from escrow",
              processedBy: req.user._id,
            },
          ],
          { session },
        );
      }
    });

    return res.status(200).json({
      success: true,
      message:
        status === "approved"
          ? "Submission approved and reward released successfully"
          : "Submission rejected and reserved slot released successfully",
      submission: reviewedSubmission,
    });
  } catch (error) {
    console.error("Review submission error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to review submission",
    });
  } finally {
    await session.endSession();
  }
};

const getBuyerSubmissions = async (req, res) => {
  try {
    // Find all tasks created by the logged-in buyer
    const buyerTasks = await Task.find({
      advertiser: req.user._id,
    }).select("_id");

    const taskIds = buyerTasks.map((task) => task._id);

    // Find submissions belonging to those tasks
    const submissions = await TaskSubmission.find({
      task: { $in: taskIds },
    })
      .populate({
        path: "task",
        select:
          "title category rewardPerWorker totalSlots reservedSlots completedSlots status",
      })
      .populate("freelancer", "name username")
      .sort({ createdAt: -1 });

    // Add remainingSlots to each submission's task
    const formattedSubmissions = submissions.map((submission) => {
      const submissionObject = submission.toObject();

      if (submissionObject.task) {
        const task = submissionObject.task;

        submissionObject.task.remainingSlots =
          task.totalSlots -
          (task.completedSlots || 0) -
          (task.reservedSlots || 0);
      }

      return submissionObject;
    });

    return res.status(200).json({
      success: true,
      count: formattedSubmissions.length,
      submissions: formattedSubmissions,
    });
  } catch (error) {
    console.error("Get buyer submissions error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch buyer submissions",
    });
  }
};

const getBuyerSubmissionDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID",
      });
    }

    const submission = await TaskSubmission.findById(id)
      .populate({
        path: "task",
        select:
          "title description instructions category rewardPerWorker totalSlots reservedSlots completedSlots status advertiser",
      })
      .populate("freelancer", "name username");

    if (!submission || !submission.task) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    // Only the buyer who created this task can view its submission
    if (submission.task.advertiser.toString() !== req.user._id.toString()) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    const task = submission.task;

    const remainingSlots =
      task.totalSlots - (task.completedSlots || 0) - (task.reservedSlots || 0);

    return res.status(200).json({
      success: true,
      submission,
      remainingSlots,
    });
  } catch (error) {
    console.error("Get buyer submission details error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch submission details",
    });
  }
};

module.exports = {
  createTask,
  getTasks,
  getPendingTasks,
  reviewTask,
  acceptTask,
  submitProof,
  reviewSubmission,
  getBuyerSubmissions,
  getBuyerSubmissionDetails,
};
