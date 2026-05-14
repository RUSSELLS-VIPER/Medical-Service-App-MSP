const mongoose = require('mongoose');

const doctorServiceSchema = new mongoose.Schema({
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: [true, 'Provider reference is required']
    },
    doctorName: {
        type: String,
        required: [true, 'Doctor name is required'],
        trim: true
    },
    specialization: {
        type: String,
        required: [true, 'Specialization is required'],
        trim: true
    },
    basePrice: {
        type: Number,
        required: [true, 'Base price is required'],
        min: [0, 'Price cannot be negative']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    approvalStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    approvedAt: {
        type: Date
    },
    // New fields for enhanced functionality
    qualifications: {
        type: [String],
        default: []
    },
    languages: {
        type: [String],
        default: ['English']
    },
    availability: {
        workingDays: {
            type: [Number], // 0-6 (Sunday-Saturday)
            default: [1, 2, 3, 4, 5] // Monday-Friday by default
        },
        startTime: {
            type: String, // Store as "HH:MM" format
            default: '09:00'
        },
        endTime: {
            type: String, // Store as "HH:MM" format
            default: '17:00'
        }
    },
    consultationDuration: {
        type: Number, // in minutes
        default: 30,
        min: [15, 'Minimum consultation duration is 15 minutes']
    },
    photoUrl: {
        type: String,
        default: '/images/doctor-avatar.png'
    },
    rating: {
        average: {
            type: Number,
            default: 0,
            min: [0, 'Rating cannot be negative'],
            max: [5, 'Maximum rating is 5']
        },
        count: {
            type: Number,
            default: 0
        }
    },
    // For location-based services
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number] // [longitude, latitude]
        },
        address: String,
        city: String,
        state: String,
        postalCode: String,
        country: String
    },
    // For telemedicine support
    supportsTelemedicine: {
        type: Boolean,
        default: false
    },
    // For insurance acceptance
    acceptedInsurances: {
        type: [String],
        default: []
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for formatted working days
doctorServiceSchema.virtual('formattedWorkingDays').get(function () {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return this.availability.workingDays.map(day => days[day]).join(', ');
});

// Indexes for better query performance
doctorServiceSchema.index({ specialization: 1, isActive: 1 });
doctorServiceSchema.index({ 'location.coordinates': '2dsphere' });

// Pre-save hook to ensure data consistency
doctorServiceSchema.pre('save', function (next) {
    // Ensure doctorName is properly capitalized
    if (this.doctorName) {
        this.doctorName = this.doctorName.split(' ')
            .map(name => name.charAt(0).toUpperCase() + name.slice(1).toLowerCase())
            .join(' ');
    }

    // Ensure specialization is capitalized
    if (this.specialization) {
        this.specialization = this.specialization.charAt(0).toUpperCase() +
            this.specialization.slice(1).toLowerCase();
    }

    next();
});

module.exports = mongoose.model('DoctorService', doctorServiceSchema);