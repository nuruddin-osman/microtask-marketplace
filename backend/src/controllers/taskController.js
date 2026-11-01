const mongoose = require("mongoose");
const Task = require("../models/taskModels");
const TaskSubmission = require("../models/taskSubmissionModels");
const User = require("../models/userModels");
const WalletTransaction = require("../models/walletTransactionModels");

const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      instructions,
      category,
      rewardPerWorker,
      totalSlots,
    } = req.body || {};

    // Validate required text fields
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

    if (!Number.isFinite(reward) || reward < 0.01) {
      return res.status(400).json({
        success: false,
        message: "Reward per worker must be at least 0.01",
      });
    }

    if (!Number.isInteger(slots) || slots < 1) {
      return res.status(400).json({
        success: false,
        message: "Total slots must be a positive integer",
      });
    }

    const task = await Task.create({
      title: title.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      category: category.trim(),
      rewardPerWorker: reward,
      totalSlots: slots,
      advertiser: req.user._id,
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Task created and submitted for approval",
      task,
    });
  } catch (error) {
    console.error("Create task error:", error.message);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ status: "active" })
      .select("-__v")
      .populate("advertiser", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    console.error("Get tasks error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
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
  try {
    const { status } = req.body || {};
    const { id } = req.params;

    if (!["active", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be active or rejected",
      });
    }

    if (!require("mongoose").isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID",
      });
    }

    const task = await Task.findOneAndUpdate(
      { _id: id, status: "pending" },
      { $set: { status } },
      { new: true, runValidators: true },
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Pending task not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Task ${status === "active" ? "approved" : "rejected"} successfully`,
      task,
    });
  } catch (error) {
    console.error("Review task error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
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
      // Only active tasks with available slots can be accepted.
      const task = await Task.findOneAndUpdate(
        {
          _id: id,
          status: "active",
          $expr: { $lt: ["$completedSlots", "$totalSlots"] },
        },
        { $inc: { completedSlots: 1 } },
        { new: true, session },
      );

      if (!task) {
        const error = new Error("TASK_UNAVAILABLE");
        throw error;
      }

      const existing = await TaskSubmission.findOne({
        task: id,
        freelancer: freelancerId,
      }).session(session);

      if (existing) {
        const error = new Error("ALREADY_ACCEPTED");
        throw error;
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

    console.error("Accept task error:", error.message);

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
  const mongoose = require("mongoose");
  const { id } = req.params;
  const { status } = req.body;

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
      // Find submitted proof
      const submission = await TaskSubmission.findOne({
        _id: id,
        status: "submitted",
      }).session(session);

      if (!submission) {
        const error = new Error("Submission not found or already reviewed");
        error.statusCode = 404;
        throw error;
      }

      // Find the task
      const task = await Task.findById(submission.task).session(session);

      if (!task) {
        const error = new Error("Task not found");
        error.statusCode = 404;
        throw error;
      }

      // Only the buyer who created this task can review it
      if (task.advertiser.toString() !== req.user._id.toString()) {
        const error = new Error(
          "You are not authorized to review this submission",
        );
        error.statusCode = 403;
        throw error;
      }

      // Update submission status
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
          new: true,
          runValidators: true,
          session,
        },
      );

      if (!reviewedSubmission) {
        const error = new Error("Submission has already been reviewed");
        error.statusCode = 409;
        throw error;
      }

      // Credit freelancer wallet only when approved
      if (status === "approved") {
        const freelancer = await User.findById(submission.freelancer).session(
          session,
        );

        if (!freelancer) {
          throw new Error("Freelancer not found");
        }

        // Prevent duplicate reward
        const existingTransaction = await WalletTransaction.findOne({
          relatedSubmission: submission._id,
          type: "task_reward",
        }).session(session);

        if (existingTransaction) {
          throw new Error("Reward already credited for this submission");
        }

        const balanceBefore = freelancer.walletBalance;

        if (!Number.isFinite(balanceBefore) || balanceBefore < 0) {
          throw new Error("Invalid freelancer wallet balance");
        }

        const reward = Number(task.rewardPerWorker);

        if (!Number.isFinite(reward) || reward <= 0) {
          throw new Error("Invalid task reward amount");
        }

        const balanceAfter = Number((balanceBefore + reward).toFixed(2));

        if (!Number.isFinite(balanceAfter)) {
          throw new Error("Invalid wallet balance calculation");
        }

        freelancer.walletBalance = balanceAfter;

        await freelancer.save({ session });

        await WalletTransaction.create(
          [
            {
              user: freelancer._id,
              type: "task_reward",
              amount: reward,
              status: "completed",
              balanceBefore,
              balanceAfter,
              relatedTask: task._id,
              relatedSubmission: submission._id,
              note: "Task reward credited",
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
          ? "Submission approved and reward credited successfully"
          : "Submission rejected successfully",
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
      .populate("task", "title category rewardPerWorker")
      .populate("freelancer", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: submissions.length,
      submissions,
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

    if (!require("mongoose").isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID",
      });
    }

    // Find submission and populate related information
    const submission = await TaskSubmission.findById(id)
      .populate({
        path: "task",
        select:
          "title description instructions category rewardPerWorker totalSlots status advertiser",
      })
      .populate("freelancer", "name email");

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

    return res.status(200).json({
      success: true,
      submission,
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
