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
  getMyDeposits,
  getAllDeposits,
} = require("../controllers/walletController");
const { validate, validateId } = require("../middleware/validate");
const schemas = require("../validators/schemas");

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
  validateId("id"),
  validate(schemas.reviewTransaction),
  reviewDepositRequest,
);

router.get(
  "/wallet/deposits",
  protect,
  validate(schemas.deposit),
  getMyDeposits,
);

router.get(
  "/admin/wallet/deposits/all",
  protect,
  authorizeRoles("admin"),
  getAllDeposits,
);

module.exports = router;
