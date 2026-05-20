const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { accessRequired, loginRequired, roleRequired } = require('../middleware/auth');
const { registerRoutes } = require('../controllers/settingController');

const router = express.Router();
const deps = { asyncHandler, accessRequired, roleRequired };
registerRoutes(router, deps);

module.exports = router;
