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
  getMyWithdrawals,
  getAllWithdrawals,
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
  "/admin/wallet/pending-withdrawals",
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

// ?status=pending|completed|rejected&page=1&limit=10
router.get(
  "/wallet/withdrawals",
  protect,
  authorizeRoles("freelancer"),
  requireActiveMode("freelancer"),
  getMyWithdrawals,
);

router.get(
  "/admin/wallet/withdrawals/all",
  protect,
  authorizeRoles("admin"),
  getAllWithdrawals,
);

module.exports = router;
