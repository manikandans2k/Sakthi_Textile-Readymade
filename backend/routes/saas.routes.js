const express = require('express');
const router = express.Router();
const saasController = require('../controllers/saas.controller');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// Protect all routes under this file: only Super Admin can access SaaS configurations
router.use(authenticateToken);
router.use(requireRoles('Super Admin'));

// SaaS Dashboards
router.get('/dashboard', saasController.getSaasDashboard);

// Tenant shop directories
router.get('/shops', saasController.getShops);
router.post('/shops', saasController.createShop);

// Shop subscriptions and active access locks
router.put('/shops/:id/status', saasController.updateShopStatus);
router.put('/shops/:id/subscription', saasController.updateShopSubscription);
router.put('/shops/:id/details', saasController.updateShopDetails);

// Tenant employee credentials control
router.post('/users/:id/reset-password', saasController.resetShopOwnerPassword);

module.exports = router;
