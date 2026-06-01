const express = require('express');
const router = express.Router();
const barcodeController = require('../controllers/barcode.controller');
const { authenticateToken } = require('../middleware/auth');

router.post('/validate', authenticateToken, barcodeController.validateBarcode);
router.post('/generate', authenticateToken, barcodeController.generateBarcodeData);

module.exports = router;
