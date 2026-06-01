const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouse.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, warehouseController.getAllWarehouses);
router.post('/', authenticateToken, warehouseController.createWarehouse);
router.get('/:id/stock', authenticateToken, warehouseController.getWarehouseStock);

module.exports = router;
