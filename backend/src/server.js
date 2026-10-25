require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const app = express();

const PORT = process.env.PORT || 5000;

const connectDB = require("./config/db");

// Global middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Microtask Marketplace API is running",
  });
});

connectDB();
// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
