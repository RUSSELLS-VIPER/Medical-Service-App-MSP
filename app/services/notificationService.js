const Notification = require('../models/Notification');
const EmailService = require('../utils/emailService');
const Patient = require('../models/Patient');
const Provider = require('../models/Provider');
const Admin = require('../models/Admin');

class NotificationService {
    // Create notification
    static async createNotification(data) {
        try {
            const notification = new Notification({
                recipient: data.recipient,
                recipientModel: data.recipientModel,
                sender: data.sender,
                senderModel: data.senderModel,
                type: data.type,
                title: data.title,
                message: data.message,
                priority: data.priority || 'medium',
                deliveryMethod: data.deliveryMethod || 'in_app',
                relatedAppointment: data.relatedAppointment,
                relatedProvider: data.relatedProvider,
                relatedPatient: data.relatedPatient,
                actionRequired: data.actionRequired || false,
                actionUrl: data.actionUrl,
                actionText: data.actionText,
                expiresAt: data.expiresAt,
                metadata: data.metadata || {},
                ipAddress: data.ipAddress,
                userAgent: data.userAgent
            });

            await notification.save();

            // Send notification based on delivery method
            if (notification.deliveryMethod === 'email' || notification.deliveryMethod === 'all') {
                await this.sendEmailNotification(notification);
            }

            if (notification.deliveryMethod === 'sms' || notification.deliveryMethod === 'all') {
                await this.sendSMSNotification(notification);
            }

            if (notification.deliveryMethod === 'push' || notification.deliveryMethod === 'all') {
                await this.sendPushNotification(notification);
            }

            return notification;
        } catch (error) {
            throw new Error(`Error creating notification: ${error.message}`);
        }
    }

    // Send email notification
    static async sendEmailNotification(notification) {
        try {
            const recipient = await this.getRecipient(notification.recipient, notification.recipientModel);
            if (!recipient || !recipient.email) {
                throw new Error('Recipient email not found');
            }

            const emailData = {
                to: recipient.email,
                subject: notification.title,
                template: this.getEmailTemplate(notification.type),
                context: {
                    recipientName: `${recipient.firstName} ${recipient.lastName}`,
                    title: notification.title,
                    message: notification.message,
                    actionUrl: notification.actionUrl,
                    actionText: notification.actionText,
                    ...notification.metadata
                }
            };

            await EmailService.sendEmail(emailData);
            await notification.markAsSent('email');
        } catch (error) {
            await notification.markAsFailed('email', error.message);
            throw new Error(`Error sending email notification: ${error.message}`);
        }
    }

    // Send SMS notification (placeholder for SMS service integration)
    static async sendSMSNotification(notification) {
        try {
            const recipient = await this.getRecipient(notification.recipient, notification.recipientModel);
            if (!recipient || !recipient.phone) {
                throw new Error('Recipient phone not found');
            }




            await notification.markAsSent('sms');
        } catch (error) {
            await notification.markAsFailed('sms', error.message);
            throw new Error(`Error sending SMS notification: ${error.message}`);
        }
    }

    // Send push notification (placeholder for push service integration)
    static async sendPushNotification(notification) {
        try {



            await notification.markAsSent('push');
        } catch (error) {
            await notification.markAsFailed('push', error.message);
            throw new Error(`Error sending push notification: ${error.message}`);
        }
    }

    // Get recipient details
    static async getRecipient(recipientId, recipientModel) {
        try {
            let recipient;
            switch (recipientModel) {
                case 'Patient':
                    recipient = await Patient.findById(recipientId);
                    break;
                case 'Provider':
                    recipient = await Provider.findById(recipientId);
                    break;
                case 'Admin':
                    recipient = await Admin.findById(recipientId);
                    break;
                default:
                    throw new Error(`Invalid recipient model: ${recipientModel}`);
            }
            return recipient;
        } catch (error) {
            throw new Error(`Error getting recipient: ${error.message}`);
        }
    }

