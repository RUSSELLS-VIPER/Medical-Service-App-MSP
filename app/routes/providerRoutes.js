const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const DoctorService = require('../models/DoctorService');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const ServiceOffering = require('../models/ServiceOffering'); // Added import for ServiceOffering
const Provider = require('../models/Provider');
const Notification = require('../models/Notification');
const NotificationService = require('../services/notificationService');

// Provider Appointments View Page
router.get('/appointments', protect, restrictTo('provider'), async (req, res) => {
    try {
        res.render('provider/appointments', {
            title: 'Appointments',
            user: req.user,
            currentPage: 'provider/appointments'
        });
    } catch (error) {
        console.error('❌ Provider appointments view error:', error);
        next(error);
    }
});

// Provider Notifications page
router.get('/notifications', protect, restrictTo('provider'), async (req, res, next) => {
    try {
        const notifications = await Notification.find({ recipient: req.user._id, recipientModel: 'Provider' })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        const unreadNotificationsCount = await Notification.countDocuments({ recipient: req.user._id, recipientModel: 'Provider', isRead: false });

        res.render('provider/notifications', {
            title: 'Notifications',
            user: req.user,
            notifications,
            unreadNotificationsCount,
            currentPage: 'provider/notifications'
        });
    } catch (error) {
        next(error);
    }
});

// Provider Services View Page
router.get('/service-management', protect, restrictTo('provider'), async (req, res) => {
    try {
        res.render('provider/service-management', {
            title: 'Service Management',
            user: req.user,
            currentPage: 'provider/service-management'
        });
    } catch (error) {
        console.error('❌ Provider services view error:', error);
        next(error);
    }
});

// Get provider's appointments
router.get('/appointments/list', protect, restrictTo('provider'), async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const filter = { provider: req.user._id };
        if (status) {
            filter.status = status;
        }

        console.log('🔍 Fetching provider appointments for:', req.user._id);

        // First, let's see what appointments exist
        const rawAppointments = await Appointment.find(filter).limit(3);
        console.log('🔍 Raw appointments found:', rawAppointments.map(apt => ({
            id: apt._id,
            serviceId: apt.service,
            serviceIdType: typeof apt.service
        })));

        const appointments = await Appointment.aggregate([
            {
                $match: filter
            },
            {
                $lookup: {
                    from: 'patients',
                    localField: 'patient',
                    foreignField: '_id',
                    as: 'patient'
                }
            },
            {
                $unwind: '$patient'
            },
            {
                $lookup: {
                    from: 'serviceofferings',
                    localField: 'service',
                    foreignField: '_id',
                    as: 'service'
                }
            },
            {
                $unwind: {
                    path: '$service',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    patient: {
                        firstName: 1,
                        lastName: 1,
                        email: 1,
                        phone: 1
                    },
                    service: {
                        description: 1,
                        duration: 1,
                        price: 1,
                        name: 1
                    },
                    date: 1,
                    startTime: 1,
                    endTime: 1,
                    status: 1,
                    notes: 1,
                    createdAt: 1
                }
            },
            {
                $sort: { date: -1, createdAt: -1 }
            },
            {
                $skip: skip
            },
            {
                $limit: parseInt(limit)
            }
        ]);

        console.log('📊 Provider appointments fetched:', appointments.length);
        if (appointments.length > 0) {
            console.log('📊 Sample appointment data:', JSON.stringify(appointments[0], null, 2));
            console.log('📊 Service lookup result:', appointments[0].service);
        } else {
            console.log('📊 No appointments found');
        }

        const total = await Appointment.countDocuments(filter);

        res.json({
            success: true,
            data: appointments,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                total,
                limit: parseInt(limit)
            }
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Failed to fetch appointments'
        });
    }
});



