require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/userModels");

const registerUser = async (req, res) => {
  try {
    const { name, username, email, password } = req.body || {};

    if (!name || !email || !password || !username) {
      return res.status(400).json({
        success: false,
        message: "Name, username, email and password are required",
      });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Username or Email already taken",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Public registration always creates a freelancer account.

    const user = await User.create({
      name: name.trim(),
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
      roles: ["freelancer", "buyer"],
      activeMode: "freelancer",
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        roles: user.roles,
        activeMode: user.activeMode,
        walletBalance: user.walletBalance,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { identifier, password } = req.body || {};

    if (
      typeof identifier !== "string" ||
      !identifier.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedIdentifier = identifier.trim().toLowerCase();

    const user = await User.findOne({
      $or: [
        { email: normalizedIdentifier },
        { username: normalizedIdentifier },
      ],
    }).select("+password");

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive",
      });
    }

    // Ensure the account has at least one valid mode.
    if (!user.roles || user.roles.length === 0) {
      return res.status(403).json({
        success: false,
        message: "No account role is configured",
      });
    }

    // Repair an invalid active mode only when the user has a valid role.
    if (!user.roles.includes(user.activeMode)) {
      user.activeMode = user.roles.includes("freelancer")
        ? "freelancer"
        : user.roles.includes("buyer")
          ? "buyer"
          : "freelancer";

      await user.save();
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        roles: user.roles,
        activeMode: user.activeMode,
        walletBalance: user.walletBalance,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      roles: req.user.roles,
      activeMode: req.user.activeMode,
      walletBalance: req.user.walletBalance,
      isActive: req.user.isActive,
    },
  });
};

const switchMode = async (req, res) => {
  try {
    const { mode } = req.body || {};

    if (!["freelancer", "buyer"].includes(mode)) {
      return res.status(400).json({
        success: false,
        message: "Mode must be freelancer or buyer",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User not found or account inactive",
      });
    }

    if (!user.roles.includes(mode)) {
      return res.status(403).json({
        success: false,
        message: `You do not have access to ${mode} mode`,
      });
    }

    user.activeMode = mode;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `Switched to ${mode} mode successfully`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        activeMode: user.activeMode,
        walletBalance: user.walletBalance,
      },
    });
  } catch (error) {
    console.error("Switch mode error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = { registerUser, loginUser, getMe, switchMode };
