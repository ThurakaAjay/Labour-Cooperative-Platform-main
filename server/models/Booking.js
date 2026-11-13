const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  customerName: {
    type: String,
    required: true
  },
  customerId: {
    type: String,
    default: ''
  },
  customerPhone: {
    type: String,
    required: true
  },
  customerAddress: {
    type: String,
    required: true
  },
  serviceCategory: {
    type: String,
    required: true
  },
  serviceDetails: {
    type: String,
    default: ''
  },
  workerId: {
    type: String,
    required: true
  },
  workerName: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'on_the_way', 'arrived', 'working', 'in_progress', 'completed', 'paid', 'rated', 'cancelled'],
    default: 'pending'
  },

  isLocationSharing: {
    type: Boolean,
    default: false
  },
  isEmergency: {
    type: Boolean,
    default: false
  },
  arrivalPin: {
    type: String,
    default: () => {
      const crypto = require('crypto');
      return String(crypto.randomInt(1000, 9999));
    }
  },
  pinVerifiedAt: {
    type: Date,
    default: null
  },
  pinAttempts: {
    type: Number,
    default: 0
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  // Photos attached by the customer (issue evidence) and/or the worker
  // (proof of completion), stored as secure Cloudinary URLs.
  photos: [{
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
    uploadedBy: { type: String, enum: ['customer', 'worker'], default: 'customer' },
    uploadedAt: { type: Date, default: Date.now }
  }],
  // Geocoded coordinates for customerAddress, resolved server-side so map
  // views can drop a real pin instead of a hardcoded illustrative location.
  location: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    formattedAddress: { type: String, default: '' },
    geocodedAt: { type: Date, default: null }
  },
  // Confirmed appointment time once a reschedule proposal is accepted.
  scheduledFor: {
    type: Date,
    default: null
  },
  // Worker-proposed alternative availability window, and the customer's
  // response to it (accepting a specific slot within that window, or cancelling).
  reschedule: {
    status: {
      type: String,
      enum: ['none', 'pending', 'accepted', 'rejected'],
      default: 'none'
    },
    windowStart: { type: Date, default: null },
    windowEnd: { type: Date, default: null },
    reason: { type: String, default: '' },
    proposedBy: { type: String, default: '' },
    selectedStart: { type: Date, default: null },
    selectedEnd: { type: Date, default: null },
    respondedAt: { type: Date, default: null }
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  feedback: {
    type: String,
    default: ''
  },
  paymentMethod: {
    type: String,
    default: 'upi'
  },
  payment: {
    status: {
      type: String,
      enum: ['unpaid', 'created', 'paid', 'failed'],
      default: 'unpaid'
    },
    orderId: { type: String, default: '' },
    paymentId: { type: String, default: '' },
    amountPaid: { type: Number, default: 0 },
    paidAt: { type: Date, default: null },
    // Set when a customer cancels a booking that was already paid for.
    // 'pending' until a gateway refund is confirmed (or manually settled by
    // the cooperative office when no gateway is configured).
    refundStatus: {
      type: String,
      enum: ['none', 'pending', 'refunded', 'failed'],
      default: 'none'
    },
    refundedAt: { type: Date, default: null }
  },
  // Populated when the customer cancels the booking themselves (as opposed
  // to a worker rejection or a reschedule-decline cancellation).
  cancellationDetails: {
    reason: { type: String, default: '' },
    cancelledBy: { type: String, default: '' },
    cancelledAt: { type: Date, default: null }
  },
  dateString: {
    type: String,
    default: () => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }
}, {
  timestamps: true
});

// Performance Indexes for high-frequency queries
bookingSchema.index({ workerId: 1, createdAt: -1 });
bookingSchema.index({ customerPhone: 1, createdAt: -1 });
bookingSchema.index({ customerId: 1, createdAt: -1 });
bookingSchema.index({ status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
