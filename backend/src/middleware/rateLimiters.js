const rateLimit = require("express-rate-limit");

const buildLimiter = (windowMinutes, max, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
  });

// Whole API: 300 requests per 15 minutes per IP
const apiLimiter = buildLimiter(
  15,
  300,
  "Too many requests. Please try again later.",
);

// Login/register: brute-force protection
const authLimiter = buildLimiter(
  15,
  20,
  "Too many login attempts. Please try again after 15 minutes.",
);

// Image upload: stops disk-filling
const uploadLimiter = buildLimiter(
  15,
  30,
  "Too many uploads. Please try again later.",
);

// Deposit / withdrawal requests
const walletLimiter = buildLimiter(
  15,
  30,
  "Too many wallet requests. Please try again later.",
);

module.exports = { apiLimiter, authLimiter, uploadLimiter, walletLimiter };
