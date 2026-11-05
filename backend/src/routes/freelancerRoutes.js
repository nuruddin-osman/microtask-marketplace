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
const router = express.Router();

router.use(
  protect,
  authorizeRoles("freelancer"),
  requireActiveMode("freelancer"),
);

// Available tasks
router.get("/freelancer/tasks", getFreelancerTasks);

// My submissions
router.get("/freelancer/my-submissions", getMySubmissions);
router.get("/freelancer/my-submissions/:id", getMySubmissionDetails);

// Accept a task
// router.post("/tasks/:id/accept", acceptTask);

// Submit proof
// router.post("/submissions/:id/proof", submitProof);

module.exports = router;
