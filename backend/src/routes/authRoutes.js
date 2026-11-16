const express = require("express");

const {
  registerUser,
  loginUser,
  getMe,
  switchMode,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

const {
  authorizeRoles,
  requireActiveMode,
} = require("../middleware/roleMiddleware");
const { validate } = require("../middleware/validate");
const schemas = require("../validators/schemas");

const router = express.Router();

// Authentication routes
router.post("/auth/register", validate(schemas.register), registerUser);
router.post("/auth/login", validate(schemas.login), loginUser);
router.get("/auth/me", protect, getMe);
router.patch(
  "/auth/switch-mode",
  protect,
  validate(schemas.switchMode),
  switchMode,
);
router.patch(
  "/auth/profile-update",
  protect,
  validate(schemas.updateProfile),
  updateProfile,
);
router.patch(
  "/auth/change-password",
  protect,
  validate(schemas.changePassword),
  changePassword,
);
router.post(
  "/auth/forgot-password",
  validate(schemas.forgotPassword),
  forgotPassword,
);
router.post(
  "/auth/reset-password",
  validate(schemas.resetPassword),
  resetPassword,
);

// Freelancer Dashboard
router.get(
  "/freelancer-dashboard",
  protect,
  authorizeRoles("freelancer"),
  requireActiveMode("freelancer"),
  (req, res) => {
    res.status(200).json({
      success: true,
      dashboard: "freelancer",
      message: "Welcome to Freelancer Dashboard",
      user: req.user.name,
      activeMode: req.user.activeMode,
    });
  },
);

// Buyer Dashboard
router.get(
  "/buyer-dashboard",
  protect,
  authorizeRoles("buyer"),
  requireActiveMode("buyer"),
  (req, res) => {
    res.status(200).json({
      success: true,
      dashboard: "buyer",
      message: "Welcome to Buyer Dashboard",
      user: req.user.name,
      activeMode: req.user.activeMode,
    });
  },
);

module.exports = router;
