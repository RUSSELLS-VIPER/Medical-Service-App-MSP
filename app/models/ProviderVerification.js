const mongoose = require('mongoose');

const ProviderVerificationSchema = new mongoose.Schema({
    provider: {
        type: mongoose.Schema.ObjectId,
        ref: 'Provider',
        required: true
    },
    admin: {
        type: mongoose.Schema.ObjectId,
        ref: 'Admin'
    },
    documents: [{
        documentType: {
            type: String,
            required: true,
            enum: ['license', 'certificate', 'id-proof', 'address-proof', 'other']
        },
        documentUrl: {
            type: String,
            required: true
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    reviewNotes: {
        type: String,
        maxlength: [500, 'Review notes cannot be more than 500 characters']
    },
    reviewedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

ProviderVerificationSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Note: Pre-find hooks with populate are removed as we're converting to aggregate queries
// Population will be handled explicitly in aggregate pipelines

module.exports = mongoose.model('ProviderVerification', ProviderVerificationSchema);