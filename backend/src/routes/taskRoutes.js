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
  reviewSubmission,
  getBuyerSubmissions,
  getBuyerSubmissionDetails,
  getBuyerTasks,
  getBuyerTaskDetails,
  cancelBuyerTask,
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

router.patch(
  "/submissions/:id/review",
  protect,
  authorizeRoles("buyer"),
  requireActiveMode("buyer"),
  reviewSubmission,
);

router.get(
  "/buyer/submissions",
  protect,
  authorizeRoles("buyer"),
  requireActiveMode("buyer"),
  getBuyerSubmissions,
);

router.get(
  "/buyer/submissions/:id",
  protect,
  authorizeRoles("buyer"),
  requireActiveMode("buyer"),
  getBuyerSubmissionDetails,
);

router.get(
  "/buyer/tasks",
  protect,
  authorizeRoles("buyer"),
  requireActiveMode("buyer"),
  getBuyerTasks,
);

router.get(
  "/buyer/tasks/:id",
  protect,
  authorizeRoles("buyer"),
  requireActiveMode("buyer"),
  getBuyerTaskDetails,
);

router.patch(
  "/buyer/tasks/:id/cancel",
  protect,
  authorizeRoles("buyer"),
  requireActiveMode("buyer"),
  cancelBuyerTask,
);

module.exports = router;
