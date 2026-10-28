const mongoose = require("mongoose");
const Task = require("../models/taskModels");
const TaskSubmission = require("../models/taskSubmissionModels");

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

module.exports = {
  createTask,
  getTasks,
  getPendingTasks,
  reviewTask,
  acceptTask,
};
