const Worker = require('../models/Worker');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const escapeRegex = require('../utils/escapeRegex');

class WorkerService {
  /**
   * True once a worker has filled in everything Smart Match / booking
   * assignment needs: at least one skill, experience, at least one language,
   * a chosen service radius, at least one open availability slot, and a
   * payout method to actually get paid. Computed here — never accepted
   * verbatim from a client — so `isProfileComplete` can't be self-certified
   * via a crafted PUT body (same reasoning as why `verificationStatus` is
   * server-owned).
   */
  static isProfileDataComplete(worker) {
    const hasSkills = Array.isArray(worker.skills) && worker.skills.length > 0;
    const hasExperience = Boolean(worker.experience);
    const hasLanguages = Array.isArray(worker.languages) && worker.languages.length > 0;
    const hasRadius = worker.serviceRadius !== null && worker.serviceRadius !== undefined;

    let hasAvailability = false;
    if (worker.weeklyAvailability) {
      const days = worker.weeklyAvailability instanceof Map
        ? Array.from(worker.weeklyAvailability.values())
        : Object.values(worker.weeklyAvailability);
      hasAvailability = days.some((d) => d && (d.morning || d.afternoon || d.evening));
    }

    const payment = worker.paymentDetails || {};
    const hasPayment = payment.payoutType === 'bank'
      ? Boolean(payment.bankAccount?.accountNumber && payment.bankAccount?.ifsc)
      : Boolean(payment.upiId);

    return hasSkills && hasExperience && hasLanguages && hasRadius && hasAvailability && hasPayment;
  }

