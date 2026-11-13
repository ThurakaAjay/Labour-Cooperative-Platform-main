const mongoose = require('mongoose');

// Independent payment ledger, separate from the Booking document, so payment
// history/receipts survive and remain queryable even if a booking record is
// later modified — and so a re-run webhook can be de-duplicated by orderId.
const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  bookingId: {
    type: String,
    required: true,
    index: true
  },
  customerId: {
    type: String,
    default: '',
    index: true
  },
  workerId: {
    type: String,
    default: ''
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  method: {
    type: String,
    enum: ['upi', 'card', 'cash', 'razorpay'],
    default: 'razorpay'
  },
  status: {
    type: String,
    enum: ['created', 'paid', 'failed', 'refunded'],
    default: 'created'
  },
  razorpayOrderId: {
    type: String,
    default: '',
    index: true
  },
  razorpayPaymentId: {
    type: String,
    default: ''
  },
  razorpaySignature: {
    type: String,
    default: ''
  },
  failureReason: {
    type: String,
    default: ''
  },
  workerShare: {
    type: Number,
    default: 0
  },
  welfareShare: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);
