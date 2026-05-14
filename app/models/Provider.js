const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const providerSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/\S+@\S+\.\S+/, 'Please use a valid email address']
    },
    password: {
        type: String,
        required: [true, 'Password is required']
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true
    },
    professionalTitle: {
        type: String,
        required: [true, 'Professional title is required'],
        trim: true
    },
    specialization: {
        type: String,
        required: [true, 'Specialization is required'],
        trim: true
    },
    licenseNumber: {
        type: String,
        required: [true, 'License number is required'],
        unique: true,
        trim: true
    },
    yearsOfExperience: {
        type: Number,
        required: [true, 'Years of experience is required'],
        min: [0, 'Experience cannot be negative']
    },
    role: {
        type: String,
        enum: ['provider'],
        default: 'provider'
    },
    roleName: {
        type: String,
        default: 'provider'
    },
    verificationToken: String,
    verificationTokenExpires: Date,
    verificationOtpHash: String,
    verificationOtpExpires: Date,
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    documents: [{
        documentType: String,
        documentUrl: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    // Location information
    location: {
        address: {
            type: String,
            trim: true
        },
        city: {
            type: String,
            trim: true
        },
        state: {
            type: String,
            trim: true
        },
        zipCode: {
            type: String,
            trim: true
        },
        country: {
            type: String,
            trim: true,
            default: 'USA'
        },
        coordinates: {
            latitude: {
                type: Number,
                min: -90,
                max: 90
            },
            longitude: {
                type: Number,
                min: -180,
                max: 180
            }
        },
        timezone: {
            type: String,
            default: 'America/New_York'
        }
    },
    // Practice information
    practiceInfo: {
        practiceName: {
            type: String,
            trim: true
        },
        practiceType: {
            type: String,
            enum: ['private', 'hospital', 'clinic', 'group_practice', 'telemedicine_only'],
            default: 'private'
        },
        acceptsInsurance: {
            type: Boolean,
            default: false
        },
        insuranceProviders: [{
            type: String,
            trim: true
        }],
        languages: [{
            type: String,
            trim: true
        }],
        emergencyContact: {
            name: String,
            phone: String,
            relationship: String
        }
    }
}, { timestamps: true });

providerSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

providerSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for full name
providerSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

// Virtual for full address
providerSchema.virtual('fullAddress').get(function () {
    if (!this.location) return '';
    const parts = [
        this.location.address,
        this.location.city,
        this.location.state,
        this.location.zipCode
    ].filter(Boolean);
    return parts.join(', ');
});

// Virtual for formatted location
providerSchema.virtual('formattedLocation').get(function () {
    if (!this.location) return 'Location not specified';
    const parts = [
        this.location.city,
        this.location.state
    ].filter(Boolean);
    return parts.join(', ') || 'Location not specified';
});

// Method to get coordinates as array (for geospatial queries)
providerSchema.methods.getCoordinates = function () {
    if (this.location && this.location.coordinates) {
        return [this.location.coordinates.longitude, this.location.coordinates.latitude];
    }
    return null;
};

// Method to check if provider offers telemedicine
providerSchema.methods.offersTelemedicine = function () {
    return this.practiceInfo && this.practiceInfo.practiceType === 'telemedicine_only';
};

// Indexes for efficient querying
providerSchema.index({ 'location.city': 1, 'location.state': 1 });
providerSchema.index({ 'location.coordinates': '2dsphere' });
providerSchema.index({ specialization: 1, isActive: 1 });

module.exports = mongoose.model('Provider', providerSchema);
