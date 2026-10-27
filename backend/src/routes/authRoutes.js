const express = require("express");

const {
  registerUser,
  loginUser,
  getMe,
  switchMode,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

const {
  authorizeRoles,
  requireActiveMode,
} = require("../middleware/roleMiddleware");

const router = express.Router();

// Authentication routes
router.post("/auth/register", registerUser);
router.post("/auth/login", loginUser);
router.get("/auth/me", protect, getMe);
router.patch("/auth/switch-mode", protect, switchMode);

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
