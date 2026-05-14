const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const DoctorService = require('../models/DoctorService');
const Appointment = require('../models/Appointment');
const Provider = require('../models/Provider');
const ServiceOffering = require('../models/ServiceOffering');
const NotificationService = require('../services/notificationService');
const Patient = require('../models/Patient');
const Notification = require('../models/Notification');

// Get available doctors/services for booking
router.get('/services/available', protect, restrictTo('patient'), async (req, res) => {
    try {
        // Get all approved services from providers with approved documents
        const services = await DoctorService.aggregate([
            {
                $match: {
                    approvalStatus: 'approved',
                    isActive: true
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
                $match: {
                    'provider.verificationStatus': 'approved'
                }
            },
            {
                $project: {
                    provider: {
                        firstName: 1,
                        lastName: 1,
                        professionalTitle: 1,
                        specialization: 1
                    },
                    specialization: 1,
                    serviceName: 1,
                    description: 1,
                    basePrice: 1,
                    duration: 1,
                    isActive: 1,
                    approvalStatus: 1
                }
            }
        ]);

        // Filter out services where provider is not approved
        const availableServices = services.filter(service => service.provider);

        res.json({
            success: true,
            data: availableServices
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Failed to fetch available services'
        });
    }
});

// Patient Notifications page
router.get('/notifications', protect, restrictTo('patient'), async (req, res, next) => {
    try {
        const notifications = await Notification.find({ recipient: req.user._id, recipientModel: 'Patient' })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        const unreadNotificationsCount = await Notification.countDocuments({ recipient: req.user._id, recipientModel: 'Patient', isRead: false });

        res.render('patient/notifications', {
            title: 'Notifications',
            user: req.user,
            notifications,
            unreadNotificationsCount,
            currentPage: 'patient/notifications'
        });
    } catch (error) {
        next(error);
    }
});

// Get service details for booking
router.get('/services/:serviceId', protect, restrictTo('patient'), async (req, res) => {
    try {
        const service = await DoctorService.aggregate([
            {
                $match: { _id: new mongoose.Types.ObjectId(req.params.serviceId) }
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
                        firstName: 1,
                        lastName: 1,
                        professionalTitle: 1,
                        specialization: 1,
                        email: 1,
                        phone: 1
                    },
                    specialization: 1,
                    serviceName: 1,
                    description: 1,
                    basePrice: 1,
                    duration: 1,
                    isActive: 1,
                    approvalStatus: 1
                }
            }
        ]);

        const serviceDetails = service[0]; // Get the first (and only) result

        if (!serviceDetails) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        // Check if service is approved and provider is verified
        if (serviceDetails.approvalStatus !== 'approved' || serviceDetails.provider.verificationStatus !== 'approved') {
            return res.status(403).json({
                success: false,
                message: 'Service is not available for booking'
            });
        }

        res.json({
            success: true,
            data: serviceDetails
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Failed to fetch service details'
        });
    }
});

