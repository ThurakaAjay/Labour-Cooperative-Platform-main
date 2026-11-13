const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { DEFAULT_LOCALITY, DEFAULT_SOCIETY_ID } = require('../config/constants');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    index: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    select: false // Exclude from query projections by default for security
  },
  role: {
    type: String,
    enum: ['customer', 'worker', 'admin'],
    default: 'customer',
    required: true
  },
  locality: {
    type: String,
    default: DEFAULT_LOCALITY
  },
  societyId: {
    type: String,
    default: DEFAULT_SOCIETY_ID
  },
  skill: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Active', 'Verified', 'Pending', 'Suspended'],
    default: 'Active'
  },
  avatar: {
    type: String,
    default: 'U'
  },
  userCategory: {
    type: String,
    enum: ['household', 'institution', 'worker', 'officer'],
    default: 'household'
  }
}, {
  timestamps: true
});

// Pre-save hook: Hash password with bcrypt before saving to database
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method: Compare candidate password with stored bcrypt hash
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password || !candidatePassword) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Ensure password is never exposed in JSON serialization
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    return ret;
  }
});

// Performance and integrity indexes
userSchema.index({ role: 1 });
userSchema.index({ phone: 1, role: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
