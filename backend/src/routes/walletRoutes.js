const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const {
  getWalletBalance,
  getWalletTransactions,
  createDepositRequest,
} = require("../controllers/walletController");

router.get("/wallet/balance", protect, getWalletBalance);
router.get("/wallet/transactions", protect, getWalletTransactions);
router.post("/wallet/deposit", protect, createDepositRequest);

module.exports = router;
