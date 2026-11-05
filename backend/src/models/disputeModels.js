const mongoose = require("mongoose");

const disputeSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },

    submission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaskSubmission",
      required: true,
    },

    openedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    againstUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Only Freelancer can open an appeal.
    openedByRole: {
      type: String,
      enum: ["freelancer"],
      default: "freelancer",
      required: true,
    },

    reason: {
      type: String,
      enum: ["wrong_rejection", "incomplete_task", "other"],
      required: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },

    // Private storage references; file upload is not implemented yet.
    evidence: [
      {
        storageKey: {
          type: String,
          required: true,
        },
        originalName: {
          type: String,
          required: true,
        },
        mimeType: {
          type: String,
          required: true,
        },
        size: {
          type: Number,
          required: true,
        },
      },
    ],

    status: {
      type: String,
      enum: [
        "open",
        "under_review",
        "resolved_for_buyer",
        "resolved_for_freelancer",
      ],
      default: "open",
      index: true,
    },

    adminNote: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },

    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// One appeal per submission, including resolved appeals.
disputeSchema.index({ submission: 1 }, { unique: true });

disputeSchema.index({ status: 1, createdAt: -1 });
disputeSchema.index({ openedBy: 1, createdAt: -1 });

const Dispute = mongoose.model("Dispute", disputeSchema);

module.exports = Dispute;
