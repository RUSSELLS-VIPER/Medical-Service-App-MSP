const Appointment = require('../models/Appointment')
const ServiceCategory = require('../models/ServiceCategory')
const ServiceOffering = require('../models/ServiceOffering')
const Provider = require('../models/Provider')
const Notification = require('../models/Notification')
const { sendEmail } = require('../utils/emailService')

class PatientController {
    getServiceCategories = async (req, res, next) => {
        try {
            const categories = await ServiceCategory.find({ isActive: true });

            res.status(200).json({
                success: true,
                count: categories.length,
                data: categories
            });
        } catch (err) {
            next(err);
        }
    };

    getServicesByCategory = async (req, res, next) => {
        try {
            const { categoryId } = req.params;
            const services = await ServiceOffering.aggregate([
                {
                    $match: {
                        category: categoryId,
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
                    $unwind: {
                        path: '$provider',
                        preserveNullAndEmptyArrays: true
                    }
                }
            ]);

            res.status(200).json({
                success: true,
                count: services.length,
                data: services
            });
        } catch (err) {
            next(err);
        }
    };

    searchServices = async (req, res, next) => {
        try {
            const { query } = req.query;

            const services = await ServiceOffering.aggregate([
                {
                    $match: {
                        $or: [
                            { name: { $regex: query, $options: 'i' } },
                            { description: { $regex: query, $options: 'i' } }
                        ],
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
                }
            ]);

            res.status(200).json({
                success: true,
                count: services.length,
                data: services
            });
        } catch (err) {
            next(err);
        }
    };

    bookAppointment = async (req, res, next) => {
        try {
            const { serviceId, date, startTime, endTime, notes } = req.body;
            const patientId = req.user.id;

            const service = await ServiceOffering.findById(serviceId);
            if (!service) {
                return res.status(404).json({
                    success: false,
                    message: 'Service not found'
                });
            }

            const provider = await Provider.findById(service.provider);
            if (provider.verificationStatus !== 'approved') {
                return res.status(400).json({
                    success: false,
                    message: 'Provider is not approved'
                });
            }

            const conflictingAppointment = await Appointment.findOne({
                provider: service.provider,
                date,
                $or: [
                    { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
                ],
                status: { $in: ['pending', 'confirmed'] }
            });

            if (conflictingAppointment) {
                return res.status(400).json({
                    success: false,
                    message: 'Time slot is already booked'
                });
            }

            const appointment = await Appointment.create({
                patient: patientId,
                provider: service.provider,
                service: serviceId,
                date,
                startTime,
                endTime,
                notes
            });

            await Notification.create([
                {
                    recipient: patientId,
                    recipientModel: 'Patient',
                    sender: service.provider,
                    senderModel: 'Provider',
                    type: 'appointment-confirmation',
                    title: 'Appointment Booked',
                    message: `Your appointment with ${provider.firstName} ${provider.lastName} has been booked for ${date} at ${startTime}.`,
                    relatedEntity: appointment._id,
                    relatedEntityModel: 'Appointment'
                },
                {
                    recipient: service.provider,
                    recipientModel: 'Provider',
                    sender: patientId,
                    senderModel: 'Patient',
                    type: 'appointment-confirmation',
                    title: 'New Appointment',
                    message: `You have a new appointment with ${req.user.firstName} ${req.user.lastName} on ${date} at ${startTime}.`,
                    relatedEntity: appointment._id,
                    relatedEntityModel: 'Appointment'
                }
            ]);

            await Promise.all([
                sendEmail({
                    to: req.user.email,
                    subject: 'Appointment Confirmation',
                    text: `Hello ${req.user.firstName},\n\nYour appointment with ${provider.firstName} ${provider.lastName} (${provider.professionalTitle}) has been confirmed for ${date} at ${startTime}.\n\nService: ${service.name}\nNotes: ${notes || 'None'}\n\nThank you for using our platform.`
                }),
                sendEmail({
                    to: provider.email,
                    subject: 'New Appointment Booking',
                    text: `Hello ${provider.firstName},\n\nYou have a new appointment with ${req.user.firstName} ${req.user.lastName} on ${date} at ${startTime}.\n\nService: ${service.name}\nNotes: ${notes || 'None'}\n\nPlease log in to your account to manage this appointment.`
                })
            ]);

            res.status(201).json({
                success: true,
                data: appointment
            });
        } catch (err) {
            next(err);
        }
    };

    getAppointments = async (req, res, next) => {
        try {
            const appointments = await Appointment.find({ patient: req.user.id })
                .sort({ date: 1, startTime: 1 });

            res.status(200).json({
                success: true,
                count: appointments.length,
                data: appointments
            });
        } catch (err) {
            next(err);
        }
    };

    cancelAppointment = async (req, res, next) => {
        try {
            const { id } = req.params;

            const appointment = await Appointment.findOneAndUpdate(
                {
                    _id: id,
                    patient: req.user.id,
                    status: { $in: ['pending', 'confirmed'] }
                },
                { status: 'cancelled' },
                { new: true }
            );

            if (!appointment) {
                return res.status(404).json({
                    success: false,
                    message: 'Appointment not found or cannot be cancelled'
                });
            }

            // Create notifications
            await Notification.create([
                {
                    recipient: appointment.patient,
                    recipientModel: 'Patient',
                    sender: appointment.provider,
                    senderModel: 'Provider',
                    type: 'appointment-cancellation',
                    title: 'Appointment Cancelled',
                    message: `Your appointment with ${appointment.provider.firstName} ${appointment.provider.lastName} on ${appointment.date} has been cancelled.`,
                    relatedEntity: appointment._id,
                    relatedEntityModel: 'Appointment'
                },
                {
                    recipient: appointment.provider,
                    recipientModel: 'Provider',
                    sender: appointment.patient,
                    senderModel: 'Patient',
                    type: 'appointment-cancellation',
                    title: 'Appointment Cancelled',
                    message: `Your appointment with ${appointment.patient.firstName} ${appointment.patient.lastName} on ${appointment.date} has been cancelled.`,
                    relatedEntity: appointment._id,
                    relatedEntityModel: 'Appointment'
                }
            ]);

            // Send cancellation emails
            await Promise.all([
                sendEmail({
                    to: req.user.email,
                    subject: 'Appointment Cancelled',
                    text: `Hello ${req.user.firstName},\n\nYour appointment with ${appointment.provider.firstName} ${appointment.provider.lastName} on ${appointment.date} has been cancelled.\n\nIf you didn't request this cancellation, please contact support.`
                }),
                sendEmail({
                    to: appointment.provider.email,
                    subject: 'Appointment Cancelled',
                    text: `Hello ${appointment.provider.firstName},\n\nYour appointment with ${req.user.firstName} ${req.user.lastName} on ${appointment.date} has been cancelled by the patient.\n\nThis time slot is now available for other bookings.`
                })
            ]);

            res.status(200).json({
                success: true,
                data: appointment
            });
        } catch (err) {
            next(err);
        }
    };

    getNotifications = async (req, res, next) => {
        try {
            const notifications = await Notification.find({
                recipient: req.user.id,
                recipientModel: 'Patient'
            }).sort({ createdAt: -1 });

            res.status(200).json({
                success: true,
                count: notifications.length,
                data: notifications
            });
        } catch (err) {
            next(err);
        }
    };

    markNotificationAsRead = async (req, res, next) => {
        try {
            const { id } = req.params;

            const notification = await Notification.findOneAndUpdate(
                {
                    _id: id,
                    recipient: req.user.id,
                    recipientModel: 'Patient'
                },
                { isRead: true },
                { new: true }
            );

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    message: 'Notification not found'
                });
            }

            res.status(200).json({
                success: true,
                data: notification
            });
        } catch (err) {
            next(err);
        }
    };

    updateProfile = async (req, res, next) => {
        try {
            const { firstName, lastName, phone, dateOfBirth, gender, address } = req.body;

            const patient = await Patient.findByIdAndUpdate(
                req.user.id,
                { firstName, lastName, phone, dateOfBirth, gender, address },
                { new: true, runValidators: true }
            ).select('-password');

            res.status(200).json({
                success: true,
                data: patient
            });
        } catch (err) {
            next(err);
        }
    };

}

module.exports = new PatientController()