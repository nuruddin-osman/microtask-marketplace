const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { validate, validateId } = require("../middleware/validate");
const schemas = require("../validators/schemas");
const {
  rateSubmission,
  getUserRatings,
} = require("../controllers/reviewController");

router.post(
  "/submissions/:id/rating",
  protect,
  validateId("id"),
  validate(schemas.rateSubmission),
  rateSubmission,
);

router.get("/users/:id/ratings", protect, validateId("id"), getUserRatings);

module.exports = router;