// Get upcoming appointments (next 7 days)
router.get('/appointments/upcoming', protect, restrictTo('provider'), async (req, res) => {
    try {
        const today = new Date();
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

        const appointments = await Appointment.aggregate([
            {
                $match: {
                    provider: req.user._id,
                    date: { $gte: today, $lte: nextWeek },
                    status: { $in: ['pending', 'confirmed'] }
                }
            },
            {
                $lookup: {
                    from: 'patients',
                    localField: 'patient',
                    foreignField: '_id',
                    as: 'patient'
                }
            },
            {
                $unwind: '$patient'
            },
            {
                $lookup: {
                    from: 'serviceofferings',
                    localField: 'service',
                    foreignField: '_id',
                    as: 'service'
                }
            },
            {
                $unwind: {
                    path: '$service',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    patient: {
                        firstName: 1,
                        lastName: 1,
                        email: 1,
                        phone: 1
                    },
                    service: {
                        description: 1,
                        duration: 1,
                        price: 1,
                        name: 1
                    },
                    date: 1,
                    startTime: 1,
                    endTime: 1,
                    status: 1,
                    notes: 1
                }
            },
            {
                $sort: { date: 1, startTime: 1 }
            },
            {
                $limit: 20
            }
        ]);

        res.json({
            success: true,
            data: appointments
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Failed to fetch upcoming appointments'
        });
    }
});

// Get specific appointment
router.get('/appointments/:appointmentId', protect, restrictTo('provider'), async (req, res) => {
    try {
        const appointmentResult = await Appointment.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(req.params.appointmentId),
                    provider: req.user._id
                }
            },
            {
                $lookup: {
                    from: 'patients',
                    localField: 'patient',
                    foreignField: '_id',
                    as: 'patient'
                }
            },
            {
                $unwind: '$patient'
            },
            {
                $lookup: {
                    from: 'serviceofferings',
                    localField: 'service',
                    foreignField: '_id',
                    as: 'service'
                }
            },
            {
                $unwind: {
                    path: '$service',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    patient: {
                        firstName: 1,
                        lastName: 1,
                        email: 1,
                        phone: 1,
                        dateOfBirth: 1,
                        gender: 1
                    },
                    service: {
                        description: 1,
                        duration: 1,
                        price: 1,
                        name: 1,
                        basePrice: 1
                    },
                    date: 1,
                    startTime: 1,
                    endTime: 1,
                    status: 1,
                    notes: 1,
                    createdAt: 1
                }
            }
        ]);

        const appointment = appointmentResult[0];

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        res.json({
            success: true,
            data: appointment
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Failed to fetch appointment'
        });
    }
});

