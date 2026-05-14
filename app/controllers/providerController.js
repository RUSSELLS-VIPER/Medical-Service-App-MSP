const Appointment = require('../models/Appointment')
const ServiceCategory = require('../models/ServiceCategory')
const ServiceOffering = require('../models/ServiceOffering')
const Notification = require('../models/Notification')
const ProviderVerification = require('../models/ProviderVerification');
const { sendEmail } = require('../utils/emailService');

class ProviderController {
    getAppointments = async (req, res, next) => {
        try {
            const { status } = req.query;
            const filter = { provider: req.user.id };

            if (status) {
                filter.status = status;
            }

            const appointments = await Appointment.find(filter)
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

    updateAppointmentStatus = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const validStatuses = ['confirmed', 'cancelled', 'completed', 'no-show'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status value'
                });
            }

            const appointment = await Appointment.findOneAndUpdate(
                {
                    _id: id,
                    provider: req.user.id,
                    status: { $in: ['pending', 'confirmed'] }
                },
                { status },
                { new: true }
            );

            if (!appointment) {
                return res.status(404).json({
                    success: false,
                    message: 'Appointment not found or cannot be updated'
                });
            }

            await Notification.create({
                recipient: appointment.patient,
                recipientModel: 'Patient',
                sender: req.user.id,
                senderModel: 'Provider',
                type: `appointment-${status === 'confirmed' ? 'confirmation' : 'cancellation'}`,
                title: `Appointment ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                message: `Your appointment with ${req.user.firstName} ${req.user.lastName} on ${appointment.date} has been ${status}.`,
                relatedEntity: appointment._id,
                relatedEntityModel: 'Appointment'
            });

            await sendEmail({
                to: appointment.patient.email,
                subject: `Appointment ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                text: `Hello ${appointment.patient.firstName},\n\nYour appointment with ${req.user.firstName} ${req.user.lastName} on ${appointment.date} has been ${status} by the provider.\n\nIf you have any questions, please contact the provider directly.`
            });

            res.status(200).json({
                success: true,
                data: appointment
            });
        } catch (err) {
            next(err);
        }
    };

    getServices = async (req, res, next) => {
        try {
            const services = await ServiceOffering.aggregate([
                {
                    $match: { provider: req.user.id }
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

    addService = async (req, res, next) => {
        try {
            const { name, description, category, duration, price } = req.body;

            // Check if category exists
            const categoryExists = await ServiceCategory.findById(category);
            if (!categoryExists) {
                return res.status(404).json({
                    success: false,
                    message: 'Category not found'
                });
            }

            const service = await ServiceOffering.create({
                name,
                description,
                category,
                provider: req.user.id,
                duration,
                price
            });

            res.status(201).json({
                success: true,
                data: service
            });
        } catch (err) {
            next(err);
        }
    };

    updateService = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { name, description, duration, price, isActive } = req.body;

            const service = await ServiceOffering.findOneAndUpdate(
                { _id: id, provider: req.user.id },
                { name, description, duration, price, isActive },
                { new: true, runValidators: true }
            );

            if (!service) {
                return res.status(404).json({
                    success: false,
                    message: 'Service not found'
                });
            }

            // Get service with category details
            const serviceWithCategory = await ServiceOffering.aggregate([
                {
                    $match: { _id: service._id }
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

            const populatedService = serviceWithCategory[0];

            res.status(200).json({
                success: true,
                data: populatedService
            });
        } catch (err) {
            next(err);
        }
    };

    getVerificationStatus = async (req, res, next) => {
        try {
            const verification = await ProviderVerification.aggregate([
                {
                    $match: { provider: req.user.id }
                },
                {
                    $lookup: {
                        from: 'admins',
                        localField: 'admin',
                        foreignField: '_id',
                        as: 'admin'
                    }
                },
                {
                    $unwind: {
                        path: '$admin',
                        preserveNullAndEmptyArrays: true
                    }
                }
            ]);

            const verificationData = verification[0];

            res.status(200).json({
                success: true,
                data: verificationData
            });
        } catch (err) {
            next(err);
        }
    };

    uploadVerificationDocuments = async (req, res, next) => {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No files uploaded'
                });
            }

            const verification = await ProviderVerification.findOne({ provider: req.user.id });
            if (!verification) {
                return res.status(404).json({
                    success: false,
                    message: 'Verification record not found'
                });
            }

            const documents = req.files.map(file => ({
                documentType: req.body.documentType || 'other',
                documentUrl: file.path
            }));

            verification.documents = [...verification.documents, ...documents];
            await verification.save();

            await Notification.create({
                recipientModel: 'Admin',
                type: 'provider-verification',
                title: 'New Verification Documents Uploaded',
                message: `${req.user.firstName} ${req.user.lastName} has uploaded new verification documents. Please review.`,
                relatedEntity: verification._id,
                relatedEntityModel: 'ProviderVerification'
            });

            res.status(200).json({
                success: true,
                data: verification
            });
        } catch (err) {
            next(err);
        }
    };

    getNotifications = async (req, res, next) => {
        try {
            const notifications = await Notification.find({
                recipient: req.user.id,
                recipientModel: 'Provider'
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
                    recipientModel: 'Provider'
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
            const { firstName, lastName, phone, professionalTitle, specialization, address } = req.body;

            const provider = await Provider.findByIdAndUpdate(
                req.user.id,
                { firstName, lastName, phone, professionalTitle, specialization, address },
                { new: true, runValidators: true }
            ).select('-password');

            res.status(200).json({
                success: true,
                data: provider
            });
        } catch (err) {
            next(err);
        }
    };


}

module.exports = new ProviderController()