  /**
   * Flattens a client-supplied nested block (paymentDetails / healthInsurance
   * / accidentCoverage) to dot-notation update keys, e.g.
   * `{ paymentDetails: { upiId: 'x' } }` -> `{ 'paymentDetails.upiId': 'x' }`.
   * Passing the nested object as-is to findOneAndUpdate would replace the
   * *entire* embedded object, silently wiping sibling fields (a worker
   * saving a new UPI id would erase their bankAccount; an admin verifying
   * payment would erase the worker's own upiId). Mongoose auto-wraps a
   * plain (non-`$`) update object in `$set`, so dot-notation keys here merge
   * onto just the named leaf paths instead.
   */
  static flattenNestedUpdate(prefix, incoming) {
    const flat = {};
    for (const [key, value] of Object.entries(incoming)) {
      const path = `${prefix}.${key}`;
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        Object.assign(flat, WorkerService.flattenNestedUpdate(path, value));
      } else {
        flat[path] = value;
      }
    }
    return flat;
  }

  /**
   * Deep-merges a client-supplied nested block onto the existing in-memory
   * value, purely to compute what the record *will* look like after the
   * update (see isProfileDataComplete's call site) — the actual DB write
   * uses flattenNestedUpdate instead.
   */
  static deepMerge(base, incoming) {
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return incoming;
    const result = { ...(base || {}) };
    for (const [key, value] of Object.entries(incoming)) {
      result[key] = (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date))
        ? WorkerService.deepMerge(base?.[key], value)
        : value;
    }
    return result;
  }

  /**
   * Get workers list with filtering and search
   */
  static async getWorkers({ skill, search, page = 1, limit = 50 }) {
    // Customer visibility guard: this is the public worker directory used
    // for search/matching/booking. Only fully verified AND fully onboarded
    // workers may ever be queryable or searchable here — any client-supplied
    // status/verification filter is ignored, not merely defaulted, so it
    // can't be overridden. Admins get the full roster (including
    // pending/rejected/incomplete) through the dedicated authenticated
    // admin.service.getWorkers instead.
    const query = { verificationStatus: 'verified', isProfileComplete: true };

    if (skill) {
      const escapedSkill = escapeRegex(skill);
      query.$or = [
        { skill: new RegExp(escapedSkill, 'i') },
        { skills: new RegExp(escapedSkill, 'i') }
      ];
    }

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { name: searchRegex },
        { skill: searchRegex },
        { locality: searchRegex },
        { societyReg: searchRegex }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [total, workers] = await Promise.all([
      Worker.countDocuments(query),
      Worker.find(query)
        .select('-documents')
        .sort({ rating: -1, completedJobs: -1 })
        .skip(skip)
        .limit(limitNum)
    ]);

    return {
      count: workers.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      data: workers
    };
  }

  /**
   * Get single worker by ID
   */
  static async getWorkerById(id) {
    let worker = await Worker.findOne({ workerId: id }).select('-documents');
    if (!worker && id.match(/^[0-9a-fA-F]{24}$/)) {
      worker = await Worker.findById(id).select('-documents');
    }

    if (!worker) {
      throw new ApiError(404, `Worker with ID '${id}' not found`);
    }

    return worker;
  }

  /**
   * Register a new worker profile
   */
  static async createWorker(data) {
    const { name, phone, skill, experience, locality, documents = [], paymentDetails, nominee } = data;

    const workerId = data.workerId || 'wrk-' + Date.now();
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase() || 'WK';

    const newWorker = new Worker({
      workerId,
      name,
      phone,
      skill,
      skills: [skill],
      avatar: initials,
      experience: experience || '1 year',
      locality: locality || 'Ward 4, Chennai',
      status: 'Pending',
      badge: 'Pending Verification',
      societyReg: `Coop #TN-CHE-${Math.floor(100 + Math.random() * 900)}`,
      documents,
      // Registration wizard's payout step and nominee step — captured now so
      // they don't have to be re-entered later just to complete the profile.
      paymentDetails: paymentDetails ? {
        payoutType: paymentDetails.payoutType === 'bank' ? 'bank' : 'upi',
        upiId: paymentDetails.upiId || '',
        bankAccount: {
          accountNumber: paymentDetails.bankAccount?.accountNumber || '',
          ifsc: paymentDetails.bankAccount?.ifsc || '',
          bankName: paymentDetails.bankAccount?.bankName || ''
        }
      } : undefined,
      accidentCoverage: nominee ? {
        nominee: {
          name: nominee.name || '',
          relation: nominee.relation || '',
          payout: nominee.payout || ''
        }
      } : undefined
    });

    return newWorker.save();
  }

  /**
   * Update worker profile and sync user status if needed
   */
  static async updateWorker(id, updates) {
    let existing = await Worker.findOne({ workerId: id });
    let matchKey = { workerId: id };
    if (!existing && id.match(/^[0-9a-fA-F]{24}$/)) {
      existing = await Worker.findById(id);
      matchKey = { _id: id };
    }
    if (!existing) {
      throw new ApiError(404, `Worker with ID '${id}' not found`);
    }

    const existingObj = existing.toObject();
    const NESTED_BLOCKS = ['paymentDetails', 'healthInsurance', 'accidentCoverage'];

    // Compute completeness against what the record will look like *after*
    // this update (existing fields merged with the incoming ones), not the
    // stale pre-update state — otherwise saving the field that finally
    // completes the profile wouldn't flip isProfileComplete until the next
    // unrelated save. Nested blocks need a deep merge here (not a shallow
    // spread) so e.g. saving just paymentDetails.upiId doesn't read back as
    // having wiped out bankAccount for this completeness check.
    const merged = { ...existingObj, ...updates };
    for (const key of NESTED_BLOCKS) {
      if (updates[key] && typeof updates[key] === 'object') {
        merged[key] = WorkerService.deepMerge(existingObj[key], updates[key]);
      }
    }

    // Going online is gated on admin verification, enforced here (not just
    // hidden in the UI) so a direct API call can't bypass it. Checked against
    // the merged, not-yet-committed state so this can't be raced by pairing
    // isOnline:true with a verificationStatus change in the same request
    // (verificationStatus itself is stripped from non-admin bodies upstream
    // in the controller, so this only ever reads the real, current value).
    if (updates.isOnline === true && merged.verificationStatus !== 'verified') {
      throw new ApiError(403, 'Only verified workers can go online.');
    }

    const finalUpdates = { isProfileComplete: WorkerService.isProfileDataComplete(merged) };
    for (const [key, value] of Object.entries(updates)) {
      if (NESTED_BLOCKS.includes(key) && value && typeof value === 'object') {
        Object.assign(finalUpdates, WorkerService.flattenNestedUpdate(key, value));
      } else {
        finalUpdates[key] = value;
      }
    }

    const worker = await Worker.findOneAndUpdate(matchKey, finalUpdates, { returnDocument: 'after', runValidators: true });

    if (!worker) {
      throw new ApiError(404, `Worker with ID '${id}' not found`);
    }

    // Sync linked user account status if verification changed
    if (updates.status) {
      await User.findOneAndUpdate(
        { $or: [{ userId: worker.workerId }, { phone: worker.phone, role: 'worker' }] },
        { status: updates.status }
      );
    }

    return worker;
  }

  /**
   * Attach uploaded verification documents (already stored in Cloudinary by
   * the controller) to a worker's profile, and move the pipeline to
   * 'pending' review — including on resubmission after a rejection.
   */
  static async addDocuments(id, uploadedDocs) {
    let worker = await Worker.findOne({ workerId: id });
    if (!worker && id.match(/^[0-9a-fA-F]{24}$/)) {
      worker = await Worker.findById(id);
    }
    if (!worker) {
      throw new ApiError(404, `Worker with ID '${id}' not found`);
    }

    worker.documents.push(...uploadedDocs);
    if (worker.verificationStatus !== 'verified') {
      worker.verificationStatus = 'pending';
      worker.rejectionReason = '';
    }
    return worker.save();
  }

  /**
   * Admin approves or rejects a worker's submitted verification documents.
   */
  static async reviewVerification(id, { decision, rejectionReason }) {
    if (!['approve', 'reject'].includes(decision)) {
      throw new ApiError(400, "Invalid decision: must be 'approve' or 'reject'.");
    }
    if (decision === 'reject' && !rejectionReason?.trim()) {
      throw new ApiError(400, 'A rejection reason is required.');
    }

    let worker = await Worker.findOne({ workerId: id });
    if (!worker && id.match(/^[0-9a-fA-F]{24}$/)) {
      worker = await Worker.findById(id);
    }
    if (!worker) {
      throw new ApiError(404, `Worker with ID '${id}' not found`);
    }

    if (worker.documents.length === 0) {
      throw new ApiError(400, 'This worker has not submitted any verification documents yet.');
    }

    if (decision === 'approve') {
      worker.verificationStatus = 'verified';
      worker.rejectionReason = '';
      if (worker.status !== 'Suspended') worker.status = 'Verified';
      worker.badge = 'Verified Cooperative Worker';
    } else {
      worker.verificationStatus = 'rejected';
      worker.rejectionReason = rejectionReason.trim();
      if (worker.status !== 'Suspended') worker.status = 'Pending';
      worker.badge = 'Verification Rejected';
    }

    const saved = await worker.save();

    await User.findOneAndUpdate(
      { $or: [{ userId: saved.workerId }, { phone: saved.phone, role: 'worker' }] },
      { status: saved.status }
    );

    return saved;
  }

  /**
   * Resolve a worker by workerId or Mongo _id, or throw 404. Shared by the
   * admin-only insurance/welfare/payment-verification actions below, which
   * all address a worker the same way the rest of this service does.
   */
  static async findWorkerOrThrow(id) {
    let worker = await Worker.findOne({ workerId: id });
    if (!worker && id.match(/^[0-9a-fA-F]{24}$/)) {
      worker = await Worker.findById(id);
    }
    if (!worker) {
      throw new ApiError(404, `Worker with ID '${id}' not found`);
    }
    return worker;
  }

  /**
   * Admin issues or updates a worker's health/accident cooperative
   * insurance. Generates a policy number when one isn't supplied so an
   * admin doesn't have to invent one for a first-time issuance.
   */
  static async issueInsurance(id, { healthInsurance, accidentCoverage } = {}) {
    const worker = await WorkerService.findWorkerOrThrow(id);
    const genPolicyNumber = () => `TN-COOP-${(worker.workerId || '').slice(-6).toUpperCase() || Math.floor(100000 + Math.random() * 900000)}`;

    if (healthInsurance) {
      worker.healthInsurance = {
        ...worker.healthInsurance.toObject(),
        ...healthInsurance,
        active: healthInsurance.active !== false,
        policyNumber: healthInsurance.policyNumber || worker.healthInsurance.policyNumber || genPolicyNumber(),
        issuedAt: worker.healthInsurance.issuedAt || new Date()
      };
    }

    if (accidentCoverage) {
      const currentNominee = worker.accidentCoverage.nominee.toObject();
      worker.accidentCoverage = {
        ...worker.accidentCoverage.toObject(),
        ...accidentCoverage,
        // Admin issuance only ever touches coverage terms — the nominee
        // stays whatever the worker last set via their own PATCH (see
        // worker.controller.js#updateWorker's non-admin whitelist).
        nominee: currentNominee,
        active: accidentCoverage.active !== false,
        policyNumber: accidentCoverage.policyNumber || worker.accidentCoverage.policyNumber || genPolicyNumber(),
        issuedAt: worker.accidentCoverage.issuedAt || new Date()
      };
    }

    return worker.save();
  }

  /**
   * Admin manually credits/debits a worker's welfare fund balance (e.g. a
   * reconciliation correction). Automatic 5%-of-job credits and
   * withdrawal-claim debits happen elsewhere (booking completion pipeline /
   * cooperative.service.js#updateClaimStatus respectively) — this is the
   * manual override path.
   */
  static async adjustWelfareBalance(id, { amount, reason } = {}) {
    const delta = Number(amount);
    if (!Number.isFinite(delta) || delta === 0) {
      throw new ApiError(400, 'A non-zero numeric amount is required.');
    }

    const worker = await WorkerService.findWorkerOrThrow(id);
    const nextBalance = worker.welfareFundBalance + delta;
    if (nextBalance < 0) {
      throw new ApiError(400, `Adjustment would take the welfare balance negative (current: ₹${worker.welfareFundBalance}).`);
    }

    worker.welfareFundBalance = nextBalance;
    return worker.save();
  }

  /**
   * Admin marks a worker's declared UPI/bank payout details as verified (or
   * reverts them), enabling the "Instant Auto-Credit" badge client-side.
   */
  static async verifyPaymentDetails(id, { verificationStatus } = {}) {
    if (!['unverified', 'pending', 'verified'].includes(verificationStatus)) {
      throw new ApiError(400, "Invalid verificationStatus: must be 'unverified', 'pending', or 'verified'.");
    }
    const worker = await WorkerService.findWorkerOrThrow(id);
    worker.paymentDetails.verificationStatus = verificationStatus;
    return worker.save();
  }

  /**
   * Self-service snapshot for GET /api/workers/welfare — just the slice of
   * the worker record the Welfare page actually renders.
   */
  static async getWelfareSnapshot(id) {
    const worker = await WorkerService.findWorkerOrThrow(id);
    return {
      workerId: worker.workerId,
      name: worker.name,
      societyReg: worker.societyReg,
      welfareFundBalance: worker.welfareFundBalance,
      healthInsurance: worker.healthInsurance,
      accidentCoverage: worker.accidentCoverage,
      paymentDetails: worker.paymentDetails
    };
  }

  /**
   * Delete or suspend worker
   */
  static async deleteWorker(id) {
    let worker = await Worker.findOneAndDelete({ workerId: id });
    if (!worker && id.match(/^[0-9a-fA-F]{24}$/)) {
      worker = await Worker.findByIdAndDelete(id);
    }

    if (!worker) {
      throw new ApiError(404, `Worker with ID '${id}' not found`);
    }

    return worker;
  }
}

module.exports = WorkerService;
