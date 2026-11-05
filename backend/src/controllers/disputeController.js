const mongoose = require("mongoose");

const Dispute = require("../models/disputeModels");
const Task = require("../models/taskModels");
const TaskSubmission = require("../models/taskSubmissionModels");

const createDispute = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { reason, description } = req.body || {};

    // 1. Validate submission ID
    if (!mongoose.isValidObjectId(submissionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID",
      });
    }

    // 2. Validate description
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

    // 3. Find submission
    const submission = await TaskSubmission.findById(submissionId);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    // 4. Find related task
    const task = await Task.findById(submission.task);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const userId = req.user._id.toString();
    const roles = req.user.roles || [];
    const activeMode = req.user.activeMode;

    let openedByRole;
    let againstUser;
    let allowedReasons = [];

    // 5. Buyer dispute
    if (roles.includes("buyer") && activeMode === "buyer") {
      // Only the task owner can dispute
      if (task.advertiser.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: "You are not the owner of this task",
        });
      }

      // Buyer can dispute an approved submission
      if (submission.status !== "approved") {
        return res.status(400).json({
          success: false,
          message: "Buyer can dispute only approved submissions",
        });
      }

      openedByRole = "buyer";
      againstUser = submission.freelancer;

      allowedReasons = ["fake_proof", "fraud", "other"];
    }

    // 6. Freelancer appeal
    else if (roles.includes("freelancer") && activeMode === "freelancer") {
      // Only the freelancer who submitted the proof can appeal
      if (submission.freelancer.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: "You are not the owner of this submission",
        });
      }

      // Freelancer can appeal a rejected submission
      if (submission.status !== "rejected") {
        return res.status(400).json({
          success: false,
          message: "Freelancer can appeal only rejected submissions",
        });
      }

      openedByRole = "freelancer";
      againstUser = task.advertiser;

      allowedReasons = ["wrong_rejection", "incomplete_task", "other"];
    } else {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to create a dispute",
      });
    }

    // 7. Validate reason according to user role
    if (!allowedReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: "Invalid dispute reason for your role",
        allowedReasons,
      });
    }

    // 8. Prevent duplicate dispute
    const existingDispute = await Dispute.findOne({
      submission: submission._id,
    });

    if (existingDispute) {
      return res.status(409).json({
        success: false,
        message: "A dispute already exists for this submission",
      });
    }

    // 9. Create dispute
    const dispute = await Dispute.create({
      task: task._id,
      submission: submission._id,
      openedBy: req.user._id,
      againstUser,
      openedByRole,
      reason,
      description: description.trim(),
      evidence: [],
    });

    return res.status(201).json({
      success: true,
      message: "Dispute created successfully",
      dispute,
    });
  } catch (error) {
    console.error("Create dispute error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A dispute already exists for this submission",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create dispute",
    });
  }
};

module.exports = {
  createDispute,
};
