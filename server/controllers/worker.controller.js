const WorkerService = require('../services/worker.service');
const CooperativeService = require('../services/cooperative.service');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { isCloudinaryConfigured } = require('../config/cloudinary');
const { streamUploadToCloudinary } = require('../utils/cloudinaryUpload');

const FORMAT_BY_MIME = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png'
};

class WorkerController {
  /**
   * GET /api/workers
   */
  static getWorkers = asyncHandler(async (req, res) => {
    const result = await WorkerService.getWorkers(req.query);
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
   * GET /api/workers/:id
   */
  static getWorkerById = asyncHandler(async (req, res) => {
    const worker = await WorkerService.getWorkerById(req.params.id);
    return ApiResponse.success(res, worker);
  });

  /**
   * POST /api/workers
   */
  static createWorker = asyncHandler(async (req, res) => {
    const worker = await WorkerService.createWorker(req.body);
    return res.status(201).json({
      success: true,
      message: 'Worker registered successfully for cooperative verification',
      data: worker
    });
  });

  /**
   * PUT /api/workers/:id (and PATCH, same handler — both are partial
   * merge-updates here, not full replacements; see WorkerService.updateWorker)
   */
  static updateWorker = asyncHandler(async (req, res) => {
    const user = req.user;
    const worker = await WorkerService.getWorkerById(req.params.id);

    const isSelf = user && (user.userId === worker.workerId || (user.phone && user.phone === worker.phone));
    const isAdmin = user && user.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to modify this worker profile.'
      });
    }

    const updates = { ...req.body };

    // isProfileComplete is always derived server-side from the rest of the
    // profile (see WorkerService.isProfileDataComplete) — nobody, including
    // an admin, sets it directly, since a hand-set true would bypass the
    // job-readiness gate without the underlying fields actually being filled in.
    delete updates.isProfileComplete;

    // Strict privilege separation: Non-admins cannot alter accreditation status or metrics
    if (!isAdmin) {
      delete updates.status;
      delete updates.badge;
      delete updates.rating;
      delete updates.completedJobs;
      delete updates.societyReg;
      // Verification state and evidence can only change through the
      // dedicated document-upload and admin-review endpoints below — never
      // by a worker (or anyone spoofing a request body) writing directly to
      // these fields via the generic profile update route.
      delete updates.verificationStatus;
      delete updates.rejectionReason;
      delete updates.documents;
      // Welfare balance and insurance coverage/policy terms are admin-only
      // (see the dedicated /insurance and /welfare-balance routes below) —
      // a worker can view them but never self-certify or self-fund them.
      delete updates.welfareFundBalance;
      delete updates.healthInsurance;
      if (updates.paymentDetails && typeof updates.paymentDetails === 'object') {
        // A worker may edit their own payout method, but only an admin can
        // mark it verified (that's what unlocks "Instant Auto-Credit").
        delete updates.paymentDetails.verificationStatus;
      }
      if (updates.accidentCoverage && typeof updates.accidentCoverage === 'object') {
        // Of the whole accidentCoverage block, a worker may only ever touch
        // the nominee — coverage amount/policy/active status are admin-issued.
        updates.accidentCoverage = updates.accidentCoverage.nominee
          ? { nominee: updates.accidentCoverage.nominee }
          : undefined;
        if (!updates.accidentCoverage) delete updates.accidentCoverage;
      }
    }

    const updated = await WorkerService.updateWorker(req.params.id, updates);
    return ApiResponse.success(res, updated, 'Worker updated successfully');
  });

  /**
   * GET /api/workers/welfare — the calling worker's own welfare/insurance/
   * payout snapshot (admins may pass ?workerId= to view another worker's).
   */
  static getWelfare = asyncHandler(async (req, res) => {
    const user = req.user;
    const targetId = user.role === 'admin' ? (req.query.workerId || user.userId) : user.userId;
    if (!targetId) {
      throw ApiError.badRequest('workerId is required.');
    }
    const snapshot = await WorkerService.getWelfareSnapshot(targetId);
    return ApiResponse.success(res, snapshot);
  });

  /**
   * GET /api/workers/cooperative — thin alias of the audited society-pool
   * stats also exposed at GET /api/cooperative/stats, so the worker app's
   * /api/workers/* surface is self-contained. Same data, one implementation.
   */
  static getCooperative = asyncHandler(async (req, res) => {
    const stats = await CooperativeService.getStats();
    return ApiResponse.success(res, stats);
  });

  /**
   * PUT /api/workers/:id/insurance (Admin Only) — issue or update health
   * and/or accident coverage.
   */
  static issueInsurance = asyncHandler(async (req, res) => {
    const updated = await WorkerService.issueInsurance(req.params.id, req.body);
    return ApiResponse.success(res, updated, 'Insurance coverage updated.');
  });

  /**
   * PUT /api/workers/:id/welfare-balance (Admin Only) — manual credit/debit
   * correction to a worker's welfare fund balance.
   */
  static adjustWelfareBalance = asyncHandler(async (req, res) => {
    const updated = await WorkerService.adjustWelfareBalance(req.params.id, req.body);
    return ApiResponse.success(res, updated, 'Welfare fund balance adjusted.');
  });

  /**
   * PUT /api/workers/:id/payment-verification (Admin Only)
   */
  static verifyPaymentDetails = asyncHandler(async (req, res) => {
    const updated = await WorkerService.verifyPaymentDetails(req.params.id, req.body);
    return ApiResponse.success(res, updated, 'Payment verification status updated.');
  });

  /**
   * POST /api/workers/:id/documents — self or admin uploads verification
   * documents (multipart field "documents", up to 5 files: PDF/JPG/PNG).
   */
  static uploadDocuments = asyncHandler(async (req, res) => {
    const user = req.user;
    const worker = await WorkerService.getWorkerById(req.params.id);

    const isSelf = user && (user.userId === worker.workerId || (user.phone && user.phone === worker.phone));
    const isAdmin = user && user.role === 'admin';
    if (!isSelf && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to upload documents for this worker profile.'
      });
    }

    if (!isCloudinaryConfigured) {
      return res.status(503).json({
        success: false,
        message: 'Document uploads are not available: Cloudinary credentials are not configured on the server.'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No document files were provided (expected multipart field "documents").' });
    }

    const docType = ['id_proof', 'certificate', 'other'].includes(req.body.docType) ? req.body.docType : 'other';

    const uploaded = await Promise.all(req.files.map(async (file) => {
      const resourceType = file.mimetype === 'application/pdf' ? 'raw' : 'image';
      const result = await streamUploadToCloudinary(file.buffer, `workhive/verification/${worker.workerId}`, resourceType);
      return {
        name: file.originalname || `${docType}-document`,
        docType,
        format: FORMAT_BY_MIME[file.mimetype],
        url: result.secure_url,
        publicId: result.public_id
      };
    }));

    const updated = await WorkerService.addDocuments(req.params.id, uploaded);
    return ApiResponse.success(res, updated, 'Documents uploaded and submitted for verification.');
  });

  /**
   * PUT /api/workers/:id/verify — Admin approves or rejects a worker's
   * submitted verification documents.
   */
  static reviewVerification = asyncHandler(async (req, res) => {
    const { decision, rejectionReason } = req.body;
    const updated = await WorkerService.reviewVerification(req.params.id, { decision, rejectionReason });
    return ApiResponse.success(res, updated, `Worker verification ${decision === 'approve' ? 'approved' : 'rejected'}.`);
  });

  /**
   * DELETE /api/workers/:id
   */
  static deleteWorker = asyncHandler(async (req, res) => {
    const worker = await WorkerService.deleteWorker(req.params.id);
    return ApiResponse.success(res, worker, `Worker ${worker.name} removed successfully`);
  });
}

module.exports = WorkerController;
