const validateServiceCategory = (req, res, next) => {
    const { name, description, shortDescription, icon, color, isActive } = req.body;
    const errors = [];

    // Validate required fields
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
        errors.push('Name is required and must be a non-empty string');
    }

    // Validate optional fields if they are present
    if (description !== undefined && typeof description !== 'string') {
        errors.push('Description must be a string');
    }

    if (shortDescription !== undefined && (typeof shortDescription !== 'string' || shortDescription.length > 200)) {
        errors.push('Short description must be a string with maximum length of 200 characters');
    }

    if (icon !== undefined && typeof icon !== 'string') {
        errors.push('Icon must be a string');
    }

    if (color !== undefined && typeof color !== 'string') {
        errors.push('Color must be a string');
    }

    if (isActive !== undefined && typeof isActive !== 'boolean') {
        errors.push('isActive must be a boolean value');
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            errors
        });
    }

    next();
};

module.exports = {
    validateServiceCategory
};