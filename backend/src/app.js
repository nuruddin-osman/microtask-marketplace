require("dotenv").config();
const express = require("express");
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
const path = require("path");
const uploadRoutes = require("./routes/uploadRoutes");

const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const walletRoutes = require("./routes/walletRoutes");
const withdrawRoutes = require("./routes/withdrawRoutes");
const disputeRoutes = require("./routes/disputeRoutes");
const freelancerRoutes = require("./routes/freelancerRoutes");
const adminRoutes = require("./routes/adminRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

app.use("/api", authRoutes);
app.use("/api", taskRoutes);
app.use("/api", walletRoutes);
app.use("/api", withdrawRoutes);
app.use("/api", disputeRoutes);
app.use("/api", freelancerRoutes);
app.use("/api", adminRoutes);
app.use("/api", notificationRoutes);
app.use("/api", uploadRoutes);

module.exports = app;
