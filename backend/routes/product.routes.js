const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { authenticateToken, requireRoles } = require('../middleware/auth');

router.get('/', authenticateToken, productController.getAllProducts);
router.get('/barcode/:barcode', authenticateToken, productController.getProductByBarcode);
router.post('/', authenticateToken, requireRoles('Shop Owner', 'Admin'), productController.createProduct);
router.put('/:id', authenticateToken, requireRoles('Shop Owner', 'Admin'), productController.updateProduct);
router.delete('/:id', authenticateToken, requireRoles('Shop Owner', 'Admin'), productController.deleteProduct);

module.exports = router;
