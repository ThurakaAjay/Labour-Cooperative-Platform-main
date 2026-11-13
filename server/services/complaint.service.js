const Complaint = require('../models/Complaint');
const Worker = require('../models/Worker');
const ApiError = require('../utils/apiError');
const escapeRegex = require('../utils/escapeRegex');

class ComplaintService {
  /**
   * Fetch grievances with status, category filtering, and role-based privacy scoping
   */
  static async getComplaints({ status, category, page = 1, limit = 50 } = {}, user = {}) {
    const query = {};

    if (status && status !== 'All') {
      query.status = status;
    }
    if (category) {
      query.category = new RegExp(escapeRegex(category), 'i');
    }

    // Role-based privacy scoping: Members only view grievances where they are the complainant or respondent
    if (user.role && user.role !== 'admin') {
      const escapedUserName = escapeRegex(user.name || 'nomatch');
      query.$or = [
        { complainantId: user.userId },
        { complainant: new RegExp(`^${escapedUserName}$`, 'i') },
        { againstId: user.userId },
        { against: new RegExp(`^${escapedUserName}$`, 'i') }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [total, complaints] = await Promise.all([
      Complaint.countDocuments(query),
      Complaint.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
    ]);

    return {
      count: complaints.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      data: complaints
    };
  }

  /**
   * File a new grievance
   */
  static async createComplaint(data) {
    const {
      complainantId = '',
      complainant,
      againstId = '',
      against,
      category,
      description,
      bookingId,
      complainantRole = 'Customer',
      complainantPhone = ''
    } = data;

    const complaintId = data.complaintId || ('GRV-' + new Date().getFullYear() + '-' + Date.now().toString().slice(-4) + Math.floor(1000 + Math.random() * 9000));
    const newComplaint = new Complaint({
      complaintId,
      complainantId,
      complainant,
      complainantRole,
      complainantPhone,
      againstId,
      against,
      category,
      description,
      bookingId: bookingId || '',
      status: 'Open'
    });

    return newComplaint.save();
  }

  /**
   * Resolve a complaint by complaintId or Mongo _id, or throw 404. Shared by
   * addPhoto and anything else that needs to load one outside the
   * status-update path.
   */
  static async findComplaintOrThrow(id) {
    let complaint = await Complaint.findOne({ complaintId: id });
    if (!complaint && id.match(/^[0-9a-fA-F]{24}$/)) {
      complaint = await Complaint.findById(id);
    }
    if (!complaint) {
      throw new ApiError(404, `Complaint with ID '${id}' not found`);
    }
    return complaint;
  }

  /**
   * Attach an evidence photo (already stored in Cloudinary by the
   * controller) to a complaint.
   */
  static async addPhoto(id, { url, publicId, uploadedBy }) {
    const complaint = await ComplaintService.findComplaintOrThrow(id);
    complaint.photos.push({ url, publicId: publicId || '', uploadedBy: uploadedBy || 'Customer', uploadedAt: new Date() });
    return complaint.save();
  }

  /**
   * Update grievance status / resolution and optionally escalate to worker suspension
   */
  static async updateComplaint(id, { status, resolutionNotes, escalateSuspension }) {
    const update = {};
    if (status) update.status = status;
    if (resolutionNotes) update.resolutionNotes = resolutionNotes;

    let complaint = await Complaint.findOneAndUpdate({ complaintId: id }, update, { returnDocument: 'after' });
    if (!complaint && id.match(/^[0-9a-fA-F]{24}$/)) {
      complaint = await Complaint.findByIdAndUpdate(id, update, { returnDocument: 'after' });
    }

    if (!complaint) {
      throw new ApiError(404, `Complaint with ID '${id}' not found`);
    }

    // Escalate to suspension if requested
    if (escalateSuspension && (complaint.againstId || complaint.against)) {
      const workerQuery = complaint.againstId
        ? { $or: [{ workerId: complaint.againstId }, { _id: complaint.againstId }] }
        : { name: new RegExp(`^${escapeRegex(complaint.against)}$`, 'i') };

      const suspendedWorker = await Worker.findOneAndUpdate(
        workerQuery,
        { status: 'Suspended', isOnline: false, badge: 'Account Suspended' },
        { returnDocument: 'after' }
      );

      // Keep the linked User record's status in sync so any check against
      // User.status (rather than Worker.status) also sees the suspension.
      if (suspendedWorker) {
        const User = require('../models/User');
        await User.findOneAndUpdate(
          { $or: [{ userId: suspendedWorker.workerId }, { phone: suspendedWorker.phone, role: 'worker' }] },
          { status: 'Suspended' }
        );
      }
    }

    return complaint;
  }
}

module.exports = ComplaintService;
