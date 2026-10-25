const mongoose = require("mongoose");

const connectURI = process.env.DB_URI || "mongodb://127.0.0.1:27017/microtask";

const connectDB = async () => {
  try {
    await mongoose.connect(connectURI);
    console.log("DB is Connected!");
  } catch (error) {
    console.log("DB is not Connected!", error.message);
  }
};

module.exports = connectDB;
