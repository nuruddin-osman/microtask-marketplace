const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  authorizeRoles,
  requireActiveMode,
} = require("../middleware/roleMiddleware");
const { createTask, getTasks } = require("../controllers/taskController");

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

module.exports = router;