    // Get email template based on notification type
    static getEmailTemplate(notificationType) {
        const templates = {
            'booking_confirmation': 'booking-confirmation',
            'booking_reminder': 'booking-reminder',
            'booking_cancellation': 'booking-cancellation',
            'booking_reschedule': 'booking-reschedule',
            'verification_status': 'verification-status',
            'payment_confirmation': 'payment-confirmation',
            'payment_failed': 'payment-failed',
            'provider_approval': 'provider-approval',
            'provider_rejection': 'provider-rejection',
            'review_request': 'review-request',
            'account_verification': 'account-verification',
            'password_reset': 'password-reset',
            'welcome_message': 'welcome-message',
            'system_alert': 'system-alert',
            'maintenance_notice': 'maintenance-notice'
        };

        return templates[notificationType] || 'default';
    }

    // Appointment-related notifications
    static async sendBookingConfirmation(appointment) {
        try {
            const patient = await Patient.findById(appointment.patient);
            const provider = await Provider.findById(appointment.provider);
            const service = await ServiceOffering.findById(appointment.service);

            // Send to patient
            await this.createNotification({
                recipient: appointment.patient,
                recipientModel: 'Patient',
                sender: appointment.provider,
                senderModel: 'Provider',
                type: 'booking_confirmation',
                title: 'Appointment Confirmed',
                message: `Your appointment with ${provider.firstName} ${provider.lastName} for ${service.name} has been confirmed.`,
                priority: 'high',
                deliveryMethod: 'all',
                relatedAppointment: appointment._id,
                relatedProvider: appointment.provider,
                metadata: {
                    appointmentDate: appointment.date,
                    appointmentTime: appointment.startTime,
                    serviceName: service.name,
                    providerName: `${provider.firstName} ${provider.lastName}`,
                    amount: appointment.amount
                }
            });

            // Send to provider
            await this.createNotification({
                recipient: appointment.provider,
                recipientModel: 'Provider',
                sender: appointment.patient,
                senderModel: 'Patient',
                type: 'booking_confirmation',
                title: 'New Appointment Booking',
                message: `New appointment booking from ${patient.firstName} ${patient.lastName} for ${service.name}.`,
                priority: 'medium',
                deliveryMethod: 'in_app',
                relatedAppointment: appointment._id,
                relatedPatient: appointment.patient,
                metadata: {
                    appointmentDate: appointment.date,
                    appointmentTime: appointment.startTime,
                    serviceName: service.name,
                    patientName: `${patient.firstName} ${patient.lastName}`,
                    amount: appointment.amount
                }
            });
        } catch (error) {
            throw new Error(`Error sending booking confirmation: ${error.message}`);
        }
    }

    static async sendBookingReminder(appointment) {
        try {
            const patient = await Patient.findById(appointment.patient);
            const provider = await Provider.findById(appointment.provider);
            const service = await ServiceOffering.findById(appointment.service);

            await this.createNotification({
                recipient: appointment.patient,
                recipientModel: 'Patient',
                sender: appointment.provider,
                senderModel: 'Provider',
                type: 'booking_reminder',
                title: 'Appointment Reminder',
                message: `Reminder: You have an appointment with ${provider.firstName} ${provider.lastName} tomorrow.`,
                priority: 'high',
                deliveryMethod: 'all',
                relatedAppointment: appointment._id,
                relatedProvider: appointment.provider,
                metadata: {
                    appointmentDate: appointment.date,
                    appointmentTime: appointment.startTime,
                    serviceName: service.name,
                    providerName: `${provider.firstName} ${provider.lastName}`
                }
            });
        } catch (error) {
            throw new Error(`Error sending booking reminder: ${error.message}`);
        }
    }

