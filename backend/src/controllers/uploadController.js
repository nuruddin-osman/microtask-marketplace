// ==========================================
// FREELANCER: UPLOAD PROOF IMAGE
// ==========================================
const uploadProof = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please attach an image in the 'image' field",
      });
    }

    const baseUrl =
      process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;

    return res.status(201).json({
      success: true,
      message: "Image uploaded successfully",
      url: `${baseUrl}/uploads/proofs/${req.file.filename}`,
      size: req.file.size,
    });
  } catch (error) {
    console.error("Upload proof error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to upload image",
    });
  }
};

module.exports = { uploadProof };
