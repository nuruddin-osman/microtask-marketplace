const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const uploadDir = path.join(__dirname, "..", "uploads", "proofs");
fs.mkdirSync(uploadDir, { recursive: true });

// Only real image types; extension is decided by us, not by the user's file name
const ALLOWED_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const MAX_SIZE_MB = 2;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const random = crypto.randomBytes(8).toString("hex");
    cb(null, `${Date.now()}-${random}${ALLOWED_TYPES[file.mimetype]}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES[file.mimetype]) return cb(null, true);
  cb(new Error("INVALID_FILE_TYPE"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024, files: 1 },
}).single("image");

// Wrapper so upload errors return clean JSON instead of a crash
const handleProofUpload = (req, res, next) => {
  upload(req, res, (error) => {
    if (!error) return next();

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: `Image must be ${MAX_SIZE_MB}MB or smaller`,
      });
    }

    if (error.message === "INVALID_FILE_TYPE") {
      return res.status(400).json({
        success: false,
        message: "Only JPG, PNG or WEBP images are allowed",
      });
    }

    console.error("Upload error:", error.message);

    return res.status(400).json({
      success: false,
      message: "File upload failed",
    });
  });
};

module.exports = { handleProofUpload };
