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
  pauseBuyerTask,
  resumeBuyerTask,
  getTaskDetails,
} = require("../controllers/taskController");
const schemas = require("../validators/schemas");
const { validate, validateId } = require("../middleware/validate");

const router = express.Router();

router.post(
  "/create/task",
  protect,
  authorizeRoles("buyer", "admin"),
  requireActiveMode("buyer"),
  validate(schemas.createTask),
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
  validateId("id"),
  validate(schemas.reviewTask),
  reviewTask,
);

router.post(
  "/tasks/:id/accept",
  protect,
  authorizeRoles("freelancer"),
  requireActiveMode("freelancer"),
  validateId("id"),
  acceptTask,
);

router.patch(
  "/submissions/:id/proof",
  protect,
  authorizeRoles("freelancer"),
  requireActiveMode("freelancer"),
  validateId("id"),
  validate(schemas.submitProof),
  submitProof,
);

router.patch(
  "/submissions/:id/review",
  protect,
  authorizeRoles("buyer"),
  requireActiveMode("buyer"),
  validateId("id"),
  validate(schemas.reviewSubmission),
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
  validateId("id"),
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
  validateId("id"),
  cancelBuyerTask,
);

router.get(
  "/tasks-details/:id",
  protect,
  authorizeRoles("freelancer"),
  requireActiveMode("freelancer"),
  validateId("id"),
  getTaskDetails,
);

router.patch(
  "/buyer/tasks/:id/pause",
  protect,
  authorizeRoles("buyer"),
  requireActiveMode("buyer"),
  validateId("id"),
  pauseBuyerTask,
);

router.patch(
  "/buyer/tasks/:id/resume",
  protect,
  authorizeRoles("buyer"),
  requireActiveMode("buyer"),
  validateId("id"),
  resumeBuyerTask,
);

module.exports = router;
