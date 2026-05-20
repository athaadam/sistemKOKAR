const path = require('path');
const express = require('express');
const session = require('express-session');
const { ConnectSessionKnexStore } = require('connect-session-knex');
const { db } = require('./db');
const { securityHeaders } = require('./middleware/security');
const apiRoutes = require('./routes');

function createApp() {
  const app = express();
  const SESSION_MINUTES = Number(process.env.SESSION_TIMEOUT_MINUTES || 60);
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

  app.use(
    session({
      secret: process.env.SECRET_KEY || 'sikokar-v1.5-kokarsi-2025-GANTI-DI-PRODUKSI',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        maxAge: SESSION_MINUTES * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.HTTPS_ONLY === 'true',
      },
      store: new ConnectSessionKnexStore({
        knex: db,
        tableName: 'sessions',
        createTable: true,
      }),
    }),
  );

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
