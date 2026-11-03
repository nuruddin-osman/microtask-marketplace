const mongoose = require("mongoose");

const walletTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "deposit",
        "task_reward",
        "withdrawal",
        "task_budget",
        "task_refund",
      ],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: [0.01, "Amount must be greater than zero"],
    },

    status: {
      type: String,
      enum: ["pending", "completed", "rejected", "cancelled"],
      default: "pending",
    },

    balanceBefore: {
      type: Number,
      default: null,
    },

    balanceAfter: {
      type: Number,
      default: null,
    },

    relatedTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },

    relatedSubmission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaskSubmission",
      default: null,
    },

    paymentMethod: {
      type: String,
      default: "",
      trim: true,
    },

    paymentAccount: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },

    transactionReference: {
      type: String,
      default: "",
      trim: true,
    },

    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    feeAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    netAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

// User transaction history
walletTransactionSchema.index({
  user: 1,
  createdAt: -1,
});

// Admin pending transaction list
walletTransactionSchema.index({
  status: 1,
  createdAt: -1,
});

walletTransactionSchema.index(
  { relatedSubmission: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: "task_reward",
    },
  },
);

const WalletTransaction = mongoose.model(
  "WalletTransaction",
  walletTransactionSchema,
);

module.exports = WalletTransaction;
