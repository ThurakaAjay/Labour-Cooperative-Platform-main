const express = require('express');
const router = express.Router();
const ComplaintController = require('../controllers/complaint.controller');
const validate = require('../middleware/validate.middleware');
const { validateCreateComplaint } = require('../validators/complaint.validator');
const { authenticate, authorizeRole } = require('../middleware/auth.middleware');
const { handleUpload } = require('../middleware/upload.middleware');

// Enforce authentication on all complaint/grievance handling
router.use(authenticate);

// 1. Fetch grievances with role-based scoping (Admin sees all; Members see their own)
router.get('/', ComplaintController.getComplaints);

// 2. File a new grievance (Authenticated complainant)
router.post('/', validate(validateCreateComplaint), ComplaintController.createComplaint);

// 3. Attach an evidence photo (Complainant or Admin)
router.post('/:id/photos', handleUpload, ComplaintController.uploadPhoto);

// 4. Update status / resolve / escalate to suspension (Admin Only)
router.put('/:id', authorizeRole('admin'), ComplaintController.updateComplaint);

module.exports = router;
