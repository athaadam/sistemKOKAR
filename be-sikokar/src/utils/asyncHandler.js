const { jsonErr } = require('./helpers');

/**
 * Wraps async route handlers so rejected promises reach the error middleware.
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      if (res.headersSent) return next(err);
      return jsonErr(res, err.message || 'Internal server error', 500);
    });
  };
}

module.exports = asyncHandler;
