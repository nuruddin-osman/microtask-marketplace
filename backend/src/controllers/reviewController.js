const mongoose = require("mongoose");
const Review = require("../models/reviewModels");
const Task = require("../models/taskModels");
const TaskSubmission = require("../models/taskSubmissionModels");
const User = require("../models/userModels");

// ==========================================
// RATE THE OTHER SIDE OF AN APPROVED SUBMISSION
// ==========================================
const rateSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment = "" } = req.body;

    const submission = await TaskSubmission.findOne({
      _id: id,
      status: "approved",
    }).lean();

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Approved submission not found",
      });
    }

    const task = await Task.findById(submission.task)
      .select("advertiser")
      .lean();

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Related task not found",
      });
    }

    const userId = req.user._id.toString();
    let reviewerRole;
    let reviewee;

    if (task.advertiser.toString() === userId) {
      reviewerRole = "buyer";
      reviewee = submission.freelancer;
    } else if (submission.freelancer.toString() === userId) {
      reviewerRole = "freelancer";
      reviewee = task.advertiser;
    } else {
      // Not part of this work: do not reveal that it exists
      return res.status(404).json({
        success: false,
        message: "Approved submission not found",
      });
    }

    if (reviewee.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot rate yourself",
      });
    }

    const review = await Review.create({
      submission: submission._id,
      task: task._id,
      reviewer: req.user._id,
      reviewee,
      reviewerRole,
      rating,
      comment: comment.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Rating submitted successfully",
      review,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already rated this submission",
      });
    }

    console.error("Rate submission error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit rating",
    });
  }
};

// ==========================================
// GET A USER'S RATING SUMMARY + REVIEWS
// ?as=freelancer  -> ratings received for work done (given by buyers)
// ?as=buyer       -> ratings received as a task owner (given by freelancers)
// ==========================================
const getUserRatings = async (req, res) => {
  try {
    const { id } = req.params;
    const { as } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 10),
    );

    const user = await User.findById(id).select("name username").lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const filter = { reviewee: user._id };

    if (as !== undefined) {
      if (!["freelancer", "buyer"].includes(as)) {
        return res.status(400).json({
          success: false,
          message: "as must be freelancer or buyer",
        });
      }
      filter.reviewerRole = as === "freelancer" ? "buyer" : "freelancer";
    }

    const [summaryRows, reviews, total] = await Promise.all([
      Review.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            average: { $avg: "$rating" },
            count: { $sum: 1 },
          },
        },
      ]),
      Review.find(filter)
        .populate("reviewer", "name username")
        .populate("task", "title")
        .select("rating comment reviewerRole reviewer task createdAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      user,
      summary: {
        average: Number((summaryRows[0]?.average || 0).toFixed(2)),
        count: summaryRows[0]?.count || 0,
      },
      total,
      page,
      totalPages: Math.ceil(total / limit),
      reviews,
    });
  } catch (error) {
    console.error("Get user ratings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch ratings",
    });
  }
};

module.exports = { rateSubmission, getUserRatings };
