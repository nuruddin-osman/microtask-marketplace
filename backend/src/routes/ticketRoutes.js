const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const { validate, validateId } = require("../middleware/validate");
const schemas = require("../validators/schemas");
const {
  createTicket,
  getMyTickets,
  getMyTicketDetails,
  replyMyTicket,
  closeMyTicket,
  getAllTickets,
  getTicketAdmin,
  replyTicketAdmin,
  updateTicketStatus,
} = require("../controllers/ticketController");

// ---------- User ----------
router.post(
  "/support/tickets",
  protect,
  validate(schemas.createTicket),
  createTicket,
);
router.get("/support/tickets", protect, getMyTickets);
router.get(
  "/support/tickets/:id",
  protect,
  validateId("id"),
  getMyTicketDetails,
);
router.post(
  "/support/tickets/:id/messages",
  protect,
  validateId("id"),
  validate(schemas.ticketMessage),
  replyMyTicket,
);
router.patch(
  "/support/tickets/:id/close",
  protect,
  validateId("id"),
  closeMyTicket,
);

// ---------- Admin ----------
router.get(
  "/admin/support/tickets",
  protect,
  authorizeRoles("admin"),
  getAllTickets,
);
router.get(
  "/admin/support/tickets/:id",
  protect,
  authorizeRoles("admin"),
  validateId("id"),
  getTicketAdmin,
);
router.post(
  "/admin/support/tickets/:id/reply",
  protect,
  authorizeRoles("admin"),
  validateId("id"),
  validate(schemas.ticketMessage),
  replyTicketAdmin,
);
router.patch(
  "/admin/support/tickets/:id/status",
  protect,
  authorizeRoles("admin"),
  validateId("id"),
  validate(schemas.updateTicketStatus),
  updateTicketStatus,
);

module.exports = router;
