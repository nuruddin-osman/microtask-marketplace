const User = require("../models/userModels");
const Task = require("../models/taskModels");
const TaskSubmission = require("../models/taskSubmissionModels");
const WalletTransaction = require("../models/walletTransactionModels");
const Dispute = require("../models/disputeModels");

// Convert an array of { _id, count } into an object with default zeros
const toCountMap = (rows, keys) => {
  const result = {};
  keys.forEach((key) => {
    result[key] = 0;
  });
  rows.forEach((row) => {
    result[row._id] = row.count;
  });
  return result;
};

// ==========================================
// ADMIN: DASHBOARD STATS
// ==========================================
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      taskStatusRows,
      submissionStatusRows,
      disputeStatusRows,
      depositRows,
      withdrawalRows,
      budgetRows,
      rewardRows,
      walletRows,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isActive: true }),

      Task.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),

      TaskSubmission.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      Dispute.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),

      WalletTransaction.aggregate([
        { $match: { type: "deposit" } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            amount: { $sum: "$amount" },
          },
        },
      ]),

      WalletTransaction.aggregate([
        { $match: { type: "withdrawal" } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            amount: { $sum: "$amount" },
            fee: { $sum: "$feeAmount" },
          },
        },
      ]),

      // Total money buyers have spent on tasks (reward + 5% fee)
      WalletTransaction.aggregate([
        { $match: { type: "task_budget", status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      // Total reward paid to freelancers
      WalletTransaction.aggregate([
        { $match: { type: "task_reward", status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      // Total money currently inside all user wallets
      User.aggregate([
        { $group: { _id: null, total: { $sum: "$walletBalance" } } },
      ]),
    ]);

    const tasks = toCountMap(taskStatusRows, [
      "pending",
      "active",
      "paused",
      "completed",
      "rejected",
      "cancelled",
    ]);

    const submissions = toCountMap(submissionStatusRows, [
      "accepted",
      "submitted",
      "approved",
      "rejected",
    ]);

    const appeals = toCountMap(disputeStatusRows, [
      "open",
      "under_review",
      "resolved_for_buyer",
      "resolved_for_freelancer",
    ]);

    const depositMap = {};
    depositRows.forEach((row) => {
      depositMap[row._id] = row;
    });

    const withdrawalMap = {};
    withdrawalRows.forEach((row) => {
      withdrawalMap[row._id] = row;
    });

    const round = (value) => Number(Number(value || 0).toFixed(2));

    return res.status(200).json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers,
        },

        tasks: {
          total: Object.values(tasks).reduce((sum, n) => sum + n, 0),
          ...tasks,
        },

        submissions: {
          total: Object.values(submissions).reduce((sum, n) => sum + n, 0),
          ...submissions,
        },

        appeals: {
          total: Object.values(appeals).reduce((sum, n) => sum + n, 0),
          pending: appeals.open + appeals.under_review,
          ...appeals,
        },

        deposits: {
          pendingCount: depositMap.pending?.count || 0,
          pendingAmount: round(depositMap.pending?.amount),
          approvedCount: depositMap.completed?.count || 0,
          approvedAmount: round(depositMap.completed?.amount),
          rejectedCount: depositMap.rejected?.count || 0,
        },

        withdrawals: {
          pendingCount: withdrawalMap.pending?.count || 0,
          pendingAmount: round(withdrawalMap.pending?.amount),
          approvedCount: withdrawalMap.completed?.count || 0,
          approvedAmount: round(withdrawalMap.completed?.amount),
          rejectedCount: withdrawalMap.rejected?.count || 0,
        },

        revenue: {
          // 5% fee on tasks. Calculated from task_budget minus rewards budgeted.
          // See note below: this is the fee collected from all non-refunded tasks.
          withdrawalFeesCollected: round(withdrawalMap.completed?.fee),
          totalTaskSpending: round(budgetRows[0]?.total),
          totalRewardsPaid: round(rewardRows[0]?.total),
        },

        wallets: {
          totalBalanceInSystem: round(walletRows[0]?.total),
        },
      },
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
    });
  }
};

module.exports = {
  getDashboardStats,
};
