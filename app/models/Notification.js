const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'recipientModel',
        required: true
    },
    recipientModel: {
        type: String,
        required: true,
        enum: ['Patient', 'Provider', 'Admin']
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'senderModel'
    },
    senderModel: {
        type: String,
        enum: ['Patient', 'Provider', 'Admin', 'System']
    },
    type: {
        type: String,
        required: [true, 'Notification type is required'],
        enum: [
            'booking_confirmation',
            'booking_reminder',
            'booking_cancellation',
            'booking_reschedule',
            'verification_status',
            'service_approval',
            'service_rejection',
            'appointment_confirmation',
            'appointment_cancellation',
            'payment_confirmation',
            'payment_failed',
            'account',

            'system_alert',
            'appointment_reminder',
            'provider_approval',
            'provider_rejection',
            'review_request',
            'emergency_alert',
            'maintenance_notice',
            'account_verification',
            'password_reset',
            'welcome_message'
        ]
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        trim: true
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date,
        validate: {
            validator: function (v) {
                return !v || (this.isRead && v) || (!this.isRead && !v);
            },
            message: 'readAt must be set when isRead is true'
        }
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    deliveryStatus: {
        type: String,
        enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
        default: 'pending'
    },
    deliveryAttempts: {
        type: Number,
        default: 0
    },
    lastDeliveryAttempt: Date,
    deliveryMethod: {
        type: String,
        enum: ['email', 'sms', 'push', 'in_app'],
        default: 'in_app'
    },
    relatedAppointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment'
    },
    relatedProvider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider'
    },
    relatedPatient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient'
    },
    actionRequired: {
        type: Boolean,
        default: false
    },
    actionUrl: String,
    actionText: String,
    expiresAt: Date,
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    // Email-specific fields
    emailSent: {
        type: Boolean,
        default: false
    },
    emailSentAt: Date,
    emailError: String,
    // SMS-specific fields
    smsSent: {
        type: Boolean,
        default: false
    },
    smsSentAt: Date,
    smsError: String,
    // Push notification fields
    pushSent: {
        type: Boolean,
        default: false
    },
    pushSentAt: Date,
    pushError: String
}, {
    timestamps: true
});

// Indexes for efficient querying
notificationSchema.index({ recipient: 1, recipientModel: 1, createdAt: -1 });
notificationSchema.index({ isRead: 1 });
notificationSchema.index({ deliveryStatus: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ priority: 1 });
notificationSchema.index({ expiresAt: 1 });

// Method to mark as read
notificationSchema.methods.markAsRead = function () {
    this.isRead = true;
    this.readAt = new Date();
    this.deliveryStatus = 'read';
    return this.save();
};

// Method to mark as sent
notificationSchema.methods.markAsSent = function (method = 'email') {
    this.deliveryStatus = 'sent';
    this.deliveryAttempts += 1;
    this.lastDeliveryAttempt = new Date();

    switch (method) {
        case 'email':
            this.emailSent = true;
            this.emailSentAt = new Date();
            break;
        case 'sms':
            this.smsSent = true;
            this.smsSentAt = new Date();
            break;
        case 'push':
            this.pushSent = true;
            this.pushSentAt = new Date();
            break;
    }

    return this.save();
};

// Method to mark as failed
notificationSchema.methods.markAsFailed = function (method = 'email', error) {
    this.deliveryStatus = 'failed';
    this.deliveryAttempts += 1;
    this.lastDeliveryAttempt = new Date();

    switch (method) {
        case 'email':
            this.emailError = error;
            break;
        case 'sms':
            this.smsError = error;
            break;
        case 'push':
            this.pushError = error;
            break;
    }

    return this.save();
};

// Static method to get unread notifications count
notificationSchema.statics.getUnreadCount = function (recipientId, recipientModel) {
    return this.countDocuments({
        recipient: recipientId,
        recipientModel: recipientModel,
        isRead: false
    });
};

// Static method to get notifications by type
notificationSchema.statics.getByType = function (recipientId, recipientModel, type) {
    return this.find({
        recipient: recipientId,
        recipientModel: recipientModel,
        type: type
    }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('Notification', notificationSchema);