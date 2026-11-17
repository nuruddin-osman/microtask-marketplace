const cron = require("node-cron");
const mongoose = require("mongoose");
const TaskSubmission = require("../models/taskSubmissionModels");
const { releaseAcceptedSlot } = require("../utils/releaseSlot");
const { notifyUser } = require("../utils/notificationHelper");

let running = false;

const expireOverdueSubmissions = async () => {
  const overdue = await TaskSubmission.find({
    status: "accepted",
    deadline: { $lte: new Date() },
  })
    .select("_id")
    .limit(200)
    .lean();

  for (const item of overdue) {
    const session = await mongoose.startSession();

    try {
      let result = null;

      await session.withTransaction(async () => {
        // The status check inside makes this safe even if two servers run the job
        result = await releaseAcceptedSlot({
          session,
          filter: { _id: item._id, deadline: { $lte: new Date() } },
          newStatus: "expired",
          note: "Freelancer deadline expired on a cancelled task; slot reward refunded",
        });
      });

      if (result) {
        await notifyUser({
          user: result.submission.freelancer,
          type: "submission_expired",
          title: "Task time expired",
          message: `You did not submit proof for "${result.task.title}" in time, so the slot was released.`,
          relatedTask: result.task._id,
          relatedSubmission: result.submission._id,
        });
      }
    } catch (error) {
      console.error("Expire submission error:", item._id, error.message);
    } finally {
      await session.endSession();
    }
  }
};

const startExpiryJob = () => {
  // Every 10 minutes
  cron.schedule("*/10 * * * *", async () => {
    if (running) return; // skip if the previous run is still going
    running = true;

    try {
      await expireOverdueSubmissions();
    } catch (error) {
      console.error("Expiry job error:", error.message);
    } finally {
      running = false;
    }
  });

  console.log("Submission expiry job started");
};

module.exports = { startExpiryJob };