// Patient profile update API
router.put('/profile', protect, restrictTo('patient'), async (req, res) => {
    try {
        const allowed = (({ firstName, lastName, phone, address, dateOfBirth, gender, healthInfo }) => ({ firstName, lastName, phone, address, dateOfBirth, gender, healthInfo }))(req.body);
        Object.keys(allowed).forEach(k => allowed[k] === undefined && delete allowed[k]);
        // Ensure nested objects updated correctly
        const updated = await Patient.findByIdAndUpdate(req.user._id, allowed, { new: true });
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
});

// Book an appointment
router.post('/appointments', protect, restrictTo('patient'), async (req, res) => {
    try {
        console.log('📅 Appointment booking request received:', req.body);
        console.log('👤 User making request:', req.user ? { id: req.user._id, role: req.user.role } : 'No user');
        const { serviceId, date, startTime, time, endTime, notes, patientName } = req.body;

        // Handle both 'startTime' and 'time' field names for backward compatibility
        const actualStartTime = startTime || time;

        // Validate required fields (endTime optional; will be derived by duration)
        if (!serviceId || !date || !actualStartTime) {
            console.log('❌ Validation failed:', { serviceId, date, actualStartTime, startTime, time });
            return res.status(400).json({
                success: false,
                message: 'Service ID, date, and start time are required'
            });
        }

        // Get service details (support ServiceCategory -> pick first ServiceOffering; direct ServiceOffering)
        const ServiceCategory = require('../models/ServiceCategory');

        let resolvedServiceId = serviceId;
        let serviceDetailsResolved = null;

        // If a category ID was sent, pick the first service offering in that category
        try {
            const cat = await ServiceCategory.findById(serviceId);
            if (cat) {
                const anyAgg = await ServiceOffering.aggregate([
                    { $match: { category: new mongoose.Types.ObjectId(serviceId) } },
                    { $sort: { createdAt: -1 } },
                    { $limit: 1 },
                    { $lookup: { from: 'providers', localField: 'provider', foreignField: '_id', as: 'provider' } },
                    { $unwind: { path: '$provider', preserveNullAndEmptyArrays: true } },
                    { $project: { name: 1, description: 1, duration: 1, isActive: 1, approvalStatus: 1, price: 1, isVirtual: 1, location: 1, provider: { _id: 1, firstName: 1, lastName: 1, professionalTitle: 1, verificationStatus: 1 } } }
                ]);
                const anyService = anyAgg && anyAgg[0];
                if (!anyService) {
                    return res.status(404).json({ success: false, message: 'No service found in this category' });
                }
                serviceDetailsResolved = {
                    provider: anyService.provider,
                    specialization: '',
                    serviceName: anyService.name,
                    description: anyService.description,
                    basePrice: anyService.price,
                    duration: anyService.duration,
                    isActive: anyService.isActive,
                    approvalStatus: anyService.approvalStatus,
                    isVirtual: anyService.isVirtual,
                    location: anyService.location
                };
                resolvedServiceId = anyService._id;
            }
        } catch (_) { /* ignore */ }

        // If still not resolved, try ServiceOffering by id
        if (!serviceDetailsResolved) {
            const soAgg = await ServiceOffering.aggregate([
                { $match: { _id: new mongoose.Types.ObjectId(resolvedServiceId) } },
                { $lookup: { from: 'providers', localField: 'provider', foreignField: '_id', as: 'provider' } },
                { $unwind: { path: '$provider', preserveNullAndEmptyArrays: true } },
                { $project: { name: 1, description: 1, duration: 1, isActive: 1, approvalStatus: 1, price: 1, isVirtual: 1, location: 1, provider: { _id: 1, firstName: 1, lastName: 1, professionalTitle: 1, verificationStatus: 1 } } }
            ]);
            const so = soAgg && soAgg[0];

            if (!so) {
                return res.status(404).json({
                    success: false,
                    message: 'Service not found'
                });
            }

            serviceDetailsResolved = {
                provider: so.provider,
                specialization: '',
                serviceName: so.name,
                description: so.description,
                basePrice: so.price,
                duration: so.duration,
                isActive: so.isActive,
                approvalStatus: so.approvalStatus,
                isVirtual: so.isVirtual,
                location: so.location
            };
            resolvedServiceId = so._id;
        }

        // Check if service is available for booking
        if (serviceDetailsResolved.approvalStatus !== 'approved') {
            return res.status(403).json({
                success: false,
                message: 'Service is not available for booking'
            });
        }

        // Resolve provider id robustly
        const providerId = (serviceDetailsResolved.provider && (serviceDetailsResolved.provider._id || serviceDetailsResolved.provider)) || null;
        if (!providerId) {
            return res.status(400).json({ success: false, message: 'Selected service has no provider assigned' });
        }

        // Validate appointment datetime (must be in the future)
        const appointmentDate = new Date(date);
        const startDateTime = new Date(`${date}T${actualStartTime}:00`);
        let computedEndTime = endTime;

        // If endTime not provided, compute using service duration (minutes)
        if (!computedEndTime) {
            const serviceDurationMinutes = Number(serviceDetailsResolved?.duration || serviceDetailsResolved?.consultationDuration || 60);
            const endDateTimeObj = new Date(startDateTime.getTime() + (serviceDurationMinutes * 60000));
            computedEndTime = endDateTimeObj.toTimeString().slice(0, 5);
        }

        const endDateTime = new Date(`${date}T${computedEndTime}:00`);
        if (isNaN(appointmentDate.getTime()) || isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date or time'
            });
        }
        // Accept bookings even if they cross midnight; only ensure positive duration

        // Check for time slot conflicts (overlap if existing.start < end && existing.end > start)
        const conflictingAppointment = await Appointment.findOne({
            provider: providerId,
            date: appointmentDate,
            startTime: { $lt: computedEndTime },
            endTime: { $gt: actualStartTime },
            status: { $in: ['pending', 'confirmed'] }
        });

        if (conflictingAppointment) {
            return res.status(409).json({
                success: false,
                message: 'This time slot is already booked'
            });
        }

        // Calculate duration in minutes
        const startTimeParts = actualStartTime.split(':').map(Number);
        const endTimeParts = computedEndTime.split(':').map(Number);
        const startMinutes = startTimeParts[0] * 60 + startTimeParts[1];
        const endMinutes = endTimeParts[0] * 60 + endTimeParts[1];
        const duration = endMinutes - startMinutes;

        // Determine location type based on service
        const isVirtualService = serviceDetailsResolved.isVirtual || false;
        const locationType = isVirtualService ? 'virtual' : 'provider_location';

        // Fallback: if we can't determine the service type, default to provider_location
        const finalLocationType = locationType || 'provider_location';

        console.log('🔍 Service details resolved:', {
            isVirtual: isVirtualService,
            locationType,
            finalLocationType,
            hasLocation: !!serviceDetailsResolved.location,
            location: serviceDetailsResolved.location,
            serviceDetailsResolved: serviceDetailsResolved
        });

        // Create appointment
        const appointmentData = {
            patient: req.user._id,
            provider: providerId,
            service: resolvedServiceId,
            date: appointmentDate,
            startTime: actualStartTime,
            endTime: computedEndTime,
            duration,
            notes: notes || '',
            location: {
                type: finalLocationType,
                address: isVirtualService ? undefined : {
                    street: serviceDetailsResolved.location?.address || '',
                    city: serviceDetailsResolved.location?.city || '',
                    state: serviceDetailsResolved.location?.state || '',
                    zipCode: serviceDetailsResolved.location?.zipCode || '',
                    coordinates: serviceDetailsResolved.location?.coordinates || {}
                },
                virtualMeetingUrl: isVirtualService ? 'To be provided by provider' : undefined
            }
        };

        console.log('📝 Creating appointment with data:', JSON.stringify(appointmentData, null, 2));
        const appointment = await Appointment.create(appointmentData);

        // Get appointment with provider details
        const populatedAppointment = await Appointment.aggregate([
            { $match: { _id: appointment._id } },
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
                $project: {
                    provider: { firstName: 1, lastName: 1, professionalTitle: 1 },
                    patient: 1,
                    service: 1,
                    date: 1,
                    startTime: 1,
                    endTime: 1,
                    duration: 1,
                    status: 1,
                    notes: 1,
                    createdAt: 1
                }
            }
        ]);

        const populatedAppointmentData = populatedAppointment[0];

        // Create in-app notifications (best-effort)
        try {
            // Best-effort fetch provider name for message
            let providerName = 'Provider';
            try {
                const p = await Provider.findById(providerId).select('firstName lastName').lean();
                if (p) providerName = `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Provider';
            } catch (_) { }
            await NotificationService.createNotification({
                recipient: req.user._id,
                recipientModel: 'Patient',
                sender: providerId,
                senderModel: 'Provider',
                type: 'booking_confirmation',
                title: 'Appointment Booked',
                message: `Your appointment with ${providerName} for ${(serviceDetailsResolved.serviceName || 'Service')} is booked for ${new Date(appointmentDate).toLocaleDateString()} at ${actualStartTime}.`,
                priority: 'high',
                deliveryMethod: 'in_app',
                relatedAppointment: appointment._id,
                relatedProvider: providerId,
                relatedPatient: req.user._id,
            });

            await NotificationService.createNotification({
                recipient: providerId,
                recipientModel: 'Provider',
                sender: req.user._id,
                senderModel: 'Patient',
                type: 'booking_confirmation',
                title: 'New Appointment Booked',
                message: `New appointment booked by ${req.user.firstName} ${req.user.lastName} for ${(serviceDetailsResolved.serviceName || 'Service')} on ${new Date(appointmentDate).toLocaleDateString()} at ${actualStartTime}.`,
                priority: 'medium',
                deliveryMethod: 'in_app',
                relatedAppointment: appointment._id,
                relatedPatient: req.user._id,
            });
        } catch (_) { }

        res.status(201).json({
            success: true,
            message: 'Appointment booked successfully',
            data: populatedAppointmentData
        });

    } catch (error) {
        console.error('❌ Appointment booking error:', error);
        if (error.name === 'TimeSlotConflict') {
            return res.status(409).json({ success: false, message: 'This time slot is already booked' });
        }
        res.status(500).json({
            success: false,
            message: 'Failed to book appointment',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get patient's appointments
router.get('/appointments', protect, restrictTo('patient'), async (req, res, next) => {
    try {
        const patientId = req.user._id;
        console.log('🔍 Current patient ID:', patientId);
        console.log('🔍 Patient ID type:', typeof patientId);

        // Get appointments with aggregation
        let appointments = [];
        try {
            appointments = await Appointment.aggregate([
                {
                    $match: {
                        patient: patientId
                    }
                },
                {
                    $lookup: {
                        from: 'providers',
                        localField: 'provider',
                        foreignField: '_id',
                        as: 'providerInfo'
                    }
                },
                {
                    $unwind: {
                        path: '$providerInfo',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $lookup: {
                        from: 'serviceofferings',
                        localField: 'service',
                        foreignField: '_id',
                        as: 'serviceInfo'
                    }
                },
                {
                    $unwind: {
                        path: '$serviceInfo',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $sort: {
                        date: -1,
                        startTime: -1
                    }
                }
            ]);
        } catch (appointmentsError) {
            console.error('Error fetching appointments:', appointmentsError);
            appointments = [];
        }

        console.log('📊 Raw appointments found:', appointments.length);
        console.log('📊 First appointment (if any):', appointments[0] ? {
            _id: appointments[0]._id,
            patient: appointments[0].patient,
            status: appointments[0].status,
            date: appointments[0].date
        } : 'No appointments');

        // Debug: Check total appointments in database
        const totalAppointments = await Appointment.countDocuments();
        console.log('📊 Total appointments in database:', totalAppointments);

        // Debug: Check appointments for any patient
        const anyAppointments = await Appointment.find().limit(3);
        console.log('📊 Sample appointments in DB:', anyAppointments.map(apt => ({
            _id: apt._id,
            patient: apt.patient,
            status: apt.status,
            date: apt.date
        })));

        // Format appointments for the template
        let formattedAppointments = appointments.map(apt => ({
            ...apt,
            serviceName: apt.serviceInfo ? apt.serviceInfo.name : 'Appointment',
            providerName: apt.providerInfo ? `${apt.providerInfo.firstName} ${apt.providerInfo.lastName}` : 'Provider',
            formattedDate: new Date(apt.date).toLocaleDateString(),
            formattedTime: apt.startTime
        }));

        console.log('📊 Formatted appointments:', formattedAppointments.length);
        console.log('📊 First formatted appointment:', formattedAppointments[0] || 'None');

        // If no appointments found, create a test appointment for this user
        if (formattedAppointments.length === 0) {
            console.log('🧪 Creating test appointment for user:', patientId);
            try {
                // Find a service to use for the test appointment
                const ServiceOffering = require('../models/ServiceOffering');
                const testService = await ServiceOffering.findOne();

                if (testService) {
                    const testAppointment = new Appointment({
                        patient: patientId,
                        provider: testService.provider,
                        service: testService._id,
                        serviceCategory: testService.category,
                        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
                        startTime: '10:00',
                        endTime: '11:00',
                        duration: 60,
                        status: 'pending',
                        notes: 'Test appointment created automatically',
                        patientNotes: 'Test appointment',
                        location: {
                            address: '',
                            city: '',
                            state: '',
                            zipCode: ''
                        },
                        isVirtual: false
                    });

                    await testAppointment.save();
                    console.log('✅ Test appointment created:', testAppointment._id);

                    // Re-fetch appointments with the new test appointment
                    appointments = await Appointment.aggregate([
                        {
                            $match: {
                                patient: patientId
                            }
                        },
                        {
                            $lookup: {
                                from: 'providers',
                                localField: 'provider',
                                foreignField: '_id',
                                as: 'providerInfo'
                            }
                        },
                        {
                            $unwind: {
                                path: '$providerInfo',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $lookup: {
                                from: 'serviceofferings',
                                localField: 'service',
                                foreignField: '_id',
                                as: 'serviceInfo'
                            }
                        },
                        {
                            $unwind: {
                                path: '$serviceInfo',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $sort: {
                                date: -1,
                                startTime: -1
                            }
                        }
                    ]);

                    // Re-format appointments
                    const newFormattedAppointments = appointments.map(apt => ({
                        ...apt,
                        serviceName: apt.serviceInfo ? apt.serviceInfo.name : 'Appointment',
                        providerName: apt.providerInfo ? `${apt.providerInfo.firstName} ${apt.providerInfo.lastName}` : 'Provider',
                        formattedDate: new Date(apt.date).toLocaleDateString(),
                        formattedTime: apt.startTime
                    }));

                    console.log('📊 After creating test appointment - Found:', newFormattedAppointments.length);
                    formattedAppointments = newFormattedAppointments;
                }
            } catch (testError) {
                console.error('❌ Error creating test appointment:', testError);
            }
        }

        res.render('patient/appointments', {
            title: 'My Appointments',
            user: req.user,
            appointments: formattedAppointments,
            currentPage: 'appointments'
        });
    } catch (err) {
        next(err);
    }
});

// Get specific appointment
router.get('/appointments/:appointmentId', protect, restrictTo('patient'), async (req, res) => {
    try {
        const appointmentResult = await Appointment.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(req.params.appointmentId),
                    patient: req.user._id
                }
            },
            {
                $lookup: {
                    from: 'providers',
                    localField: 'provider',
                    foreignField: '_id',
                    as: 'providerInfo'
                }
            },
            {
                $unwind: {
                    path: '$providerInfo',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'serviceofferings',
                    localField: 'service',
                    foreignField: '_id',
                    as: 'serviceInfo'
                }
            },
            {
                $unwind: {
                    path: '$serviceInfo',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    providerInfo: {
                        firstName: 1,
                        lastName: 1,
                        professionalTitle: 1,
                        email: 1,
                        phone: 1
                    },
                    serviceInfo: {
                        name: 1,
                        description: 1,
                        duration: 1,
                        price: 1
                    },
                    date: 1,
                    startTime: 1,
                    endTime: 1,
                    status: 1,
                    notes: 1,
                    patientNotes: 1,
                    createdAt: 1
                }
            }
        ]);

        const appointment = appointmentResult[0];

        if (!appointment) {
            return res.status(404).render('error', {
                title: 'Appointment Not Found',
                message: 'Appointment not found',
                user: req.user
            });
        }

        return res.render('patient/appointment-details', {
            title: 'Appointment Details',
            user: req.user,
            appointment,
            currentPage: 'appointments'
        });
    } catch (error) {
        return res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to fetch appointment',
            user: req.user
        });
    }
});

// Cancel appointment
router.put('/appointments/:appointmentId/cancel', protect, restrictTo('patient'), async (req, res) => {
    try {
        const appointment = await Appointment.findOne({
            _id: req.params.appointmentId,
            patient: req.user._id
        });

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        // Check if appointment can be cancelled
        if (appointment.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Appointment is already cancelled'
            });
        }

        if (appointment.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel completed appointment'
            });
        }

        // Check if appointment is within 24 hours
        const appointmentDate = new Date(appointment.date);
        const now = new Date();
        const hoursDifference = (appointmentDate - now) / (1000 * 60 * 60);

        if (hoursDifference < 24) {
            return res.status(400).json({
                success: false,
                message: 'Appointments can only be cancelled at least 24 hours in advance'
            });
        }

        appointment.status = 'cancelled';
        appointment.updatedAt = new Date();
        await appointment.save();

        res.json({
            success: true,
            message: 'Appointment cancelled successfully',
            data: appointment
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Failed to cancel appointment'
        });
    }
});

module.exports = router;