// Utility functions for location-based calculations
class LocationUtils {
    // Calculate distance between two coordinates using Haversine formula
    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = LocationUtils.deg2rad(lat2 - lat1);
        const dLon = LocationUtils.deg2rad(lon2 - lon1);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(LocationUtils.deg2rad(lat1)) * Math.cos(LocationUtils.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return distance * 0.621371; // Convert to miles
    }

    static deg2rad(deg) {
        return deg * (Math.PI / 180);
    }

    // Check if a location is within service area
    static isWithinServiceArea(provider, patientCity, patientState, patientZipCode) {
        // Check if provider serves the entire state
        const servesState = provider.serviceAreas.some(area =>
            area.state === patientState && !area.city && !area.zipCode
        );

        // Check if provider serves the specific city
        const servesCity = provider.serviceAreas.some(area =>
            area.state === patientState && area.city === patientCity
        );

        // Check if provider serves the specific zip code
        const servesZip = provider.serviceAreas.some(area =>
            area.zipCode === patientZipCode
        );

        return servesState || servesCity || servesZip;
    }

    // Get coordinates from address using a geocoding service
    static async geocodeAddress(address) {
        // This would integrate with a geocoding service like Google Maps or OpenStreetMap
        // Implementation depends on which geocoding service you choose to use
        throw new Error('Geocoding service not implemented');
    }
}

module.exports = LocationUtils;