// Update appointment status (confirm/cancel/complete) - PUT method
router.put('/appointments/:appointmentId/status', protect, restrictTo('provider'), async (req, res) => {
    try {
        const { status, providerNotes, cancellationReason } = req.body;

        if (!['pending', 'confirmed', 'completed', 'cancelled', 'no_show'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be one of: pending, confirmed, completed, cancelled, no-show'
            });
        }

        const appointment = await Appointment.findOne({
            _id: req.params.appointmentId,
            provider: req.user._id
        });

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        // Check if appointment can be updated
        if (appointment.status === 'completed' && status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Cannot modify completed appointment'
            });
        }

        if (appointment.status === 'cancelled' && status !== 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Cannot modify cancelled appointment'
            });
        }

        // Update appointment fields
        appointment.status = status;
        if (providerNotes !== undefined) appointment.providerNotes = providerNotes;
        if (cancellationReason !== undefined) appointment.cancellationReason = cancellationReason;
        if (status === 'cancelled') {
            appointment.cancelledBy = req.user._id;
            appointment.cancelledByModel = 'Provider';
            appointment.cancellationDate = new Date();
        }
        appointment.updatedAt = new Date();
        await appointment.save();

        // Get appointment with patient details for response
        const populatedAppointment = await Appointment.aggregate([
            {
                $match: { _id: appointment._id }
            },
            {
                $lookup: {
                    from: 'patients',
                    localField: 'patient',
                    foreignField: '_id',
                    as: 'patient'
                }
            },
            {
                $unwind: '$patient'
            },
            {
                $project: {
                    patient: {
                        firstName: 1,
                        lastName: 1,
                        email: 1,
                        phone: 1
                    },
                    date: 1,
                    startTime: 1,
                    endTime: 1,
                    status: 1,
                    notes: 1,
                    createdAt: 1,
                    updatedAt: 1
                }
            }
        ]);

        const populatedAppointmentData = populatedAppointment[0];

        // Best-effort: create notifications based on status change
        try {
            if (status === 'confirmed') {
                // Notify patient
                await NotificationService.createNotification({
                    recipient: appointment.patient,
                    recipientModel: 'Patient',
                    sender: req.user._id,
                    senderModel: 'Provider',
                    type: 'appointment_confirmation',
                    title: 'Appointment Confirmed',
                    message: `Your appointment on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime} has been confirmed by ${req.user.firstName} ${req.user.lastName}.`,
                    priority: 'high',
                    deliveryMethod: 'in_app',
                    relatedAppointment: appointment._id,
                    relatedProvider: req.user._id,
                    relatedPatient: appointment.patient
                });
            } else if (status === 'cancelled') {
                // Notify patient of cancellation
                await NotificationService.createNotification({
                    recipient: appointment.patient,
                    recipientModel: 'Patient',
                    sender: req.user._id,
                    senderModel: 'Provider',
                    type: 'appointment_cancellation',
                    title: 'Appointment Cancelled',
                    message: `Your appointment on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime} was cancelled by ${req.user.firstName} ${req.user.lastName}${cancellationReason ? `: ${cancellationReason}` : ''}.`,
                    priority: 'high',
                    deliveryMethod: 'in_app',
                    relatedAppointment: appointment._id,
                    relatedProvider: req.user._id,
                    relatedPatient: appointment.patient
                });
            }
        } catch (notifyError) {
            // Non-blocking
        }

        res.json({
            success: true,
            message: `Appointment ${status} successfully`,
            data: populatedAppointmentData
        });

    } catch (error) {
        console.error('Error updating appointment status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update appointment status',
            error: error.message
        });
    }
});

// Update appointment status (confirm/cancel/complete) - PATCH method (alias for PUT)
router.patch('/appointments/:appointmentId/status', protect, restrictTo('provider'), async (req, res) => {
    try {
        const { status, providerNotes, cancellationReason } = req.body;

        if (!['pending', 'confirmed', 'completed', 'cancelled', 'no_show'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be one of: pending, confirmed, completed, cancelled, no-show'
            });
        }

        const appointment = await Appointment.findOne({
            _id: req.params.appointmentId,
            provider: req.user._id
        });

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        // Check if appointment can be updated
        if (appointment.status === 'completed' && status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Cannot modify completed appointment'
            });
        }

        if (appointment.status === 'cancelled' && status !== 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Cannot modify cancelled appointment'
            });
        }

        // Update appointment fields
        appointment.status = status;
        if (providerNotes !== undefined) appointment.providerNotes = providerNotes;
        if (cancellationReason !== undefined) appointment.cancellationReason = cancellationReason;
        if (status === 'cancelled') {
            appointment.cancelledBy = req.user._id;
            appointment.cancelledByModel = 'Provider';
            appointment.cancellationDate = new Date();
        }
        appointment.updatedAt = new Date();
        await appointment.save();

        // Get appointment with patient details for response
        const populatedAppointment = await Appointment.aggregate([
            {
                $match: { _id: appointment._id }
            },
            {
                $lookup: {
                    from: 'patients',
                    localField: 'patient',
                    foreignField: '_id',
                    as: 'patient'
                }
            },
            {
                $unwind: '$patient'
            },
            {
                $project: {
                    patient: {
                        firstName: 1,
                        lastName: 1,
                        email: 1,
                        phone: 1
                    },
                    date: 1,
                    startTime: 1,
                    endTime: 1,
                    status: 1,
                    notes: 1,
                    createdAt: 1,
                    updatedAt: 1
                }
            }
        ]);

        const populatedAppointmentData = populatedAppointment[0];

        // Best-effort: create notifications based on status change
        try {
            if (status === 'confirmed') {
                await NotificationService.createNotification({
                    recipient: appointment.patient,
                    recipientModel: 'Patient',
                    sender: req.user._id,
                    senderModel: 'Provider',
                    type: 'appointment_confirmation',
                    title: 'Appointment Confirmed',
                    message: `Your appointment on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime} has been confirmed by ${req.user.firstName} ${req.user.lastName}.`,
                    priority: 'high',
                    deliveryMethod: 'in_app',
                    relatedAppointment: appointment._id,
                    relatedProvider: req.user._id,
                    relatedPatient: appointment.patient
                });
            } else if (status === 'cancelled') {
                await NotificationService.createNotification({
                    recipient: appointment.patient,
                    recipientModel: 'Patient',
                    sender: req.user._id,
                    senderModel: 'Provider',
                    type: 'appointment_cancellation',
                    title: 'Appointment Cancelled',
                    message: `Your appointment on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime} was cancelled by ${req.user.firstName} ${req.user.lastName}${cancellationReason ? `: ${cancellationReason}` : ''}.`,
                    priority: 'high',
                    deliveryMethod: 'in_app',
                    relatedAppointment: appointment._id,
                    relatedProvider: req.user._id,
                    relatedPatient: appointment.patient
                });
            }
        } catch (notifyError) {
            // Non-blocking
        }

        res.json({
            success: true,
            message: `Appointment ${status} successfully`,
            data: populatedAppointmentData
        });

    } catch (error) {
        console.error('Error updating appointment status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating appointment status',
            error: error.message
        });
    }
});