    static async sendBookingCancellation(appointment, cancelledBy, reason) {
        try {
            const patient = await Patient.findById(appointment.patient);
            const provider = await Provider.findById(appointment.provider);
            const service = await ServiceOffering.findById(appointment.service);

            // Send to patient
            await this.createNotification({
                recipient: appointment.patient,
                recipientModel: 'Patient',
                sender: cancelledBy,
                senderModel: cancelledBy === appointment.patient ? 'Patient' : 'Provider',
                type: 'booking_cancellation',
                title: 'Appointment Cancelled',
                message: `Your appointment with ${provider.firstName} ${provider.lastName} for ${service.name} has been cancelled.`,
                priority: 'high',
                deliveryMethod: 'all',
                relatedAppointment: appointment._id,
                relatedProvider: appointment.provider,
                metadata: {
                    appointmentDate: appointment.date,
                    appointmentTime: appointment.startTime,
                    serviceName: service.name,
                    providerName: `${provider.firstName} ${provider.lastName}`,
                    cancellationReason: reason
                }
            });

            // Send to provider
            await this.createNotification({
                recipient: appointment.provider,
                recipientModel: 'Provider',
                sender: cancelledBy,
                senderModel: cancelledBy === appointment.provider ? 'Provider' : 'Patient',
                type: 'booking_cancellation',
                title: 'Appointment Cancelled',
                message: `Appointment with ${patient.firstName} ${patient.lastName} for ${service.name} has been cancelled.`,
                priority: 'medium',
                deliveryMethod: 'in_app',
                relatedAppointment: appointment._id,
                relatedPatient: appointment.patient,
                metadata: {
                    appointmentDate: appointment.date,
                    appointmentTime: appointment.startTime,
                    serviceName: service.name,
                    patientName: `${patient.firstName} ${patient.lastName}`,
                    cancellationReason: reason
                }
            });
        } catch (error) {
            throw new Error(`Error sending booking cancellation: ${error.message}`);
        }
    }

