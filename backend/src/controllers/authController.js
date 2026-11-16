require("dotenv").config();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/userModels");
const { sendEmail } = require("../utils/sendEmail");

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

// ==========================================
// UPDATE MY PROFILE
// ==========================================
const updateProfile = async (req, res) => {
  try {
    const { name, username } = req.body || {};

    const updates = {};

    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        name.trim().length < 2 ||
        name.trim().length > 50
      ) {
        return res.status(400).json({
          success: false,
          message: "Name must be between 2 and 50 characters",
        });
      }
      updates.name = name.trim();
    }

    if (username !== undefined) {
      if (typeof username !== "string") {
        return res.status(400).json({
          success: false,
          message: "Invalid username",
        });
      }

      const normalizedUsername = username.trim().toLowerCase();

      if (!/^[a-z0-9_]{3,30}$/.test(normalizedUsername)) {
        return res.status(400).json({
          success: false,
          message:
            "Username must be 3-30 characters: letters, numbers and underscore only",
        });
      }

      if (normalizedUsername !== req.user.username) {
        const taken = await User.findOne({
          username: normalizedUsername,
          _id: { $ne: req.user._id },
        }).select("_id");

        if (taken) {
          return res.status(409).json({
            success: false,
            message: "Username already taken",
          });
        }

        updates.username = normalizedUsername;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update: name or username",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { returnDocument: "after", runValidators: true },
    );

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
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
        message: "Username already taken",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Update profile error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ==========================================
// CHANGE MY PASSWORD
// ==========================================
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (
      typeof currentPassword !== "string" ||
      !currentPassword ||
      typeof newPassword !== "string" ||
      !newPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from the current password",
      });
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();
    await user.save();

    // Old tokens are now invalid, so give this device a fresh one
    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
      token,
    });
  } catch (error) {
    console.error("Change password error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ==========================================
// FORGOT PASSWORD: SEND RESET LINK
// ==========================================
const forgotPassword = async (req, res) => {
  // Same response whether the email exists or not (prevents email guessing)
  const genericResponse = {
    success: true,
    message:
      "If an account exists with this email, a password reset link has been sent.",
  };

  try {
    const { email } = req.body || {};

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user || !user.isActive) {
      return res.status(200).json(genericResponse);
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetToken: hashedToken,
          passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000),
        },
      },
    );

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    try {
      await sendEmail({
        to: user.email,
        subject: "Password reset request",
        text: `Hello ${user.name},\n\nUse this link to reset your password (valid for 15 minutes):\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
        html: `<p>Hello ${user.name},</p>
<p>Click the button below to reset your password. This link is valid for <b>15 minutes</b>.</p>
<p><a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Reset Password</a></p>
<p>If the button does not work, copy this link:<br>${resetUrl}</p>
<p>If you did not request this, you can safely ignore this email.</p>`,
      });
    } catch (mailError) {
      // Email failed: remove the token so it cannot be used
      await User.updateOne(
        { _id: user._id },
        { $unset: { passwordResetToken: "", passwordResetExpires: "" } },
      );

      console.error("Send reset email error:", mailError.message);

      return res.status(500).json({
        success: false,
        message: "Failed to send reset email. Please try again later.",
      });
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error("Forgot password error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ==========================================
// RESET PASSWORD: USING THE EMAILED TOKEN
// ==========================================
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};

    if (
      typeof token !== "string" ||
      !token ||
      typeof newPassword !== "string" ||
      !newPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "Token and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Atomic: token can be used only once
    const user = await User.findOneAndUpdate(
      {
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: new Date() },
      },
      {
        $set: { password: hashedPassword, passwordChangedAt: new Date() },
        $unset: { passwordResetToken: "", passwordResetExpires: "" },
      },
      { returnDocument: "after" },
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Reset link is invalid or has expired",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password reset successful. You can now log in.",
    });
  } catch (error) {
    console.error("Reset password error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  switchMode,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
};
