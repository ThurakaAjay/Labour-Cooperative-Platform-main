const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../server');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const Worker = require('../models/Worker');
const { JWT_SECRET } = require('../middleware/auth.middleware');

jest.setTimeout(60000);

let mongoServer;
let customerToken, otherCustomerToken, workerToken, adminToken;
let customerId, workerId;

beforeAll(async () => {
  try {
    const testUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/workhive_test';
    await mongoose.connect(testUri, { serverSelectionTimeoutMS: 2000 });
  } catch (err) {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  }

  // Create test tokens
  customerId = new mongoose.Types.ObjectId().toString();
  const otherCustomerId = new mongoose.Types.ObjectId().toString();
  workerId = new mongoose.Types.ObjectId().toString();
  const adminId = new mongoose.Types.ObjectId().toString();

  customerToken = jwt.sign({ userId: customerId, role: 'customer', name: 'Test Customer', phone: '+91 98401 11111' }, JWT_SECRET);
  otherCustomerToken = jwt.sign({ userId: otherCustomerId, role: 'customer', name: 'Other Customer', phone: '+91 98402 22222' }, JWT_SECRET);
  workerToken = jwt.sign({ userId: workerId, role: 'worker', name: 'Test Worker', phone: '+91 98403 33333' }, JWT_SECRET);
  adminToken = jwt.sign({ userId: adminId, role: 'admin', name: 'Test Admin', phone: '+91 98404 44444' }, JWT_SECRET);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Booking.deleteMany({});
  await Service.deleteMany({});
  await Worker.deleteMany({});

  // Seed standard service
  await Service.create({
    serviceId: 'srv-plumb',
    title: 'Plumbing Service',
    description: 'Expert plumbing repairs and pipe fixing',
    category: 'Plumbing',
    baseRate: '₹400',
    rateNumber: 400
  });
});