// Get appointment statistics
router.get('/appointments/stats', protect, restrictTo('provider'), async (req, res) => {
    try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const stats = await Appointment.aggregate([
            { $match: { provider: req.user._id } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get today's appointments
        const todayAppointments = await Appointment.countDocuments({
            provider: req.user._id,
            date: {
                $gte: new Date(today.setHours(0, 0, 0, 0)),
                $lt: new Date(today.setHours(23, 59, 59, 999))
            },
            status: { $in: ['pending', 'confirmed'] }
        });

        // Get this month's appointments
        const monthAppointments = await Appointment.countDocuments({
            provider: req.user._id,
            date: { $gte: startOfMonth, $lte: endOfMonth }
        });

        // Get upcoming appointments count
        const upcomingAppointments = await Appointment.countDocuments({
            provider: req.user._id,
            date: { $gte: today },
            status: { $in: ['pending', 'confirmed'] }
        });

        // Convert stats array to object
        const statsObject = {
            total: 0,
            pending: 0,
            confirmed: 0,
            completed: 0,
            cancelled: 0,
            'no-show': 0
        };

        stats.forEach(stat => {
            statsObject[stat._id] = stat.count;
            statsObject.total += stat.count;
        });

        res.json({
            success: true,
            data: {
                ...statsObject,
                today: todayAppointments,
                thisMonth: monthAppointments,
                upcoming: upcomingAppointments
            }
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Failed to fetch appointment statistics'
        });
    }
});

// Get available time slots for a specific date
router.get('/availability/:date', protect, restrictTo('provider'), async (req, res) => {
    try {
        const { date } = req.params;
        const appointmentDate = new Date(date);

        if (isNaN(appointmentDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format'
            });
        }

        // Get all appointments for this date
        const appointments = await Appointment.find({
            provider: req.user._id,
            date: appointmentDate,
            status: { $in: ['pending', 'confirmed'] }
        }).select('startTime endTime');

        // Define working hours (9 AM to 5 PM)
        const workingHours = {
            start: '09:00',
            end: '17:00',
            slotDuration: 60 // minutes
        };

        // Generate all possible time slots
        const timeSlots = [];
        const startTime = new Date(`2000-01-01T${workingHours.start}:00`);
        const endTime = new Date(`2000-01-01T${workingHours.end}:00`);

        while (startTime < endTime) {
            const slotStart = startTime.toTimeString().slice(0, 5);
            const slotEnd = new Date(startTime.getTime() + workingHours.slotDuration * 60000).toTimeString().slice(0, 5);

            timeSlots.push({
                start: slotStart,
                end: slotEnd,
                available: true
            });

            startTime.setMinutes(startTime.getMinutes() + workingHours.slotDuration);
        }

        // Mark booked slots as unavailable
        appointments.forEach(appointment => {
            timeSlots.forEach(slot => {
                if (
                    (slot.start >= appointment.startTime && slot.start < appointment.endTime) ||
                    (slot.end > appointment.startTime && slot.end <= appointment.endTime) ||
                    (slot.start <= appointment.startTime && slot.end >= appointment.endTime)
                ) {
                    slot.available = false;
                }
            });
        });

        res.json({
            success: true,
            data: {
                date: appointmentDate.toISOString().split('T')[0],
                timeSlots
            }
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Failed to fetch availability'
        });
    }
});

// Provider Services Management
router.post('/services', protect, restrictTo('provider'), async (req, res) => {
    try {
        console.log('Received service creation request:', req.body);

        const {
            name,
            category,
            description,
            shortDescription,
            duration,
            currency,
            isVirtual,
            location,
            price
        } = req.body;

        // Validate required fields
        if (!name || !category || !duration) {
            console.log('Validation failed - missing required fields:', { name, category, duration });
            return res.status(400).json({
                success: false,
                message: 'Name, category, and duration are required'
            });
        }

        // Create new service
        const service = new ServiceOffering({
            provider: req.user._id,
            name,
            category,
            description,
            shortDescription,
            duration,
            price: price || 0,
            currency: currency || 'USD',
            isVirtual: isVirtual || false,
            location: location || {},
            isActive: true,
            approvalStatus: 'pending'
        });

        await service.save();
        console.log('Service saved successfully:', service._id);

        // Populate category and provider for response
        await service.populate([
            { path: 'category', select: 'name' },
            { path: 'provider', select: 'firstName lastName' }
        ]);

        console.log('Service populated successfully');

        res.status(201).json({
            success: true,
            message: 'Service created successfully',
            data: service
        });
    } catch (error) {
        console.error('Error creating service:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: 'Failed to create service',
            error: error.message
        });
    }
});

