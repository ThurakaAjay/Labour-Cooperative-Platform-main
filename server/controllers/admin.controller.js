const AdminService = require('../services/admin.service');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

class AdminController {
  /**
   * GET /api/admin/stats or /api/admin/metrics
   */
  static getMetrics = asyncHandler(async (req, res) => {
    const metrics = await AdminService.getMetrics();
    return ApiResponse.success(res, metrics);
  });

  /**
   * GET /api/admin/customers
   */
  static getCustomers = asyncHandler(async (req, res) => {
    const result = await AdminService.getCustomers();
    return res.json({
      success: true,
      count: result.count,
      data: result.data
    });
  });

  /**
   * GET /api/admin/workers — full roster (all verification/status states)
   */
  static getWorkers = asyncHandler(async (req, res) => {
    const result = await AdminService.getWorkers();
    return res.json({
      success: true,
      count: result.count,
      data: result.data
    });
  });

  /**
   * PUT /api/admin/users/:id/status
   */
  static updateUserStatus = asyncHandler(async (req, res) => {
    const user = await AdminService.updateUserStatus(req.params.id, req.body.status);
    return ApiResponse.success(res, user, `Status updated to '${user.status}'.`);
  });

  /**
   * POST /api/admin/reset-demo
   */
  static resetDemo = asyncHandler(async (req, res) => {
    const result = await AdminService.resetDemo();
    return ApiResponse.success(res, null, result.message);
  });
}

module.exports = AdminController;
