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

module.exports = {
  getWalletBalance,
  getWalletTransactions,
};
