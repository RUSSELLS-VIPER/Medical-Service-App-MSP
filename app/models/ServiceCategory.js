const mongoose = require('mongoose');

const serviceCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: String,
    shortDescription: {
        type: String,
        maxlength: 200
    },
    // Parent category for hierarchical organization
    parentCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceCategory',
        default: null
    },
    // Subcategories
    subcategories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceCategory'
    }],
    // Category icon and styling
    icon: {
        type: String,
        default: 'fa-user-md'
    },
    // Category image
    imageUrl: {
        type: String,
        default: null
    },
    color: {
        type: String,
        default: '#2563eb'
    },
    // Category metadata
    keywords: [String],
    seoTitle: String,
    seoDescription: String,
    // Category requirements and features
    requirements: [String],
    features: [String],
    // Category-specific settings
    isActive: {
        type: Boolean,
        default: true
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    // Category display order
    displayOrder: {
        type: Number,
        default: 0
    },
    // Category statistics
    totalServices: {
        type: Number,
        default: 0
    },
    totalProviders: {
        type: Number,
        default: 0
    },
    // Category-specific pricing ranges
    priceRange: {
        min: Number,
        max: Number,
        currency: {
            type: String,
            default: 'USD'
        }
    },
    // Category availability patterns
    availabilityPatterns: [{
        name: String,
        description: String,
        isDefault: Boolean
    }],
    // Custom category attributes
    customFields: [{
        key: String,
        label: String,
        type: {
            type: String,
            enum: ['text', 'number', 'boolean', 'select', 'date'],
            default: 'text'
        },
        required: Boolean,
        options: [String], // For select type
        defaultValue: String,
        validation: {
            min: Number,
            max: Number,
            pattern: String
        }
    }],
    // Category templates for quick service creation
    serviceTemplates: [{
        name: String,
        description: String,
        duration: Number,
        basePrice: Number,
        features: [String],
        requirements: [String]
    }]
}, {
    timestamps: true
});

// Indexes for efficient querying
serviceCategorySchema.index({ parentCategory: 1, isActive: 1 });
serviceCategorySchema.index({ isFeatured: 1 });
serviceCategorySchema.index({ displayOrder: 1 });
serviceCategorySchema.index({ name: 'text', description: 'text', keywords: 'text' });

// Virtual for full category path
serviceCategorySchema.virtual('fullPath').get(function () {
    if (this.parentCategory) {
        return `${this.parentCategory.name} > ${this.name}`;
    }
    return this.name;
});

// Virtual for category level
serviceCategorySchema.virtual('level').get(function () {
    if (this.parentCategory) {
        return 2; // Subcategory
    }
    return 1; // Main category
});

// Method to get all subcategories recursively
serviceCategorySchema.methods.getAllSubcategories = async function () {
    const subcategories = [];

    for (const subId of this.subcategories) {
        const subcategory = await this.constructor.findById(subId);
        if (subcategory) {
            subcategories.push(subcategory);
            const nestedSubs = await subcategory.getAllSubcategories();
            subcategories.push(...nestedSubs);
        }
    }

    return subcategories;
};

// Method to get category hierarchy
serviceCategorySchema.methods.getHierarchy = async function () {
    const hierarchy = [];
    let currentCategory = this;

    while (currentCategory) {
        hierarchy.unshift({
            _id: currentCategory._id,
            name: currentCategory.name,
            level: hierarchy.length + 1
        });

        if (currentCategory.parentCategory) {
            currentCategory = await this.constructor.findById(currentCategory.parentCategory);
        } else {
            break;
        }
    }

    return hierarchy;
};

// Method to check if category has active services
serviceCategorySchema.methods.hasActiveServices = async function () {
    const ServiceOffering = mongoose.model('ServiceOffering');
    const count = await ServiceOffering.countDocuments({
        category: this._id,
        isActive: true,
        approvalStatus: 'approved'
    });
    return count > 0;
};

// Method to update category statistics
serviceCategorySchema.methods.updateStatistics = async function () {
    const ServiceOffering = mongoose.model('ServiceOffering');
    const Provider = mongoose.model('Provider');

    // Count active services
    const totalServices = await ServiceOffering.countDocuments({
        category: this._id,
        isActive: true,
        approvalStatus: 'approved'
    });

    // Count providers offering services in this category
    const totalProviders = await ServiceOffering.distinct('provider', {
        category: this._id,
        isActive: true,
        approvalStatus: 'approved'
    });

    // Update price range
    const priceStats = await ServiceOffering.aggregate([
        {
            $match: {
                category: this._id,
                isActive: true,
                approvalStatus: 'approved'
            }
        },
        {
            $group: {
                _id: null,
                minPrice: { $min: '$price' },
                maxPrice: { $max: '$price' }
            }
        }
    ]);

    this.totalServices = totalServices;
    this.totalProviders = totalProviders.length;

    if (priceStats.length > 0) {
        this.priceRange = {
            min: priceStats[0].minPrice,
            max: priceStats[0].maxPrice,
            currency: 'USD'
        };
    }

    await this.save();
};

// Pre-save middleware to update parent category subcategories
serviceCategorySchema.pre('save', async function (next) {
    if (this.isModified('parentCategory')) {
        // Remove from old parent's subcategories
        if (this._oldParentCategory && this._oldParentCategory.toString() !== this.parentCategory?.toString()) {
            const oldParent = await this.constructor.findById(this._oldParentCategory);
            if (oldParent) {
                oldParent.subcategories = oldParent.subcategories.filter(
                    subId => subId.toString() !== this._id.toString()
                );
                await oldParent.save();
            }
        }

        // Add to new parent's subcategories
        if (this.parentCategory) {
            const newParent = await this.constructor.findById(this.parentCategory);
            if (newParent && !newParent.subcategories.includes(this._id)) {
                newParent.subcategories.push(this._id);
                await newParent.save();
            }
        }

        this._oldParentCategory = this.parentCategory;
    }
    next();
});

// Static method to get category tree
serviceCategorySchema.statics.getCategoryTree = async function () {
    const categories = await this.find({
        isActive: true,
        parentCategory: null
    }).populate('subcategories');

    return categories;
};

// Static method to search categories
serviceCategorySchema.statics.searchCategories = async function (query) {
    return await this.find({
        $and: [
            { isActive: true },
            {
                $or: [
                    { name: { $regex: query, $options: 'i' } },
                    { description: { $regex: query, $options: 'i' } },
                    { keywords: { $in: [new RegExp(query, 'i')] } }
                ]
            }
        ]
    }).sort({ displayOrder: 1, name: 1 });
};

module.exports = mongoose.model('ServiceCategory', serviceCategorySchema);