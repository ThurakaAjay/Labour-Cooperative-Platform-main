const ServiceCatalogService = require('../services/service.service');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

class ServiceController {
  /**
   * GET /api/services
   */
  static getServices = asyncHandler(async (req, res) => {
    const result = await ServiceCatalogService.getServices(req.query);
    return res.json({
      success: true,
      count: result.count,
      data: result.data
    });
  });

  /**
   * GET /api/services/:id
   */
  static getServiceById = asyncHandler(async (req, res) => {
    const service = await ServiceCatalogService.getServiceById(req.params.id);
    return ApiResponse.success(res, service);
  });

  /**
   * POST /api/services
   */
  static createOrUpsertService = asyncHandler(async (req, res) => {
    const result = await ServiceCatalogService.createOrUpsertService(req.body);
    const statusCode = result.isNew ? 201 : 200;
    const message = result.isNew ? 'New service created successfully in MongoDB' : 'Service updated in catalog';
    return res.status(statusCode).json({
      success: true,
      message,
      data: result.service
    });
  });

  /**
   * PUT /api/services/:id
   */
  static updateService = asyncHandler(async (req, res) => {
    const service = await ServiceCatalogService.updateService(req.params.id, req.body);
    return ApiResponse.success(res, service, 'Service updated successfully in MongoDB');
  });

  /**
   * DELETE /api/services/:id
   */
  static deleteService = asyncHandler(async (req, res) => {
    await ServiceCatalogService.deleteService(req.params.id);
    return res.json({
      success: true,
      message: 'Service successfully deleted from catalog'
    });
  });
}

module.exports = ServiceController;
