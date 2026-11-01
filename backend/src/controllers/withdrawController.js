const mongoose = require("mongoose");
const User = require("../models/userModels");
const WalletTransaction = require("../models/walletTransactionModels");

const createWithdrawalRequest = async (req, res) => {
  const { amount, paymentMethod, paymentAccount } = req.body;

  const withdrawalAmount = Number(amount);

  if (
    !Number.isFinite(withdrawalAmount) ||
    withdrawalAmount <= 0 ||
    Math.round(withdrawalAmount * 100) !== withdrawalAmount * 100
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

  if (typeof paymentAccount !== "string" || !paymentAccount.trim()) {
    return res.status(400).json({
      success: false,
      message: "Payment account is required",
    });
  }

  const session = await mongoose.startSession();

  try {
    let withdrawalRequest;

    await session.withTransaction(async () => {
      // Atomically deduct amount only if balance is sufficient
      const updatedUser = await User.findOneAndUpdate(
        {
          _id: req.user._id,
          walletBalance: { $gte: withdrawalAmount },
        },
        {
          $inc: {
            walletBalance: -withdrawalAmount,
          },
        },
        {
          returnDocument: "after",
          session,
        },
      );

      if (!updatedUser) {
        const error = new Error("Insufficient wallet balance");
        error.statusCode = 400;
        throw error;
      }

      const balanceAfter = Number(updatedUser.walletBalance.toFixed(2));

      const balanceBefore = Number(
        (balanceAfter + withdrawalAmount).toFixed(2),
      );

      const [transaction] = await WalletTransaction.create(
        [
          {
            user: req.user._id,
            type: "withdrawal",
            amount: withdrawalAmount,
            status: "pending",
            balanceBefore,
            balanceAfter,
            paymentMethod: paymentMethod.trim(),
            paymentAccount: paymentAccount.trim(),
            note: "Withdrawal request submitted",
          },
        ],
        { session },
      );

      withdrawalRequest = transaction;
    });

    return res.status(201).json({
      success: true,
      message:
        "Withdrawal request submitted successfully. Waiting for admin approval.",
      withdrawalRequest,
    });
  } catch (error) {
    console.error("Create withdrawal request error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to create withdrawal request",
    });
  } finally {
    await session.endSession();
  }
};

// Admin pending withdrawal list
// @desc    Get all pending withdrawal requests
const getPendingWithdrawals = async (req, res) => {
  try {
    const withdrawals = await WalletTransaction.find({
      type: "withdrawal",
      status: "pending",
    })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: withdrawals.length,
      withdrawals,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Approve or reject withdrawal request
// @route   PATCH /api/admin/wallet/withdrawals/:id/review
// @access  Admin
const reviewWithdrawalRequest = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid withdrawal ID",
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
    let reviewedWithdrawal;

    await session.withTransaction(async () => {
      const withdrawal = await WalletTransaction.findOne({
        _id: id,
        type: "withdrawal",
        status: "pending",
      }).session(session);

      if (!withdrawal) {
        const error = new Error(
          "Pending withdrawal request not found or already reviewed",
        );
        error.statusCode = 404;
        throw error;
      }

      const user = await User.findById(withdrawal.user).session(session);

      if (!user) {
        const error = new Error("Freelancer account not found");
        error.statusCode = 404;
        throw error;
      }

      const amount = Number(withdrawal.amount);

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Invalid withdrawal amount");
      }

      const updateData = {
        status: status === "approved" ? "completed" : "rejected",
        processedBy: req.user._id,
      };

      if (status === "rejected") {
        const balanceBefore = Number(user.walletBalance);

        if (!Number.isFinite(balanceBefore) || balanceBefore < 0) {
          throw new Error("Invalid wallet balance");
        }

        const balanceAfter = Number((balanceBefore + amount).toFixed(2));

        if (!Number.isFinite(balanceAfter)) {
          throw new Error("Invalid refunded balance");
        }

        user.walletBalance = balanceAfter;
        await user.save({ session });

        updateData.balanceBefore = balanceBefore;
        updateData.balanceAfter = balanceAfter;
        updateData.note = "Withdrawal rejected; amount refunded to wallet";
      }

      reviewedWithdrawal = await WalletTransaction.findOneAndUpdate(
        {
          _id: id,
          type: "withdrawal",
          status: "pending",
        },
        { $set: updateData },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        },
      );

      if (!reviewedWithdrawal) {
        throw new Error("Withdrawal request was already reviewed");
      }
    });

    return res.status(200).json({
      success: true,
      message:
        status === "approved"
          ? "Withdrawal approved successfully"
          : "Withdrawal rejected and amount refunded successfully",
      withdrawal: reviewedWithdrawal,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};

module.exports = {
  createWithdrawalRequest,
  getPendingWithdrawals,
  reviewWithdrawalRequest,
};
