const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const {
  authorizeRoles,
  requireActiveMode,
} = require("../middleware/roleMiddleware");
const { handleProofUpload } = require("../middleware/uploadMiddleware");
const { uploadProof } = require("../controllers/uploadController");

router.post(
  "/uploads/proof",
  protect,
  authorizeRoles("freelancer"),
  requireActiveMode("freelancer"),
  handleProofUpload,
  uploadProof,
);

module.exports = router;
