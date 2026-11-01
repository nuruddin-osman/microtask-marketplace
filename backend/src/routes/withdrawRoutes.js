const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  authorizeRoles,
  requireActiveMode,
} = require("../middleware/roleMiddleware");
const {
  createWithdrawalRequest,
  reviewWithdrawalRequest,
  getPendingWithdrawals,
} = require("../controllers/withdrawController");

router.post(
  "/wallet/withdrawal",
  protect,
  authorizeRoles("freelancer"),
  requireActiveMode("freelancer"),
  createWithdrawalRequest,
);

// Admin: Get pending withdrawal requests
router.get(
  "/admin/wallet/withdrawals",
  protect,
  authorizeRoles("admin"),
  getPendingWithdrawals,
);

// Admin: Approve or reject withdrawal
router.patch(
  "/admin/wallet/withdrawals/:id/review",
  protect,
  authorizeRoles("admin"),
  reviewWithdrawalRequest,
);

module.exports = router;
