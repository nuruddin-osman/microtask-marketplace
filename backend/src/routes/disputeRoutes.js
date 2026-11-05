const express = require("express");
const router = express.Router();

const {
  createAppeal,
  getAppeals,
  getAppealDetails,
  reviewAppeal,
} = require("../controllers/disputeController");
const { protect } = require("../middleware/authMiddleware");
const {
  authorizeRoles,
  requireActiveMode,
} = require("../middleware/roleMiddleware");

// Freelancer: Create Appeal
router.post(
  "/disputes/:submissionId",
  protect,
  authorizeRoles("freelancer"),
  requireActiveMode("freelancer"),
  createAppeal,
);

// Admin: Get All Appeals
router.get("/admin/appeals", protect, authorizeRoles("admin"), getAppeals);

// Admin: Get Single Appeal
router.get(
  "/admin/appeals/:id",
  protect,
  authorizeRoles("admin"),
  getAppealDetails,
);

// Admin: Accept or Reject Appeal
router.patch(
  "/admin/appeals/:id/review",
  protect,
  authorizeRoles("admin"),
  reviewAppeal,
);

module.exports = router;
