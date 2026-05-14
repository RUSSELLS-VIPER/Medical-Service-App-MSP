const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
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
    service: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceOffering',
        required: true
    },
    serviceCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceCategory',
        required: false
    },
    date: {
        type: Date,
        required: true
    },
    startTime: {
        type: String,
        required: true
    },
    endTime: {
        type: String,
        required: true
    },
    duration: {
        type: Number, // Duration in minutes
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'],
        default: 'pending'
    },

    notes: {
        type: String,
        trim: true
    },
    patientNotes: {
        type: String,
        trim: true
    },
    providerNotes: {
        type: String,
        trim: true
    },
    cancellationReason: {
        type: String,
        trim: true
    },
    cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'cancelledByModel'
    },
    cancelledByModel: {
        type: String,
        enum: ['Patient', 'Provider', 'Admin']
    },
    cancellationDate: Date,
    reminderSent: {
        type: Boolean,
        default: false
    },
    reminderSentAt: Date,
    confirmationSent: {
        type: Boolean,
        default: false
    },
    confirmationSentAt: Date,
    // Location information
    location: {
        type: {
            type: String,
            enum: ['provider_location', 'patient_location', 'virtual', 'specific_address'],
            required: true
        },
        address: {
            street: String,
            city: String,
            state: String,
            zipCode: String,
            coordinates: {
                latitude: Number,
                longitude: Number
            }
        },
        virtualMeetingUrl: String
    },
    // Emergency contact
    emergencyContact: {
        name: String,
        phone: String,
        relationship: String
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
appointmentSchema.index({ patient: 1, date: -1 });
appointmentSchema.index({ provider: 1, date: -1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ date: 1, startTime: 1 });


// Virtual for formatted date
appointmentSchema.virtual('formattedDate').get(function () {
    return this.date.toLocaleDateString();
});

// Virtual for formatted time
appointmentSchema.virtual('formattedTime').get(function () {
    return `${this.startTime} - ${this.endTime}`;
});

// Method to check if appointment is in the past
appointmentSchema.methods.isPast = function () {
    const now = new Date();
    const appointmentDateTime = new Date(this.date);
    appointmentDateTime.setHours(parseInt(this.startTime.split(':')[0]), parseInt(this.startTime.split(':')[1]));
    return appointmentDateTime < now;
};

// Method to check if appointment is today
appointmentSchema.methods.isToday = function () {
    const today = new Date();
    const appointmentDate = new Date(this.date);
    return today.toDateString() === appointmentDate.toDateString();
};

// Method to check if appointment is upcoming (within 24 hours)
appointmentSchema.methods.isUpcoming = function () {
    const now = new Date();
    const appointmentDateTime = new Date(this.date);
    appointmentDateTime.setHours(parseInt(this.startTime.split(':')[0]), parseInt(this.startTime.split(':')[1]));
    const diffInHours = (appointmentDateTime - now) / (1000 * 60 * 60);
    return diffInHours > 0 && diffInHours <= 24;
};

module.exports = mongoose.model('Appointment', appointmentSchema);
