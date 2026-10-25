const express = require("express");
const { registerUser } = require("../controllers/authController");

const router = express.Router();

router.post("/auth/register", registerUser);

module.exports = router;
