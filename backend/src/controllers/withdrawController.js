const mongoose = require("mongoose");
const User = require("../models/userModels");
const WalletTransaction = require("../models/walletTransactionModels");

const WITHDRAWAL_FEE_PERCENT = 3;

// Calculate money using integer cents to avoid floating-point errors.
const toCents = (amount) => Math.round(Number(amount) * 100);
const fromCents = (cents) => Number((cents / 100).toFixed(2));

const calculateWithdrawal = (amount) => {
  const grossCents = toCents(amount);
  const feeCents = Math.round((grossCents * WITHDRAWAL_FEE_PERCENT) / 100);
  const netCents = grossCents - feeCents;

  return {
    grossAmount: fromCents(grossCents),
    feeAmount: fromCents(feeCents),
    netAmount: fromCents(netCents),
  };
};

// Freelancer: Create withdrawal request
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

  const { grossAmount, feeAmount, netAmount } =
    calculateWithdrawal(withdrawalAmount);

  const session = await mongoose.startSession();

  try {
    let withdrawalRequest;

    await session.withTransaction(async () => {
      // Reserve the full gross withdrawal amount.
      const updatedUser = await User.findOneAndUpdate(
        {
          _id: req.user._id,
          walletBalance: { $gte: grossAmount },
        },
        {
          $inc: {
            walletBalance: -grossAmount,
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
      const balanceBefore = Number((balanceAfter + grossAmount).toFixed(2));

      const [transaction] = await WalletTransaction.create(
        [
          {
            user: req.user._id,
            type: "withdrawal",
            amount: grossAmount,
            feeAmount,
            netAmount,
            status: "pending",
            balanceBefore,
            balanceAfter,
            paymentMethod: paymentMethod.trim(),
            paymentAccount: paymentAccount.trim(),
            note: "Withdrawal request submitted. 3% fee will apply if approved.",
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
      calculation: {
        grossAmount,
        feePercent: WITHDRAWAL_FEE_PERCENT,
        feeAmount,
        netAmount,
      },
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

// Admin: Get pending withdrawal requests
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

// Admin: Approve or reject withdrawal request
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
    let calculation;

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

      if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        Math.round(amount * 100) !== amount * 100
      ) {
        throw new Error("Invalid withdrawal amount");
      }

      calculation = calculateWithdrawal(amount);

      const updateData = {
        status: status === "approved" ? "completed" : "rejected",
        processedBy: req.user._id,
      };

      if (status === "approved") {
        // The gross amount was already reserved at request time.
        // Admin approval confirms the net payout and applies the fee.
        updateData.feeAmount = calculation.feeAmount;
        updateData.netAmount = calculation.netAmount;
        updateData.note = "Withdrawal approved. 3% withdrawal fee applied.";
      } else {
        // Rejection: refund the full gross amount. No fee is charged.
        const balanceBefore = Number(user.walletBalance);

        if (!Number.isFinite(balanceBefore) || balanceBefore < 0) {
          throw new Error("Invalid wallet balance");
        }

        const balanceAfter = Number(
          (balanceBefore + calculation.grossAmount).toFixed(2),
        );

        if (!Number.isFinite(balanceAfter)) {
          throw new Error("Invalid refunded balance");
        }

        user.walletBalance = balanceAfter;
        await user.save({ session });

        updateData.balanceBefore = balanceBefore;
        updateData.balanceAfter = balanceAfter;
        updateData.feeAmount = 0;
        updateData.netAmount = 0;
        updateData.note =
          "Withdrawal rejected; full amount refunded. No fee charged.";
      }

      reviewedWithdrawal = await WalletTransaction.findOneAndUpdate(
        {
          _id: id,
          type: "withdrawal",
          status: "pending",
        },
        {
          $set: updateData,
        },
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
          : "Withdrawal rejected and full amount refunded successfully",
      withdrawal: reviewedWithdrawal,
      calculation:
        status === "approved"
          ? {
              grossAmount: calculation.grossAmount,
              feePercent: WITHDRAWAL_FEE_PERCENT,
              feeAmount: calculation.feeAmount,
              netAmount: calculation.netAmount,
            }
          : {
              grossAmount: calculation.grossAmount,
              feeAmount: 0,
              refundedAmount: calculation.grossAmount,
            },
    });
  } catch (error) {
    console.error("Review withdrawal request error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to review withdrawal request",
    });
  } finally {
    await session.endSession();
  }
};

// ==========================================
// USER: GET MY WITHDRAWAL REQUESTS
// ==========================================
const getMyWithdrawals = async (req, res) => {
  try {
    const { status } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 10),
    );

    const filter = { user: req.user._id, type: "withdrawal" };

    if (status) {
      if (!["pending", "completed", "rejected", "cancelled"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status filter",
        });
      }
      filter.status = status;
    }

    const [withdrawals, total] = await Promise.all([
      WalletTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      WalletTransaction.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: withdrawals.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      withdrawals,
    });
  } catch (error) {
    console.error("Get my withdrawals error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get withdrawal history",
    });
  }
};

// ==========================================
// ADMIN: GET ALL WITHDRAWALS (ANY STATUS)
// ==========================================
const getAllWithdrawals = async (req, res) => {
  try {
    const { status } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 20),
    );

    const filter = { type: "withdrawal" };

    if (status) {
      if (!["pending", "completed", "rejected", "cancelled"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status filter",
        });
      }
      filter.status = status;
    }

    const [withdrawals, total] = await Promise.all([
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
      count: withdrawals.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      withdrawals,
    });
  } catch (error) {
    console.error("Get all withdrawals error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get withdrawals",
    });
  }
};

module.exports = {
  createWithdrawalRequest,
  getPendingWithdrawals,
  reviewWithdrawalRequest,
  getMyWithdrawals,
  getAllWithdrawals,
};
