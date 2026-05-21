const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { accessRequired } = require('../middleware/auth');
const { registerRoutes } = require('../controllers/promoController');

const router = express.Router();
const deps = { asyncHandler, accessRequired };
registerRoutes(router, deps);

module.exports = router;
