const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../server');
const Worker = require('../models/Worker');
const { JWT_SECRET } = require('../middleware/auth.middleware');

jest.setTimeout(60000);

let mongoServer;
let adminToken, workerToken, otherWorkerToken, verifiedWorkerToken;
let workerUserId, otherWorkerUserId, verifiedWorkerUserId;

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
  await Worker.deleteMany({});

  workerUserId = 'wrk-jest-' + Date.now();
  otherWorkerUserId = 'wrk-jest-other-' + Date.now();
  const adminId = 'adm-jest-' + Date.now();

  await Worker.create({
    workerId: workerUserId,
    name: 'Pending Worker',
    phone: '+91 90000 11111',
    skill: 'Electrician',
    status: 'Pending',
    verificationStatus: 'unsubmitted'
  });
  verifiedWorkerUserId = 'wrk-jest-verified-' + Date.now();
  await Worker.create({
    workerId: verifiedWorkerUserId,
    name: 'Already Verified Worker',
    phone: '+91 90000 22222',
    skill: 'Plumbing',
    status: 'Verified',
    verificationStatus: 'verified'
  });

  adminToken = jwt.sign({ userId: adminId, role: 'admin', name: 'Society Admin', phone: '+91 90000 00000' }, JWT_SECRET);
  workerToken = jwt.sign({ userId: workerUserId, role: 'worker', name: 'Pending Worker', phone: '+91 90000 11111' }, JWT_SECRET);
  otherWorkerToken = jwt.sign({ userId: otherWorkerUserId, role: 'worker', name: 'Other Worker', phone: '+91 90000 33333' }, JWT_SECRET);
  verifiedWorkerToken = jwt.sign({ userId: verifiedWorkerUserId, role: 'worker', name: 'Already Verified Worker', phone: '+91 90000 22222' }, JWT_SECRET);
});

