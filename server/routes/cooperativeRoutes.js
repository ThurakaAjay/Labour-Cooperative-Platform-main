const express = require('express');
const router = express.Router();
const CooperativeController = require('../controllers/cooperative.controller');
const { authenticate, authorizeRole } = require('../middleware/auth.middleware');

// 1. Summary metrics for audited society pool (Public Transparency)
router.get('/stats', CooperativeController.getStats);

// Democratic voting moved to /api/polls (see routes/pollRoutes.js) — a
// dedicated Poll/Vote schema with a DB-level unique index for one-worker-
// one-vote idempotency, rather than an array-embedded voters list here.

// 2. Fetch welfare & insurance claims log (Role-Scoped: Worker sees own, Admin sees all)
router.get('/claims', authenticate, CooperativeController.getClaims);

// 3. Submit welfare / subsidy claim (Worker & Admin)
router.post('/claims', authenticate, authorizeRole('worker', 'admin'), CooperativeController.createClaim);

// 4. Approve / Settle / Reject welfare claim (Admin Only)
router.put('/claims/:id', authenticate, authorizeRole('admin'), CooperativeController.updateClaimStatus);

module.exports = router;
