const express = require('express');
const router = express.Router();
const PollController = require('../controllers/poll.controller');
const validate = require('../middleware/validate.middleware');
const { validateCreatePoll, validateVote } = require('../validators/poll.validator');
const { authenticate, authorizeRole } = require('../middleware/auth.middleware');

// 1. List polls (Authenticated members — workers and admins)
router.get('/', authenticate, PollController.listPolls);

// 2. Get single poll with live tallies (Authenticated members)
router.get('/:id', authenticate, PollController.getPollById);

// 3. Create a new poll (Admin Only)
router.post('/', authenticate, authorizeRole('admin'), validate(validateCreatePoll), PollController.createPoll);

// 4. Update a poll — e.g. toggle isActive, edit dates (Admin Only)
router.patch('/:id', authenticate, authorizeRole('admin'), PollController.updatePoll);

// 5. Cast a Yes/No vote (Worker Only — 1 worker = 1 vote per poll, enforced by a DB unique index)
router.post('/:id/vote', authenticate, authorizeRole('worker'), validate(validateVote), PollController.castVote);

module.exports = router;
