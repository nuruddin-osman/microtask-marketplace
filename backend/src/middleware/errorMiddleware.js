// 404: no route matched
const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

// Global error handler: must have 4 arguments
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Invalid JSON body
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON in request body",
    });
  }

  // Body too large
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Request body is too large",
    });
  }

  // Blocked by CORS
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "This origin is not allowed",
    });
  }

  console.error("Unhandled error:", err);

  return res.status(err.statusCode || err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error",
  });
};

module.exports = { notFound, errorHandler };
