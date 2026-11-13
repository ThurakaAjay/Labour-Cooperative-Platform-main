const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { geocodeAddress } = require('../utils/geocode');
const asyncHandler = require('../utils/asyncHandler');

// Nominatim's usage policy caps automated use at ~1 req/sec; this keeps the
// whole app well under that regardless of how many users are geocoding.
const geocodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many geocoding requests. Please slow down.' }
});

// GET /api/geo/geocode?address=... — proxies OpenStreetMap Nominatim so the
// browser never calls a third party directly (keeps the required identifying
// User-Agent server-side, and avoids CORS/policy issues per client).
router.get('/geocode', geocodeLimiter, asyncHandler(async (req, res) => {
  const { address } = req.query;
  if (!address || !address.trim()) {
    return res.status(400).json({ success: false, message: 'address query parameter is required.' });
  }

  const resolved = await geocodeAddress(address);
  if (!resolved) {
    return res.status(404).json({ success: false, message: 'Could not resolve coordinates for that address.' });
  }

  return res.json({ success: true, data: resolved });
}));

module.exports = router;
