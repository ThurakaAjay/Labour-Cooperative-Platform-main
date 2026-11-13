const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
  pollId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  startsAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  endsAt: {
    type: Date,
    required: true
  },
  // Admin-controlled kill switch, independent of startsAt/endsAt — an admin
  // can close a poll early, or leave it inactive as a draft before it opens.
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

pollSchema.index({ isActive: 1, startsAt: 1, endsAt: 1 });

module.exports = mongoose.model('Poll', pollSchema);
