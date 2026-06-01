const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { authenticateToken, requireRoles } = require('../middleware/auth');

router.get('/stats', authenticateToken, requireRoles('Shop Owner', 'Admin', 'Manager'), dashboardController.getStats);

module.exports = router;
