const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const { validate, validateId } = require("../middleware/validate");
const schemas = require("../validators/schemas");
const {
  getCategories,
  getAllCategories,
  createCategory,
  updateCategory,
} = require("../controllers/categoryController");

router.get("/all/categories", protect, getCategories);

router.get(
  "/admin/categories",
  protect,
  authorizeRoles("admin"),
  getAllCategories,
);

router.post(
  "/admin/create/categories",
  protect,
  authorizeRoles("admin"),
  validate(schemas.createCategory),
  createCategory,
);

router.patch(
  "/admin/categories/:id",
  protect,
  authorizeRoles("admin"),
  validateId("id"),
  validate(schemas.updateCategory),
  updateCategory,
);

module.exports = router;
