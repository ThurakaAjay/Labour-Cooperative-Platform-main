const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  pollId: {
    type: String,
    required: true,
    index: true
  },
  workerId: {
    type: String,
    required: true,
    index: true
  },
  // Denormalized for admin display convenience only — never trusted as the
  // source of truth (the real worker record is looked up by workerId).
  workerName: {
    type: String,
    default: ''
  },
  choice: {
    type: String,
    enum: ['yes', 'no'],
    required: true
  }
}, {
  timestamps: true
});

// The idempotency guarantee: MongoDB enforces at most one vote per
// (pollId, workerId) pair at the database level. A second vote attempt
// fails with a duplicate-key error (E11000) rather than relying on an
// application-level "have they already voted?" read-then-write, which is
// race-prone under concurrent requests.
voteSchema.index({ pollId: 1, workerId: 1 }, { unique: true });

module.exports = mongoose.model('Vote', voteSchema);
