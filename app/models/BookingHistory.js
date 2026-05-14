const mongoose = require('mongoose');

const bookingHistorySchema = new mongoose.Schema({
    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true
    },
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true
    },
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: true
    },
    action: {
        type: String,
        enum: ['created', 'confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show'],
        required: true
    },
    previousStatus: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'completed'],
        default: null
    },
    newStatus: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'completed'],
        required: true
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'performedByModel',
        required: true
    },
    performedByModel: {
        type: String,
        enum: ['Patient', 'Provider', 'Admin'],
        required: true
    },
    reason: {
        type: String,
        trim: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ipAddress: String,
    userAgent: String,
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for efficient querying
bookingHistorySchema.index({ appointment: 1, timestamp: -1 });
bookingHistorySchema.index({ patient: 1, timestamp: -1 });
bookingHistorySchema.index({ provider: 1, timestamp: -1 });

module.exports = mongoose.model('BookingHistory', bookingHistorySchema);
