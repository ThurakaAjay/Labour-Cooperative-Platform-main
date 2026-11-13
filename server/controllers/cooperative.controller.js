const CooperativeService = require('../services/cooperative.service');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

class CooperativeController {
  /**
   * GET /api/cooperative/stats
   */
  static getStats = asyncHandler(async (req, res) => {
    const stats = await CooperativeService.getStats();
    return ApiResponse.success(res, stats);
  });

  /**
   * GET /api/cooperative/claims
   */
  static getClaims = asyncHandler(async (req, res) => {
    const user = req.user;
    const { page, limit } = req.query;
    const result = await CooperativeService.getClaims(user, { page, limit });
    return res.json({
      success: true,
      count: result.count,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      data: result.data
    });
  });

  /**
   * POST /api/cooperative/claims
   */
  static createClaim = asyncHandler(async (req, res) => {
    const user = req.user;
    const claim = await CooperativeService.createClaim(req.body, user);
    return res.status(201).json({
      success: true,
      message: 'Welfare claim submitted for review in MongoDB',
      data: claim
    });
  });

  /**
   * PUT /api/cooperative/claims/:id (Admin)
   */
  static updateClaimStatus = asyncHandler(async (req, res) => {
    const claim = await CooperativeService.updateClaimStatus(req.params.id, req.body);
    return ApiResponse.success(res, claim, `Welfare claim status updated to ${req.body.status}`);
  });
}

module.exports = CooperativeController;
