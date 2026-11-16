const Category = require("../models/categoryModels");

// ==========================================
// ANY USER: GET ACTIVE CATEGORIES
// ==========================================
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .select("name")
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
    });
  }
};

// ==========================================
// ADMIN: GET ALL CATEGORIES
// ==========================================
const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 }).lean();

    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Get all categories error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
    });
  }
};

// ==========================================
// ADMIN: CREATE CATEGORY
// ==========================================
const createCategory = async (req, res) => {
  try {
    const name = req.body.name.trim();

    const category = await Category.create({
      name,
      key: name.toLowerCase(),
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This category already exists",
      });
    }

    console.error("Create category error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create category",
    });
  }
};

// ==========================================
// ADMIN: RENAME / ACTIVATE / DEACTIVATE CATEGORY
// ==========================================
const updateCategory = async (req, res) => {
  try {
    const { name, isActive } = req.body;
    const updates = {};

    if (name !== undefined) {
      updates.name = name.trim();
      updates.key = name.trim().toLowerCase();
    }

    if (isActive !== undefined) {
      updates.isActive = isActive;
    }

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { returnDocument: "after", runValidators: true },
    ).lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This category already exists",
      });
    }

    console.error("Update category error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update category",
    });
  }
};

module.exports = {
  getCategories,
  getAllCategories,
  createCategory,
  updateCategory,
};
