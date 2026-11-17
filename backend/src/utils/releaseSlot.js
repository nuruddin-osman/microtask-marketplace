const Task = require("../models/taskModels");
const TaskSubmission = require("../models/taskSubmissionModels");
const User = require("../models/userModels");
const WalletTransaction = require("../models/walletTransactionModels");

// Must run inside a transaction. Returns null if the submission is no longer "accepted".
const releaseAcceptedSlot = async ({ session, filter, newStatus, note }) => {
  // Atomic: only one caller can move "accepted" -> newStatus
  const submission = await TaskSubmission.findOneAndUpdate(
    { ...filter, status: "accepted" },
    { $set: { status: newStatus } },
    { returnDocument: "after", session },
  );

  if (!submission) return null;

  const task = await Task.findOneAndUpdate(
    { _id: submission.task, reservedSlots: { $gt: 0 } },
    { $inc: { reservedSlots: -1 } },
    { returnDocument: "after", session },
  );

  if (!task) {
    throw new Error("No reserved slot found for this submission");
  }

  // A cancelled task kept this slot's reward in escrow. Nobody can use it now, so refund the buyer.
  let refundAmount = 0;

  if (task.status === "cancelled") {
    refundAmount = Number(task.rewardPerWorker);

    const buyer = await User.findOneAndUpdate(
      { _id: task.advertiser },
      { $inc: { walletBalance: refundAmount } },
      { returnDocument: "after", session },
    );

    if (!buyer) throw new Error("Buyer not found");

    const balanceAfter = Number(buyer.walletBalance);
    const balanceBefore = Number((balanceAfter - refundAmount).toFixed(2));

    await WalletTransaction.create(
      [
        {
          user: buyer._id,
          type: "task_refund",
          amount: refundAmount,
          status: "completed",
          balanceBefore,
          balanceAfter,
          relatedTask: task._id,
          relatedSubmission: submission._id,
          note,
        },
      ],
      { session },
    );
  }

  return { submission, task, refundAmount };
};

module.exports = { releaseAcceptedSlot };
