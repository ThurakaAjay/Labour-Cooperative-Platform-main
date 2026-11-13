const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  claimId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  recipient: {
    type: String,
    required: true
  },
  workerId: {
    type: String,
    required: true,
    index: true
  },
  workerName: {
    type: String,
    default: ''
  },
  amount: {
    type: String,
    required: true
  },
  amountNum: {
    type: Number,
    required: true
  },
  date: {
    type: String,
    default: () => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  },
  status: {
    type: String,
    enum: ['Pending Review', 'Approved', 'Disbursed', 'Settled', 'Rejected'],
    default: 'Pending Review'
  },
  category: {
    type: String,
    default: 'Medical & Accident'
  },
  details: {
    type: String,
    default: ''
  },
  // Set once a 'welfare_withdrawal' category claim has actually moved money
  // out of the worker's welfareFundBalance, so re-saving the same status
  // (or moving between Approved/Disbursed/Settled) never double-deducts.
  disbursed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('WelfareClaim', claimSchema);
