const LocationUtils = require('../utils/locationUtils');
const Provider = require('../models/Provider');
const ServiceOffering = require('../models/ServiceOffering');

// Middleware to validate if provider serves patient's location
const validateServiceLocation = async (req, res, next) => {
    try {
        const { serviceId } = req.params;
        const { city, state, zipCode } = req.location || {};

        if (!city || !state) {
            return res.status(400).json({
                success: false,
                message: 'City and state are required for location validation'
            });
        }

        const service = await ServiceOffering.findById(serviceId).populate('provider');
        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        const provider = service.provider;
        const isServed = LocationUtils.isWithinServiceArea(provider, city, state, zipCode);

        if (!isServed) {
            return res.status(400).json({
                success: false,
                message: 'This service is not available in your area'
            });
        }

        next();
    } catch (error) {
        next(error);
    }
};

// Middleware to extract location from request
const extractLocation = (req, res, next) => {
    const { city, state, zipCode } = req.body;

    if (city && state) {
        req.location = { city, state, zipCode };
    }

    next();
};

module.exports = {
    validateServiceLocation,
    extractLocation
};
