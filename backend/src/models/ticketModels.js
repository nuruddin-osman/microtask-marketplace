const mongoose = require("mongoose");

const ticketMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    senderRole: {
      type: String,
      enum: ["user", "admin"],
      required: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const ticketSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    subject: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 150,
    },

    category: {
      type: String,
      enum: ["payment", "task", "account", "technical", "other"],
      required: true,
    },

    relatedTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },

    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
      index: true,
    },

    messages: {
      type: [ticketMessageSchema],
      default: [],
    },
  },
  { timestamps: true },
);

ticketSchema.index({ user: 1, createdAt: -1 });
ticketSchema.index({ status: 1, updatedAt: -1 });

const Ticket = mongoose.model("Ticket", ticketSchema);

module.exports = Ticket;
