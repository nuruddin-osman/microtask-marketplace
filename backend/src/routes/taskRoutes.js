const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  authorizeRoles,
  requireActiveMode,
} = require("../middleware/roleMiddleware");
const {
  createTask,
  getTasks,
  reviewTask,
  getPendingTasks,
  acceptTask,
  submitProof,
} = require("../controllers/taskController");

const router = express.Router();

router.post(
  "/create/task",
  protect,
  authorizeRoles("buyer", "admin"),
  requireActiveMode("buyer"),
  createTask,
);
// Get available tasks — Freelancer mode
router.get(
  "/get/tasks",
  protect,
  authorizeRoles("freelancer"),
  requireActiveMode("freelancer"),
  getTasks,
);

// Admin: View pending tasks
router.get(
  "/admin/tasks/pending",
  protect,
  authorizeRoles("admin"),
  getPendingTasks,
);

// Admin: Approve or reject a pending task
router.patch(
  "/admin/tasks/:id/review",
  protect,
  authorizeRoles("admin"),
  reviewTask,
);

router.post(
  "/tasks/:id/accept",
  protect,
  authorizeRoles("freelancer"),
  requireActiveMode("freelancer"),
  acceptTask,
);

router.patch(
  "/submissions/:id/proof",
  protect,
  authorizeRoles("freelancer"),
  requireActiveMode("freelancer"),
  submitProof,
);

module.exports = router;
