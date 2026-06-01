const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const { authenticateToken, requireRoles } = require('../middleware/auth');

router.get('/ledger', authenticateToken, inventoryController.getStockLedger);
router.get('/low-stock', authenticateToken, inventoryController.getLowStockAlerts);
router.post('/stock-in', authenticateToken, inventoryController.processStockIn);
router.post('/stock-out', authenticateToken, inventoryController.processStockOut);
router.post('/transfer', authenticateToken, inventoryController.processStockTransfer);
router.post('/damage', authenticateToken, inventoryController.processDamageStock);

// Advanced stock management endpoints secured with role permissions
router.post('/adjust', authenticateToken, requireRoles('Shop Owner', 'Admin', 'Manager', 'Stock Manager'), inventoryController.processStockAdjustment);
router.post('/reconcile', authenticateToken, requireRoles('Shop Owner', 'Admin', 'Manager', 'Stock Manager'), inventoryController.processStockReconciliation);
router.get('/valuation', authenticateToken, requireRoles('Shop Owner', 'Admin', 'Manager'), inventoryController.getInventoryValuation);

module.exports = router;
