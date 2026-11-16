const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const options = {
  abortEarly: false,
  stripUnknown: true, // unknown fields (e.g. "roles", "walletBalance") are dropped
  errors: { wrap: { label: false } },
};

// Validates req.body; the cleaned body replaces req.body
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body || {}, options);

  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
      errors: error.details.map((d) => d.message),
    });
  }

  req.body = value;
  return next();
};

// Validates URL params like :id as MongoDB ObjectIds
const validateId =
  (...names) =>
  (req, res, next) => {
    for (const name of names) {
      if (!OBJECT_ID.test(String(req.params[name] || ""))) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${name}`,
        });
      }
    }
    return next();
  };

module.exports = { validate, validateId };
