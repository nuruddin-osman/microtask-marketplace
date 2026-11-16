const Joi = require("joi");

const text = (max) => Joi.string().trim().max(max);
const money = Joi.number().min(0.01).max(10000000);

// ---------- Auth ----------
const register = Joi.object({
  name: Joi.string().trim().min(2).max(50).required(),
  username: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9_]{3,30}$/)
    .required()
    .messages({
      "string.pattern.base":
        "username must be 3-30 characters: letters, numbers and underscore only",
    }),
  email: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .required(),
  // bcrypt only reads the first 72 bytes
  password: Joi.string().min(6).max(72).required(),
});

const login = Joi.object({
  identifier: Joi.string().trim().min(1).max(100).required(),
  password: Joi.string().min(1).max(72).required(),
});

const switchMode = Joi.object({
  mode: Joi.string().valid("freelancer", "buyer").required(),
});

const updateProfile = Joi.object({
  name: Joi.string().trim().min(2).max(50),
  username: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9_]{3,30}$/)
    .messages({
      "string.pattern.base":
        "username must be 3-30 characters: letters, numbers and underscore only",
    }),
}).min(1);

const changePassword = Joi.object({
  currentPassword: Joi.string().min(1).max(72).required(),
  newPassword: Joi.string().min(6).max(72).required(),
});

const forgotPassword = Joi.object({
  email: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .required(),
});

const resetPassword = Joi.object({
  token: Joi.string().trim().min(10).max(200).required(),
  newPassword: Joi.string().min(6).max(72).required(),
});

// ---------- Tasks ----------
const createTask = Joi.object({
  title: Joi.string().trim().min(5).max(120).required(),
  description: text(3000).min(1).required(),
  instructions: text(5000).min(1).required(),
  category: text(50).min(1).required(),
  rewardPerWorker: money.required(),
  totalSlots: Joi.number().integer().min(1).max(100000).required(),
});

const reviewTask = Joi.object({
  status: Joi.string().valid("active", "rejected").required(),
});

const submitProof = Joi.object({
  proofText: text(5000).allow(""),
  // http/https only: blocks javascript: links
  proofUrl: Joi.string()
    .trim()
    .max(2000)
    .uri({ scheme: ["http", "https"] })
    .allow(""),
}).or("proofText", "proofUrl");

const reviewSubmission = Joi.object({
  status: Joi.string().valid("approved", "rejected").required(),
});

// ---------- Wallet ----------
const deposit = Joi.object({
  amount: money.required(),
  paymentMethod: text(50).min(1).required(),
  transactionReference: text(100).min(1).required(),
  note: text(500).allow(""),
});

const withdrawal = Joi.object({
  amount: money.required(),
  paymentMethod: text(50).min(1).required(),
  paymentAccount: text(100).min(1).required(),
});

const reviewTransaction = Joi.object({
  status: Joi.string().valid("approved", "rejected").required(),
});

// ---------- Disputes ----------
const createAppeal = Joi.object({
  reason: Joi.string()
    .valid("wrong_rejection", "incomplete_task", "other")
    .required(),
  description: text(3000).min(1).required(),
});

const reviewAppeal = Joi.object({
  decision: Joi.string().valid("accept", "reject").required(),
  adminNote: text(3000).allow(""),
});

// ---------- Admin ----------
const updateUserStatus = Joi.object({
  isActive: Joi.boolean().required(),
});

// ---------- Categories ----------
const createCategory = Joi.object({
  name: Joi.string().trim().min(2).max(50).required(),
});

const updateCategory = Joi.object({
  name: Joi.string().trim().min(2).max(50),
  isActive: Joi.boolean(),
}).min(1);

// ---------- Ratings ----------
const rateSubmission = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: text(500).allow(""),
});

// ---------- Support tickets ----------
const createTicket = Joi.object({
  subject: Joi.string().trim().min(5).max(150).required(),
  category: Joi.string()
    .valid("payment", "task", "account", "technical", "other")
    .required(),
  message: text(3000).min(1).required(),
  relatedTask: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({ "string.pattern.base": "relatedTask must be a valid ID" }),
});

const ticketMessage = Joi.object({
  message: text(3000).min(1).required(),
});

const updateTicketStatus = Joi.object({
  status: Joi.string().valid("in_progress", "resolved", "closed").required(),
});

module.exports = {
  register,
  login,
  switchMode,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  createTask,
  reviewTask,
  submitProof,
  reviewSubmission,
  deposit,
  withdrawal,
  reviewTransaction,
  createAppeal,
  reviewAppeal,
  updateUserStatus,

  createCategory,
  updateCategory,
  rateSubmission,
  createTicket,
  ticketMessage,
  updateTicketStatus,
};
