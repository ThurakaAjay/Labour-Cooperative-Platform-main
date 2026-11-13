const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../server');
const User = require('../models/User');
const Worker = require('../models/Worker');
const { JWT_SECRET } = require('../middleware/auth.middleware');

jest.setTimeout(60000);

let mongoServer;
let adminToken, customerToken, workerToken;
let customerUserId, workerUserId;

beforeAll(async () => {
  try {
    const testUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/workhive_test';
    await mongoose.connect(testUri, { serverSelectionTimeoutMS: 2000 });
  } catch (err) {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await User.deleteMany({});
  await Worker.deleteMany({});

  const adminId = 'adm-jest-' + Date.now();
  customerUserId = 'cus-jest-' + Date.now();
  workerUserId = 'wrk-jest-' + Date.now();

  await User.create({
    userId: adminId,
    name: 'Society Admin',
    phone: '+91 90000 00001',
    email: 'admin.jest@workhive.local',
    password: 'adminPassword123',
    role: 'admin',
    status: 'Active'
  });
  await User.create({
    userId: customerUserId,
    name: 'Test Customer',
    phone: '+91 90000 00002',
    email: 'customer.jest@workhive.local',
    password: 'password123',
    role: 'customer',
    status: 'Active'
  });
  await User.create({
    userId: workerUserId,
    name: 'Test Worker',
    phone: '+91 90000 00003',
    email: 'worker.jest@workhive.local',
    password: 'password123',
    role: 'worker',
    status: 'Pending'
  });
  await Worker.create({
    workerId: workerUserId,
    name: 'Test Worker',
    phone: '+91 90000 00003',
    skill: 'Plumbing',
    status: 'Pending',
    verificationStatus: 'unsubmitted'
  });

  adminToken = jwt.sign({ userId: adminId, role: 'admin', name: 'Society Admin', phone: '+91 90000 00001' }, JWT_SECRET);
  customerToken = jwt.sign({ userId: customerUserId, role: 'customer', name: 'Test Customer', phone: '+91 90000 00002' }, JWT_SECRET);
  workerToken = jwt.sign({ userId: workerUserId, role: 'worker', name: 'Test Worker', phone: '+91 90000 00003' }, JWT_SECRET);
});

describe('WorkHive Admin RBAC & Directory Endpoints', () => {
  describe('1. Route Guard: verifyAdmin / checkRole', () => {
    it('rejects every /api/admin/* route without a token (401)', async () => {
      const res = await request(app).get('/api/admin/workers');
      expect(res.status).toBe(401);
    });

    it('rejects a customer token on admin routes (403)', async () => {
      const res = await request(app).get('/api/admin/workers').set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('rejects a worker token on admin routes (403)', async () => {
      const res = await request(app).get('/api/admin/customers').set('Authorization', `Bearer ${workerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('2. Directory Views', () => {
    it('returns the full worker roster with booking-history fields for admin', async () => {
      const res = await request(app).get('/api/admin/workers').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0]).toHaveProperty('totalBookings');
      expect(res.body.data[0]).toHaveProperty('completedBookings');
      expect(res.body.data[0].verificationStatus).toBe('unsubmitted');
    });

    it('returns all customers with booking-history fields for admin', async () => {
      const res = await request(app).get('/api/admin/customers').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0]).toHaveProperty('totalBookings');
      expect(res.body.data[0]).toHaveProperty('completedBookings');
    });
  });

  describe('3. Status Management + Privilege Escalation Guards', () => {
    it('rejects a worker attempting to self-suspend/unsuspend via the admin endpoint (403)', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${workerUserId}/status`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ status: 'Active' });

      expect(res.status).toBe(403);
    });

    it('allows admin to suspend a worker, syncing the linked Worker record', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${workerUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Suspended' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('Suspended');

      const worker = await Worker.findOne({ workerId: workerUserId });
      expect(worker.status).toBe('Suspended');
      expect(worker.isOnline).toBe(false);
    });

    it('rejects an invalid status value with 400 Bad Request', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${customerUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Banned' });

      expect(res.status).toBe(400);
    });

    it('does not let a non-admin PUT /api/workers/:id write verificationStatus directly (privilege escalation guard)', async () => {
      const res = await request(app)
        .put(`/api/workers/${workerUserId}`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ verificationStatus: 'verified', status: 'Verified' });

      expect(res.status).toBe(200);
      const worker = await Worker.findOne({ workerId: workerUserId });
      expect(worker.verificationStatus).toBe('unsubmitted');
      expect(worker.status).toBe('Pending');
    });
  });
});
