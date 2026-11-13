const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/admin.controller');
const validate = require('../middleware/validate.middleware');
const { validateUpdateStatus } = require('../validators/admin.validator');
const { authenticate, authorizeRole } = require('../middleware/auth.middleware');

// Apply authentication and admin role authorization to ALL admin routes.
// This is the `verifyAdmin`/`checkRole` guard: every route below is
// unreachable by a non-admin, and by an anonymous caller, full stop.
router.use(authenticate);
router.use(authorizeRole('admin'));

// 1. Live primary admin dashboard telemetry
router.get(['/stats', '/metrics'], AdminController.getMetrics);

// 2. Get all registered customers (with booking history)
router.get('/customers', AdminController.getCustomers);

// 3. Get the full worker roster (all verification/status states, with booking history)
router.get('/workers', AdminController.getWorkers);

// 4. Toggle a user's (and linked worker's) active/suspended status
router.put('/users/:id/status', validate(validateUpdateStatus), AdminController.updateUserStatus);

// 5. Clean slate re-seed for presentation runs (Protected)
router.post('/reset-demo', AdminController.resetDemo);

module.exports = router;
