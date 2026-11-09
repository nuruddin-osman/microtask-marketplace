const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const {
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getNotifications,
} = require("../controllers/notificationController");

router.get("/notifications", protect, getNotifications);
router.get("/notifications/unread-count", protect, getUnreadCount);
router.patch("/notifications/read-all", protect, markAllAsRead);
router.patch("/notifications/:id/read", protect, markAsRead);

module.exports = router;
