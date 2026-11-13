const WelfareClaim = require('../models/WelfareClaim');
const Worker = require('../models/Worker');
const Booking = require('../models/Booking');
const ApiError = require('../utils/apiError');

class CooperativeService {
  /**
   * Summary metrics for audited society pool
   * Optimized with concurrent queries and MongoDB aggregation
   */
  static async getStats() {
    const [
      totalWorkers,
      activeWorkers,
      grossAgg,
      totalClaims
    ] = await Promise.all([
      Worker.countDocuments(),
      Worker.countDocuments({ isOnline: true }),
      Booking.aggregate([
        { $match: { status: { $in: ['completed', 'paid', 'rated'] } } },
        { $group: { _id: null, totalGross: { $sum: '$amount' } } }
      ]),
      WelfareClaim.countDocuments()
    ]);

    const totalGross = grossAgg[0]?.totalGross || 0;
    const workerDirectEarnings = Math.round(totalGross * 0.95);
    const welfareEscrowPool = Math.round(totalGross * 0.05);
    const retainedSurplus = Math.round(totalGross * 0.05);

    return {
      totalWorkers,
      activeWorkers,
      totalEarningsDistributed: workerDirectEarnings,
      welfareFundBalance: welfareEscrowPool,
      coopSurplus: retainedSurplus,
      totalClaimsCount: totalClaims,
      dividendRate: '5.2%',
      splits: {
        workerWage: '95%',
        welfareReserve: '5%',
        platformCut: '0%'
      },
      societyName: 'Chennai Central Labour Cooperative Society Ltd.',
      registrationNumber: 'TN-CHE-2024-88402'
    };
  }

  /**
   * Fetch welfare & insurance claims log (Role-Scoped & Paginated)
   */
  static async getClaims(user = {}, { page = 1, limit = 50 } = {}) {
    const escapeRegex = require('../utils/escapeRegex');
    const query = {};

    // Privacy protection: workers view own claims; admins view all claims
    if (user.role === 'worker') {
      const escapedUserName = escapeRegex(user.name || 'nomatch');
      query.$or = [
        { workerId: user.userId },
        { recipient: new RegExp(`^${escapedUserName}(\\s|$)`, 'i') }
      ];
    } else if (user.role && user.role !== 'admin') {
      return { count: 0, total: 0, page: 1, totalPages: 0, data: [] };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [total, claims] = await Promise.all([
      WelfareClaim.countDocuments(query),
      WelfareClaim.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
    ]);

    return {
      count: claims.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      data: claims
    };
  }

  /**
   * Submit welfare / subsidy claim
   */
  static async createClaim({ title, amount, category, details }, user = {}) {
    const claimId = 'CLM-' + Math.floor(1000 + Math.random() * 9000);
    const amountNum = Number(amount) || 0;
    const workerName = user.name || 'Cooperative Worker';
    const workerId = user.userId || 'worker';

    return WelfareClaim.create({
      claimId,
      title: title || 'Tool Upgrade & Safety Gear Subsidy',
      recipient: `${workerName} (Member)`,
      workerId,
      workerName,
      amount: `₹${amountNum.toLocaleString('en-IN')}`,
      amountNum,
      category: category || 'Medical & Accident',
      details: details || 'Approved by Ward 4 Cooperative Society',
      status: 'Pending Review',
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    });
  }

  /**
   * Admin approves / settles / updates welfare claim
   */
  static async updateClaimStatus(id, { status, resolutionNotes }) {
    if (!['Pending Review', 'Approved', 'Disbursed', 'Settled', 'Rejected'].includes(status)) {
      throw new ApiError(400, `Invalid claim status '${status}'`);
    }

    let query = { claimId: id };
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { $or: [{ claimId: id }, { _id: id }] };
    }

    const claim = await WelfareClaim.findOne(query);
    if (!claim) {
      throw new ApiError(404, `Welfare claim with ID '${id}' not found`);
    }

    claim.status = status;
    if (resolutionNotes) claim.details = resolutionNotes;

    // A 'welfare_withdrawal' claim draws down the worker's actual
    // welfareFundBalance the first time it's moved into any settled-ish
    // state — gated on the `disbursed` flag so approving, then later
    // re-marking as Settled, never deducts twice.
    const isSettling = ['Approved', 'Disbursed', 'Settled'].includes(status);
    if (claim.category === 'welfare_withdrawal' && isSettling && !claim.disbursed) {
      const worker = await Worker.findOne({ workerId: claim.workerId });
      if (!worker) {
        throw new ApiError(404, `Worker '${claim.workerId}' for this withdrawal claim was not found.`);
      }
      if (worker.welfareFundBalance < claim.amountNum) {
        throw new ApiError(400, `Worker's welfare balance (₹${worker.welfareFundBalance}) is less than the withdrawal amount (₹${claim.amountNum}).`);
      }
      worker.welfareFundBalance -= claim.amountNum;
      await worker.save();
      claim.disbursed = true;
    }

    return claim.save();
  }
}

module.exports = CooperativeService;
