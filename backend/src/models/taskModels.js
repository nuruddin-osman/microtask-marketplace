const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      minlength: 5,
      maxlength: 120,
    },

    description: {
      type: String,
      required: [true, "Task description is required"],
      trim: true,
      maxlength: 3000,
    },

    instructions: {
      type: String,
      required: [true, "Task instructions are required"],
      trim: true,
      maxlength: 5000,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    rewardPerWorker: {
      type: Number,
      required: true,
      min: 0.01,
    },

    totalSlots: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Total slots must be an integer",
      },
    },

    completedSlots: {
      type: Number,
      default: 0,
      min: 0,
    },

    advertiser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["pending", "active", "paused", "completed", "rejected"],
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

taskSchema.index({ status: 1, createdAt: -1 });

const Task = mongoose.model("Task", taskSchema);

module.exports = Task;
