const express = require("express");
const {
  registerUser,
  loginUser,
  getMe,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.post("/auth/register", registerUser);
router.post("/auth/login", loginUser);
router.get("/auth/me", protect, getMe);
router.get(
  "/worker-dashboard",
  protect,
  authorizeRoles("worker"),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Welcome to Worker Dashboard",
      user: req.user.name,
    });
  },
);

module.exports = router;