describe('WorkHive Booking Lifecycle & State Machine Test Suite', () => {
  describe('1. Booking Creation & Price Validation', () => {
    it('creates booking with dynamically generated 4-digit PIN and binds customer identity', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          customerName: 'Test Customer',
          customerPhone: '+91 98401 11111',
          customerAddress: 'Ward 4, Adyar, Chennai',
          serviceCategory: 'Plumbing',
          serviceDetails: 'Fix leaking pipe',
          workerId: workerId,
          workerName: 'Test Worker',
          amount: 450
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customerId).toBe(customerId);
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.arrivalPin).toMatch(/^\d{4}$/);
    });

    it('rejects booking with underpayment below catalog base rate', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          customerName: 'Test Customer',
          customerPhone: '+91 98401 11111',
          customerAddress: 'Ward 4, Adyar, Chennai',
          serviceCategory: 'Plumbing',
          amount: 200 // base rate is 400
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot be less than/i);
    });
  });

  describe('2. BOLA / IDOR Access Control', () => {
    it('prevents another customer from viewing private booking details', async () => {
      const booking = await Booking.create({
        bookingId: 'BK-TEST-BOLA',
        customerId,
        customerName: 'Test Customer',
        customerPhone: '+91 98401 11111',
        customerAddress: 'Ward 4, Chennai',
        serviceCategory: 'Plumbing',
        serviceDetails: 'Pipe repair',
        workerId,
        workerName: 'Test Worker',
        amount: 450,
        status: 'pending'
      });

      // Other customer attempts to access
      const res = await request(app)
        .get(`/api/bookings/${booking.bookingId}`)
        .set('Authorization', `Bearer ${otherCustomerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/not authorized/i);
    });

    it('prevents another customer from deleting/cancelling private booking', async () => {
      const booking = await Booking.create({
        bookingId: 'BK-TEST-CANCEL',
        customerId,
        customerName: 'Test Customer',
        customerPhone: '+91 98401 11111',
        customerAddress: 'Ward 4, Chennai',
        serviceCategory: 'Plumbing',
        serviceDetails: 'Pipe repair',
        workerId,
        workerName: 'Test Worker',
        amount: 450,
        status: 'pending'
      });

      const res = await request(app)
        .delete(`/api/bookings/${booking.bookingId}`)
        .set('Authorization', `Bearer ${otherCustomerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('2b. Job Readiness Guard on Self-Assignment', () => {
    it('blocks an unverified/incomplete worker from accepting an unassigned job (403)', async () => {
      const booking = await Booking.create({
        bookingId: 'BK-TEST-READINESS-BLOCK',
        customerId,
        customerName: 'Test Customer',
        customerPhone: '+91 98401 11111',
        customerAddress: 'Ward 4, Chennai',
        serviceCategory: 'Plumbing',
        serviceDetails: 'Pipe repair',
        workerId: 'unassigned',
        workerName: 'Cooperative Worker',
        amount: 450,
        status: 'pending'
      });

      const res = await request(app)
        .put(`/api/bookings/${booking.bookingId}/status`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ status: 'accepted' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/complete your profile/i);
    });

    it('allows a verified, profile-complete worker to accept an unassigned job', async () => {
      await Worker.create({
        workerId,
        name: 'Test Worker',
        phone: '+91 98403 33333',
        skill: 'Plumbing',
        skills: ['Plumbing'],
        experience: '5 years',
        languages: ['Tamil'],
        serviceRadius: 5,
        weeklyAvailability: { mon: { morning: true, afternoon: false, evening: false } },
        verificationStatus: 'verified',
        isProfileComplete: true
      });

      const booking = await Booking.create({
        bookingId: 'BK-TEST-READINESS-OK',
        customerId,
        customerName: 'Test Customer',
        customerPhone: '+91 98401 11111',
        customerAddress: 'Ward 4, Chennai',
        serviceCategory: 'Plumbing',
        serviceDetails: 'Pipe repair',
        workerId: 'unassigned',
        workerName: 'Cooperative Worker',
        amount: 450,
        status: 'pending'
      });

      const res = await request(app)
        .put(`/api/bookings/${booking.bookingId}/status`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ status: 'accepted' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('accepted');
      expect(res.body.data.workerId).toBe(workerId);
    });
  });

  describe('3. Booking State Machine Enforcement', () => {
    it('rejects illegal status leaps (pending -> completed)', async () => {
      const booking = await Booking.create({
        bookingId: 'BK-TEST-STATE-1',
        customerId,
        customerName: 'Test Customer',
        customerPhone: '+91 98401 11111',
        customerAddress: 'Ward 4, Chennai',
        serviceCategory: 'Plumbing',
        serviceDetails: 'Pipe repair',
        workerId,
        workerName: 'Test Worker',
        amount: 450,
        status: 'pending'
      });

      const res = await request(app)
        .put(`/api/bookings/${booking.bookingId}/status`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid state transition/i);
    });

    it('prevents non-admin from bypassing state machine using forceAdminOverride (C3)', async () => {
      const booking = await Booking.create({
        bookingId: 'BK-TEST-OVERRIDE',
        customerId,
        customerName: 'Test Customer',
        customerPhone: '+91 98401 11111',
        customerAddress: 'Ward 4, Chennai',
        serviceCategory: 'Plumbing',
        serviceDetails: 'Pipe repair',
        workerId,
        workerName: 'Test Worker',
        amount: 450,
        status: 'pending'
      });

      const res = await request(app)
        .put(`/api/bookings/${booking.bookingId}/status`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ status: 'completed', forceAdminOverride: true });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid state transition/i);
    });

    it('enforces full valid lifecycle: pending -> on_the_way -> arrived -> completed -> rated', async () => {
      const booking = await Booking.create({
        bookingId: 'BK-TEST-LIFECYCLE',
        customerId,
        customerName: 'Test Customer',
        customerPhone: '+91 98401 11111',
        customerAddress: 'Ward 4, Chennai',
        serviceCategory: 'Plumbing',
        serviceDetails: 'Pipe repair',
        workerId,
        workerName: 'Test Worker',
        amount: 450,
        status: 'pending'
      });

      // 1. on_the_way
      const step1 = await request(app)
        .put(`/api/bookings/${booking.bookingId}/status`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ status: 'on_the_way', isLocationSharing: true });
      expect(step1.status).toBe(200);
      expect(step1.body.data.status).toBe('on_the_way');

      // 2. arrived
      const step2 = await request(app)
        .put(`/api/bookings/${booking.bookingId}/status`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ status: 'arrived', isLocationSharing: false });
      expect(step2.status).toBe(200);
      expect(step2.body.data.status).toBe('arrived');

      // 3. completed
      const step3 = await request(app)
        .put(`/api/bookings/${booking.bookingId}/status`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ status: 'completed' });
      expect(step3.status).toBe(200);
      expect(step3.body.data.status).toBe('completed');

      // 4. rated
      const step4 = await request(app)
        .put(`/api/bookings/${booking.bookingId}/status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ status: 'rated', rating: 5, feedback: 'Great job!' });
      expect(step4.status).toBe(200);
      expect(step4.body.data.rating).toBe(5);

      // 5. terminal state rejection (rated is terminal; cannot transition to pending)
      const terminalAttempt = await request(app)
        .put(`/api/bookings/${booking.bookingId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'pending' });
      expect(terminalAttempt.status).toBe(400);
      expect(terminalAttempt.body.message).toMatch(/invalid state transition/i);
    });
  });
});
