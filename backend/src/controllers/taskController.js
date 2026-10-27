const Task = require("../models/taskModels");

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

module.exports = { createTask, getTasks };
