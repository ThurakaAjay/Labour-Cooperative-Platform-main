// One-off manual smoke test for the new booking workflow endpoints
// (accept/reject/reschedule/verify-pin/photos) and payment config.
// Run with: node scripts/smokeTestNewFeatures.js (server must be running on PORT env or 5099)
const axios = require('axios');

const PORT = process.env.PORT || 5099;
const BASE = `http://localhost:${PORT}/api`;
const rand = () => Math.floor(Math.random() * 1e6);

const log = (label, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}${extra ? ' :: ' + extra : ''}`);

(async () => {
  try {
    const custPhone = `9${rand()}`;
    const custReg = await axios.post(`${BASE}/auth/register`, {
      name: 'Smoke Customer', phone: custPhone, password: 'Passw0rd!', role: 'customer'
    });
    const custToken = custReg.data.data.token;
    const custUserId = custReg.data.data.userId;
    log('customer register', custReg.data.success);

    const workerPhone = `9${rand()}`;
    const workerReg = await axios.post(`${BASE}/auth/register`, {
      name: 'Smoke Worker', phone: workerPhone, password: 'Passw0rd!', role: 'worker', skill: 'Plumber'
    });
    const workerToken = workerReg.data.data.token;
    const workerUserId = workerReg.data.data.userId;
    log('worker register', workerReg.data.success);

    const custClient = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${custToken}` } });
    const workerClient = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${workerToken}` } });

    const bookingRes = await custClient.post('/bookings', {
      customerName: 'Smoke Customer',
      customerPhone: custPhone,
      customerAddress: 'Besant Nagar, Chennai',
      serviceCategory: 'Plumbing',
      serviceDetails: 'Leaking tap',
      workerId: workerUserId,
      workerName: 'Smoke Worker',
      amount: 400
    });
    const bookingId = bookingRes.data.data.bookingId;
    log('booking create', bookingRes.data.success, bookingId);

    // Worker should NOT see the real arrivalPin in the API response.
    const workerView = await workerClient.get(`/bookings/${bookingId}`);
    log('worker view redacts arrivalPin', workerView.data.data.arrivalPin === undefined);

    // Customer SHOULD see the real arrivalPin.
    const custView = await custClient.get(`/bookings/${bookingId}`);
    const realPin = custView.data.data.arrivalPin;
    log('customer view has arrivalPin', typeof realPin === 'string' && realPin.length === 4, realPin);

    // Wrong PIN should fail.
    try {
      await workerClient.post(`/bookings/${bookingId}/verify-pin`, { pin: '0000' });
      log('wrong pin rejected', false);
    } catch (err) {
      log('wrong pin rejected', err.response?.status === 400, err.response?.data?.message);
    }

    // Accept the booking.
    const acceptRes = await workerClient.put(`/bookings/${bookingId}/status`, { status: 'accepted' });
    log('worker accept', acceptRes.data.success);

    // Propose reschedule (a 3-hour availability window).
    const windowStart = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
    const windowEnd = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
    const rescheduleRes = await workerClient.put(`/bookings/${bookingId}/reschedule`, {
      windowStart, windowEnd, reason: 'Stuck on another job'
    });
    log('propose reschedule', rescheduleRes.data.success && rescheduleRes.data.data.reschedule.status === 'pending');

    // Customer picks a specific 2-hour slot inside the proposed window.
    const respondRes = await custClient.put(`/bookings/${bookingId}/reschedule/respond`, { action: 'accept', selectedStart: windowStart });
    log('customer accepts reschedule', respondRes.data.success && respondRes.data.data.status === 'accepted');

    // Move through on_the_way -> arrived, then verify correct PIN.
    await workerClient.put(`/bookings/${bookingId}/status`, { status: 'on_the_way' });
    await workerClient.put(`/bookings/${bookingId}/status`, { status: 'arrived' });

    // Attempting to start work before PIN verification must fail.
    try {
      await workerClient.put(`/bookings/${bookingId}/status`, { status: 'working' });
      log('working blocked without PIN', false);
    } catch (err) {
      log('working blocked without PIN', err.response?.status === 400, err.response?.data?.message);
    }

    const verifyRes = await workerClient.post(`/bookings/${bookingId}/verify-pin`, { pin: realPin });
    log('correct pin verified', verifyRes.data.success);

    const workingRes = await workerClient.put(`/bookings/${bookingId}/status`, { status: 'working' });
    log('working allowed after PIN', workingRes.data.success);

    await workerClient.put(`/bookings/${bookingId}/status`, { status: 'completed' });

    // Cash payment path (no Razorpay keys configured in this environment).
    const paidRes = await custClient.put(`/bookings/${bookingId}/status`, { status: 'paid', paymentMethod: 'cash' });
    log('customer marks paid (cash)', paidRes.data.success);

    // A second booking to test rejection.
    const booking2Res = await custClient.post('/bookings', {
      customerName: 'Smoke Customer', customerPhone: custPhone,
      customerAddress: 'T Nagar, Chennai', serviceCategory: 'Plumbing', serviceDetails: 'Pipe fix',
      workerId: workerUserId, workerName: 'Smoke Worker', amount: 350
    });
    const bookingId2 = booking2Res.data.data.bookingId;
    const rejectRes = await workerClient.put(`/bookings/${bookingId2}/reject`, { reason: 'Too far' });
    log('worker reject', rejectRes.data.success && rejectRes.data.data.status === 'rejected');

    const paymentsConfig = await axios.get(`${BASE}/payments/config`);
    log('payments config reachable', paymentsConfig.data.success);

    console.log('\nAll smoke tests executed.');
  } catch (err) {
    console.error('SMOKE TEST CRASHED:', err.response?.status, err.response?.data || err.message);
    process.exit(1);
  }
})();
