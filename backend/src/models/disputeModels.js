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
      index: true,
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

    openedByRole: {
      type: String,
      enum: ["buyer", "freelancer"],
      required: true,
    },

    reason: {
      type: String,
      enum: [
        "fake_proof",
        "wrong_rejection",
        "incomplete_task",
        "fraud",
        "other",
      ],
      required: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },

    // Private evidence storage references.
    // These are storage keys, NOT public file URLs.
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

disputeSchema.index({
  submission: 1,
  status: 1,
});

disputeSchema.index({
  openedBy: 1,
  createdAt: -1,
});

const Dispute = mongoose.model("Dispute", disputeSchema);

module.exports = Dispute;
