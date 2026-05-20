const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { accessRequired, loginRequired, roleRequired } = require('../middleware/auth');
const { registerRoutes } = require('../controllers/refOptionController');

const router = express.Router();
const deps = { asyncHandler, loginRequired };
registerRoutes(router, deps);

module.exports = router;
