const mongoose = require('mongoose');
const ServiceOffering = require('../models/ServiceOffering');
const ServiceCategory = require('../models/ServiceCategory');
const { asyncHandler } = require('../utils/asyncHandler');
const { ErrorResponse } = require('../utils/errorResponse');

class ServiceController {
    // Update a service category by ID
    updateServiceCategoryById = asyncHandler(async (req, res, next) => {
        const { id } = req.params;
        const updateData = req.body;

        // Validate MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return next(new ErrorResponse('Invalid category ID', 400));
        }

        try {
            // Check if category exists first
            const existingCategory = await ServiceCategory.findById(id);
            if (!existingCategory) {
                return next(new ErrorResponse('Service category not found', 404));
            }

            // If updating name, check for uniqueness
            if (updateData.name && updateData.name !== existingCategory.name) {
                const nameExists = await ServiceCategory.findOne({
                    name: updateData.name,
                    _id: { $ne: id } // Exclude current category
                });
                if (nameExists) {
                    return next(new ErrorResponse('Category name already exists', 400));
                }
            }

            // Find and update the category
            const category = await ServiceCategory.findByIdAndUpdate(
                id,
                updateData,
                {
                    new: true, // Return the updated document
                    runValidators: true // Run model validators
                }
            );

            res.status(200).json({
                success: true,
                data: category,
                message: 'Service category updated successfully',
                redirect: '/admin/categories'
            });
        } catch (error) {
            if (error.name === 'ValidationError') {
                return next(new ErrorResponse(error.message, 400));
            } else if (error.code === 11000) {
                return next(new ErrorResponse('Duplicate field value entered', 400));
            }
            return next(new ErrorResponse('Error updating service category', 500));
        }
    });
    // Get all services with advanced filtering and pagination
    getAllServices = asyncHandler(async (req, res, next) => {
        const {
            page = 1,
            limit = 10,
            category,
            provider,
            priceMin,
            priceMax,
            duration,
            location,
            isVirtual,
            pricingModel,
            tags,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            availability,
            rating
        } = req.query;

        // Build filter object
        const filter = { isActive: true, approvalStatus: 'approved' };

        if (category) {
            if (Array.isArray(category)) {
                filter.category = { $in: category };
            } else {
                filter.category = category;
            }
        }

        if (provider) filter.provider = provider;
        if (isVirtual !== undefined) filter.isVirtual = isVirtual === 'true';
        if (pricingModel) filter.pricingModel = pricingModel;

        // Price range filter
        if (priceMin || priceMax) {
            filter.price = {};
            if (priceMin) filter.price.$gte = parseFloat(priceMin);
            if (priceMax) filter.price.$lte = parseFloat(priceMax);
        }

        // Duration filter
        if (duration) {
            if (Array.isArray(duration)) {
                filter.duration = { $in: duration.map(d => parseInt(d)) };
            } else {
                filter.duration = parseInt(duration);
            }
        }

        // Tags filter
        if (tags) {
            if (Array.isArray(tags)) {
                filter.tags = { $in: tags };
            } else {
                filter.tags = tags;
            }
        }

        // Search filter
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        // Rating filter
        if (rating) {
            filter.averageRating = { $gte: parseFloat(rating) };
        }

        // Build aggregation pipeline
        const pipeline = [
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
                $addFields: {
                    // Calculate dynamic price if applicable
                    finalPrice: {
                        $cond: {
                            if: { $eq: ['$pricingModel', 'dynamic'] },
                            then: {
                                $function: {
                                    body: function (price, date, time) {
                                        // This would be implemented in the model method
                                        return price;
                                    },
                                    args: ['$price', new Date(), '09:00'],
                                    lang: 'js'
                                }
                            },
                            else: '$price'
                        }
                    }
                }
            },
            {
                $project: {
                    provider: {
                        firstName: 1,
                        lastName: 1,
                        professionalTitle: 1,
                        specialization: 1,
                        rating: 1,
                        verificationStatus: 1
                    },
                    category: {
                        name: 1,
                        description: 1,
                        icon: 1,
                        color: 1
                    },
                    name: 1,
                    description: 1,
                    shortDescription: 1,
                    price: 1,
                    finalPrice: 1,
                    duration: 1,
                    pricingModel: 1,
                    pricingTiers: 1,
                    averageRating: 1,
                    totalReviews: 1,
                    tags: 1,
                    isVirtual: 1,
                    location: 1,
                    availability: 1,
                    customAttributes: 1,
                    variations: 1,
                    isFeatured: 1,
                    createdAt: 1
                }
            }
        ];

        // Add sorting
        const sortDirection = sortOrder === 'desc' ? -1 : 1;
        pipeline.push({ $sort: { [sortBy]: sortDirection } });

        // Add pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        pipeline.push({ $skip: skip }, { $limit: parseInt(limit) });

        // Execute aggregation
        const services = await ServiceOffering.aggregate(pipeline);

        // Get total count for pagination
        const totalCount = await ServiceOffering.countDocuments(filter);

        // Calculate pagination info
        const totalPages = Math.ceil(totalCount / parseInt(limit));
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        res.status(200).json({
            success: true,
            data: services,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalCount,
                hasNextPage,
                hasPrevPage,
                limit: parseInt(limit)
            }
        });
    });

    // Get service by ID with full details
    getServiceById = asyncHandler(async (req, res, next) => {
        const { id } = req.params;

        const service = await ServiceOffering.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(id) } },
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
                $lookup: {
                    from: 'reviews',
                    localField: '_id',
                    foreignField: 'service',
                    as: 'reviews'
                }
            }
        ]);

        if (!service || service.length === 0) {
            return next(new ErrorResponse('Service not found', 404));
        }

        // Get availability for next 30 days
        const availability = await this.getServiceAvailability(id, 30);

        const serviceData = {
            ...service[0],
            availability
        };

        res.status(200).json({
            success: true,
            data: serviceData
        });
    });

    // Get service availability for a specific date range
    getServiceAvailability = asyncHandler(async (serviceId, days = 30) => {
        const service = await ServiceOffering.findById(serviceId);
        if (!service) {
            throw new ErrorResponse('Service not found', 404);
        }

        const availability = [];
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + days);

        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'lowercase' });
            const daySchedule = service.availability.weekly[dayOfWeek];

            if (daySchedule && daySchedule.available) {
                // Check custom date availability
                const isCustomAvailable = service.isCustomDateAvailable(date);

                if (isCustomAvailable) {
                    const timeSlots = service.getAvailableTimeSlots(date);
                    availability.push({
                        date: date.toISOString().split('T')[0],
                        available: true,
                        timeSlots,
                        maxBookings: daySchedule.maxBookings,
                        startTime: daySchedule.startTime,
                        endTime: daySchedule.endTime
                    });
                }
            } else {
                availability.push({
                    date: date.toISOString().split('T')[0],
                    available: false,
                    reason: 'Not available on this day'
                });
            }
        }

        return availability;
    });

    // Create new service
    createService = asyncHandler(async (req, res, next) => {
        const {
            name,
            description,
            category,
            duration,
            price,
            pricingModel = 'fixed',
            pricingTiers,
            hourlyRate,
            subscriptionDetails,
            availability,
            isVirtual,
            location,
            requirements,
            features,
            customAttributes,
            tags,
            variations
        } = req.body;

        // Validate category exists
        const categoryExists = await ServiceCategory.findById(category);
        if (!categoryExists) {
            return next(new ErrorResponse('Category not found', 404));
        }

        // Create service
        const service = await ServiceOffering.create({
            provider: req.user.id,
            name,
            description,
            category,
            duration,
            price,
            pricingModel,
            pricingTiers,
            hourlyRate,
            subscriptionDetails,
            availability: availability || this.getDefaultAvailability(),
            isVirtual,
            location,
            requirements,
            features,
            customAttributes,
            tags,
            variations
        });

        // Update category statistics
        await categoryExists.updateStatistics();

        res.status(201).json({
            success: true,
            data: service,
            message: 'Service created successfully'
        });
    });

    // Update service
    updateService = asyncHandler(async (req, res, next) => {
        const { id } = req.params;
        const updateData = req.body;

        // Check if service exists and belongs to provider
        const service = await ServiceOffering.findOne({
            _id: id,
            provider: req.user.id
        });

        if (!service) {
            return next(new ErrorResponse('Service not found or unauthorized', 404));
        }

        // Update service
        const updatedService = await ServiceOffering.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        // Update category statistics if category changed
        if (updateData.category && updateData.category !== service.category.toString()) {
            const oldCategory = await ServiceCategory.findById(service.category);
            const newCategory = await ServiceCategory.findById(updateData.category);

            if (oldCategory) await oldCategory.updateStatistics();
            if (newCategory) await newCategory.updateStatistics();
        }

        res.status(200).json({
            success: true,
            data: updatedService,
            message: 'Service updated successfully'
        });
    });

    // Delete service
    deleteService = asyncHandler(async (req, res, next) => {
        const { id } = req.params;

        const service = await ServiceOffering.findOne({
            _id: id,
            provider: req.user.id
        });

        if (!service) {
            return next(new ErrorResponse('Service not found or unauthorized', 404));
        }

        // Soft delete - mark as inactive
        await ServiceOffering.findByIdAndUpdate(id, { isActive: false });

        // Update category statistics
        const category = await ServiceCategory.findById(service.category);
        if (category) {
            await category.updateStatistics();
        }

        res.status(200).json({
            success: true,
            message: 'Service deleted successfully'
        });
    });

    // Toggle service status
    toggleServiceStatus = asyncHandler(async (req, res, next) => {
        const { id } = req.params;
        const { isActive } = req.body;

        const service = await ServiceOffering.findOneAndUpdate(
            {
                _id: id,
                provider: req.user.id
            },
            { isActive },
            { new: true }
        );

        if (!service) {
            return next(new ErrorResponse('Service not found or unauthorized', 404));
        }

        res.status(200).json({
            success: true,
            data: service,
            message: `Service ${isActive ? 'activated' : 'deactivated'} successfully`
        });
    });

    // Get service analytics
    getServiceAnalytics = asyncHandler(async (req, res, next) => {
        const { id } = req.params;
        const { period = '30d' } = req.query;

        const service = await ServiceOffering.findById(id);
        if (!service) {
            return next(new ErrorResponse('Service not found', 404));
        }

        // Calculate analytics based on period
        const analytics = await this.calculateServiceAnalytics(id, period);

        res.status(200).json({
            success: true,
            data: analytics
        });
    });

    // Calculate service analytics
    calculateServiceAnalytics = asyncHandler(async (serviceId, period) => {
        const endDate = new Date();
        let startDate = new Date();

        switch (period) {
            case '7d':
                startDate.setDate(endDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(endDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(endDate.getDate() - 90);
                break;
            case '1y':
                startDate.setFullYear(endDate.getFullYear() - 1);
                break;
            default:
                startDate.setDate(endDate.getDate() - 30);
        }

        // Get appointments for the period
        const Appointment = mongoose.model('Appointment');
        const appointments = await Appointment.find({
            service: serviceId,
            date: { $gte: startDate, $lte: endDate }
        });

        // Calculate metrics
        const totalAppointments = appointments.length;
        const completedAppointments = appointments.filter(apt => apt.status === 'completed').length;
        const cancelledAppointments = appointments.filter(apt => apt.status === 'cancelled').length;
        const revenue = appointments
            .filter(apt => apt.status === 'completed')
            .reduce((sum, apt) => sum + (apt.price || 0), 0);

        // Calculate average rating
        const Review = mongoose.model('Review');
        const reviews = await Review.find({ service: serviceId });
        const averageRating = reviews.length > 0
            ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
            : 0;

        return {
            period,
            totalAppointments,
            completedAppointments,
            cancelledAppointments,
            completionRate: totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0,
            revenue,
            averageRating,
            totalReviews: reviews.length,
            startDate,
            endDate
        };
    });

    // Get default availability template
    getDefaultAvailability() {
        return {
            weekly: {
                monday: { available: true, startTime: '09:00', endTime: '17:00', maxBookings: 10 },
                tuesday: { available: true, startTime: '09:00', endTime: '17:00', maxBookings: 10 },
                wednesday: { available: true, startTime: '09:00', endTime: '17:00', maxBookings: 10 },
                thursday: { available: true, startTime: '09:00', endTime: '17:00', maxBookings: 10 },
                friday: { available: true, startTime: '09:00', endTime: '17:00', maxBookings: 10 },
                saturday: { available: false, startTime: '09:00', endTime: '17:00', maxBookings: 5 },
                sunday: { available: false, startTime: '09:00', endTime: '17:00', maxBookings: 5 }
            },
            customDates: [],
            holidays: [],
            timeSlotInterval: 30
        };
    }

    // Search services with advanced filters
    searchServices = asyncHandler(async (req, res, next) => {
        const { query, filters, sort, page = 1, limit = 10 } = req.body;

        // Build search query
        const searchQuery = {
            isActive: true,
            approvalStatus: 'approved',
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } },
                { tags: { $in: [new RegExp(query, 'i')] } }
            ]
        };

        // Apply filters
        if (filters) {
            Object.keys(filters).forEach(key => {
                if (filters[key] !== undefined && filters[key] !== null) {
                    if (key === 'priceRange') {
                        searchQuery.price = {
                            $gte: filters[key].min,
                            $lte: filters[key].max
                        };
                    } else if (key === 'categories') {
                        searchQuery.category = { $in: filters[key] };
                    } else if (key === 'tags') {
                        searchQuery.tags = { $in: filters[key] };
                    } else {
                        searchQuery[key] = filters[key];
                    }
                }
            });
        }

        // Execute search
        const services = await ServiceOffering.find(searchQuery)
            .populate('provider', 'firstName lastName professionalTitle')
            .populate('category', 'name description')
            .sort(sort || { createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await ServiceOffering.countDocuments(searchQuery);

        res.status(200).json({
            success: true,
            data: services,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    });
}

module.exports = new ServiceController();