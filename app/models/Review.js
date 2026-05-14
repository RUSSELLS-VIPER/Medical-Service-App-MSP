const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
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
    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true
    },
    // Rating details
    overallRating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    // Detailed ratings
    detailedRatings: {
        professionalism: {
            type: Number,
            min: 1,
            max: 5
        },
        communication: {
            type: Number,
            min: 1,
            max: 5
        },
        punctuality: {
            type: Number,
            min: 1,
            max: 5
        },
        cleanliness: {
            type: Number,
            min: 1,
            max: 5
        },
        valueForMoney: {
            type: Number,
            min: 1,
            max: 5
        },
        effectiveness: {
            type: Number,
            min: 1,
            max: 5
        }
    },
    // Review content
    title: {
        type: String,
        trim: true,
        maxlength: 100
    },
    comment: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    // Review status
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'flagged'],
        default: 'pending'
    },
    isAnonymous: {
        type: Boolean,
        default: false
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    // Moderation
    moderatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    moderatedAt: Date,
    moderationNotes: {
        type: String,
        trim: true
    },
    // Provider response
    providerResponse: {
        comment: {
            type: String,
            trim: true,
            maxlength: 1000
        },
        respondedAt: {
            type: Date,
            default: Date.now
        }
    },
    // Helpful votes
    helpfulVotes: {
        type: Number,
        default: 0
    },
    helpfulVoters: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient'
    }],
    // Report handling
    reportedBy: [{
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Patient'
        },
        reason: {
            type: String,
            enum: ['inappropriate', 'spam', 'fake', 'offensive', 'other']
        },
        reportedAt: {
            type: Date,
            default: Date.now
        }
    }],
    // Media attachments
    images: [{
        url: String,
        caption: String
    }],
    // Metadata
    ipAddress: String,
    userAgent: String,
    // Analytics
    viewCount: {
        type: Number,
        default: 0
    },
    lastViewedAt: Date
}, {
    timestamps: true
});

// Indexes for efficient querying
reviewSchema.index({ provider: 1, createdAt: -1 });
reviewSchema.index({ service: 1, createdAt: -1 });
reviewSchema.index({ patient: 1, createdAt: -1 });
reviewSchema.index({ status: 1 });
reviewSchema.index({ overallRating: -1 });
reviewSchema.index({ isVerified: 1 });
reviewSchema.index({ appointment: 1 }, { unique: true });

// Compound indexes
reviewSchema.index({ provider: 1, status: 1 });
reviewSchema.index({ service: 1, status: 1 });

// Virtual for average detailed rating
reviewSchema.virtual('averageDetailedRating').get(function () {
    const ratings = Object.values(this.detailedRatings).filter(rating => rating !== undefined);
    if (ratings.length === 0) return this.overallRating;
    return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
});

// Virtual for formatted rating
reviewSchema.virtual('formattedRating').get(function () {
    return `${this.overallRating}/5`;
});

// Method to calculate helpful percentage
reviewSchema.methods.getHelpfulPercentage = function () {
    return this.helpfulVotes > 0 ? Math.round((this.helpfulVotes / this.viewCount) * 100) : 0;
};

// Method to mark as helpful
reviewSchema.methods.markAsHelpful = function (patientId) {
    if (!this.helpfulVoters.includes(patientId)) {
        this.helpfulVoters.push(patientId);
        this.helpfulVotes += 1;
        return this.save();
    }
    return Promise.resolve(this);
};

// Method to report review
reviewSchema.methods.reportReview = function (patientId, reason) {
    const existingReport = this.reportedBy.find(report => report.patient.toString() === patientId.toString());
    if (!existingReport) {
        this.reportedBy.push({
            patient: patientId,
            reason: reason
        });
        return this.save();
    }
    return Promise.resolve(this);
};

// Static method to get average rating for a provider
reviewSchema.statics.getAverageRatingForProvider = function (providerId) {
    return this.aggregate([
        { $match: { provider: providerId, status: 'approved' } },
        { $group: { _id: null, averageRating: { $avg: '$overallRating' }, totalReviews: { $sum: 1 } } }
    ]);
};

// Static method to get rating distribution for a provider
reviewSchema.statics.getRatingDistributionForProvider = function (providerId) {
    return this.aggregate([
        { $match: { provider: providerId, status: 'approved' } },
        { $group: { _id: '$overallRating', count: { $sum: 1 } } },
        { $sort: { _id: -1 } }
    ]);
};

// Pre-save middleware to ensure only one review per appointment
reviewSchema.pre('save', function (next) {
    if (this.isNew) {
        this.constructor.findOne({ appointment: this.appointment })
            .then(existingReview => {
                if (existingReview) {
                    const error = new Error('Review already exists for this appointment');
                    error.name = 'ValidationError';
                    return next(error);
                }
                next();
            })
            .catch(next);
    } else {
        next();
    }
});

module.exports = mongoose.model('Review', reviewSchema);
