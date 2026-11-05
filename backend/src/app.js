require("dotenv").config();
const express = require("express");
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const walletRoutes = require("./routes/walletRoutes");
const withdrawRoutes = require("./routes/withdrawRoutes");
const disputeRoutes = require("./routes/disputeRoutes");
const freelancerRoutes = require("./routes/freelancerRoutes");

app.use("/api", authRoutes);
app.use("/api", taskRoutes);
app.use("/api", walletRoutes);
app.use("/api", withdrawRoutes);
app.use("/api", disputeRoutes);
app.use("/api", freelancerRoutes);

module.exports = app;