// Get services by location (public endpoint)
router.get('/services/by-location', async (req, res) => {
    try {
        const { city, state, latitude, longitude, radius = 10 } = req.query;

        let query = {
            isActive: true,
            approvalStatus: 'approved'
        };

        // Add location filters
        if (city) {
            query['location.city'] = { $regex: city, $options: 'i' };
        }
        if (state) {
            query['location.state'] = { $regex: state, $options: 'i' };
        }

        // If coordinates are provided, we could add geospatial queries here
        // For now, we'll use basic text matching
        if (latitude && longitude) {
            // This is a simplified approach - in production you'd use MongoDB's geospatial queries
            console.log(`Location-based search: lat=${latitude}, lng=${longitude}, radius=${radius}km`);
        }

        const services = await ServiceOffering.find(query)
            .populate('provider', 'firstName lastName professionalTitle specialization')
            .populate('category', 'name description icon color')
            .select('name description shortDescription duration price currency isVirtual location')
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({
            success: true,
            data: services,
            filters: {
                city: city || null,
                state: state || null,
                coordinates: (latitude && longitude) ? { latitude, longitude, radius } : null
            }
        });
    } catch (error) {
        console.error('Error fetching services by location:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching services by location',
            error: error.message
        });
    }
});

// Get provider's services
router.get('/services', protect, restrictTo('provider'), async (req, res) => {
    try {
        const services = await ServiceOffering.aggregate([
            {
                $match: { provider: req.user._id }
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
                    name: 1,
                    description: 1,
                    shortDescription: 1,
                    duration: 1,
                    price: 1,
                    currency: 1,
                    pricingModel: 1,
                    isVirtual: 1,
                    isActive: 1,
                    approvalStatus: 1,
                    category: {
                        _id: 1,
                        name: 1
                    },
                    provider: {
                        _id: 1,
                        firstName: 1,
                        lastName: 1
                    },
                    createdAt: 1,
                    updatedAt: 1
                }
            },
            {
                $sort: { createdAt: -1 }
            }
        ]);

        res.json({
            success: true,
            data: services
        });
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch services'
        });
    }
});

