const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { createDispute } = require("../controllers/disputeController");

router.post("/disputes/:submissionId", protect, createDispute);

module.exports = router;
