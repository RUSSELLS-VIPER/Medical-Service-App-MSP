const mongoose = require('mongoose');

const serviceOfferingSchema = new mongoose.Schema({
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceCategory',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    shortDescription: {
        type: String,
        trim: true,
        maxlength: 200
    },
    duration: {
        type: Number, // Duration in minutes
        required: true,
        min: 15
    },
    price: {
        type: Number,
        required: false,
        min: 0
    },
    currency: {
        type: String,
        default: 'USD'
    },
    // Enhanced pricing models
    pricingModel: {
        type: String,
        enum: ['fixed', 'hourly', 'tiered', 'dynamic', 'subscription'],
        default: 'fixed'
    },
    // Dynamic pricing tiers with more flexibility
    pricingTiers: [{
        name: String,
        price: Number,
        duration: Number,
        description: String,
        isPopular: { type: Boolean, default: false },
        maxBookings: Number,
        validityDays: Number
    }],
    // Hourly rate for hourly pricing model
    hourlyRate: {
        type: Number,
        min: 0
    },
    // Subscription details
    subscriptionDetails: {
        monthlyPrice: Number,
        yearlyPrice: Number,
        features: [String],
        maxSessions: Number
    },
    // Dynamic availability with custom schedules
    availability: {
        // Default weekly schedule
        weekly: {
            monday: {
                available: { type: Boolean, default: true },
                startTime: { type: String, default: '09:00' },
                endTime: { type: String, default: '17:00' },
                breakStart: { type: String, default: '12:00' },
                breakEnd: { type: String, default: '13:00' },
                maxBookings: { type: Number, default: 10 }
            },
            tuesday: {
                available: { type: Boolean, default: true },
                startTime: { type: String, default: '09:00' },
                endTime: { type: String, default: '17:00' },
                breakStart: { type: String, default: '12:00' },
                breakEnd: { type: String, default: '13:00' },
                maxBookings: { type: Number, default: 10 }
            },
            wednesday: {
                available: { type: Boolean, default: true },
                startTime: { type: String, default: '09:00' },
                endTime: { type: String, default: '17:00' },
                breakStart: { type: String, default: '12:00' },
                breakEnd: { type: String, default: '13:00' },
                maxBookings: { type: Number, default: 10 }
            },
            thursday: {
                available: { type: Boolean, default: true },
                startTime: { type: String, default: '09:00' },
                endTime: { type: String, default: '17:00' },
                breakStart: { type: String, default: '12:00' },
                breakEnd: { type: String, default: '13:00' },
                maxBookings: { type: Number, default: 10 }
            },
            friday: {
                available: { type: Boolean, default: true },
                startTime: { type: String, default: '09:00' },
                endTime: { type: String, default: '17:00' },
                breakStart: { type: String, default: '12:00' },
                breakEnd: { type: String, default: '13:00' },
                maxBookings: { type: Number, default: 10 }
            },
            saturday: {
                available: { type: Boolean, default: false },
                startTime: { type: String, default: '09:00' },
                endTime: { type: String, default: '17:00' },
                breakStart: { type: String, default: '12:00' },
                breakEnd: { type: String, default: '13:00' },
                maxBookings: { type: Number, default: 5 }
            },
            sunday: {
                available: { type: Boolean, default: false },
                startTime: { type: String, default: '09:00' },
                endTime: { type: String, default: '17:00' },
                breakStart: { type: String, default: '12:00' },
                breakEnd: { type: String, default: '13:00' },
                maxBookings: { type: Number, default: 5 }
            }
        },
        // Custom availability for specific dates
        customDates: [{
            date: Date,
            available: Boolean,
            startTime: String,
            endTime: String,
            maxBookings: Number,
            reason: String
        }],
        // Holiday/unavailable dates
        holidays: [{
            date: Date,
            reason: String
        }],
        // Time slot intervals
        timeSlotInterval: {
            type: Number,
            default: 30, // minutes
            enum: [15, 30, 45, 60]
        }
    },
    // Service-specific settings
    maxBookingsPerDay: {
        type: Number,
        default: 10
    },
    advanceBookingDays: {
        type: Number,
        default: 30
    },
    cancellationPolicy: {
        type: String,
        enum: ['flexible', 'moderate', 'strict'],
        default: 'moderate'
    },
    cancellationHours: {
        type: Number,
        default: 24
    },
    // Location settings
    isVirtual: {
        type: Boolean,
        default: false
    },
    location: {
        address: String,
        city: String,
        state: String,
        zipCode: String,
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },
    // Service requirements
    requirements: [{
        type: String,
        trim: true
    }],
    // Service features
    features: [{
        type: String,
        trim: true
    }],
    // Dynamic service attributes
    customAttributes: [{
        key: String,
        value: String,
        type: { type: String, enum: ['text', 'number', 'boolean', 'select'], default: 'text' },
        required: Boolean,
        options: [String] // For select type
    }],
    // Images and media
    images: [{
        url: String,
        caption: String,
        isPrimary: { type: Boolean, default: false }
    }],
    // Approval and status
    approvalStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    approvalNotes: {
        type: String,
        trim: true
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    approvedAt: Date,
    isActive: {
        type: Boolean,
        default: true
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    // Analytics
    totalBookings: {
        type: Number,
        default: 0
    },
    averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    totalReviews: {
        type: Number,
        default: 0
    },
    // SEO and search
    keywords: [{
        type: String,
        trim: true
    }],
    seoDescription: {
        type: String,
        trim: true
    },
    // Service tags for better categorization
    tags: [{
        type: String,
        trim: true
    }],
    // Service variations (e.g., different durations, locations)
    variations: [{
        name: String,
        duration: Number,
        price: Number,
        description: String,
        isActive: Boolean
    }]
}, {
    timestamps: true
});

// Indexes for efficient querying
serviceOfferingSchema.index({ provider: 1, isActive: 1 });
serviceOfferingSchema.index({ category: 1, isActive: 1 });
serviceOfferingSchema.index({ approvalStatus: 1 });
serviceOfferingSchema.index({ isFeatured: 1 });
serviceOfferingSchema.index({ averageRating: -1 });
serviceOfferingSchema.index({ price: 1 });
serviceOfferingSchema.index({ tags: 1 });
serviceOfferingSchema.index({ pricingModel: 1 });

// Virtual for formatted price
serviceOfferingSchema.virtual('formattedPrice').get(function () {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: this.currency
    }).format(this.price);
});

