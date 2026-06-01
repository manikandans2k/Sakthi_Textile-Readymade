const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employee.controller');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// Protect all routes under this file: only Shop Owners and Admins can manage employees
router.use(authenticateToken);
router.use(requireRoles('Shop Owner', 'Admin'));

router.get('/', employeeController.getAllEmployees);
router.get('/roles', employeeController.getStaffRoles);
router.post('/', employeeController.createEmployee);
router.put('/:id', employeeController.updateEmployee);
router.post('/:id/reset-password', employeeController.resetEmployeePassword);

module.exports = router;
