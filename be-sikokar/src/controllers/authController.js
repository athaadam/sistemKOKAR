const bcrypt = require('bcryptjs');
const { Q, X } = require('../db');
const { getSetting } = require('../utils/settings');
const { nowStr, jsonOk, jsonErr } = require('../utils/helpers');
const { ROLE_LABELS, canAccess } = require('../constants/roleMenus');
const { signToken } = require('../utils/jwt');
const { loginRequired } = require('../middleware/auth');

const loginAttempts = new Map();

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.ip || '127.0.0.1';
}

function checkRateLimit(ip, maxAttempts = 5, windowSec = 300) {
  const now = Date.now();
  const attempts = (loginAttempts.get(ip) || []).filter((t) => now - t < windowSec * 1000);
  loginAttempts.set(ip, attempts);
  return attempts.length < maxAttempts;
}

function recordFailedLogin(ip) {
  const list = loginAttempts.get(ip) || [];
  list.push(Date.now());
  loginAttempts.set(ip, list);
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

function registerRoutes(router, deps) {
  const { asyncHandler } = deps;

router.get('/login', (req, res) => {
  return jsonOk(res, { user: null });
});

router.post('/login', asyncHandler(async (req, res) => {
  try {
    const u = String(req.body.username || '').trim();
    const p = req.body.password || '';
    const user = await Q('SELECT * FROM users WHERE username=? AND aktif=1', [u], true);
    const ip = clientIp(req);

    const wl = (await getSetting('ip_whitelist', ''))
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (user && ['admin', 'pengurus'].includes(user.role) && wl.length && !wl.includes(ip)) {
      return jsonErr(res, 'Akses admin ditolak: IP tidak masuk whitelist', 403);
    }

    if (!checkRateLimit(ip)) {
      return jsonErr(res, 'Terlalu banyak percobaan login. Coba lagi dalam 5 menit.', 429);
    }

    if (user && (await bcrypt.compare(p, user.password))) {
      const changed = user.password_changed_at || user.created_at || nowStr();
      const expDays = Number(await getSetting('password_expiry_days', '90')) || 0;
      if (expDays > 0) {
        try {
          const expDate = new Date(changed.slice(0, 10));
          expDate.setDate(expDate.getDate() + expDays);
          if (expDate < new Date()) {
            return jsonErr(
              res,
              'Password sudah melewati masa berlaku. Silakan minta admin reset password.',
              403,
            );
          }
        } catch {
          /* ignore parse */
        }
      }

      clearLoginAttempts(ip);
      const userObj = { ...user };
      delete userObj.password;

      const token = signToken({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        custom_menus: user.custom_menus,
        lokasi_id: user.lokasi_id,
      });

      await X(
        'UPDATE users SET last_login=?, last_login_ip=?, failed_attempts=0 WHERE id=?',
        [nowStr(), ip, user.id],
      );

      return jsonOk(res, { token, user: userObj }, `Selamat datang, ${user.name}!`);
    }

    if (user) {
      await X('UPDATE users SET failed_attempts=COALESCE(failed_attempts,0)+1 WHERE id=?', [
        user.id,
      ]);
    }
    recordFailedLogin(ip);
    return jsonErr(res, 'Username atau password salah', 401);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/logout', (_req, res) => {
  jsonOk(res, {}, 'Logout berhasil');
});

router.get('/me', loginRequired, (req, res) => {
  return jsonOk(res, {
    user: req.user,
    ROLE_LABELS,
    canAccess: (menu) => canAccess(req.user, menu),
  });
});
}

module.exports = { registerRoutes };
