const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userRoles = req.user.roles || [];

    const hasPermission = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource",
      });
    }

    return next();
  };
};

// Checks the user's currently selected mode.
const requireActiveMode = (...allowedModes) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!allowedModes.includes(req.user.activeMode)) {
      return res.status(403).json({
        success: false,
        message: "Please switch to the required mode to continue",
      });
    }

    return next();
  };
};

module.exports = {
  authorizeRoles,
  requireActiveMode,
};
