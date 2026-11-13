const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  complaintId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  complainantId: {
    type: String,
    index: true
  },
  complainant: {
    type: String,
    required: true
  },
  complainantRole: {
    type: String,
    enum: ['Customer', 'Worker', 'Admin'],
    default: 'Customer'
  },
  complainantPhone: {
    type: String,
    default: ''
  },
  againstId: {
    type: String,
    index: true
  },
  against: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  date: {
    type: String,
    default: () => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  },
  status: {
    type: String,
    enum: ['Open', 'Investigating', 'Resolved'],
    default: 'Open'
  },
  description: {
    type: String,
    required: true
  },
  bookingId: {
    type: String,
    default: ''
  },
  resolutionNotes: {
    type: String,
    default: ''
  },
  // Evidence photos — always server-generated from an actual uploaded file
  // (see complaint.controller.js#uploadPhoto), same pattern as
  // Booking.photos and Worker.documents. Never accepted directly in the
  // complaint-creation body.
  photos: [{
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
    uploadedBy: { type: String, enum: ['Customer', 'Worker', 'Admin'], default: 'Customer' },
    uploadedAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Complaint', complaintSchema);
