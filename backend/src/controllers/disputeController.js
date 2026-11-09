const mongoose = require("mongoose");

const Dispute = require("../models/disputeModels");
const Task = require("../models/taskModels");
const TaskSubmission = require("../models/taskSubmissionModels");
const User = require("../models/userModels");
const WalletTransaction = require("../models/walletTransactionModels");
const { notifyUser } = require("../utils/notificationHelper");

// ==========================================
// FREELANCER: CREATE APPEAL
// ==========================================
const createAppeal = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { reason, description } = req.body || {};

    if (
      !req.user.roles?.includes("freelancer") ||
      req.user.activeMode !== "freelancer"
    ) {
      return res.status(403).json({
        success: false,
        message: "Switch to Freelancer mode to create an appeal",
      });
    }

    if (!mongoose.isValidObjectId(submissionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID",
      });
    }

    const allowedReasons = ["wrong_rejection", "incomplete_task", "other"];

    if (!allowedReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appeal reason",
        allowedReasons,
      });
    }

    if (
      typeof description !== "string" ||
      !description.trim() ||
      description.trim().length > 3000
    ) {
      return res.status(400).json({
        success: false,
        message: "Description is required and must be within 3000 characters",
      });
    }

    const submission = await TaskSubmission.findOne({
      _id: submissionId,
      freelancer: req.user._id,
      status: "rejected",
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Rejected submission not found",
      });
    }

    const task = await Task.findById(submission.task);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Related task not found",
      });
    }

    const existingAppeal = await Dispute.findOne({
      submission: submission._id,
    });

    if (existingAppeal) {
      return res.status(409).json({
        success: false,
        message: "An appeal already exists for this submission",
      });
    }

    const appeal = await Dispute.create({
      task: task._id,
      submission: submission._id,
      openedBy: req.user._id,
      againstUser: task.advertiser,
      openedByRole: "freelancer",
      reason,
      description: description.trim(),
      evidence: [],
      status: "open",
    });

    await notifyUser({
      user: task.advertiser,
      type: "appeal_created",
      title: "Appeal submitted",
      message: `A freelancer appealed a rejected submission on your task "${task.title}".`,
      relatedTask: task._id,
      relatedSubmission: submission._id,
      relatedDispute: appeal._id,
    });

    return res.status(201).json({
      success: true,
      message: "Appeal submitted successfully",
      appeal,
    });
  } catch (error) {
    console.error("Create appeal error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An appeal already exists for this submission",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create appeal",
    });
  }
};

// ==========================================
// ADMIN: GET ALL APPEALS
// ==========================================
const getAppeals = async (req, res) => {
  try {
    const filter = {
      openedByRole: "freelancer",
    };

    const { status } = req.query;

    const allowedStatuses = [
      "open",
      "under_review",
      "resolved_for_buyer",
      "resolved_for_freelancer",
    ];

    if (status) {
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid appeal status",
        });
      }

      filter.status = status;
    }

    const appeals = await Dispute.find(filter)
      .populate("openedBy", "name username")
      .populate("againstUser", "name username")
      .populate("task", "title category rewardPerWorker")
      .populate("submission", "proofText proofUrl status")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: appeals.length,
      appeals,
    });
  } catch (error) {
    console.error("Get appeals error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch appeals",
    });
  }
};

// ==========================================
// ADMIN: GET SINGLE APPEAL DETAILS
// ==========================================
const getAppealDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appeal ID",
      });
    }

    const appeal = await Dispute.findOne({
      _id: id,
      openedByRole: "freelancer",
    })
      .populate("openedBy", "name username")
      .populate("againstUser", "name username")
      .populate("task")
      .populate({
        path: "submission",
        populate: [
          {
            path: "freelancer",
            select: "name username",
          },
          {
            path: "task",
            select: "title rewardPerWorker advertiser",
          },
        ],
      });

    if (!appeal) {
      return res.status(404).json({
        success: false,
        message: "Appeal not found",
      });
    }

    return res.status(200).json({
      success: true,
      appeal,
    });
  } catch (error) {
    console.error("Get appeal details error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch appeal details",
    });
  }
};

