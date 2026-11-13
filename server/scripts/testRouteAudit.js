/**
 * WorkHive Comprehensive Route Audit Suite
 * Tests all 38 backend routes, edge cases, RBAC, input validations, and error states.
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
let customerToken = '';
let adminToken = '';
let workerToken = '';
let createdBookingId = '';
let testWorkerId = '';
let testServiceId = 'srv-audit-temp';

const results = [];

function recordTest(id, name, expectedStatus, actualStatus, passed, notes = '') {
  results.push({ id, name, expectedStatus, actualStatus, passed, notes });
  const statusBadge = passed ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
  console.log(`  ${statusBadge} #${id.toString().padStart(2, '0')}: ${name.padEnd(50)} (Exp: ${expectedStatus}, Got: ${actualStatus}) ${notes}`);
}

async function runSuite() {
  console.log('\n' + '='.repeat(85));
  console.log('       WORKHIVE — COMPREHENSIVE PRODUCTION ROUTE & SECURITY AUDIT SUITE       ');
  console.log('='.repeat(85) + '\n');

  // Ephemeral test identities
  const uniquePhone = `+91 99${Math.floor(10000000 + Math.random() * 90000000)}`;
  const auditAdminPhone = `+91 98404${Date.now().toString().slice(-6)}`;
  const auditAdminEmail = `audit.admin.${Date.now()}@chennailabour.coop`;
  const auditWorkerPhone = `+91 98405${Date.now().toString().slice(-6)}`;

  // --- SECTION 1: System Health & Base Telemetry ---
  console.log('--- 1. SYSTEM HEALTH & BASE TELEMETRY ---');
  try {
    const res = await axios.get(`${BASE_URL}/health`);
    recordTest(1, 'GET /api/health', 200, res.status, res.status === 200 && res.data.status === 'ok');
  } catch (err) {
    recordTest(1, 'GET /api/health', 200, err.response?.status || 500, false, err.message);
  }

  try {
    const res = await axios.get(`${BASE_URL}/stats`);
    recordTest(2, 'GET /api/stats (Unauthenticated request rejected -> 401)', 401, res.status, false, 'Expected 401 Unauthorized');
  } catch (err) {
    const status = err.response?.status || 500;
    recordTest(2, 'GET /api/stats (Unauthenticated request rejected -> 401)', 401, status, status === 401);
  }

  // --- SECTION 2: Authentication & Authorization ---
  console.log('\n--- 2. AUTHENTICATION, VALIDATION & RBAC ---');

  try {
    const res = await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Audit Customer',
      phone: uniquePhone,
      password: 'AuditPassword123',
      role: 'customer',
      locality: 'Ward 4, Adyar'
    });
    customerToken = res.data.token || res.data.data?.token;
    recordTest(3, 'POST /api/auth/register (Valid Customer)', 201, res.status, res.status === 201 && !!customerToken);
  } catch (err) {
    recordTest(3, 'POST /api/auth/register (Valid Customer)', 201, err.response?.status || 500, false, err.message);
  }

  try {
    const res = await axios.post(`${BASE_URL}/auth/register`, {
      name: '',
      phone: ''
    });
    recordTest(4, 'POST /api/auth/register (Empty payload -> 400)', 400, res.status, false, 'Should have failed');
  } catch (err) {
    recordTest(4, 'POST /api/auth/register (Empty payload -> 400)', 400, err.response?.status || 500, err.response?.status === 400);
  }

  try {
    const res = await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Invalid Role User',
      phone: '+91 91111 22222',
      password: 'password123',
      role: 'super_hacker'
    });
    recordTest(5, 'POST /api/auth/register (Invalid role enum -> 400)', 400, res.status, false);
  } catch (err) {
    recordTest(5, 'POST /api/auth/register (Invalid role enum -> 400)', 400, err.response?.status || 500, err.response?.status === 400);
  }

  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      identifier: uniquePhone,
      password: 'AuditPassword123'
    });
    const loggedInToken = res.data.token || res.data.data?.token;
    recordTest(6, 'POST /api/auth/login (Correct Credentials)', 200, res.status, res.status === 200 && !!loggedInToken);
  } catch (err) {
    recordTest(6, 'POST /api/auth/login (Correct Credentials)', 200, err.response?.status || 500, false, err.message);
  }

  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      identifier: uniquePhone,
      password: 'WrongPassword'
    });
    recordTest(7, 'POST /api/auth/login (Wrong Password -> 401)', 401, res.status, false);
  } catch (err) {
    recordTest(7, 'POST /api/auth/login (Wrong Password -> 401)', 401, err.response?.status || 500, err.response?.status === 401);
  }

  try {
    const res = await axios.post(`${BASE_URL}/auth/send-otp`, { phone: uniquePhone });
    recordTest(8, 'POST /api/auth/send-otp (No OTP leak in response)', 200, res.status, res.status === 200 && !res.data.otp);
  } catch (err) {
    recordTest(8, 'POST /api/auth/send-otp (No OTP leak in response)', 200, err.response?.status || 500, false, err.message);
  }

  try {
    const res = await axios.post(`${BASE_URL}/auth/verify-otp`, { phone: uniquePhone, otp: '000000' });
    recordTest(9, 'POST /api/auth/verify-otp (Invalid OTP -> 400)', 400, res.status, false);
  } catch (err) {
    recordTest(9, 'POST /api/auth/verify-otp (Invalid OTP -> 400)', 400, err.response?.status || 500, err.response?.status === 400);
  }

  try {
    const res = await axios.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const profile = res.data.data || res.data.user || res.data;
    recordTest(10, 'GET /api/auth/me (Authenticated Session)', 200, res.status, res.status === 200 && profile.role === 'customer');
  } catch (err) {
    recordTest(10, 'GET /api/auth/me (Authenticated Session)', 200, err.response?.status || 500, false, err.message);
  }

  try {
    const res = await axios.put(`${BASE_URL}/auth/profile`, {
      name: 'Audit Customer Updated',
      locality: 'Ward 4, Besant Nagar'
    }, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const updated = res.data.data || res.data.user || res.data;
    recordTest(11, 'PUT /api/auth/profile (Update Profile)', 200, res.status, res.status === 200 && updated.name === 'Audit Customer Updated');
  } catch (err) {
    recordTest(11, 'PUT /api/auth/profile (Update Profile)', 200, err.response?.status || 500, false, err.message);
  }

  // --- Admin Login for Protected Actions ---
  // Admin accounts are never created through registration (only the
  // boot-time seed in db/seed.js creates the single admin account), so this
  // audit inserts its own ephemeral admin directly into MongoDB.
  try {
    const mongoose = require('mongoose');
    const User = require('../models/User');
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/workhive');
    }
    await new User({
      userId: 'adm-audit-' + Date.now(),
      name: 'Audit Administrator',
      phone: auditAdminPhone,
      email: auditAdminEmail,
      password: 'password123',
      role: 'admin',
      locality: 'Ward 4 Operations Desk',
      status: 'Active'
    }).save();

    const res = await axios.post(`${BASE_URL}/auth/login`, {
      identifier: auditAdminEmail,
      password: 'password123',
      role: 'admin'
    });
    adminToken = res.data.token || res.data.data?.token;
  } catch (err) {
    console.error('Failed to log in as admin:', err.message);
  }

  // --- SECTION 3: Workers Roster & Security ---
  console.log('\n--- 3. WORKERS ROSTER & ACCESS CONTROL ---');
  try {
    const wReg = await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Audit Worker Member',
      phone: auditWorkerPhone,
      password: 'password123',
      role: 'worker',
      skill: 'Plumbing'
    });
    testWorkerId = wReg.data.data?.userId || 'wor-audit';
    workerToken = wReg.data.data?.token || '';
  } catch (err) {
    testWorkerId = 'wor-audit';
  }

  try {
    const res = await axios.get(`${BASE_URL}/workers`);
    recordTest(12, 'GET /api/workers (Public Roster)', 200, res.status, res.status === 200 && Array.isArray(res.data.data));
  } catch (err) {
    recordTest(12, 'GET /api/workers (Public Roster)', 200, err.response?.status || 500, false, err.message);
  }

  try {
    const res = await axios.get(`${BASE_URL}/workers?skill=Plumbing`);
    recordTest(13, 'GET /api/workers?skill=Plumbing (Filtered)', 200, res.status, res.status === 200 && Array.isArray(res.data.data));
  } catch (err) {
    recordTest(13, 'GET /api/workers?skill=Plumbing (Filtered)', 200, err.response?.status || 500, false, err.message);
  }

  try {
    const res = await axios.get(`${BASE_URL}/workers/${testWorkerId}`);
    recordTest(14, 'GET /api/workers/:id (Worker Profile)', 200, res.status, res.status === 200 && !!res.data.data);
  } catch (err) {
    recordTest(14, 'GET /api/workers/:id (Worker Profile)', 200, err.response?.status || 500, false, err.message);
  }

  try {
    const res = await axios.get(`${BASE_URL}/workers/non_existent_worker_id_999`);
    recordTest(15, 'GET /api/workers/:id (Non-existent -> 404)', 404, res.status, false);
  } catch (err) {
    recordTest(15, 'GET /api/workers/:id (Non-existent -> 404)', 404, err.response?.status || 500, err.response?.status === 404);
  }

  try {
    const res = await axios.delete(`${BASE_URL}/workers/${testWorkerId}`);
    recordTest(16, 'DELETE /api/workers/:id without token -> 401', 401, res.status, false);
  } catch (err) {
    recordTest(16, 'DELETE /api/workers/:id without token -> 401', 401, err.response?.status || 500, err.response?.status === 401);
  }

  try {
    const res = await axios.delete(`${BASE_URL}/workers/${testWorkerId}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    recordTest(17, 'DELETE /api/workers/:id with customer token -> 403', 403, res.status, false);
  } catch (err) {
    recordTest(17, 'DELETE /api/workers/:id with customer token -> 403', 403, err.response?.status || 500, err.response?.status === 403);
  }

  // --- SECTION 4: Service Catalog & Protected Mutations ---
  console.log('\n--- 4. SERVICE CATALOG & PROTECTED MUTATIONS ---');
  try {
    const res = await axios.get(`${BASE_URL}/services`);
    recordTest(18, 'GET /api/services (Public Catalog)', 200, res.status, res.status === 200 && Array.isArray(res.data.data));
  } catch (err) {
    recordTest(18, 'GET /api/services (Public Catalog)', 200, err.response?.status || 500, false, err.message);
  }

  try {
    const res = await axios.post(`${BASE_URL}/services`, {
      title: 'Hacked Service',
      category: 'Unpermitted'
    });
    recordTest(19, 'POST /api/services without token -> 401', 401, res.status, false);
  } catch (err) {
    recordTest(19, 'POST /api/services without token -> 401', 401, err.response?.status || 500, err.response?.status === 401);
  }

  try {
    const res = await axios.post(`${BASE_URL}/services`, {
      serviceId: testServiceId,
      title: 'Solar Panel Maintenance',
      category: 'Electrical',
      description: 'Audit service inspection',
      baseRate: '₹600 visit fee',
      rateNumber: 600
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    recordTest(20, 'POST /api/services with Admin token -> 200/201', 201, res.status, (res.status === 200 || res.status === 201) && res.data.success);
  } catch (err) {
    recordTest(20, 'POST /api/services with Admin token -> 200/201', 201, err.response?.status || 500, false, err.message);
  }

  try {
    const res = await axios.put(`${BASE_URL}/services/${testServiceId}`, {
      title: 'Solar Panel & Inverter Maintenance'
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    recordTest(21, 'PUT /api/services/:id with Admin token -> 200', 200, res.status, res.status === 200);
  } catch (err) {
    recordTest(21, 'PUT /api/services/:id with Admin token -> 200', 200, err.response?.status || 500, false, err.message);
  }

  try {
    const res = await axios.delete(`${BASE_URL}/services/${testServiceId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    recordTest(22, 'DELETE /api/services/:id with Admin token -> 200', 200, res.status, res.status === 200);
  } catch (err) {
    recordTest(22, 'DELETE /api/services/:id with Admin token -> 200', 200, err.response?.status || 500, false, err.message);
  }

  // --- SECTION 5: Bookings Lifecycle & Validation ---
  console.log('\n--- 5. BOOKINGS LIFECYCLE & VALIDATION ---');
  try {
    const res = await axios.post(`${BASE_URL}/bookings`, {
      customerName: 'Audit Customer',
      customerPhone: uniquePhone,
      serviceCategory: 'Plumbing',
      amount: -100 // Invalid negative amount
    }, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    recordTest(23, 'POST /api/bookings (Negative amount -> 400)', 400, res.status, false);
  } catch (err) {
    recordTest(23, 'POST /api/bookings (Negative amount -> 400)', 400, err.response?.status || 500, err.response?.status === 400);
  }

  try {
    const res = await axios.post(`${BASE_URL}/bookings`, {
      customerName: 'Audit Customer',
      customerPhone: uniquePhone,
      customerAddress: 'Ward 4, Adyar',
      serviceCategory: 'Plumbing',
      serviceDetails: 'Leak repair',
      workerId: testWorkerId,
      workerName: 'Verified Worker',
      amount: 450
    }, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    createdBookingId = res.data.data.bookingId;
    recordTest(24, 'POST /api/bookings (Valid booking -> 201)', 201, res.status, res.status === 201 && !!createdBookingId);
  } catch (err) {
    recordTest(24, 'POST /api/bookings (Valid booking -> 201)', 201, err.response?.status || 500, false, err.message);
  }

  try {
    const res = await axios.get(`${BASE_URL}/bookings/${createdBookingId}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    recordTest(25, 'GET /api/bookings/:id (Fetch Booking)', 200, res.status, res.status === 200 && res.data.data.bookingId === createdBookingId);
  } catch (err) {
    recordTest(25, 'GET /api/bookings/:id (Fetch Booking)', 200, err.response?.status || 500, false, err.message);
  }

  try {
    const res = await axios.put(`${BASE_URL}/bookings/${createdBookingId}/status`, {
      status: 'on_the_way',
      isLocationSharing: true
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    recordTest(26, 'PUT /api/bookings/:id/status (Advance Status)', 200, res.status, res.status === 200 && res.data.data.status === 'on_the_way');
  } catch (err) {
    recordTest(26, 'PUT /api/bookings/:id/status (Advance Status)', 200, err.response?.status || 500, false, err.message);
  }

  try {
    const res = await axios.delete(`${BASE_URL}/bookings/${createdBookingId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    recordTest(27, 'DELETE /api/bookings/:id (Cancel/Delete)', 200, res.status, res.status === 200);
  } catch (err) {
    recordTest(27, 'DELETE /api/bookings/:id (Cancel/Delete)', 200, err.response?.status || 500, false, err.message);
  }

  // --- SECTION 6: Cooperative Society Operations ---
  console.log('\n--- 6. COOPERATIVE SOCIETY OPERATIONS ---');
  try {
    const res = await axios.get(`${BASE_URL}/cooperative/stats`);
    recordTest(28, 'GET /api/cooperative/stats (Fast Aggregation)', 200, res.status, res.status === 200 && res.data.data.dividendRate === '5.2%');
  } catch (err) {
    recordTest(28, 'GET /api/cooperative/stats (Fast Aggregation)', 200, err.response?.status || 500, false, err.message);
  }

  let pollId = '';
  try {
    const res = await axios.get(`${BASE_URL}/polls`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    pollId = res.data.data[0]?.pollId || '';
    recordTest(29, 'GET /api/polls', 200, res.status, res.status === 200 && Array.isArray(res.data.data));
  } catch (err) {
    recordTest(29, 'GET /api/polls', 200, err.response?.status || 500, false, err.message);
  }

  try {
    const res = await axios.post(`${BASE_URL}/polls/${pollId}/vote`, { choice: 'yes' }, {
      headers: { Authorization: `Bearer ${workerToken}` }
    });
    recordTest(30, 'POST /api/polls/:id/vote (Worker votes yes)', 200, res.status, res.status === 200);
  } catch (err) {
    recordTest(30, 'POST /api/polls/:id/vote (Worker votes yes)', 200, err.response?.status || 500, false, err.message);
  }

  try {
    const res = await axios.post(`${BASE_URL}/polls`, {
      title: 'Unauthenticated poll'
    });
    recordTest(31, 'POST /api/polls without token -> 401', 401, res.status, false);
  } catch (err) {
    recordTest(31, 'POST /api/polls without token -> 401', 401, err.response?.status || 500, err.response?.status === 401);
  }

  try {
    const res = await axios.get(`${BASE_URL}/cooperative/claims`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    recordTest(32, 'GET /api/cooperative/claims', 200, res.status, res.status === 200 && Array.isArray(res.data.data));
  } catch (err) {
    recordTest(32, 'GET /api/cooperative/claims', 200, err.response?.status || 500, false, err.message);
  }

  // --- SECTION 7: Complaints & Grievances ---
  console.log('\n--- 7. COMPLAINTS & GRIEVANCES ---');
  let complaintId = '';
  try {
    const res = await axios.post(`${BASE_URL}/complaints`, {
      complainant: 'Audit Customer',
      against: 'Verified Worker',
      category: 'Billing Query',
      description: 'Audit test grievance filing'
    }, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    complaintId = res.data.data.complaintId;
    recordTest(33, 'POST /api/complaints (File Grievance)', 201, res.status, res.status === 201 && !!complaintId);
  } catch (err) {
    recordTest(33, 'POST /api/complaints (File Grievance)', 201, err.response?.status || 500, false, err.message);
  }

  try {
    const res = await axios.get(`${BASE_URL}/complaints`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    recordTest(34, 'GET /api/complaints', 200, res.status, res.status === 200 && Array.isArray(res.data.data));
  } catch (err) {
    recordTest(34, 'GET /api/complaints', 200, err.response?.status || 500, false, err.message);
  }

  try {
    const res = await axios.put(`${BASE_URL}/complaints/${complaintId}`, {
      status: 'Resolved'
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    recordTest(35, 'PUT /api/complaints/:id (Resolve Grievance)', 200, res.status, res.status === 200);
  } catch (err) {
    recordTest(35, 'PUT /api/complaints/:id (Resolve Grievance)', 200, err.response?.status || 500, false, err.message);
  }

  // --- SECTION 8: Admin Protected Telemetry & Operations ---
  console.log('\n--- 8. ADMIN PROTECTED TELEMETRY & OPERATIONS ---');
  try {
    const res = await axios.get(`${BASE_URL}/admin/stats`);
    recordTest(36, 'GET /api/admin/stats without token -> 401', 401, res.status, false);
  } catch (err) {
    recordTest(36, 'GET /api/admin/stats without token -> 401', 401, err.response?.status || 500, err.response?.status === 401);
  }

  try {
    const res = await axios.get(`${BASE_URL}/admin/stats`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    recordTest(37, 'GET /api/admin/stats with Customer token -> 403', 403, res.status, false);
  } catch (err) {
    recordTest(37, 'GET /api/admin/stats with Customer token -> 403', 403, err.response?.status || 500, err.response?.status === 403);
  }

  try {
    const res = await axios.get(`${BASE_URL}/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    recordTest(38, 'GET /api/admin/stats with Admin token -> 200 OK', 200, res.status, res.status === 200 && typeof res.data.data.totalWorkers === 'number');
  } catch (err) {
    recordTest(38, 'GET /api/admin/stats with Admin token -> 200 OK', 200, err.response?.status || 500, false, err.message);
  }

  // --- Teardown: Clean up ephemeral audit records ---
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/workhive');
    }
    await Promise.all([
      mongoose.connection.db.collection('users').deleteMany({
        $or: [{ phone: uniquePhone }, { email: auditAdminEmail }, { phone: auditAdminPhone }, { phone: auditWorkerPhone }]
      }),
      mongoose.connection.db.collection('workers').deleteMany({ phone: auditWorkerPhone }),
      ...(createdBookingId ? [mongoose.connection.db.collection('bookings').deleteOne({ bookingId: createdBookingId })] : [])
    ]);
    await mongoose.disconnect();
    console.log('  [TEARDOWN] All ephemeral test records successfully purged from database.');
  } catch (e) {
    console.error('Teardown caught exception:', e);
  }

  // --- Final Summary ---
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log('\n' + '='.repeat(85));
  console.log(`  ROUTE AUDIT SUMMARY: ${passed} / ${total} TESTS PASSED (${Math.round((passed / total) * 100)}% SUCCESS RATE)`);
  console.log('='.repeat(85) + '\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
