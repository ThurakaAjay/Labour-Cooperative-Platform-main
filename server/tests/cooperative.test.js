const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../server');
const WelfareClaim = require('../models/WelfareClaim');
const Worker = require('../models/Worker');
const { JWT_SECRET } = require('../middleware/auth.middleware');

jest.setTimeout(60000);

let mongoServer;
let worker1Token, worker2Token, customerToken, adminToken;
let worker1Id, worker2Id;

beforeAll(async () => {
  try {
    const testUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/workhive_test';
    await mongoose.connect(testUri, { serverSelectionTimeoutMS: 2000 });
  } catch (err) {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  }

  worker1Id = new mongoose.Types.ObjectId().toString();
  worker2Id = new mongoose.Types.ObjectId().toString();
  const customerId = new mongoose.Types.ObjectId().toString();
  const adminId = new mongoose.Types.ObjectId().toString();

  worker1Token = jwt.sign({ userId: worker1Id, role: 'worker', name: 'Worker One', phone: '+91 98401 11111' }, JWT_SECRET);
  worker2Token = jwt.sign({ userId: worker2Id, role: 'worker', name: 'Worker Two', phone: '+91 98402 22222' }, JWT_SECRET);
  customerToken = jwt.sign({ userId: customerId, role: 'customer', name: 'Customer Member', phone: '+91 98403 33333' }, JWT_SECRET);
  adminToken = jwt.sign({ userId: adminId, role: 'admin', name: 'Society Admin', phone: '+91 98404 44444' }, JWT_SECRET);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await WelfareClaim.deleteMany({});
  await Worker.deleteMany({});
});

describe('WorkHive Cooperative Governance & Welfare Test Suite', () => {
  describe('1. Welfare Claims Privacy Scoping & Lifecycle', () => {
    it('allows worker to submit welfare claim defaulting to "Pending Review"', async () => {
      const res = await request(app)
        .post('/api/cooperative/claims')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({
          type: 'Tool Damage Grant',
          amount: 2500,
          details: 'Replacement drill motor following heavy site use.'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.workerId).toBe(worker1Id);
      expect(res.body.data.status).toBe('Pending Review');
    });

    it('denies customer from submitting welfare claims with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/cooperative/claims')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          type: 'Tool Damage Grant',
          amount: 2500
        });

      expect(res.status).toBe(403);
    });

    it('scopes claims visibility so workers only see their own claims while admins see all', async () => {
      // Worker 1 creates a claim
      await request(app)
        .post('/api/cooperative/claims')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({
          type: 'Tool Damage Grant',
          amount: 2500
        });

      // Worker 1 fetches claims -> gets 1
      const worker1Claims = await request(app)
        .get('/api/cooperative/claims')
        .set('Authorization', `Bearer ${worker1Token}`);

      expect(worker1Claims.status).toBe(200);
      expect(worker1Claims.body.data.length).toBe(1);

      // Worker 2 fetches claims -> gets 0
      const worker2Claims = await request(app)
        .get('/api/cooperative/claims')
        .set('Authorization', `Bearer ${worker2Token}`);

      expect(worker2Claims.status).toBe(200);
      expect(worker2Claims.body.data.length).toBe(0);

      // Admin fetches claims -> gets 1
      const adminClaims = await request(app)
        .get('/api/cooperative/claims')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminClaims.status).toBe(200);
      expect(adminClaims.body.data.length).toBe(1);
    });

    it('allows admin to approve and update claim status', async () => {
      const claimRes = await request(app)
        .post('/api/cooperative/claims')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({
          type: 'Medical Expense Assistance',
          amount: 5000
        });

      const claimId = claimRes.body.data.claimId;

      const updateRes = await request(app)
        .put(`/api/cooperative/claims/${claimId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Approved' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.status).toBe('Approved');
    });
  });

  describe('2. Welfare Fund Withdrawal Claims', () => {
    it('deducts the withdrawal amount from the worker welfare balance exactly once, even across repeated status updates', async () => {
      await Worker.create({
        workerId: worker1Id,
        name: 'Worker One',
        phone: '+91 98401 11111',
        skill: 'Electrician',
        welfareFundBalance: 2000
      });

      const claimRes = await request(app)
        .post('/api/cooperative/claims')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ category: 'welfare_withdrawal', title: 'Welfare Fund Withdrawal', amount: 1500 });

      const claimId = claimRes.body.data.claimId;

      const approveRes = await request(app)
        .put(`/api/cooperative/claims/${claimId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Approved' });
      expect(approveRes.status).toBe(200);

      let worker = await Worker.findOne({ workerId: worker1Id });
      expect(worker.welfareFundBalance).toBe(500);

      // Moving it on to Settled afterwards must not deduct a second time
      const settleRes = await request(app)
        .put(`/api/cooperative/claims/${claimId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Settled' });
      expect(settleRes.status).toBe(200);

      worker = await Worker.findOne({ workerId: worker1Id });
      expect(worker.welfareFundBalance).toBe(500);
    });

    it('refuses to approve a withdrawal larger than the worker\'s current welfare balance', async () => {
      await Worker.create({
        workerId: worker1Id,
        name: 'Worker One',
        phone: '+91 98401 11111',
        skill: 'Electrician',
        welfareFundBalance: 200
      });

      const claimRes = await request(app)
        .post('/api/cooperative/claims')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ category: 'welfare_withdrawal', title: 'Welfare Fund Withdrawal', amount: 1500 });

      const claimId = claimRes.body.data.claimId;

      const approveRes = await request(app)
        .put(`/api/cooperative/claims/${claimId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Approved' });

      expect(approveRes.status).toBe(400);

      const worker = await Worker.findOne({ workerId: worker1Id });
      expect(worker.welfareFundBalance).toBe(200);
    });
  });
});