// Virtual for formatted duration
serviceOfferingSchema.virtual('formattedDuration').get(function () {
    const hours = Math.floor(this.duration / 60);
    const minutes = this.duration % 60;
    if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
});

// Method to check if service is available on a specific day and time
serviceOfferingSchema.methods.isAvailable = function (dayOfWeek, time) {
    const day = dayOfWeek.toLowerCase();
    const daySchedule = this.availability.weekly[day];

    if (!daySchedule || !daySchedule.available) {
        return false;
    }

    const timeValue = time.replace(':', '');
    const startValue = daySchedule.startTime.replace(':', '');
    const endValue = daySchedule.endTime.replace(':', '');

    return timeValue >= startValue && timeValue <= endValue;
};

// Method to get available time slots for a specific day
serviceOfferingSchema.methods.getAvailableTimeSlots = function (date) {
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'lowercase' });
    const daySchedule = this.availability.weekly[dayOfWeek];

    if (!daySchedule || !daySchedule.available) {
        return [];
    }

    const slots = [];
    const startTime = new Date(`2000-01-01 ${daySchedule.startTime}`);
    const endTime = new Date(`2000-01-01 ${daySchedule.endTime}`);
    const interval = this.availability.timeSlotInterval || 30; // Use configured interval

    while (startTime < endTime) {
        const timeString = startTime.toTimeString().slice(0, 5);
        slots.push(timeString);
        startTime.setMinutes(startTime.getMinutes() + interval);
    }

    return slots;
};

// Method to check custom date availability
serviceOfferingSchema.methods.isCustomDateAvailable = function (date) {
    const dateStr = date.toISOString().split('T')[0];
    const customDate = this.availability.customDates.find(cd =>
        cd.date.toISOString().split('T')[0] === dateStr
    );

    if (customDate) {
        return customDate.available;
    }

    // Check if it's a holiday
    const holiday = this.availability.holidays.find(h =>
        h.date.toISOString().split('T')[0] === dateStr
    );

    return !holiday;
};

// Method to get dynamic pricing based on date/time
serviceOfferingSchema.methods.getDynamicPrice = function (date, time) {
    if (this.pricingModel === 'dynamic') {
        // Implement dynamic pricing logic based on demand, time, etc.
        const hour = new Date(`2000-01-01 ${time}`).getHours();
        const isPeakHour = hour >= 9 && hour <= 17;
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;

        let multiplier = 1.0;
        if (isPeakHour) multiplier *= 1.2;
        if (isWeekend) multiplier *= 1.3;

        return Math.round(this.price * multiplier);
    }

    return this.price;
};

// Method to check if service can be booked
serviceOfferingSchema.methods.canBeBooked = function (date, time) {
    if (!this.isActive || this.approvalStatus !== 'approved') {
        return false;
    }

    if (!this.isAvailable(date.toLocaleDateString('en-US', { weekday: 'lowercase' }), time)) {
        return false;
    }

    if (!this.isCustomDateAvailable(date)) {
        return false;
    }

    // Check if max bookings reached for the day
    // This would need to be implemented with actual booking data

    return true;
};

module.exports = mongoose.model('ServiceOffering', serviceOfferingSchema);