// Provider profile update API
router.put('/profile', protect, restrictTo('provider'), async (req, res) => {
    try {
        const updates = (({ firstName, lastName, phone, specialization, licenseNumber, yearsOfExperience, bio }) => ({ firstName, lastName, phone, specialization, licenseNumber, yearsOfExperience, bio }))(req.body);
        Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);
        const provider = await Provider.findByIdAndUpdate(req.user._id, updates, { new: true });
        res.json({ success: true, data: provider });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
});

// Get specific service by ID
router.get('/services/:id', protect, restrictTo('provider'), async (req, res) => {
    try {
        const service = await ServiceOffering.findOne({
            _id: req.params.id,
            provider: req.user._id
        }).populate([
            { path: 'category', select: 'name' },
            { path: 'provider', select: 'firstName lastName' }
        ]);

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        res.json({
            success: true,
            data: service
        });
    } catch (error) {
        console.error('Error fetching service:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch service'
        });
    }
});

// Update service
router.put('/services/:id', protect, restrictTo('provider'), async (req, res) => {
    try {
        const {
            name,
            category,
            description,
            shortDescription,
            duration,
            price,
            currency,
            pricingModel,
            isVirtual,
            location
        } = req.body;

        const service = await ServiceOffering.findOne({
            _id: req.params.id,
            provider: req.user._id
        });

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        // Update fields
        if (name) service.name = name;
        if (category) service.category = category;
        if (description !== undefined) service.description = description;
        if (shortDescription !== undefined) service.shortDescription = shortDescription;
        if (duration) service.duration = duration;
        if (price) service.price = price;
        if (currency) service.currency = currency;
        if (pricingModel) service.pricingModel = pricingModel;
        if (isVirtual !== undefined) service.isVirtual = isVirtual;
        if (location) service.location = location;

        // Reset approval status if significant changes made
        if (name || category || duration || price) {
            service.approvalStatus = 'pending';
        }

        await service.save();

        // Populate for response
        await service.populate([
            { path: 'category', select: 'name' },
            { path: 'provider', select: 'firstName lastName' }
        ]);

        res.json({
            success: true,
            message: 'Service updated successfully',
            data: service
        });
    } catch (error) {
        console.error('Error updating service:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update service'
        });
    }
});

// Toggle service status (active/inactive)
router.patch('/services/:id/toggle-status', protect, restrictTo('provider'), async (req, res) => {
    try {
        const { isActive } = req.body;

        const service = await ServiceOffering.findOne({
            _id: req.params.id,
            provider: req.user._id
        });

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        service.isActive = isActive;
        await service.save();

        res.json({
            success: true,
            message: `Service ${isActive ? 'activated' : 'deactivated'} successfully`,
            data: service
        });
    } catch (error) {
        console.error('Error toggling service status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle service status'
        });
    }
});

// Delete service
router.delete('/services/:id', protect, restrictTo('provider'), async (req, res) => {
    try {
        const service = await ServiceOffering.findOne({
            _id: req.params.id,
            provider: req.user._id
        });

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        // Check if service has any appointments
        const hasAppointments = await Appointment.exists({ service: req.params.id });
        if (hasAppointments) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete service with existing appointments'
            });
        }

        await ServiceOffering.deleteOne({ _id: req.params.id });

        res.json({
            success: true,
            message: 'Service deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting service:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete service'
        });
    }
});




module.exports = router;