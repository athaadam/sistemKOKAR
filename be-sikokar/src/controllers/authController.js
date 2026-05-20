const bcrypt = require('bcryptjs');
const { Q, X } = require('../db');
const { getSetting } = require('../utils/settings');
const { nowStr, jsonOk, jsonErr } = require('../utils/helpers');
const { ROLE_LABELS } = require('../constants/roleMenus');
const { canAccess } = require('../middleware/auth');

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
  router.get('/', (_req, res) => {
  if (res.req.session?.user) return res.redirect('/api/dashboard');
  return res.redirect('/api/auth/login');
});

router.get('/login', (req, res) => {
  if (req.session.user) return jsonOk(res, { user: req.session.user });
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
      req.session.user = { ...user };
      delete req.session.user.password;

      const timeout = Number(await getSetting('session_timeout_minutes', '60')) || 60;
      req.session.cookie.maxAge = timeout * 60 * 1000;

      await X(
        'UPDATE users SET last_login=?, last_login_ip=?, failed_attempts=0 WHERE id=?',
        [nowStr(), ip, user.id],
      );

      return jsonOk(res, { user: req.session.user }, `Selamat datang, ${user.name}!`);
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

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    jsonOk(res, {}, 'Logout berhasil');
  });
});

router.get('/me', (req, res) => {
  if (!req.session.user) return jsonErr(res, 'Not authenticated', 401);
  return jsonOk(res, {
    user: req.session.user,
    ROLE_LABELS,
    canAccess: (menu) => canAccess(req.session.user, menu),
  });
});
}

module.exports = { registerRoutes };
