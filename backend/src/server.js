require("dotenv").config();
const app = require("./app");
const PORT = process.env.PORT || 5000;
const connectDB = require("./config/db");
const cors = require("cors");
const helmet = require("helmet");

// Global middleware
app.use(helmet());
app.use(cors());

// Health check
app.use("/api/v1/health", (req, res) => {
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
