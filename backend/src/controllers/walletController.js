const WalletTransaction = require("../models/walletTransactionModels");

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

module.exports = {
  getWalletBalance,
  getWalletTransactions,
  createDepositRequest,
};
