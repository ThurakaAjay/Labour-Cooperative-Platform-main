const Service = require('../models/Service');
const ApiError = require('../utils/apiError');
const escapeRegex = require('../utils/escapeRegex');

class ServiceCatalogService {
  /**
   * Fetch services with category/keyword search
   */
  static async getServices({ category, search }) {
    const query = {};

    if (category) {
      query.category = new RegExp(escapeRegex(category), 'i');
    }

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { category: searchRegex }
      ];
    }

    const services = await Service.find(query).sort({ popular: -1, title: 1 });
    return {
      count: services.length,
      data: services
    };
  }

  /**
   * Get single service by ID
   */
  static async getServiceById(id) {
    let service = await Service.findOne({ serviceId: id });
    if (!service && id.match(/^[0-9a-fA-F]{24}$/)) {
      service = await Service.findById(id);
    }

    if (!service) {
      throw new ApiError(404, `Service with ID '${id}' not found`);
    }

    return service;
  }

  /**
   * Create or upsert service catalog item
   */
  static async createOrUpsertService(data) {
    const { title, description, baseRate, category } = data;

    const cleanTitleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const serviceId = data.serviceId || (cleanTitleSlug.length > 0 ? cleanTitleSlug : `job-${Date.now()}`);

    const rawRate = data.rateNumber || parseInt(String(baseRate).replace(/[^0-9]/g, ''), 10) || 350;
    const formattedBaseRate = typeof baseRate === 'number' ? `₹${baseRate} visit fee` : baseRate;

    const existing = await Service.findOne({ serviceId });
    if (existing) {
      const updated = await Service.findOneAndUpdate(
        { serviceId },
        {
          ...data,
          serviceId,
          rateNumber: rawRate,
          baseRate: formattedBaseRate
        },
        { returnDocument: 'after' }
      );
      return { isNew: false, service: updated };
    }

    const newService = new Service({
      serviceId,
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      baseRate: formattedBaseRate,
      rateNumber: rawRate,
      duration: data.duration || '1 - 2 hours',
      emoji: data.emoji || '🔧',
      icon: data.icon || 'Wrench',
      popular: Boolean(data.popular),
      availableWorkersCount: data.availableWorkersCount || 0
    });

    const saved = await newService.save();
    return { isNew: true, service: saved };
  }

  /**
   * Update service in catalog
   */
  static async updateService(id, updateData) {
    const updates = { ...updateData };
    if (updates.baseRate && !updates.rateNumber) {
      updates.rateNumber = parseInt(String(updates.baseRate).replace(/[^0-9]/g, ''), 10) || 350;
    }

    const updated = await Service.findOneAndUpdate(
      { $or: [{ serviceId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
      updates,
      { returnDocument: 'after' }
    );

    if (!updated) {
      throw new ApiError(404, `Service '${id}' not found to update`);
    }

    return updated;
  }

  /**
   * Delete service from catalog
   */
  static async deleteService(id) {
    const deleted = await Service.findOneAndDelete({
      $or: [{ serviceId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }]
    });

    if (!deleted) {
      throw new ApiError(404, 'Service not found in catalog');
    }

    return deleted;
  }
}

module.exports = ServiceCatalogService;
