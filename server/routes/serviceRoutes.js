const express = require('express');
const router = express.Router();
const ServiceController = require('../controllers/service.controller');
const validate = require('../middleware/validate.middleware');
const { validateCreateService } = require('../validators/service.validator');
const { authenticate, authorizeRole } = require('../middleware/auth.middleware');

// 1. Fetch all services with optional category or keyword filtering (Public)
router.get('/', ServiceController.getServices);

// 2. Fetch single service by ID (Public)
router.get('/:id', ServiceController.getServiceById);

// 3. Create or upsert a service (Admin Only)
router.post('/', authenticate, authorizeRole('admin'), validate(validateCreateService), ServiceController.createOrUpsertService);

// 4. Update an existing service (Admin Only)
router.put('/:id', authenticate, authorizeRole('admin'), ServiceController.updateService);

// 5. Delete a service from catalog (Admin Only)
router.delete('/:id', authenticate, authorizeRole('admin'), ServiceController.deleteService);

module.exports = router;
