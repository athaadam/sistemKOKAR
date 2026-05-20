const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { registerRoutes } = require('../controllers/authController');

const router = express.Router();
const deps = { asyncHandler };
registerRoutes(router, deps);

module.exports = router;
