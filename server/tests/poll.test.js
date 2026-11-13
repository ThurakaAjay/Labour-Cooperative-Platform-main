const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../server');
const Poll = require('../models/Poll');
const Vote = require('../models/Vote');
const { JWT_SECRET } = require('../middleware/auth.middleware');

jest.setTimeout(60000);

let mongoServer;
let worker1Token, worker2Token, customerToken, adminToken;
let worker1Id, worker2Id, adminId;

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
  adminId = new mongoose.Types.ObjectId().toString();

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

let activePoll;

beforeEach(async () => {
  await Poll.deleteMany({});
  await Vote.deleteMany({});

  const now = Date.now();
  activePoll = await Poll.create({
    pollId: 'POLL-JEST-01',
    title: 'Welfare Fund Expansion 2026',
    description: 'Allocate 3% additional cooperative surplus to emergency medical reserve.',
    startsAt: new Date(now - 60 * 60 * 1000),
    endsAt: new Date(now + 7 * 24 * 60 * 60 * 1000),
    isActive: true,
    createdBy: adminId
  });
});

describe('WorkHive Poll & Voting System', () => {
  describe('1. Admin Poll Creation & Management', () => {
    it('allows admin to create a poll with start/end timestamps and active flag', async () => {
      const res = await request(app)
        .post('/api/polls')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Should we raise the tool subsidy cap?',
          description: 'Increase the annual tool subsidy cap from ₹3,000 to ₹5,000.',
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          isActive: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pollId).toMatch(/^POLL-/);
      expect(res.body.data.isActive).toBe(true);
    });

    it('rejects poll creation by a non-admin with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/polls')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ title: 'Worker-drafted poll', description: 'Should not be allowed.' });

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated poll creation with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/polls')
        .send({ title: 'Unauthenticated poll', description: 'No token attached.' });

      expect(res.status).toBe(401);
    });

    it('allows admin to close a poll early by setting isActive to false', async () => {
      const res = await request(app)
        .patch(`/api/polls/${activePoll.pollId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });
  });

  describe('2. Worker Voting, DB-Enforced Idempotency, & Live Tallies', () => {
    it('allows a worker to cast a yes/no vote and reflects it in live tallies', async () => {
      const res = await request(app)
        .post(`/api/polls/${activePoll.pollId}/vote`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ choice: 'yes' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.yesCount).toBe(1);
      expect(res.body.data.noCount).toBe(0);
      expect(res.body.data.totalVotes).toBe(1);
      expect(res.body.data.myVote).toBe('yes');
    });

    it('rejects a duplicate vote from the same worker with 409 Conflict (unique pollId+workerId index)', async () => {
      await request(app)
        .post(`/api/polls/${activePoll.pollId}/vote`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ choice: 'yes' });

      const duplicateRes = await request(app)
        .post(`/api/polls/${activePoll.pollId}/vote`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ choice: 'no' });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.message).toMatch(/already cast your vote/i);

      // Confirm exactly one Vote document exists for this worker on this poll
      const voteCount = await Vote.countDocuments({ pollId: activePoll.pollId, workerId: worker1Id });
      expect(voteCount).toBe(1);
    });

    it('allows two different workers to each cast one independent vote', async () => {
      await request(app)
        .post(`/api/polls/${activePoll.pollId}/vote`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ choice: 'yes' });

      const res2 = await request(app)
        .post(`/api/polls/${activePoll.pollId}/vote`)
        .set('Authorization', `Bearer ${worker2Token}`)
        .send({ choice: 'no' });

      expect(res2.status).toBe(200);
      expect(res2.body.data.yesCount).toBe(1);
      expect(res2.body.data.noCount).toBe(1);
      expect(res2.body.data.totalVotes).toBe(2);
    });

    it('rejects voting by a customer with 403 Forbidden (workers only)', async () => {
      const res = await request(app)
        .post(`/api/polls/${activePoll.pollId}/vote`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ choice: 'yes' });

      expect(res.status).toBe(403);
    });

    it('rejects voting on a non-existent poll with 404 Not Found', async () => {
      const res = await request(app)
        .post('/api/polls/POLL-NON-EXISTENT/vote')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ choice: 'yes' });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('rejects voting on a poll an admin has closed (isActive: false)', async () => {
      await Poll.findOneAndUpdate({ pollId: activePoll.pollId }, { isActive: false });

      const res = await request(app)
        .post(`/api/polls/${activePoll.pollId}/vote`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ choice: 'yes' });

      expect(res.status).toBe(403);
    });

    it('rejects an invalid vote choice with 400 Bad Request', async () => {
      const res = await request(app)
        .post(`/api/polls/${activePoll.pollId}/vote`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ choice: 'maybe' });

      expect(res.status).toBe(400);
    });
  });

  describe('3. Poll Listing Visibility', () => {
    it('excludes inactive polls from the default (active-only) list', async () => {
      await Poll.findOneAndUpdate({ pollId: activePoll.pollId }, { isActive: false });

      const res = await request(app)
        .get('/api/polls')
        .set('Authorization', `Bearer ${worker1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.find(p => p.pollId === activePoll.pollId)).toBeUndefined();
    });

    it('lets an admin see inactive/closed polls with ?all=true', async () => {
      await Poll.findOneAndUpdate({ pollId: activePoll.pollId }, { isActive: false });

      const res = await request(app)
        .get('/api/polls?all=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.find(p => p.pollId === activePoll.pollId)).toBeDefined();
    });
  });
});
