const path = require('path');
const express = require('express');
const { securityHeaders } = require('./middleware/security');
const apiRoutes = require('./routes');

function createApp() {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';

  app.set('trust proxy', 1);
  app.use(securityHeaders);
  app.use(express.json({ limit: '16mb' }));
  app.use(express.urlencoded({ extended: true, limit: '16mb' }));

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use('/uploads', express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads')));
  app.use('/api', apiRoutes);

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'be-sikokar', version: '1.5.0' }));

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
