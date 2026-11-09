const mongoose = require("mongoose");
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

// ==========================================
// ADMIN: GET ALL USERS
// ==========================================
const getUsers = async (req, res) => {
  try {
    const { search, role, isActive } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 20),
    );

    const filter = {};

    if (role) {
      if (!["freelancer", "buyer", "admin"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role filter",
        });
      }
      filter.roles = role;
    }

    if (isActive !== undefined) {
      if (!["true", "false"].includes(isActive)) {
        return res.status(400).json({
          success: false,
          message: "isActive must be true or false",
        });
      }
      filter.isActive = isActive === "true";
    }

    if (typeof search === "string" && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [{ name: regex }, { username: regex }, { email: regex }];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: users.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      users,
    });
  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

// ==========================================
// ADMIN: GET SINGLE USER DETAILS
// ==========================================
const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await User.findById(id).select("-password").lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const [tasksCreated, submissionsMade, submissionsApproved] =
      await Promise.all([
        Task.countDocuments({ advertiser: user._id }),
        TaskSubmission.countDocuments({ freelancer: user._id }),
        TaskSubmission.countDocuments({
          freelancer: user._id,
          status: "approved",
        }),
      ]);

    return res.status(200).json({
      success: true,
      user,
      activity: {
        tasksCreated,
        submissionsMade,
        submissionsApproved,
      },
    });
  } catch (error) {
    console.error("Get user details error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user details",
    });
  }
};

// ==========================================
// ADMIN: BAN / UNBAN USER
// ==========================================
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false",
      });
    }

    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own account status",
      });
    }

    const target = await User.findById(id).select("roles");

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (target.roles.includes("admin")) {
      return res.status(403).json({
        success: false,
        message: "Admin accounts cannot be banned",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: { isActive } },
      { returnDocument: "after", runValidators: true },
    )
      .select("-password")
      .lean();

    return res.status(200).json({
      success: true,
      message: isActive
        ? "User unbanned successfully"
        : "User banned successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update user status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update user status",
    });
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  getUserDetails,
  updateUserStatus,
};
