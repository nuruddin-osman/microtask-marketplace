const mongoose = require("mongoose");

const taskSubmissionSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },

    freelancer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    proofText: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    proofUrl: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    status: {
      type: String,
      enum: ["accepted", "submitted", "approved", "rejected"],
      default: "accepted",
      index: true,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// A Freelancer same Task- maximum one time participated।
taskSubmissionSchema.index({ task: 1, freelancer: 1 }, { unique: true });

const TaskSubmission = mongoose.model("TaskSubmission", taskSubmissionSchema);

module.exports = TaskSubmission;
