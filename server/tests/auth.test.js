const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../server');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { JWT_SECRET } = require('../middleware/auth.middleware');
const crypto = require('crypto');

jest.setTimeout(60000);

let mongoServer;

beforeAll(async () => {
  try {
    // Try connecting to running MongoDB instance first for instant testing
    const testUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/workhive_test';
    await mongoose.connect(testUri, { serverSelectionTimeoutMS: 2000 });
  } catch (err) {
    // Fall back to in-memory MongoDB for headless CI environments
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
  // Clear collections between tests for test isolation
  await User.deleteMany({});
  await Otp.deleteMany({});
});

describe('WorkHive Security & Authentication Test Suite', () => {

  describe('1. System Health & Security Headers', () => {
    test('GET /api/health should return 200 and include security headers from Helmet', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });
  });

  describe('2. Password Hashing on Registration', () => {
    test('User password must be securely hashed with bcrypt in database, not stored in plain text', async () => {
      const plainPassword = 'MySecurePassword!456';
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test Customer',
          phone: '+91 99999 00001',
          email: 'testcustomer@workhive.local',
          password: plainPassword,
          role: 'customer'
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.success).toBe(true);

      // Verify token returned is a genuine 3-part signed JWT
      const token = regRes.body.data.token;
      expect(token).toBeDefined();
      const parts = token.split('.');
      expect(parts.length).toBe(3);

      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.role).toBe('customer');
      expect(decoded.name).toBe('Test Customer');

      // Fetch the raw user document directly from MongoDB to verify password hashing
      const rawUser = await User.findOne({ email: 'testcustomer@workhive.local' }).select('+password');
      expect(rawUser).toBeDefined();
      expect(rawUser.password).not.toBe(plainPassword);
      // Bcrypt hash pattern check ($2a$ or $2b$)
      expect(rawUser.password).toMatch(/^\$2[ab]\$\d{2}\$/);
    });

    test('Password must be rejected if shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Short Pass User',
          phone: '+91 99999 00002',
          email: 'shortpass@workhive.local',
          password: '1234567',
          role: 'customer'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/8 characters/i);
    });
  });

  describe('3. Login Security & Backdoor Elimination', () => {
    beforeEach(async () => {
      // Register a test customer
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Arun Kumar',
          phone: '+91 98401 11223',
          email: 'arun@example.com',
          password: 'CorrectPassword123',
          role: 'customer'
        });
    });

    test('Login succeeds with correct password and returns signed JWT', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: '+91 98401 11223',
          password: 'CorrectPassword123',
          role: 'customer'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();

      const decoded = jwt.verify(res.body.data.token, JWT_SECRET);
      expect(decoded.name).toBe('Arun Kumar');
    });

    test('Login fails with invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: '+91 98401 11223',
          password: 'TotallyWrongPassword',
          role: 'customer'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('Universal backdoor passwords MUST be rejected', async () => {
      const backdoorPasswords = [
        'password123',
        'cooperative2026',
        'admin123',
        'worker123',
        'customer123'
      ];

      for (const backdoor of backdoorPasswords) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            identifier: '+91 98401 11223',
            password: backdoor,
            role: 'customer'
          });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
      }
    });
  });

  describe('4. Role-Based Access Control (RBAC) & Protected Routes', () => {
    let customerToken;
    let adminToken;

    beforeEach(async () => {
      // Create a customer
      const custRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Customer Member',
          phone: '+91 98401 55555',
          email: 'cust@workhive.local',
          password: 'custPassword123',
          role: 'customer'
        });
      customerToken = custRes.body.data.token;

      // Admin accounts are never created through registration — seed one
      // directly, the same way db/seed.js's ensureAdminUser does at boot.
      const admin = await User.create({
        userId: 'adm-test-' + Date.now(),
        name: 'Admin Officer',
        phone: '+91 98400 99999',
        email: 'admin@workhive.local',
        password: 'adminPassword123',
        role: 'admin',
        status: 'Active'
      });
      adminToken = jwt.sign(
        { userId: admin.userId, role: admin.role, name: admin.name, phone: admin.phone, email: admin.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
    });

    test('Public admin registration must always be REJECTED, regardless of any secret field', async () => {
      const resPlain = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Attacker Admin',
          phone: '+91 99999 88888',
          email: 'hacker@workhive.local',
          password: 'hackerPassword123',
          role: 'admin'
        });
      expect(resPlain.status).toBe(400);
      expect(resPlain.body.success).toBe(false);

      // Verify that a spoofed/legacy secret field is also REJECTED (fail-closed)
      const resWithSpoofedSecret = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Attacker Admin 2',
          phone: '+91 99999 88889',
          email: 'hacker2@workhive.local',
          password: 'hackerPassword123',
          role: 'admin',
          adminSecret: 'anything',
          requestingUser: { role: 'admin' }
        });
      expect(resWithSpoofedSecret.status).toBe(400);
      expect(resWithSpoofedSecret.body.success).toBe(false);
    });

    test('GET /api/admin/stats returns 401 Unauthorized when no token is provided', async () => {
      const res = await request(app).get('/api/admin/stats');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('GET /api/admin/stats returns 403 Forbidden when accessed by a customer token', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test('GET /api/admin/stats returns 200 OK when accessed by an admin token', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    test('POST /api/admin/reset-demo returns 401/403 when accessed without admin privileges', async () => {
      const noAuthRes = await request(app).post('/api/admin/reset-demo');
      expect(noAuthRes.status).toBe(401);

      const custAuthRes = await request(app)
        .post('/api/admin/reset-demo')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(custAuthRes.status).toBe(403);
    });
  });

  describe('5. Secure OTP Flow (No Self-Disclosure & Anti-Replay)', () => {
    const testPhone = '+91 98407 12345';

    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'OTP User',
          phone: testPhone,
          email: 'otpuser@workhive.local',
          password: 'passwordForOTP123',
          role: 'customer'
        });
    });

    test('POST /api/auth/send-otp must NOT return the OTP in the response body', async () => {
      const res = await request(app)
        .post('/api/auth/send-otp')
        .send({ phone: testPhone });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.otp).toBeUndefined(); // MUST NOT leak the OTP!
    });

    test('POST /api/auth/verify-otp verifies against stored hash and prevents replay', async () => {
      // Explicitly generate a test OTP in the DB
      const rawTestOtp = '654321';
      const otpHash = crypto.createHash('sha256').update(rawTestOtp).digest('hex');
      await Otp.create({
        phone: testPhone,
        otpHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });

      // Verification fails with wrong OTP
      const failRes = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: testPhone, otp: '000000', role: 'customer' });
      expect(failRes.status).toBe(400);

      // Verification succeeds with correct OTP
      const passRes = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: testPhone, otp: rawTestOtp, role: 'customer' });
      expect(passRes.status).toBe(200);
      expect(passRes.body.success).toBe(true);
      expect(passRes.body.data.token).toBeDefined();

      // Attempting to re-use the same OTP (replay attack) fails
      const replayRes = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: testPhone, otp: rawTestOtp, role: 'customer' });
      expect(replayRes.status).toBe(400);
    });
  });

});
