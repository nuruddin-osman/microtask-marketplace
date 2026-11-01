const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const {
  getWalletBalance,
  getWalletTransactions,
  createDepositRequest,
  getPendingDeposits,
  reviewDepositRequest,
} = require("../controllers/walletController");

router.get("/wallet/balance", protect, getWalletBalance);
router.get("/wallet/transactions", protect, getWalletTransactions);
router.post("/wallet/deposit", protect, createDepositRequest);
router.get(
  "/admin/wallet/deposits",
  protect,
  authorizeRoles("admin"),
  getPendingDeposits,
);

router.patch(
  "/admin/wallet/deposits/:id/review",
  protect,
  authorizeRoles("admin"),
  reviewDepositRequest,
);

module.exports = router;
