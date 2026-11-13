const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Worker = require('../models/Worker');
const Otp = require('../models/Otp');
const ApiError = require('../utils/apiError');
const { JWT_SECRET } = require('../middleware/auth.middleware');
const { DEFAULT_LOCALITY, DEFAULT_SOCIETY_ID } = require('../config/constants');

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;
const SEVEN_DAYS_MS = SEVEN_DAYS_SECONDS * 1000;

class AuthService {
  /**
   * Helper: Issue cryptographically signed JWT token
   */
  static issueToken(user) {
    return jwt.sign(
      {
        userId: user.userId,
        role: user.role,
        name: user.name,
        phone: user.phone,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  /**
   * Register a new user (Customer, Worker, or Admin)
   */
  static async register(userData) {
    const {
      name,
      phone,
      email,
      password,
      role = 'customer',
      locality = DEFAULT_LOCALITY,
      skill,
      experience,
      societyId,
      userCategory = 'household'
    } = userData;

    const cleanPhone = phone.trim();
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const cleanName = name.trim();
    const digitsOnly = cleanPhone.replace(/\D/g, '');

    // Check if an account already exists with this phone number or email across database
    const orConditions = [
      { phone: cleanPhone },
      ...(digitsOnly.length >= 8 ? [{ phone: { $regex: new RegExp(digitsOnly + '$') } }] : [])
    ];
    if (cleanEmail && !cleanEmail.endsWith('@workhive.local')) {
      orConditions.push({ email: cleanEmail });
    }

    const existing = await User.findOne({ $or: orConditions });

    if (existing) {
      throw new ApiError(
        409,
        `An account with this ${cleanEmail && existing.email === cleanEmail ? 'email' : 'phone number'} already exists. Please sign in instead.`,
        true,
        { alreadyExists: true }
      );
    }

    if (role === 'admin') {
      // The single admin account is created only by the server boot seed
      // (see db/seed.js ensureAdminUser) from ADMIN_EMAIL/ADMIN_PASSWORD.
      // There is no path for creating an admin account through this endpoint.
      throw new ApiError(403, 'Administrative accounts cannot be created through registration.');
    }

    const userId = `${role.substring(0, 3)}-` + Date.now();
    const initials = cleanName.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

    const newUser = new User({
      userId,
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail || `${digitsOnly || 'user'}@workhive.local`,
      password, // Hashed by pre-save hook
      role,
      locality,
      societyId: societyId || DEFAULT_SOCIETY_ID,
      skill: skill || '',
      status: role === 'worker' ? 'Pending' : 'Active',
      avatar: initials,
      userCategory
    });

    const savedUser = await newUser.save();

    // If registering as a worker, create linked record in Worker collection
    if (role === 'worker') {
      const workerRecord = new Worker({
        workerId: userId,
        name: cleanName,
        phone: cleanPhone,
        skill: skill || 'General Services',
        skills: skill ? [skill] : ['General Services'],
        avatar: initials,
        experience: experience || '2 years',
        locality,
        status: 'Pending',
        badge: 'Pending Verification',
        societyReg: societyId || `Coop #TN-CHE-${Math.floor(100 + Math.random() * 900)}`
      });
      await workerRecord.save();
    }

    const token = this.issueToken(savedUser);
    const now = Date.now();
    const expiresAt = now + SEVEN_DAYS_MS;

    return {
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully!`,
      data: {
        userId: savedUser.userId,
        name: savedUser.name,
        phone: savedUser.phone,
        email: savedUser.email,
        role: savedUser.role,
        locality: savedUser.locality,
        societyId: savedUser.societyId,
        skill: savedUser.skill,
        status: savedUser.status,
        avatar: savedUser.avatar,
        token,
        loggedInAt: now,
        expiresAt,
        sessionDurationDays: 7
      }
    };
  }

  /**
   * Log in user with identifier and password
   */
  static async login({ identifier, phone, email, password, role }) {
    const loginId = (identifier || phone || email || '').trim();
    const escapedLoginId = loginId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const digitsOnly = loginId.replace(/\D/g, '');

    const query = {
      $or: [
        { userId: loginId },
        { phone: loginId },
        ...(digitsOnly.length >= 8 ? [{ phone: { $regex: new RegExp(digitsOnly + '$') } }] : []),
        { email: loginId.toLowerCase() },
        { name: { $regex: new RegExp(`^${escapedLoginId}$`, 'i') } }
      ]
    };

    if (role) {
      query.role = role;
    }

    // Request password field with select: false
    let user = await User.findOne(query).select('+password');

    if (!user) {
      throw new ApiError(401, 'Invalid credentials. Please verify your identifier and password.');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid credentials. Please verify your identifier and password.');
    }

    if (user.status === 'Suspended') {
      throw new ApiError(403, 'This account has been suspended. Please contact the cooperative office.');
    }
    if (user.role === 'worker') {
      const worker = await Worker.findOne({ workerId: user.userId }).select('status').lean();
      if (worker?.status === 'Suspended') {
        throw new ApiError(403, 'This worker account has been suspended. Please contact the cooperative office.');
      }
    }

    const token = this.issueToken(user);
    const now = Date.now();
    const expiresAt = now + SEVEN_DAYS_MS;

    return {
      message: `Welcome back, ${user.name}!`,
      data: {
        userId: user.userId,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        locality: user.locality,
        societyId: user.societyId,
        skill: user.skill,
        status: user.status,
        avatar: user.avatar,
        token,
        loggedInAt: now,
        expiresAt,
        sessionDurationDays: 7
      }
    };
  }

  /**
   * Send 6-digit OTP to phone number
   */
  static async sendOtp(phone) {
    const cleanPhone = phone.trim();
    const rawOtp = String(crypto.randomInt(100000, 999999));
    const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');

    await Otp.deleteMany({ phone: cleanPhone });

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await Otp.create({
      phone: cleanPhone,
      otpHash,
      attempts: 0,
      expiresAt
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n==============================================`);
      console.log(`[DEV OTP NOTIFICATION]`);
      console.log(`Recipient: ${cleanPhone}`);
      console.log(`One-Time Password: ${rawOtp}`);
      console.log(`Expires in: 5 minutes`);
      console.log(`==============================================\n`);
    }

    return {
      message: `Verification code sent to ${cleanPhone}. Valid for 5 minutes.`,
      expiresInSeconds: 300
    };
  }

  /**
   * Verify submitted OTP code
   */
  static async verifyOtp({ phone, otp, role = 'customer' }) {
    const cleanPhone = phone.trim();
    const cleanOtp = String(otp).trim();

    const otpRecord = await Otp.findOne({ phone: cleanPhone });

    if (!otpRecord) {
      throw new ApiError(400, 'No active verification code found for this phone number. Please request a new code.');
    }

    if (new Date() > otpRecord.expiresAt) {
      await Otp.deleteOne({ _id: otpRecord._id });
      throw new ApiError(400, 'Verification code has expired. Please request a new code.');
    }

    if (otpRecord.attempts >= 5) {
      await Otp.deleteOne({ _id: otpRecord._id });
      throw new ApiError(429, 'Maximum verification attempts exceeded. Please request a new code.');
    }

    const submittedHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');
    if (submittedHash !== otpRecord.otpHash) {
      await Otp.updateOne({ _id: otpRecord._id }, { $inc: { attempts: 1 } });
      const remainingAttempts = 4 - otpRecord.attempts;
      throw new ApiError(
        400,
        `Invalid verification code. ${remainingAttempts > 0 ? `${remainingAttempts} attempts remaining.` : 'Code locked.'}`
      );
    }

    await Otp.deleteOne({ _id: otpRecord._id });

    const digitsOnly = cleanPhone.replace(/\D/g, '');
    const user = await User.findOne({
      role,
      $or: [
        { phone: cleanPhone },
        ...(digitsOnly.length >= 8 ? [{ phone: { $regex: new RegExp(digitsOnly + '$') } }] : [])
      ]
    });

    if (!user) {
      throw new ApiError(404, 'Account does not exist with this mobile number. Please register first.', true, { notRegistered: true });
    }

    const token = this.issueToken(user);
    const now = Date.now();
    const expiresAt = now + SEVEN_DAYS_MS;

    return {
      message: 'Mobile verification successful!',
      data: {
        userId: user.userId,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        locality: user.locality,
        societyId: user.societyId,
        skill: user.skill,
        status: user.status,
        avatar: user.avatar,
        token,
        loggedInAt: now,
        expiresAt,
        sessionDurationDays: 7
      }
    };
  }

  /**
   * Get user profile
   */
  static async getProfile({ userId, phone, email }) {
    if (!userId && !phone && !email) {
      throw new ApiError(400, 'User identification required');
    }

    const query = {};
    if (userId) query.userId = userId;
    else if (phone) query.phone = phone;
    else if (email) query.email = email;

    const user = await User.findOne(query);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return {
      userId: user.userId,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      locality: user.locality,
      societyId: user.societyId,
      skill: user.skill,
      status: user.status,
      avatar: user.avatar,
      userCategory: user.userCategory
    };
  }

  /**
   * Update user profile
   */
  static async updateProfile({ idToUpdate, updates = {} }) {
    if (!idToUpdate) {
      throw new ApiError(400, 'User identifier required for profile update.');
    }

    const query = { userId: idToUpdate };
    const updateData = {};
    if (updates.name) updateData.name = updates.name.trim();
    if (updates.locality) updateData.locality = updates.locality.trim();
    if (updates.skill) updateData.skill = updates.skill.trim();
    if (updates.userCategory) updateData.userCategory = updates.userCategory;
    if (updates.avatar) updateData.avatar = updates.avatar;

    const updatedUser = await User.findOneAndUpdate(query, updateData, { returnDocument: 'after' });
    if (!updatedUser) {
      throw new ApiError(404, 'User not found to update.');
    }

    if (updatedUser.role === 'worker') {
      await Worker.findOneAndUpdate(
        { $or: [{ workerId: updatedUser.userId }, { phone: updatedUser.phone }] },
        {
          name: updatedUser.name,
          phone: updatedUser.phone,
          locality: updatedUser.locality,
          skill: updatedUser.skill || 'Electrician'
        }
      );
    }

    return {
      userId: updatedUser.userId,
      name: updatedUser.name,
      phone: updatedUser.phone,
      email: updatedUser.email,
      role: updatedUser.role,
      locality: updatedUser.locality,
      societyId: updatedUser.societyId,
      skill: updatedUser.skill,
      status: updatedUser.status,
      avatar: updatedUser.avatar,
      userCategory: updatedUser.userCategory
    };
  }
}

module.exports = AuthService;
