const mongoose = require('mongoose');

const providerAnalyticsSchema = new mongoose.Schema({
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: true,
        unique: true
    },
    // Booking Statistics
    totalBookings: {
        type: Number,
        default: 0
    },
    completedBookings: {
        type: Number,
        default: 0
    },
    cancelledBookings: {
        type: Number,
        default: 0
    },
    noShowBookings: {
        type: Number,
        default: 0
    },
    // Financial Metrics
    totalRevenue: {
        type: Number,
        default: 0
    },
    averageBookingValue: {
        type: Number,
        default: 0
    },
    monthlyRevenue: [{
        month: {
            type: String,
            required: true
        },
        year: {
            type: Number,
            required: true
        },
        revenue: {
            type: Number,
            default: 0
        },
        bookings: {
            type: Number,
            default: 0
        }
    }],
    // Rating and Reviews
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
    ratingDistribution: {
        fiveStar: { type: Number, default: 0 },
        fourStar: { type: Number, default: 0 },
        threeStar: { type: Number, default: 0 },
        twoStar: { type: Number, default: 0 },
        oneStar: { type: Number, default: 0 }
    },
    // Performance Metrics
    responseTime: {
        type: Number, // Average response time in hours
        default: 0
    },
    bookingAcceptanceRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    patientSatisfactionScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    // Time-based Analytics
    peakBookingHours: [{
        hour: Number,
        count: Number
    }],
    peakBookingDays: [{
        day: String,
        count: Number
    }],
    // Service-specific Analytics
    serviceAnalytics: [{
        serviceCategory: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ServiceCategory'
        },
        totalBookings: { type: Number, default: 0 },
        revenue: { type: Number, default: 0 },
        averageRating: { type: Number, default: 0 }
    }],
    // Last Updated
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    // Historical Data
    historicalData: [{
        date: {
            type: Date,
            required: true
        },
        bookings: Number,
        revenue: Number,
        rating: Number
    }]
}, {
    timestamps: true
});

// Indexes for efficient querying
providerAnalyticsSchema.index({ provider: 1 });
providerAnalyticsSchema.index({ 'monthlyRevenue.month': 1, 'monthlyRevenue.year': 1 });
providerAnalyticsSchema.index({ averageRating: -1 });
providerAnalyticsSchema.index({ totalRevenue: -1 });

// Method to update analytics
providerAnalyticsSchema.methods.updateAnalytics = async function (bookingData) {
    // This method will be implemented to update analytics based on new booking data
    this.lastUpdated = new Date();
    return await this.save();
};

// Method to calculate average rating
providerAnalyticsSchema.methods.calculateAverageRating = function () {
    const total = this.ratingDistribution.fiveStar * 5 +
        this.ratingDistribution.fourStar * 4 +
        this.ratingDistribution.threeStar * 3 +
        this.ratingDistribution.twoStar * 2 +
        this.ratingDistribution.oneStar * 1;
    const count = this.totalReviews;
    return count > 0 ? total / count : 0;
};

module.exports = mongoose.model('ProviderAnalytics', providerAnalyticsSchema);