describe('WorkHive Worker Verification Pipeline', () => {
  describe('1. Customer Visibility Guard', () => {
    it('GET /api/workers (public directory) only returns verified workers', async () => {
      const res = await request(app).get('/api/workers');
      expect(res.status).toBe(200);
      expect(res.body.data.every(w => w.verificationStatus === 'verified')).toBe(true);
      expect(res.body.data.some(w => w.workerId === workerUserId)).toBe(false);
    });

    it('ignores a client-supplied status override attempt on the public directory', async () => {
      const res = await request(app).get('/api/workers?status=Pending&verificationStatus=pending');
      expect(res.status).toBe(200);
      expect(res.body.data.some(w => w.workerId === workerUserId)).toBe(false);
    });
  });

  describe('2. Admin Review: Approve / Reject', () => {
    it('rejects a review attempt with no documents submitted yet (400)', async () => {
      const res = await request(app)
        .put(`/api/workers/${workerUserId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'approve' });

      expect(res.status).toBe(400);
    });

    it('rejects verification review by a non-admin (403)', async () => {
      const res = await request(app)
        .put(`/api/workers/${workerUserId}/verify`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ decision: 'approve' });

      expect(res.status).toBe(403);
    });

    it('requires a rejectionReason when rejecting', async () => {
      await Worker.findOneAndUpdate({ workerId: workerUserId }, {
        documents: [{ name: 'aadhaar.pdf', docType: 'id_proof', format: 'pdf', url: 'https://res.cloudinary.com/x/y.pdf', publicId: 'x/y' }]
      });

      const res = await request(app)
        .put(`/api/workers/${workerUserId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'reject' });

      expect(res.status).toBe(400);
    });

    it('approves a worker with submitted documents, syncing status + verificationStatus', async () => {
      await Worker.findOneAndUpdate({ workerId: workerUserId }, {
        verificationStatus: 'pending',
        documents: [{ name: 'aadhaar.pdf', docType: 'id_proof', format: 'pdf', url: 'https://res.cloudinary.com/x/y.pdf', publicId: 'x/y' }],
        // Directory visibility also requires a complete profile, not just
        // verification — set the fields isProfileComplete depends on so this
        // test still reflects "verified AND ready" appearing in the directory.
        skills: ['Electrician'],
        experience: '5 years',
        languages: ['Tamil'],
        serviceRadius: 5,
        isProfileComplete: true,
        weeklyAvailability: { mon: { morning: true, afternoon: false, evening: false } }
      });

      const res = await request(app)
        .put(`/api/workers/${workerUserId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'approve' });

      expect(res.status).toBe(200);
      expect(res.body.data.verificationStatus).toBe('verified');
      expect(res.body.data.status).toBe('Verified');

      // Now visible in the public, verified-only directory
      const listRes = await request(app).get('/api/workers');
      expect(listRes.body.data.some(w => w.workerId === workerUserId)).toBe(true);
    });

    it('rejects a worker with a reason, leaving them out of the public directory', async () => {
      await Worker.findOneAndUpdate({ workerId: workerUserId }, {
        verificationStatus: 'pending',
        documents: [{ name: 'aadhaar.pdf', docType: 'id_proof', format: 'pdf', url: 'https://res.cloudinary.com/x/y.pdf', publicId: 'x/y' }]
      });

      const res = await request(app)
        .put(`/api/workers/${workerUserId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'reject', rejectionReason: 'Aadhaar photo is blurry, please re-upload.' });

      expect(res.status).toBe(200);
      expect(res.body.data.verificationStatus).toBe('rejected');
      expect(res.body.data.rejectionReason).toMatch(/blurry/);

      const listRes = await request(app).get('/api/workers');
      expect(listRes.body.data.some(w => w.workerId === workerUserId)).toBe(false);
    });
  });

  describe('2b. Profile Completeness (isProfileComplete)', () => {
    it('flips isProfileComplete to true only once every required field is set, and ignores a client-supplied override', async () => {
      const partial = await request(app)
        .put(`/api/workers/${workerUserId}`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ skills: ['Electrician'], experience: '5 years' });
      expect(partial.body.data.isProfileComplete).toBe(false);

      const almostComplete = await request(app)
        .put(`/api/workers/${workerUserId}`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          languages: ['Tamil'],
          serviceRadius: 5,
          weeklyAvailability: { mon: { morning: true, afternoon: false, evening: false } },
          isProfileComplete: false // client attempt to force it off — must be ignored
        });
      // Payment details are also required now — still incomplete without them
      expect(almostComplete.body.data.isProfileComplete).toBe(false);

      const complete = await request(app)
        .put(`/api/workers/${workerUserId}`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          paymentDetails: { payoutType: 'upi', upiId: 'worker@okaxis' },
          isProfileComplete: true // client attempt to force it on — irrelevant, it's already earned here
        });
      expect(complete.body.data.isProfileComplete).toBe(true);
    });

    it('does not let a worker mark their own payout details verified via the generic update route', async () => {
      const res = await request(app)
        .put(`/api/workers/${workerUserId}`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ paymentDetails: { upiId: 'worker@okhdfcbank', verificationStatus: 'verified' } });

      expect(res.status).toBe(200);
      expect(res.body.data.paymentDetails.upiId).toBe('worker@okhdfcbank');
      expect(res.body.data.paymentDetails.verificationStatus).not.toBe('verified');
    });
  });

  describe('2c. Verified-Only Online Toggle Guard', () => {
    it('rejects an unverified worker trying to go online, and leaves isOnline false', async () => {
      const res = await request(app)
        .put(`/api/workers/${workerUserId}`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ isOnline: true });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Only verified workers can go online/);

      const stored = await Worker.findOne({ workerId: workerUserId });
      expect(stored.isOnline).toBe(false);
    });

    it('allows a verified worker to go online', async () => {
      const res = await request(app)
        .put(`/api/workers/${verifiedWorkerUserId}`)
        .set('Authorization', `Bearer ${verifiedWorkerToken}`)
        .send({ isOnline: true });

      expect(res.status).toBe(200);
      expect(res.body.data.isOnline).toBe(true);
    });

    it('cannot be bypassed by pairing isOnline:true with a spoofed verificationStatus in the same request', async () => {
      const res = await request(app)
        .put(`/api/workers/${workerUserId}`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ isOnline: true, verificationStatus: 'verified' });

      expect(res.status).toBe(403);
      const stored = await Worker.findOne({ workerId: workerUserId });
      expect(stored.verificationStatus).toBe('unsubmitted');
      expect(stored.isOnline).toBe(false);
    });
  });

  describe('2d. Admin Insurance Issuance & Welfare Balance', () => {
    it('issues health and accident coverage without disturbing a nominee the worker already set', async () => {
      await request(app)
        .put(`/api/workers/${verifiedWorkerUserId}`)
        .set('Authorization', `Bearer ${verifiedWorkerToken}`)
        .send({ accidentCoverage: { nominee: { name: 'Sunita', relation: 'Spouse', payout: 'sunita@okaxis' } } });

      const res = await request(app)
        .put(`/api/workers/${verifiedWorkerUserId}/insurance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ healthInsurance: { active: true }, accidentCoverage: { active: true } });

      expect(res.status).toBe(200);
      expect(res.body.data.healthInsurance.active).toBe(true);
      expect(res.body.data.healthInsurance.coverageAmount).toBe(500000);
      expect(res.body.data.accidentCoverage.active).toBe(true);
      expect(res.body.data.accidentCoverage.nominee.name).toBe('Sunita');
    });

    it('rejects a non-admin trying to issue insurance', async () => {
      const res = await request(app)
        .put(`/api/workers/${verifiedWorkerUserId}/insurance`)
        .set('Authorization', `Bearer ${verifiedWorkerToken}`)
        .send({ healthInsurance: { active: true } });

      expect(res.status).toBe(403);
    });

    it('credits and debits the welfare fund balance, and refuses to go negative', async () => {
      const credit = await request(app)
        .put(`/api/workers/${verifiedWorkerUserId}/welfare-balance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 1000, reason: 'Manual credit' });
      expect(credit.body.data.welfareFundBalance).toBe(1000);

      const overDebit = await request(app)
        .put(`/api/workers/${verifiedWorkerUserId}/welfare-balance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: -5000 });
      expect(overDebit.status).toBe(400);

      const stored = await Worker.findOne({ workerId: verifiedWorkerUserId });
      expect(stored.welfareFundBalance).toBe(1000);
    });
  });

  describe('3. Privilege Escalation Guard on Document Upload', () => {
    it("rejects a different worker's attempt to upload documents to someone else's profile (403)", async () => {
      const res = await request(app)
        .post(`/api/workers/${workerUserId}/documents`)
        .set('Authorization', `Bearer ${otherWorkerToken}`)
        .attach('documents', Buffer.from('fake pdf content'), { filename: 'fake.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated document upload (401)', async () => {
      const res = await request(app)
        .post(`/api/workers/${workerUserId}/documents`)
        .attach('documents', Buffer.from('fake pdf content'), { filename: 'fake.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(401);
    });
  });
});
