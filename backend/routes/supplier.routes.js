const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplier.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, supplierController.getAllSuppliers);
router.post('/', authenticateToken, supplierController.createSupplier);
router.get('/:id/ledger', authenticateToken, supplierController.getSupplierLedger);
router.post('/:id/pay', authenticateToken, supplierController.paySupplierCredit);
router.post('/:id/invoice', authenticateToken, supplierController.receiveConsignmentInvoice);

module.exports = router;
