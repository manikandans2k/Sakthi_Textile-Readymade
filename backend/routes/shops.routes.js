const express = require('express');
const router = express.Router();
const shopsController = require('../controllers/shops.controller');
const { authenticateToken } = require('../middleware/auth');

// Allow authenticated users to fetch their own shop info; Super Admins may fetch any shop.
router.get('/:id', authenticateToken, shopsController.getShopById);
router.put('/:id/gst', authenticateToken, shopsController.updateShopGst);

module.exports = router;
