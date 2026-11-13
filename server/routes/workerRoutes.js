const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const WorkerController = require('../controllers/worker.controller');
const validate = require('../middleware/validate.middleware');
const { validateCreateWorker, validateReviewVerification } = require('../validators/worker.validator');
const { authenticate, authorizeRole } = require('../middleware/auth.middleware');
const { handleDocumentUpload } = require('../middleware/verificationUpload.middleware');

// This endpoint is intentionally left unauthenticated: the worker onboarding
// flow (client/src/apps/worker/pages/registration/WorkerRegistrationFlow.jsx)
// calls it before a session/token exists. Rate-limit it instead to blunt
// anonymous spam into the public worker directory.
const createWorkerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many worker registration attempts from this IP. Please try again later.' }
});

// 1. Fetch all workers with optional search, skill, and status filtering (Public directory)
router.get('/', WorkerController.getWorkers);

// 1a. Self-service welfare/insurance/payout snapshot (must be registered
// before GET /:id so 'welfare' isn't swallowed as a worker id)
router.get('/welfare', authenticate, WorkerController.getWelfare);

// 1b. Cooperative economics stats, mirrored at /api/cooperative/stats
router.get('/cooperative', WorkerController.getCooperative);

// 2. Fetch single worker by workerId or MongoDB _id (Public profile)
router.get('/:id', WorkerController.getWorkerById);

// 3. Create / Register a new worker
router.post('/', createWorkerLimiter, validate(validateCreateWorker), WorkerController.createWorker);

// 4. Update worker details / online toggle (Authenticated self or Admin).
// PATCH is an alias of PUT — both are the same partial merge-update.
router.put('/:id', authenticate, WorkerController.updateWorker);
router.patch('/:id', authenticate, WorkerController.updateWorker);

// 5. Upload verification documents (Authenticated self or Admin)
router.post('/:id/documents', authenticate, handleDocumentUpload, WorkerController.uploadDocuments);

// 6. Approve / reject a worker's verification documents (Admin Only)
router.put('/:id/verify', authenticate, authorizeRole('admin'), validate(validateReviewVerification), WorkerController.reviewVerification);

// 6a. Issue / update cooperative health & accident insurance (Admin Only)
router.put('/:id/insurance', authenticate, authorizeRole('admin'), WorkerController.issueInsurance);

// 6b. Manually credit/debit a worker's welfare fund balance (Admin Only)
router.put('/:id/welfare-balance', authenticate, authorizeRole('admin'), WorkerController.adjustWelfareBalance);

// 6c. Mark a worker's declared payout (UPI/bank) details verified (Admin Only)
router.put('/:id/payment-verification', authenticate, authorizeRole('admin'), WorkerController.verifyPaymentDetails);

// 7. Remove / Suspend worker (Admin Only)
router.delete('/:id', authenticate, authorizeRole('admin'), WorkerController.deleteWorker);

module.exports = router;
