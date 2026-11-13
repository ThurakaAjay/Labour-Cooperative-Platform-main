const User = require('../models/User');
const { DEFAULT_LOCALITY, DEFAULT_SOCIETY_ID } = require('../config/constants');
const Worker = require('../models/Worker');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const Complaint = require('../models/Complaint');
const Poll = require('../models/Poll');
const Vote = require('../models/Vote');
const WelfareClaim = require('../models/WelfareClaim');
const AdminMetric = require('../models/AdminMetric');

// Standard cooperative service categories catalog
const defaultServices = [
  {
    serviceId: 'plumber',
    title: 'Plumber & Pipe Repairs',
    description: 'Tap leakages, kitchen drainage, pipe blocks, and overhead tank setups.',
    icon: 'Wrench',
    emoji: '🔧',
    baseRate: '₹300 fixed visit fee',
    rateNumber: 300,
    duration: '1 - 2 hours',
    popular: true,
    category: 'Repairs'
  },
  {
    serviceId: 'electrician',
    title: 'Electrician & Wiring',
    description: 'Switchboards, MCB trippings, fan installations, and inverter lines.',
    icon: 'Zap',
    emoji: '⚡',
    baseRate: '₹250 fixed visit fee',
    rateNumber: 250,
    duration: '1 - 2 hours',
    popular: true,
    category: 'Repairs'
  },
  {
    serviceId: 'cleaning',
    title: 'Home Deep Cleaning',
    description: 'Kitchen degreasing, bathroom sanitation, and complete house sanitization.',
    icon: 'Sparkles',
    emoji: '✨',
    baseRate: '₹350 / session',
    rateNumber: 350,
    duration: '2 - 3 hours',
    popular: true,
    category: 'Household'
  },
  {
    serviceId: 'carpenter',
    title: 'Carpentry & Woodwork',
    description: 'Door hinge alignment, modular furniture repairs, and locks fitting.',
    icon: 'Hammer',
    emoji: '🪚',
    baseRate: '₹350 fixed visit fee',
    rateNumber: 350,
    duration: '1 - 3 hours',
    popular: false,
    category: 'Repairs'
  },
  {
    serviceId: 'painter',
    title: 'Painting & Waterproofing',
    description: 'Wall touch-ups, weather-proof coatings, and stain removal.',
    icon: 'Paintbrush',
    emoji: '🎨',
    baseRate: '₹400 / room',
    rateNumber: 400,
    duration: '3 - 5 hours',
    popular: false,
    category: 'Household'
  },
  {
    serviceId: 'caregiver',
    title: 'Elder Care Assistance',
    description: 'Daytime assistance, companion care, mobility support, and medicine tracking.',
    icon: 'HeartPulse',
    emoji: '🩺',
    baseRate: '₹450 / day',
    rateNumber: 450,
    duration: '4 - 8 hours',
    popular: true,
    category: 'Caregiving'
  },
  {
    serviceId: 'gardener',
    title: 'Garden & Plant Care',
    description: 'Balcony garden setup, pruning, organic compost, and pest treatment.',
    icon: 'Sprout',
    emoji: '🌱',
    baseRate: '₹280 / session',
    rateNumber: 280,
    duration: '1 - 2 hours',
    popular: false,
    category: 'Household'
  },
  {
    serviceId: 'technician',
    title: 'Appliance Repair',
    description: 'AC servicing, washing machines, refrigerators, and RO water purifiers.',
    icon: 'Cpu',
    emoji: '⚙️',
    baseRate: '₹350 fixed visit fee',
    rateNumber: 350,
    duration: '1 - 2 hours',
    popular: true,
    category: 'Repairs'
  }
];

// Clean wipe of all data from MongoDB (Primes zero-data state)
const clearAllDatabaseData = async () => {
  try {
    console.log('[MongoDB] Clearing all user, worker, booking, and complaint data from database...');
    await Promise.all([
      User.deleteMany({}),
      Worker.deleteMany({}),
      Booking.deleteMany({}),
      Complaint.deleteMany({}),
      Poll.deleteMany({}),
      Vote.deleteMany({}),
      WelfareClaim.deleteMany({}),
      AdminMetric.deleteMany({}),
      Service.deleteMany({})
    ]);

    // Re-seed standard services catalog so booking categories exist
    await Service.insertMany(defaultServices);

    // Re-seed a default democratic poll
    await Poll.create(defaultPoll);

    // Initialize clean zeroed admin metrics document
    await AdminMetric.create({
      metricKey: 'primary_node_metrics',
      totalWorkers: 0,
      activeWorkers: 0,
      todayJobs: 0,
      completedJobs: 0,
      pendingJobs: 0,
      totalEarningsDistributed: 0,
      welfareFundBalance: 0,
      coopSurplus: 0,
      averageRating: 5.0
    });

    console.log('[MongoDB] Database successfully cleared of all mock/test data! Zero users, zero workers.');
  } catch (err) {
    console.error('[MongoDB] Error clearing database:', err);
    throw err;
  }
};

const defaultPoll = {
  pollId: 'POLL-DEFAULT-01',
  title: 'Should 5% of cooperative surplus be allocated to emergency worker assistance?',
  description: 'This resolution authorizes the cooperative committee to earmark 5% of monthly surplus revenues into an immediate, zero-interest emergency hardship grant pool for active members facing medical or extreme weather distress.',
  startsAt: new Date(),
  endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  isActive: true,
  createdBy: 'system'
};

const seedDatabase = async (force = false) => {
  try {
    const serviceCount = await Service.countDocuments();
    if (serviceCount === 0) {
      await Service.insertMany(defaultServices);
      console.log('[MongoDB] Standard service catalog initialized.');
    }

    const pollCount = await Poll.countDocuments();
    if (pollCount === 0) {
      await Poll.create(defaultPoll);
      console.log('[MongoDB] Democratic voting poll initialized.');
    }

    // Zero users/workers are created on boot. Only real registered accounts appear.
  } catch (err) {
    console.error('[MongoDB] Seeding error:', err);
  }
};

// Creates the single administrator account from ADMIN_EMAIL/ADMIN_PASSWORD env
// vars if no admin exists yet. This is the only way an admin account is ever
// created — public self-registration as 'admin' is rejected (see auth.service.js).
const ensureAdminUser = async () => {
  try {
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) return;

    const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_PHONE } = process.env;
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      console.warn('[MongoDB] No admin account exists yet, and ADMIN_EMAIL/ADMIN_PASSWORD are not set in .env — skipping admin creation.');
      return;
    }

    const admin = new User({
      userId: 'adm-' + Date.now(),
      name: ADMIN_NAME || 'Administrator',
      phone: ADMIN_PHONE || '9999999999',
      email: ADMIN_EMAIL.trim().toLowerCase(),
      password: ADMIN_PASSWORD, // Hashed by the User pre-save hook
      role: 'admin',
      locality: DEFAULT_LOCALITY,
      societyId: DEFAULT_SOCIETY_ID,
      status: 'Active',
      avatar: 'A',
      userCategory: 'officer'
    });

    await admin.save();
    console.log(`[MongoDB] Admin account created for ${admin.email}.`);
  } catch (err) {
    console.error('[MongoDB] Admin seeding error:', err);
  }
};

module.exports = {
  clearAllDatabaseData,
  seedDatabase,
  ensureAdminUser,
  defaultServices,
  defaultPoll
};

