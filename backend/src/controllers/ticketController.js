const mongoose = require("mongoose");
const Ticket = require("../models/ticketModels");
const Task = require("../models/taskModels");

const MAX_MESSAGES = 100;
const MAX_ACTIVE_TICKETS = 5;
const STATUSES = ["open", "in_progress", "resolved", "closed"];

const getPaging = (req, defaultLimit) => ({
  page: Math.max(1, parseInt(req.query.page, 10) || 1),
  limit: Math.min(
    50,
    Math.max(1, parseInt(req.query.limit, 10) || defaultLimit),
  ),
});

// ==========================================
// USER: CREATE TICKET
// ==========================================
const createTicket = async (req, res) => {
  try {
    const { subject, category, message, relatedTask } = req.body;

    // Stop one user from flooding the support queue
    const activeCount = await Ticket.countDocuments({
      user: req.user._id,
      status: { $in: ["open", "in_progress"] },
    });

    if (activeCount >= MAX_ACTIVE_TICKETS) {
      return res.status(429).json({
        success: false,
        message: `You already have ${MAX_ACTIVE_TICKETS} active tickets. Please wait for a reply or close one.`,
      });
    }

    if (relatedTask) {
      const taskExists = await Task.exists({ _id: relatedTask });

      if (!taskExists) {
        return res.status(404).json({
          success: false,
          message: "Related task not found",
        });
      }
    }

    const ticket = await Ticket.create({
      user: req.user._id,
      subject: subject.trim(),
      category,
      relatedTask: relatedTask || null,
      messages: [
        {
          sender: req.user._id,
          senderRole: "user",
          message: message.trim(),
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Ticket created successfully",
      ticket,
    });
  } catch (error) {
    console.error("Create ticket error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create ticket",
    });
  }
};

// ==========================================
// USER: GET MY TICKETS
// ==========================================
const getMyTickets = async (req, res) => {
  try {
    const { status } = req.query;
    const { page, limit } = getPaging(req, 10);

    const filter = { user: req.user._id };

    if (status) {
      if (!STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status filter",
        });
      }
      filter.status = status;
    }

    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .select("-messages")
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Ticket.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: tickets.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      tickets,
    });
  } catch (error) {
    console.error("Get my tickets error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tickets",
    });
  }
};

// ==========================================
// USER: GET ONE OF MY TICKETS (WITH MESSAGES)
// ==========================================
const getMyTicketDetails = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({
      _id: req.params.id,
      user: req.user._id,
    })
      .populate("relatedTask", "title")
      .populate("messages.sender", "name username")
      .lean();

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    return res.status(200).json({ success: true, ticket });
  } catch (error) {
    console.error("Get ticket details error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch ticket",
    });
  }
};

// ==========================================
// USER: REPLY TO MY TICKET
// ==========================================
const replyMyTicket = async (req, res) => {
  try {
    const { id } = req.params;

    // A user reply always puts the ticket back to "open" (waiting for admin)
    const ticket = await Ticket.findOneAndUpdate(
      {
        _id: id,
        user: req.user._id,
        status: { $ne: "closed" },
        [`messages.${MAX_MESSAGES - 1}`]: { $exists: false },
      },
      {
        $push: {
          messages: {
            sender: req.user._id,
            senderRole: "user",
            message: req.body.message.trim(),
          },
        },
        $set: { status: "open" },
      },
      { returnDocument: "after" },
    ).lean();

    if (!ticket) {
      const exists = await Ticket.exists({ _id: id, user: req.user._id });

      return res.status(exists ? 409 : 404).json({
        success: false,
        message: exists
          ? "This ticket is closed or has reached the message limit"
          : "Ticket not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Reply sent",
      ticket,
    });
  } catch (error) {
    console.error("Reply ticket error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to send reply",
    });
  }
};

// ==========================================
// USER: CLOSE MY TICKET
// ==========================================
const closeMyTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user._id,
        status: { $ne: "closed" },
      },
      { $set: { status: "closed" } },
      { returnDocument: "after" },
    )
      .select("-messages")
      .lean();

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Open ticket not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Ticket closed",
      ticket,
    });
  } catch (error) {
    console.error("Close ticket error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to close ticket",
    });
  }
};

// ==========================================
// ADMIN: GET ALL TICKETS
// ==========================================
const getAllTickets = async (req, res) => {
  try {
    const { status, category, user } = req.query;
    const { page, limit } = getPaging(req, 20);

    const filter = {};

    if (status) {
      if (!STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status filter",
        });
      }
      filter.status = status;
    }

    if (category) {
      if (
        !["payment", "task", "account", "technical", "other"].includes(category)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid category filter",
        });
      }
      filter.category = category;
    }

    if (user) {
      if (!mongoose.isValidObjectId(user)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }
      filter.user = user;
    }

    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .select("-messages")
        .populate("user", "name username email")
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Ticket.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: tickets.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      tickets,
    });
  } catch (error) {
    console.error("Get all tickets error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tickets",
    });
  }
};

// ==========================================
// ADMIN: GET ONE TICKET (WITH MESSAGES)
// ==========================================
const getTicketAdmin = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate("user", "name username email")
      .populate("relatedTask", "title status")
      .populate("messages.sender", "name username")
      .lean();

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    return res.status(200).json({ success: true, ticket });
  } catch (error) {
    console.error("Get ticket admin error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch ticket",
    });
  }
};

// ==========================================
// ADMIN: REPLY TO A TICKET
// ==========================================
const replyTicketAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await Ticket.findOneAndUpdate(
      {
        _id: id,
        status: { $in: ["open", "in_progress"] },
        [`messages.${MAX_MESSAGES - 1}`]: { $exists: false },
      },
      {
        $push: {
          messages: {
            sender: req.user._id,
            senderRole: "admin",
            message: req.body.message.trim(),
          },
        },
        $set: { status: "in_progress" },
      },
      { returnDocument: "after" },
    ).lean();

    if (!ticket) {
      const existing = await Ticket.findById(id).select("status").lean();

      return res.status(existing ? 409 : 404).json({
        success: false,
        message: existing
          ? `Cannot reply: this ticket is ${existing.status} or has reached the message limit`
          : "Ticket not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Reply sent",
      ticket,
    });
  } catch (error) {
    console.error("Reply ticket admin error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to send reply",
    });
  }
};

// ==========================================
// ADMIN: CHANGE TICKET STATUS
// ==========================================
const updateTicketStatus = async (req, res) => {
  try {
    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      { $set: { status: req.body.status } },
      { returnDocument: "after" },
    )
      .select("-messages")
      .lean();

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Ticket status updated",
      ticket,
    });
  } catch (error) {
    console.error("Update ticket status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update ticket status",
    });
  }
};

module.exports = {
  createTicket,
  getMyTickets,
  getMyTicketDetails,
  replyMyTicket,
  closeMyTicket,
  getAllTickets,
  getTicketAdmin,
  replyTicketAdmin,
  updateTicketStatus,
};
