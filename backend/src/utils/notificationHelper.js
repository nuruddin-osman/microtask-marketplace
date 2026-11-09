const Notification = require("../models/notificationModels");

// Never throws: a failed notification must not break the main action.
const notifyUser = async ({
  user,
  type,
  title,
  message,
  relatedTask = null,
  relatedSubmission = null,
  relatedDispute = null,
  relatedTransaction = null,
}) => {
  try {
    if (!user) return null;

    return await Notification.create({
      user,
      type,
      title,
      message,
      relatedTask,
      relatedSubmission,
      relatedDispute,
      relatedTransaction,
    });
  } catch (error) {
    console.error("Notify user error:", error.message);
    return null;
  }
};

module.exports = { notifyUser };
