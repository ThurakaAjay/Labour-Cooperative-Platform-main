const Worker = require('../models/Worker');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const Complaint = require('../models/Complaint');
const WelfareClaim = require('../models/WelfareClaim');
const User = require('../models/User');
const { clearAllDatabaseData } = require('../db/seed');
const ApiError = require('../utils/apiError');

class AdminService {
  /**
   * Aggregate live telemetry for admin dashboard
   * Fully optimized with concurrent Promise.all execution and MongoDB $facet aggregation
   */
  static async getMetrics() {
    const [
      totalWorkers,
      verifiedWorkers,
      pendingWorkers,
      activeWorkers,
      totalCustomers,
      totalComplaints,
      totalServices,
      totalClaims,
      bookingStats
    ] = await Promise.all([
      Worker.countDocuments(),
      Worker.countDocuments({ status: 'Verified' }),
      Worker.countDocuments({ status: 'Pending' }),
      Worker.countDocuments({ status: 'Verified', isOnline: true }),
      User.countDocuments({ role: 'customer' }),
      Complaint.countDocuments(),
      Service.countDocuments(),
      WelfareClaim.countDocuments(),
      Booking.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            completed: [
              { $match: { status: { $in: ['completed', 'paid', 'rated'] } } },
              { $group: { _id: null, count: { $sum: 1 }, gross: { $sum: '$amount' } } }
            ],
            pending: [
              { $match: { status: { $in: ['pending', 'accepted', 'in_progress'] } } },
              { $count: 'count' }
            ],
            active: [
              { $match: { status: { $in: ['pending', 'accepted', 'in_progress', 'on_the_way', 'arrived', 'working'] } } },
              { $count: 'count' }
            ]
          }
        }
      ])
    ]);

    const facet = bookingStats[0] || {};
    const todayJobs = facet.total?.[0]?.count || 0;
    const completedJobs = facet.completed?.[0]?.count || 0;
    const totalGross = facet.completed?.[0]?.gross || 0;
    const pendingJobs = facet.pending?.[0]?.count || 0;
    const activeJobs = facet.active?.[0]?.count || 0;

    const totalEarningsDistributed = Math.round(totalGross * 0.95);
    const welfareFundBalance = Math.round(totalGross * 0.05);
    const coopSurplus = Math.round(totalGross * 0.05);

    return {
      totalWorkers,
      verifiedWorkers,
      pendingWorkers,
      activeWorkers,
      totalCustomers,
      todayJobs,
      completedJobs,
      pendingJobs,
      activeJobs,
      totalEarningsDistributed,
      welfareFundBalance,
      coopSurplus,
      averageRating: 5.0,
      totalComplaints,
      totalServices,
      totalClaims
    };
  }

  /**
   * Get all registered customers, enriched with booking history counts
   * (RBAC admin directory: complete profile metadata + booking history).
   */
  static async getCustomers() {
    const customers = await User.find({ role: 'customer' }).select('-password').lean();
    if (customers.length === 0) return { count: 0, data: [] };

    const bookingCounts = await Booking.aggregate([
      { $match: { customerId: { $in: customers.map(c => c.userId) } } },
      {
        $group: {
          _id: '$customerId',
          totalBookings: { $sum: 1 },
          completedBookings: {
            $sum: { $cond: [{ $in: ['$status', ['completed', 'paid', 'rated']] }, 1, 0] }
          }
        }
      }
    ]);
    const countsByCustomerId = Object.fromEntries(bookingCounts.map(b => [b._id, b]));

    const data = customers.map(c => ({
      ...c,
      totalBookings: countsByCustomerId[c.userId]?.totalBookings || 0,
      completedBookings: countsByCustomerId[c.userId]?.completedBookings || 0
    }));

    return { count: data.length, data };
  }

  /**
   * Get the full worker roster — all verification/status states, including
   * uploaded documents — enriched with booking history counts. This is the
   * admin-only counterpart to the public, verified-only WorkerService.getWorkers.
   */
  static async getWorkers() {
    const workers = await Worker.find().sort({ createdAt: -1 }).lean();
    if (workers.length === 0) return { count: 0, data: [] };

    const bookingCounts = await Booking.aggregate([
      { $match: { workerId: { $in: workers.map(w => w.workerId) } } },
      {
        $group: {
          _id: '$workerId',
          totalBookings: { $sum: 1 },
          completedBookings: {
            $sum: { $cond: [{ $in: ['$status', ['completed', 'paid', 'rated']] }, 1, 0] }
          }
        }
      }
    ]);
    const countsByWorkerId = Object.fromEntries(bookingCounts.map(b => [b._id, b]));

    const data = workers.map(w => ({
      ...w,
      totalBookings: countsByWorkerId[w.workerId]?.totalBookings || 0,
      completedBookings: countsByWorkerId[w.workerId]?.completedBookings || 0
    }));

    return { count: data.length, data };
  }

  /**
   * Toggle a user's (and, if applicable, their linked worker record's)
   * active/suspended status.
   */
  static async updateUserStatus(userId, status) {
    if (!['Active', 'Suspended'].includes(status)) {
      throw new ApiError(400, "Invalid status: must be 'Active' or 'Suspended'.");
    }

    const user = await User.findOneAndUpdate({ userId }, { status }, { returnDocument: 'after' });
    if (!user) {
      throw new ApiError(404, `User with ID '${userId}' not found`);
    }

    if (user.role === 'worker') {
      const worker = await Worker.findOne({ $or: [{ workerId: user.userId }, { phone: user.phone }] });
      if (worker) {
        if (status === 'Suspended') {
          worker.status = 'Suspended';
          worker.isOnline = false;
        } else {
          // Reactivating only restores 'Verified' if the worker actually
          // passed document review — otherwise it falls back to 'Pending'
          // rather than skipping the verification pipeline.
          worker.status = worker.verificationStatus === 'verified' ? 'Verified' : 'Pending';
        }
        await worker.save();
      }
    }

    return user;
  }

  /**
   * Reset demo data to clean slate
   */
  static async resetDemo() {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_RESET !== 'true') {
      throw new ApiError(403, 'Database wipe is disabled in production environments for safety.');
    }

    await clearAllDatabaseData();
    return { message: 'Database reset to clean initial state.' };
  }
}

module.exports = AdminService;
