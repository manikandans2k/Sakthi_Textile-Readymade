const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// Secure all analytical endpoints behind Token Auth and Admin/Manager/Shop Owner Role validation
router.get('/sales', authenticateToken, requireRoles('Shop Owner', 'Admin', 'Manager'), reportController.getSalesReport);
router.get('/gst', authenticateToken, requireRoles('Shop Owner', 'Admin', 'Manager'), reportController.getGstReport);
router.get('/stock', authenticateToken, requireRoles('Shop Owner', 'Admin', 'Manager'), reportController.getStockReport);
router.get('/profit', authenticateToken, requireRoles('Shop Owner', 'Admin', 'Manager'), reportController.getProfitAnalysis);
router.get('/movement', authenticateToken, requireRoles('Shop Owner', 'Admin', 'Manager'), reportController.getInventoryMovement);
router.get('/cashiers', authenticateToken, requireRoles('Shop Owner', 'Admin', 'Manager'), reportController.getCashierPerformance);
router.get('/customers', authenticateToken, requireRoles('Shop Owner', 'Admin', 'Manager'), reportController.getCustomerAnalytics);

module.exports = router;
