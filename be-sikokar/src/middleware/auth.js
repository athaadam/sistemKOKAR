const { canAccess } = require('../constants/roleMenus');
const { jsonErr } = require('../utils/helpers');

function loginRequired(req, res, next) {
  if (!req.session?.user) {
    return jsonErr(res, 'Login required', 401);
  }
  next();
}

function accessRequired(menu) {
  return (req, res, next) => {
    if (!req.session?.user) {
      return jsonErr(res, 'Login required', 401);
    }
    if (!canAccess(req.session.user, menu)) {
      return jsonErr(res, 'Akses ditolak', 403);
    }
    next();
  };
}

function roleRequired(...roles) {
  return (req, res, next) => {
    if (!req.session?.user) return jsonErr(res, 'Login required', 401);
    if (!roles.includes(req.session.user.role)) {
      return jsonErr(res, 'Akses ditolak', 403);
    }
    next();
  };
}

module.exports = { loginRequired, accessRequired, roleRequired, canAccess };
