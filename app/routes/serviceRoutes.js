const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const ServiceOffering = require('../models/ServiceOffering');
const ServiceCategory = require('../models/ServiceCategory');
const DoctorService = require('../models/DoctorService');
const serviceController = require('../controllers/serviceController');

// Get all services (for admin) - must come first to avoid conflicts
router.get('/', protect, restrictTo('admin'), async (req, res) => {
    try {
        const services = await ServiceOffering.aggregate([
            {
                $lookup: {
                    from: 'providers',
                    localField: 'provider',
                    foreignField: '_id',
                    as: 'provider'
                }
            },
            {
                $unwind: {
                    path: '$provider',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'servicecategories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            {
                $unwind: {
                    path: '$category',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    provider: {
                        name: 1,
                        email: 1
                    },
                    category: {
                        name: 1
                    },
                    name: 1,
                    description: 1,
                    duration: 1,
                    price: 1,
                    isActive: 1,
                    isApproved: 1
                }
            }
        ]);

        res.json({
            success: true,
            data: services
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching services',
            error: error.message
        });
    }
});

// Get services by category
router.get('/category/:categoryId', async (req, res) => {
    try {
        const { categoryId } = req.params;
        const services = await ServiceOffering.aggregate([
            {
                $match: {
                    category: categoryId,
                    isActive: true,
                    isApproved: true
                }
            },
            {
                $lookup: {
                    from: 'providers',
                    localField: 'provider',
                    foreignField: '_id',
                    as: 'provider'
                }
            },
            {
                $unwind: '$provider'
            },
            {
                $project: {
                    provider: {
                        name: 1,
                        email: 1,
                        phone: 1
                    },
                    name: 1,
                    description: 1,
                    duration: 1,
                    price: 1,
                    isActive: 1,
                    isApproved: 1
                }
            }
        ]);

        res.json({
            success: true,
            data: services
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching services',
            error: error.message
        });
    }
});

// Get service availability
router.get('/:serviceId/availability', async (req, res) => {
    try {
        const { serviceId } = req.params;
        const { date } = req.query;

        const service = await ServiceOffering.findById(serviceId);
        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        // For now, return basic availability
        // This would need to be enhanced with actual availability logic
        const availability = {
            available: true,
            timeSlots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00']
        };

        res.json({
            success: true,
            data: availability
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching availability',
            error: error.message
        });
    }
});

// Toggle service status (for providers)
router.patch('/:serviceId/toggle-status', protect, restrictTo('provider'), async (req, res) => {
    try {
        const { serviceId } = req.params;
        const { isActive } = req.body;

        const service = await ServiceOffering.findOneAndUpdate(
            {
                _id: serviceId,
                provider: req.user._id
            },
            { isActive },
            { new: true }
        );

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found or unauthorized'
            });
        }

        res.json({
            success: true,
            data: service,
            message: `Service ${isActive ? 'activated' : 'deactivated'} successfully`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating service status',
            error: error.message
        });
    }
});

// Get service categories
router.get('/categories', async (req, res) => {
    try {
        const categories = await ServiceCategory.find({ isActive: true })
            .sort({ displayOrder: 1, name: 1 });

        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching categories',
            error: error.message
        });
    }
});

// Update service category by ID
router.put('/categories/:id',
    protect,
    restrictTo('admin'),
    require('../middleware/serviceCategoryValidation').validateServiceCategory,
    serviceController.updateServiceCategoryById);

// Get service category for editing
router.get('/categories/:id/edit', protect, restrictTo('admin'), async (req, res) => {
    try {
        const category = await ServiceCategory.findById(req.params.id);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Service category not found'
            });
        }
        res.json({
            success: true,
            data: category
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching category',
            error: error.message
        });
    }
});

// Get all approved services for public viewing (services page)
router.get('/public', async (req, res) => {
    try {
        const {
            category,
            search,
            priceMin,
            priceMax,
            isVirtual,
            page = 1,
            limit = 20
        } = req.query;

        // Build filter for approved and active services
        const filter = {
            isActive: true,
            approvalStatus: 'approved'
        };

        if (category) {
            filter.category = category;
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { shortDescription: { $regex: search, $options: 'i' } }
            ];
        }

        if (priceMin || priceMax) {
            filter.price = {};
            if (priceMin) filter.price.$gte = parseFloat(priceMin);
            if (priceMax) filter.price.$lte = parseFloat(priceMax);
        }

        if (isVirtual !== undefined) {
            filter.isVirtual = isVirtual === 'true';
        }

        const skip = (page - 1) * limit;

        const services = await ServiceOffering.aggregate([
            { $match: filter },
            {
                $lookup: {
                    from: 'providers',
                    localField: 'provider',
                    foreignField: '_id',
                    as: 'provider'
                }
            },
            { $unwind: '$provider' },
            {
                $lookup: {
                    from: 'servicecategories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            { $unwind: '$category' },
            {
                $project: {
                    name: 1,
                    description: 1,
                    shortDescription: 1,
                    duration: 1,
                    price: 1,
                    currency: 1,
                    isVirtual: 1,
                    tags: 1,
                    category: {
                        _id: 1,
                        name: 1
                    },
                    provider: {
                        _id: 1,
                        firstName: 1,
                        lastName: 1,
                        specialization: 1
                    }
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: parseInt(limit) }
        ]);

        const total = await ServiceOffering.countDocuments(filter);

        res.json({
            success: true,
            data: services,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                total,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching public services:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching services',
            error: error.message
        });
    }
});

module.exports = router;