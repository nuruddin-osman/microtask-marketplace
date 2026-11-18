const express = require("express");
const {
  authorizeRoles,
  requireActiveMode,
} = require("../middleware/roleMiddleware");
const { protect } = require("../middleware/authMiddleware");
const {
  getFreelancerTasks,
  getMySubmissions,
  getMySubmissionDetails,
  acceptTask,
  submitProof,
} = require("../controllers/taskController");
const { validateId } = require("../middleware/validate");
const router = express.Router();

router.use(
  "/freelancer",
  protect,
  authorizeRoles("freelancer"),
  requireActiveMode("freelancer"),
);

// Available tasks
router.get("/freelancer/tasks", getFreelancerTasks);
// GET /api/freelancer/tasks?category=Social Media&minReward=10&available=true&sort=reward_high&page=1&limit=10

// My submissions
router.get("/freelancer/my-submissions", getMySubmissions);
router.get(
  "/freelancer/my-submissions/:id",
  validateId("id"),
  getMySubmissionDetails,
);

// Accept a task
// router.post("/tasks/:id/accept", acceptTask);

// Submit proof
// router.post("/submissions/:id/proof", submitProof);

module.exports = router;
