const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'sikokar-jwt-secret-ganti-di-produksi';
const EXPIRES_IN = '1d';

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { signToken, verifyToken };
