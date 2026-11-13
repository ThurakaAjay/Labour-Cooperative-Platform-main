const ComplaintService = require('../services/complaint.service');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { isCloudinaryConfigured } = require('../config/cloudinary');
const { streamUploadToCloudinary } = require('../utils/cloudinaryUpload');

class ComplaintController {
  /**
   * GET /api/complaints
   */
  static getComplaints = asyncHandler(async (req, res) => {
    const user = req.user;
    const result = await ComplaintService.getComplaints(req.query, user);
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
   * POST /api/complaints
   */
  static createComplaint = asyncHandler(async (req, res) => {
    const user = req.user;
    const complaintData = {
      ...req.body,
      complainantId: user.userId,
      complainant: user.name || req.body.complainant,
      complainantPhone: user.phone || req.body.complainantPhone,
      complainantRole: user.role === 'worker' ? 'Worker' : 'Customer'
    };

    const complaint = await ComplaintService.createComplaint(complaintData);
    return res.status(201).json({
      success: true,
      message: 'Complaint filed successfully',
      data: complaint
    });
  });

  /**
   * PUT /api/complaints/:id
   */
  static updateComplaint = asyncHandler(async (req, res) => {
    const complaint = await ComplaintService.updateComplaint(req.params.id, req.body);
    return ApiResponse.success(res, complaint, 'Complaint updated successfully');
  });

  /**
   * POST /api/complaints/:id/photos — the complainant (or an admin) attaches
   * evidence photos (multipart field "photo").
   */
  static uploadPhoto = asyncHandler(async (req, res) => {
    const user = req.user;
    const complaint = await ComplaintService.findComplaintOrThrow(req.params.id);

    const isComplainant = user && user.userId === complaint.complainantId;
    const isAdmin = user && user.role === 'admin';
    if (!isComplainant && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to attach photos to this complaint.'
      });
    }

    if (!isCloudinaryConfigured) {
      return res.status(503).json({
        success: false,
        message: 'Photo uploads are not available: Cloudinary credentials are not configured on the server.'
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No photo file was provided (expected multipart field "photo").' });
    }

    const result = await streamUploadToCloudinary(req.file.buffer, `workhive/complaints/${complaint.complaintId}`);
    const uploadedBy = user.role === 'admin' ? 'Admin' : (user.role === 'worker' ? 'Worker' : 'Customer');

    const updated = await ComplaintService.addPhoto(req.params.id, {
      url: result.secure_url,
      publicId: result.public_id,
      uploadedBy
    });

    return ApiResponse.success(res, updated, 'Photo uploaded and attached to complaint.');
  });
}

module.exports = ComplaintController;
