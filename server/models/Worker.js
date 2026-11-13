const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
  workerId: {
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
    required: true
  },
  skill: {
    type: String,
    required: true
  },
  skills: [{
    type: String
  }],
  avatar: {
    type: String,
    default: 'RK'
  },
  matchScore: {
    type: Number,
    default: 95
  },
  rating: {
    type: Number,
    default: 4.8,
    min: 0,
    max: 5
  },

  reviewsCount: {
    type: Number,
    default: 0
  },
  experience: {
    type: String,
    default: '5 years'
  },
  distance: {
    type: String,
    default: '1.8 km away'
  },
  priceEstimate: {
    type: String,
    default: '₹450 estimated'
  },
  availability: {
    type: String,
    default: 'Available today in 30 mins'
  },
  status: {
    type: String,
    enum: ['Verified', 'Pending', 'Suspended'],
    default: 'Pending'
  },
  // Tracks the document-review pipeline specifically (distinct from `status`,
  // which also covers admin-initiated suspension). Approving verification
  // sets both this AND status:'Verified' together; suspension only ever
  // touches `status`, leaving the verification record intact.
  verificationStatus: {
    type: String,
    enum: ['unsubmitted', 'pending', 'verified', 'rejected'],
    default: 'unsubmitted'
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  badge: {
    type: String,
    default: 'Pending Verification'
  },
  societyReg: {
    type: String,
    default: 'Coop #TN-CHE-402'
  },
  bio: {
    type: String,
    default: ''
  },
  completedJobs: {
    type: Number,
    default: 0
  },
  onTimeRate: {
    type: String,
    default: '99%'
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  locality: {
    type: String,
    default: 'Adyar, Chennai'
  },
  breakdown: {
    skillMatch: { type: String, default: '96%' },
    distanceVal: { type: String, default: '1.8 km (Nearest in Ward 4)' },
    availabilityVal: { type: String, default: '100% (Instant dispatch ready)' },
    ratingVal: { type: String, default: '4.8 / 5.0' },
    experienceVal: { type: String, default: '7 years cooperative service' }
  },
  // Verification documents (Aadhaar, trade certificate, etc.), uploaded to
  // Cloudinary. `url`/`publicId` are always server-generated from the actual
  // uploaded file — never accepted directly from a client PUT body — so a
  // document entry always corresponds to something that really exists in
  // Cloudinary.
  documents: [{
    name: { type: String, required: true },
    docType: {
      type: String,
      enum: ['id_proof', 'certificate', 'other'],
      default: 'other'
    },
    format: { type: String, enum: ['pdf', 'jpg', 'jpeg', 'png'] },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
  }],
  languages: [{ type: String }],
  // Working radius in km — a fixed set of tiers rather than a free number so
  // Smart Match can bucket workers consistently.
  serviceRadius: {
    type: Number,
    enum: [2, 5, 10, 15],
    default: null
  },
  // One entry per day, each a 3-shift boolean map. Defaults to fully
  // unavailable rather than "always on" — a worker who hasn't set a real
  // schedule yet shouldn't silently appear bookable every hour.
  weeklyAvailability: {
    type: Map,
    of: new mongoose.Schema({
      morning: { type: Boolean, default: false },
      afternoon: { type: Boolean, default: false },
      evening: { type: Boolean, default: false }
    }, { _id: false }),
    default: () => new Map()
  },
  // Derived, never client-settable (see worker.service.js#isProfileDataComplete
  // and worker.controller.js#updateWorker) — true once skills, experience,
  // languages, service radius, availability, and payment details are all set.
  isProfileComplete: {
    type: Boolean,
    default: false
  },
  // Payout onboarding. `verificationStatus` here is admin-controlled (see
  // worker.service.js#verifyPaymentDetails) — a worker can enter/edit their
  // own UPI/bank info but cannot self-certify it as verified.
  paymentDetails: {
    payoutType: { type: String, enum: ['upi', 'bank'], default: 'upi' },
    upiId: { type: String, default: '' },
    bankAccount: {
      accountNumber: { type: String, default: '' },
      ifsc: { type: String, default: '' },
      bankName: { type: String, default: '' }
    },
    verificationStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified'],
      default: 'unverified'
    }
  },
  // Accumulated 5% cooperative welfare escrow. Only ever moved server-side —
  // credited by the earnings pipeline and debited by an admin approving a
  // withdrawal claim (see cooperative.service.js#updateClaimStatus).
  welfareFundBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  // Both insurance blocks are issued/edited by an admin only
  // (worker.service.js#issueInsurance) — a worker can view but never set them.
  healthInsurance: {
    active: { type: Boolean, default: false },
    policyNumber: { type: String, default: '' },
    coverageAmount: { type: Number, default: 500000 },
    provider: { type: String, default: 'Chennai Coop Health Network' },
    issuedAt: { type: Date, default: null }
  },
  accidentCoverage: {
    active: { type: Boolean, default: false },
    policyNumber: { type: String, default: '' },
    coverageAmount: { type: Number, default: 500000 },
    provider: { type: String, default: 'Chennai Coop Health Network' },
    issuedAt: { type: Date, default: null },
    // Unlike the rest of this block, the nominee is worker-editable — see
    // worker.controller.js#updateWorker's non-admin field whitelist.
    nominee: {
      name: { type: String, default: '' },
      relation: { type: String, default: '' },
      payout: { type: String, default: '' }
    }
  }
}, {
  timestamps: true
});

// Performance Indexes for high-frequency queries and sorting
workerSchema.index({ status: 1, isOnline: 1 });
workerSchema.index({ verificationStatus: 1 });
workerSchema.index({ skill: 1 });
workerSchema.index({ rating: -1, completedJobs: -1 });

module.exports = mongoose.model('Worker', workerSchema);
