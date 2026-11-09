const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const {
  getDashboardStats,
  getUserDetails,
  updateUserStatus,
  getUsers,
  getAllTasks,
  getAllSubmissions,
} = require("../controllers/adminController");

router.get(
  "/admin/dashboard/stats",
  protect,
  authorizeRoles("admin"),
  getDashboardStats,
);

router.get("/admin/users", protect, authorizeRoles("admin"), getUsers);

router.get(
  "/admin/users/:id",
  protect,
  authorizeRoles("admin"),
  getUserDetails,
);

router.patch(
  "/admin/users/:id/status",
  protect,
  authorizeRoles("admin"),
  updateUserStatus,
);

router.get("/admin/tasks", protect, authorizeRoles("admin"), getAllTasks);

router.get(
  "/admin/submissions",
  protect,
  authorizeRoles("admin"),
  getAllSubmissions,
);

module.exports = router;
