require("dotenv").config();
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

const {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  walletLimiter,
} = require("./middleware/rateLimiters");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

// Needed when running behind a proxy (Render, Railway, Nginx, etc.)
// so rate limiting sees the real user IP. Remove if running without a proxy.
app.set("trust proxy", 1);

// Security headers.
// crossOriginResourcePolicy is relaxed so frontend on another domain can show uploaded images.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// CORS: set ALLOWED_ORIGINS in .env, e.g. https://yoursite.com,http://localhost:3000
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow tools without an Origin header (Postman, mobile apps, server-to-server)
      if (!origin) return callback(null, true);

      // If ALLOWED_ORIGINS is empty, allow all (development only)
      if (allowedOrigins.length === 0) return callback(null, true);

      if (allowedOrigins.includes(origin)) return callback(null, true);

      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Rate limits (specific ones first, then the general one)
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
app.use("/api/uploads", uploadLimiter);
app.use("/api/wallet/deposit", walletLimiter);
app.use("/api/wallet/withdrawal", walletLimiter);
app.use("/api", apiLimiter);

const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const walletRoutes = require("./routes/walletRoutes");
const withdrawRoutes = require("./routes/withdrawRoutes");
const disputeRoutes = require("./routes/disputeRoutes");
const freelancerRoutes = require("./routes/freelancerRoutes");
const adminRoutes = require("./routes/adminRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const uploadRoutes = require("./routes/uploadRoutes");

app.use("/api", authRoutes);
app.use("/api", taskRoutes);
app.use("/api", walletRoutes);
app.use("/api", withdrawRoutes);
app.use("/api", disputeRoutes);
app.use("/api", freelancerRoutes);
app.use("/api", adminRoutes);
app.use("/api", notificationRoutes);
app.use("/api", uploadRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
