const { canAccess } = require('../constants/roleMenus');
const { jsonErr } = require('../utils/helpers');
const { verifyToken } = require('../utils/jwt');

function extractUser(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    return verifyToken(header.slice(7));
  } catch {
    return null;
  }
}

function loginRequired(req, res, next) {
  const user = extractUser(req);
  if (!user) {
    return jsonErr(res, 'Login required', 401);
  }
  req.user = user;
  next();
}

function accessRequired(menu) {
  return (req, res, next) => {
    const user = extractUser(req);
    if (!user) {
      return jsonErr(res, 'Login required', 401);
    }
    if (!canAccess(user, menu)) {
      return jsonErr(res, 'Akses ditolak', 403);
    }
    req.user = user;
    next();
  };
}

function roleRequired(...roles) {
  return (req, res, next) => {
    const user = extractUser(req);
    if (!user) return jsonErr(res, 'Login required', 401);
    if (!roles.includes(user.role)) {
      return jsonErr(res, 'Akses ditolak', 403);
    }
    req.user = user;
    next();
  };
}

module.exports = { loginRequired, accessRequired, roleRequired, canAccess };
