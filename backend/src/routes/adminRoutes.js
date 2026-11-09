const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const { getDashboardStats } = require("../controllers/adminController");

router.get(
  "/admin/dashboard/stats",
  protect,
  authorizeRoles("admin"),
  getDashboardStats,
);

module.exports = router;