    // Provider verification notifications
    static async sendVerificationStatus(provider, status, adminId = null) {
        try {
            const message = status === 'approved'
                ? 'Your account has been approved. You can now start accepting appointments.'
                : 'Your account verification has been rejected. Please review and resubmit your documents.';

            await this.createNotification({
                recipient: provider._id,
                recipientModel: 'Provider',
                sender: adminId,
                senderModel: adminId ? 'Admin' : 'System',
                type: 'verification_status',
                title: `Account ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                message: message,
                priority: 'high',
                deliveryMethod: 'all',
                relatedProvider: provider._id,
                metadata: {
                    verificationStatus: status,
                    providerName: `${provider.firstName} ${provider.lastName}`
                }
            });
        } catch (error) {
            throw new Error(`Error sending verification status: ${error.message}`);
        }
    }

    // Payment notifications
    static async sendPaymentConfirmation(payment) {
        try {
            const patient = await Patient.findById(payment.patient);
            const provider = await Provider.findById(payment.provider);
            const service = await ServiceOffering.findById(payment.service);

            await this.createNotification({
                recipient: payment.patient,
                recipientModel: 'Patient',
                sender: payment.provider,
                senderModel: 'Provider',
                type: 'payment_confirmation',
                title: 'Payment Confirmed',
                message: `Your payment of $${payment.amount} for ${service.name} has been confirmed.`,
                priority: 'medium',
                deliveryMethod: 'all',
                relatedAppointment: payment.appointment,
                relatedProvider: payment.provider,
                metadata: {
                    amount: payment.amount,
                    serviceName: service.name,
                    providerName: `${provider.firstName} ${provider.lastName}`,
                    transactionId: payment.transactionId,
                    receiptNumber: payment.receiptNumber
                }
            });
        } catch (error) {
            throw new Error(`Error sending payment confirmation: ${error.message}`);
        }
    }

    static async sendPaymentFailed(payment, reason) {
        try {
            const patient = await Patient.findById(payment.patient);
            const service = await ServiceOffering.findById(payment.service);

            await this.createNotification({
                recipient: payment.patient,
                recipientModel: 'Patient',
                sender: null,
                senderModel: 'System',
                type: 'payment_failed',
                title: 'Payment Failed',
                message: `Your payment of $${payment.amount} for ${service.name} has failed. Please try again.`,
                priority: 'high',
                deliveryMethod: 'all',
                relatedAppointment: payment.appointment,
                actionRequired: true,
                actionUrl: `/payments/retry/${payment._id}`,
                actionText: 'Retry Payment',
                metadata: {
                    amount: payment.amount,
                    serviceName: service.name,
                    failureReason: reason
                }
            });
        } catch (error) {
            throw new Error(`Error sending payment failed notification: ${error.message}`);
        }
    }

    // Review request notification
    static async sendReviewRequest(appointment) {
        try {
            const patient = await Patient.findById(appointment.patient);
            const provider = await Provider.findById(appointment.provider);
            const service = await ServiceOffering.findById(appointment.service);

            await this.createNotification({
                recipient: appointment.patient,
                recipientModel: 'Patient',
                sender: appointment.provider,
                senderModel: 'Provider',
                type: 'review_request',
                title: 'Share Your Experience',
                message: `How was your experience with ${provider.firstName} ${provider.lastName}? Please leave a review.`,
                priority: 'medium',
                deliveryMethod: 'all',
                relatedAppointment: appointment._id,
                relatedProvider: appointment.provider,
                actionRequired: true,
                actionUrl: `/reviews/create/${appointment._id}`,
                actionText: 'Leave Review',
                metadata: {
                    serviceName: service.name,
                    providerName: `${provider.firstName} ${provider.lastName}`,
                    appointmentDate: appointment.date
                }
            });
        } catch (error) {
            throw new Error(`Error sending review request: ${error.message}`);
        }
    }

    // System notifications
    static async sendSystemAlert(recipients, title, message, priority = 'medium') {
        try {
            const notifications = recipients.map(recipient => ({
                recipient: recipient.id,
                recipientModel: recipient.model,
                sender: null,
                senderModel: 'System',
                type: 'system_alert',
                title: title,
                message: message,
                priority: priority,
                deliveryMethod: 'all'
            }));

            await Promise.all(notifications.map(notification => this.createNotification(notification)));
        } catch (error) {
            throw new Error(`Error sending system alert: ${error.message}`);
        }
    }

    // Get notifications for a user
    static async getUserNotifications(userId, userModel, page = 1, limit = 20) {
        try {
            const skip = (page - 1) * limit;

            const notifications = await Notification.aggregate([
                {
                    $match: {
                        recipient: userId,
                        recipientModel: userModel
                    }
                },
                {
                    $lookup: {
                        from: 'appointments',
                        localField: 'relatedAppointment',
                        foreignField: '_id',
                        as: 'relatedAppointment'
                    }
                },
                {
                    $unwind: {
                        path: '$relatedAppointment',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $lookup: {
                        from: 'providers',
                        localField: 'relatedProvider',
                        foreignField: '_id',
                        as: 'relatedProvider'
                    }
                },
                {
                    $unwind: {
                        path: '$relatedProvider',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $lookup: {
                        from: 'patients',
                        localField: 'relatedPatient',
                        foreignField: '_id',
                        as: 'relatedPatient'
                    }
                },
                {
                    $unwind: {
                        path: '$relatedPatient',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $sort: { createdAt: -1 }
                },
                {
                    $skip: skip
                },
                {
                    $limit: limit
                }
            ]);

            const total = await Notification.countDocuments({
                recipient: userId,
                recipientModel: userModel
            });

            return {
                notifications,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw new Error(`Error getting user notifications: ${error.message}`);
        }
    }

    // Mark notification as read
    static async markAsRead(notificationId, userId) {
        try {
            const notification = await Notification.findById(notificationId);
            if (!notification) {
                throw new Error('Notification not found');
            }

            if (notification.recipient.toString() !== userId.toString()) {
                throw new Error('Unauthorized to mark this notification as read');
            }

            await notification.markAsRead();
            return notification;
        } catch (error) {
            throw new Error(`Error marking notification as read: ${error.message}`);
        }
    }

    // Get unread count
    static async getUnreadCount(userId, userModel) {
        try {
            return await Notification.getUnreadCount(userId, userModel);
        } catch (error) {
            throw new Error(`Error getting unread count: ${error.message}`);
        }
    }

    // Delete expired notifications
    static async deleteExpiredNotifications() {
        try {
            const result = await Notification.deleteMany({
                expiresAt: { $lt: new Date() }
            });
            return result.deletedCount;
        } catch (error) {
            throw new Error(`Error deleting expired notifications: ${error.message}`);
        }
    }
}

module.exports = NotificationService;