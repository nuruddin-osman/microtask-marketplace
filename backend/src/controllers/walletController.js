const User = require("../models/userModels");
const WalletTransaction = require("../models/walletTransactionModels");
const { notifyUser } = require("../utils/notificationHelper");

const getWalletBalance = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      walletBalance: req.user.walletBalance,
    });
  } catch (error) {
    console.error("Get wallet balance error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get wallet balance",
    });
  }
};

const getWalletTransactions = async (req, res) => {
  try {
    const transactions = await WalletTransaction.find({
      user: req.user._id,
    })
      .populate("relatedTask", "title category rewardPerWorker")
      .populate("relatedSubmission", "status")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: transactions.length,
      transactions,
    });
  } catch (error) {
    console.error("Get wallet transactions error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get wallet transactions",
    });
  }
};

// Deposit Request Controller
const createDepositRequest = async (req, res) => {
  try {
    const { amount, paymentMethod, transactionReference, note } = req.body;

    const depositAmount = Number(amount);

    if (
      !Number.isFinite(depositAmount) ||
      depositAmount <= 0 ||
      Math.round(depositAmount * 100) !== depositAmount * 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid amount with maximum 2 decimal places",
      });
    }

    if (typeof paymentMethod !== "string" || !paymentMethod.trim()) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }

    if (
      typeof transactionReference !== "string" ||
      !transactionReference.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Transaction reference is required",
      });
    }

    const depositRequest = await WalletTransaction.create({
      user: req.user._id,
      type: "deposit",
      amount: depositAmount,
      status: "pending",
      paymentMethod: paymentMethod.trim(),
      transactionReference: transactionReference.trim(),
      note: note || "Deposit request submitted",
    });

    return res.status(201).json({
      success: true,
      message:
        "Deposit request submitted successfully. Waiting for admin approval.",
      depositRequest,
    });
  } catch (error) {
    console.error("Create deposit request error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create deposit request",
    });
  }
};

// Pending Deposit List Controller
const getPendingDeposits = async (req, res) => {
  try {
    const deposits = await WalletTransaction.find({
      type: "deposit",
      status: "pending",
    })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: deposits.length,
      deposits,
    });
  } catch (error) {
    console.error("Get pending deposits error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get pending deposits",
    });
  }
};

// Admin Deposit Review Controller
const reviewDepositRequest = async (req, res) => {
  const mongoose = require("mongoose");
  const { id } = req.params;
  const { status } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid deposit ID",
    });
  }

  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Status must be approved or rejected",
    });
  }

  const session = await mongoose.startSession();

  try {
    let reviewedDeposit;

    await session.withTransaction(async () => {
      const deposit = await WalletTransaction.findOne({
        _id: id,
        type: "deposit",
        status: "pending",
      }).session(session);

      if (!deposit) {
        const error = new Error(
          "Deposit request not found or already reviewed",
        );
        error.statusCode = 404;
        throw error;
      }

      const user = await User.findById(deposit.user).session(session);

      if (!user) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
      }

      const updateData = {
        status: status === "approved" ? "completed" : "rejected",
        processedBy: req.user._id,
      };

      // Credit wallet only when approved
      if (status === "approved") {
        const balanceBefore = user.walletBalance;
        const amount = Number(deposit.amount);

        if (
          !Number.isFinite(balanceBefore) ||
          balanceBefore < 0 ||
          !Number.isFinite(amount) ||
          amount <= 0
        ) {
          throw new Error("Invalid wallet balance or deposit amount");
        }

        const balanceAfter = Number((balanceBefore + amount).toFixed(2));

        if (!Number.isFinite(balanceAfter)) {
          throw new Error("Invalid wallet balance calculation");
        }

        user.walletBalance = balanceAfter;

        await user.save({ session });

        updateData.balanceBefore = balanceBefore;
        updateData.balanceAfter = balanceAfter;
      }

      reviewedDeposit = await WalletTransaction.findOneAndUpdate(
        {
          _id: id,
          type: "deposit",
          status: "pending",
        },
        {
          $set: updateData,
        },
        {
          new: true,
          runValidators: true,
          session,
        },
      );

      if (!reviewedDeposit) {
        const error = new Error("Deposit request has already been reviewed");
        error.statusCode = 409;
        throw error;
      }
    });

    await notifyUser({
      user: reviewedDeposit.user,
      type: status === "approved" ? "deposit_approved" : "deposit_rejected",
      title: status === "approved" ? "Deposit approved" : "Deposit rejected",
      message:
        status === "approved"
          ? `Your deposit of ${reviewedDeposit.amount} was approved and added to your wallet.`
          : `Your deposit request of ${reviewedDeposit.amount} was rejected.`,
      relatedTransaction: reviewedDeposit._id,
    });

    return res.status(200).json({
      success: true,
      message:
        status === "approved"
          ? "Deposit approved and wallet credited successfully"
          : "Deposit request rejected successfully",
      deposit: reviewedDeposit,
    });
  } catch (error) {
    console.error("Review deposit error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to review deposit",
    });
  } finally {
    await session.endSession();
  }
};

// ==========================================
// USER: GET MY DEPOSIT REQUESTS
// ==========================================
const getMyDeposits = async (req, res) => {
  try {
    const { status } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 10),
    );

    const filter = { user: req.user._id, type: "deposit" };

    if (status) {
      if (!["pending", "completed", "rejected", "cancelled"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status filter",
        });
      }
      filter.status = status;
    }

    const [deposits, total] = await Promise.all([
      WalletTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      WalletTransaction.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: deposits.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      deposits,
    });
  } catch (error) {
    console.error("Get my deposits error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get deposit history",
    });
  }
};

// ==========================================
// ADMIN: GET ALL DEPOSITS (ANY STATUS)
// ==========================================
const getAllDeposits = async (req, res) => {
  try {
    const { status } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 20),
    );

    const filter = { type: "deposit" };

    if (status) {
      if (!["pending", "completed", "rejected", "cancelled"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status filter",
        });
      }
      filter.status = status;
    }

    const [deposits, total] = await Promise.all([
      WalletTransaction.find(filter)
        .populate("user", "name email")
        .populate("processedBy", "name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      WalletTransaction.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: deposits.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      deposits,
    });
  } catch (error) {
    console.error("Get all deposits error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get deposits",
    });
  }
};

module.exports = {
  getWalletBalance,
  getWalletTransactions,
  createDepositRequest,
  getPendingDeposits,
  reviewDepositRequest,
  getMyDeposits,
  getAllDeposits,
};
