const AuthService = require('../services/auth.service');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

class AuthController {
  /**
   * POST /api/auth/register
   */
  static register = asyncHandler(async (req, res) => {
    const result = await AuthService.register(req.body);
    return res.status(201).json({
      success: true,
      message: result.message,
      data: result.data
    });
  });

  /**
   * POST /api/auth/login
   */
  static login = asyncHandler(async (req, res) => {
    const result = await AuthService.login(req.body);
    return ApiResponse.success(res, result.data, result.message);
  });

  /**
   * POST /api/auth/send-otp
   */
  static sendOtp = asyncHandler(async (req, res) => {
    const result = await AuthService.sendOtp(req.body.phone);
    return res.json({
      success: true,
      message: result.message,
      expiresInSeconds: result.expiresInSeconds
    });
  });

  /**
   * POST /api/auth/verify-otp
   */
  static verifyOtp = asyncHandler(async (req, res) => {
    const result = await AuthService.verifyOtp(req.body);
    return ApiResponse.success(res, result.data, result.message);
  });

  /**
   * GET /api/auth/me or /api/auth/profile
   */
  static getProfile = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const profile = await AuthService.getProfile({ userId });
    return ApiResponse.success(res, profile);
  });

  /**
   * PUT /api/auth/profile
   */
  static updateProfile = asyncHandler(async (req, res) => {
    const idToUpdate = req.user.userId;
    const { phone, email, role, status, userId, ...updates } = req.body;

    const profile = await AuthService.updateProfile({
      idToUpdate,
      updates
    });
    return ApiResponse.success(res, profile, 'Profile successfully updated.');
  });
}

module.exports = AuthController;
