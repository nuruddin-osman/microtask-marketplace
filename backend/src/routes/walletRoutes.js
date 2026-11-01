const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const {
  getWalletBalance,
  getWalletTransactions,
} = require("../controllers/walletController");

router.get("/wallet/balance", protect, getWalletBalance);

router.get("/wallet/transactions", protect, getWalletTransactions);

module.exports = router;