// ==========================================
// ADMIN: ACCEPT OR REJECT APPEAL
// ==========================================
const reviewAppeal = async (req, res) => {
  const { id } = req.params;
  const { decision, adminNote = "" } = req.body || {};

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid appeal ID",
    });
  }

  if (!["accept", "reject"].includes(decision)) {
    return res.status(400).json({
      success: false,
      message: "Decision must be accept or reject",
    });
  }

  if (typeof adminNote !== "string" || adminNote.trim().length > 3000) {
    return res.status(400).json({
      success: false,
      message: "Admin note must be within 3000 characters",
    });
  }

  if (!req.user.roles?.includes("admin")) {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }

  const session = await mongoose.startSession();

  try {
    let reviewedAppeal;
    let reviewedTask;
    let reviewedSubmission;
    let rewardReleased = 0;

    await session.withTransaction(async () => {
      // 1. Find an unresolved Freelancer appeal
      const appeal = await Dispute.findOne({
        _id: id,
        openedByRole: "freelancer",
        status: { $in: ["open", "under_review"] },
      }).session(session);

      if (!appeal) {
        const error = new Error("Open appeal not found or already reviewed");
        error.statusCode = 404;
        throw error;
      }

      // 2. Find the rejected submission
      const submission = await TaskSubmission.findOne({
        _id: appeal.submission,
        status: "rejected",
      }).session(session);

      if (!submission) {
        throw new Error("Rejected submission not found");
      }

      // 3. Find related task
      const task = await Task.findById(appeal.task).session(session);

      if (!task) {
        throw new Error("Related task not found");
      }

      // 4. The slot must still be reserved
      if ((task.reservedSlots || 0) < 1) {
        const error = new Error("No reserved slot found for this appeal");
        error.statusCode = 409;
        throw error;
      }

      // 5. Calculate task slot changes
      const slotChanges = {
        reservedSlots: -1,
      };

      let nextCompletedSlots = task.completedSlots || 0;

      if (decision === "accept") {
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

        // Remaining reward budget after previously approved work
        const remainingBudget = Number(
          (totalRewardBudget - (task.completedSlots || 0) * reward).toFixed(2),
        );

        if (remainingBudget < reward) {
          throw new Error("Insufficient remaining task budget");
        }

        // This appealed work is now completed
        slotChanges.completedSlots = 1;
        nextCompletedSlots += 1;
      }

      // 6. Update task slots atomically
      const taskUpdate = {
        $inc: slotChanges,
      };

      if (decision === "accept" && nextCompletedSlots >= task.totalSlots) {
        taskUpdate.$set = {
          status: "completed",
        };
      }

      reviewedTask = await Task.findOneAndUpdate(
        {
          _id: task._id,
          reservedSlots: { $gt: 0 },
          completedSlots: task.completedSlots || 0,
        },
        taskUpdate,
        {
          returnDocument: "after",
          runValidators: true,
          session,
        },
      );

      if (!reviewedTask) {
        const error = new Error("Task slot update failed");
        error.statusCode = 409;
        throw error;
      }

      // 7. If accepted, release reward to Freelancer
      if (decision === "accept") {
        const reward = Number(task.rewardPerWorker);

        // Unique task_reward index also protects against duplicate credits
        const existingReward = await WalletTransaction.findOne({
          relatedSubmission: submission._id,
          type: "task_reward",
        }).session(session);

        if (existingReward) {
          throw new Error("Reward already credited for this submission");
        }

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
              note: "Appeal accepted. Reward released from original task budget",
              processedBy: req.user._id,
            },
          ],
          { session },
        );

        // Mark submission as approved after successful appeal
        reviewedSubmission = await TaskSubmission.findOneAndUpdate(
          {
            _id: submission._id,
            status: "rejected",
          },
          {
            $set: {
              status: "approved",
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
          throw new Error("Failed to approve appealed submission");
        }

        rewardReleased = reward;
      } else {
        // Rejected appeal: submission stays rejected.
        reviewedSubmission = submission;
      }

      // 8. Resolve appeal
      reviewedAppeal = await Dispute.findOneAndUpdate(
        {
          _id: appeal._id,
          status: { $in: ["open", "under_review"] },
        },
        {
          $set: {
            status:
              decision === "accept"
                ? "resolved_for_freelancer"
                : "resolved_for_buyer",
            adminNote: adminNote.trim(),
            resolvedBy: req.user._id,
            resolvedAt: new Date(),
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        },
      );

      if (!reviewedAppeal) {
        throw new Error("Appeal review update failed");
      }
    });

    await notifyUser({
      user: reviewedAppeal.openedBy,
      type: decision === "accept" ? "appeal_accepted" : "appeal_rejected",
      title: decision === "accept" ? "Appeal accepted" : "Appeal rejected",
      message:
        decision === "accept"
          ? `Your appeal was accepted. ${rewardReleased} has been added to your wallet.`
          : "Your appeal was reviewed and rejected by the admin.",
      relatedTask: reviewedTask._id,
      relatedSubmission: reviewedSubmission._id,
      relatedDispute: reviewedAppeal._id,
    });

    await notifyUser({
      user: reviewedAppeal.againstUser,
      type: decision === "accept" ? "appeal_accepted" : "appeal_rejected",
      title: "Appeal decision",
      message:
        decision === "accept"
          ? `The admin accepted a freelancer's appeal on your task "${reviewedTask.title}".`
          : `The admin rejected a freelancer's appeal on your task "${reviewedTask.title}". Your rejection stands.`,
      relatedTask: reviewedTask._id,
      relatedSubmission: reviewedSubmission._id,
      relatedDispute: reviewedAppeal._id,
    });

    const remainingSlots =
      reviewedTask.totalSlots -
      reviewedTask.completedSlots -
      reviewedTask.reservedSlots;

    return res.status(200).json({
      success: true,
      message:
        decision === "accept"
          ? "Appeal accepted. Freelancer reward released successfully"
          : "Appeal rejected. Reserved task slot released successfully",

      appeal: reviewedAppeal,
      submission: reviewedSubmission,

      rewardReleased,

      task: {
        _id: reviewedTask._id,
        totalSlots: reviewedTask.totalSlots,
        reservedSlots: reviewedTask.reservedSlots,
        completedSlots: reviewedTask.completedSlots,
        remainingSlots,
        status: reviewedTask.status,
      },
    });
  } catch (error) {
    console.error("Review appeal error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to review appeal",
    });
  } finally {
    await session.endSession();
  }
};

module.exports = {
  createAppeal,
  getAppeals,
  getAppealDetails,
  reviewAppeal,
};
