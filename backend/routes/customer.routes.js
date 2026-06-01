const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, customerController.getAllCustomers);
router.get('/search', authenticateToken, customerController.searchCustomer);
router.post('/', authenticateToken, customerController.createCustomer);
router.post('/:id/settle', authenticateToken, customerController.settleCustomerCredit);
router.get('/:id/purchases', authenticateToken, customerController.getCustomerPurchaseHistory);
router.get('/:id/ledger', authenticateToken, customerController.getCustomerLedger);

module.exports = router;
