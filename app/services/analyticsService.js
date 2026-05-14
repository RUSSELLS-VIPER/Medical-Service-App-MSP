const Appointment = require('../models/Appointment');
const Provider = require('../models/Provider');
const Patient = require('../models/Patient');
const ServiceOffering = require('../models/ServiceOffering');

const Review = require('../models/Review');
const ProviderAnalytics = require('../models/ProviderAnalytics');

class AnalyticsService {
    // Platform-wide analytics
    static async getPlatformOverview(startDate, endDate) {
        try {
            const dateFilter = {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };

            const [
                totalAppointments,
                totalRevenue,
                totalPatients,
                totalProviders,
                totalServices,
                averageRating,
                appointmentStats,
                revenueStats
            ] = await Promise.all([
                Appointment.countDocuments(dateFilter),

                Patient.countDocuments(dateFilter),
                Provider.countDocuments(dateFilter),
                ServiceOffering.countDocuments(dateFilter),
                Review.aggregate([
                    { $match: { ...dateFilter, status: 'approved' } },
                    { $group: { _id: null, average: { $avg: '$overallRating' } } }
                ]),
                Appointment.aggregate([
                    { $match: dateFilter },
                    { $group: { _id: '$status', count: { $sum: 1 } } }
                ]),

            ]);

            return {
                totalAppointments: totalAppointments,
                totalRevenue: 0,
                totalPatients: totalPatients,
                totalProviders: totalProviders,
                totalServices: totalServices,
                averageRating: averageRating[0]?.average || 0,
                appointmentStats: appointmentStats,
                revenueStats: []
            };
        } catch (error) {
            throw new Error(`Error getting platform overview: ${error.message}`);
        }
    }

    // Provider-specific analytics
    static async getProviderAnalytics(providerId, startDate, endDate) {
        try {
            const dateFilter = {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };

            const [
                appointments,

                reviews,
                patientStats,
                serviceStats,
                monthlyStats
            ] = await Promise.all([
                Appointment.find({ provider: providerId, ...dateFilter }),

                Review.find({ provider: providerId, ...dateFilter, status: 'approved' }),
                Appointment.aggregate([
                    { $match: { provider: providerId, ...dateFilter } },
                    { $group: { _id: '$patient', count: { $sum: 1 } } },
                    { $count: 'uniquePatients' }
                ]),
                Appointment.aggregate([
                    { $match: { provider: providerId, ...dateFilter } },
                    { $group: { _id: '$service', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                    { $limit: 5 }
                ]),
                Appointment.aggregate([
                    { $match: { provider: providerId, ...dateFilter } },
                    {
                        $group: {
                            _id: {
                                year: { $year: '$createdAt' },
                                month: { $month: '$createdAt' }
                            },
                            appointments: { $sum: 1 }
                        }
                    },
                    { $sort: { '_id.year': 1, '_id.month': 1 } }
                ])
            ]);

            const averageRating = reviews.length > 0
                ? reviews.reduce((sum, review) => sum + review.overallRating, 0) / reviews.length
                : 0;

            return {
                totalAppointments: appointments.length,
                totalRevenue: 0,
                uniquePatients: patientStats[0]?.uniquePatients || 0,
                averageRating: averageRating,
                totalReviews: reviews.length,
                topServices: serviceStats,
                monthlyStats: monthlyStats,
                appointmentStatusBreakdown: this.getAppointmentStatusBreakdown(appointments)
            };
        } catch (error) {
            throw new Error(`Error getting provider analytics: ${error.message}`);
        }
    }

    // Patient analytics
    static async getPatientAnalytics(patientId, startDate, endDate) {
        try {
            const dateFilter = {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };

            const [
                appointments,

                reviews,
                providerStats
            ] = await Promise.all([
                Appointment.find({ patient: patientId, ...dateFilter }),

                Review.find({ patient: patientId, ...dateFilter }),
                Appointment.aggregate([
                    { $match: { patient: patientId, ...dateFilter } },
                    { $group: { _id: '$provider', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                    { $limit: 5 }
                ])
            ]);

            const totalSpent = 0;

            return {
                totalAppointments: appointments.length,
                totalSpent: totalSpent,
                totalReviews: reviews.length,
                favoriteProviders: providerStats,
                appointmentHistory: appointments.map(apt => ({
                    id: apt._id,
                    date: apt.date,
                    status: apt.status,
                    service: apt.service,
                    provider: apt.provider
                }))
            };
        } catch (error) {
            throw new Error(`Error getting patient analytics: ${error.message}`);
        }
    }

    // Service category analytics
    static async getServiceCategoryAnalytics(startDate, endDate) {
        try {
            const dateFilter = {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };

            const categoryStats = await Appointment.aggregate([
                { $match: dateFilter },
                {
                    $lookup: {
                        from: 'serviceofferings',
                        localField: 'service',
                        foreignField: '_id',
                        as: 'serviceDetails'
                    }
                },
                {
                    $lookup: {
                        from: 'servicecategories',
                        localField: 'serviceDetails.category',
                        foreignField: '_id',
                        as: 'categoryDetails'
                    }
                },
                {
                    $group: {
                        _id: '$categoryDetails.name',
                        appointments: { $sum: 1 },
                        revenue: { $sum: 0 }
                    }
                },
                { $sort: { appointments: -1 } }
            ]);

            return categoryStats;
        } catch (error) {
            throw new Error(`Error getting service category analytics: ${error.message}`);
        }
    }

    // Revenue analytics
    static async getRevenueAnalytics(startDate, endDate, groupBy = 'month') {
        try {
            const dateFilter = {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };

            let groupStage;
            if (groupBy === 'day') {
                groupStage = {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    }
                };
            } else if (groupBy === 'week') {
                groupStage = {
                    _id: {
                        year: { $year: '$createdAt' },
                        week: { $week: '$createdAt' }
                    }
                };
            } else {
                groupStage = {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    }
                };
            }

            const revenueStats = [];

            return revenueStats;
        } catch (error) {
            throw new Error(`Error getting revenue analytics: ${error.message}`);
        }
    }

    // Performance metrics
    static async getPerformanceMetrics(startDate, endDate) {
        try {
            const dateFilter = {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };

            const [
                appointmentMetrics,

                reviewMetrics,
                providerMetrics
            ] = await Promise.all([
                Appointment.aggregate([
                    { $match: dateFilter },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: 1 },
                            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                            cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
                            noShow: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } }
                        }
                    }
                ]),

                Review.aggregate([
                    { $match: { ...dateFilter, status: 'approved' } },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: 1 },
                            averageRating: { $avg: '$overallRating' },
                            fiveStar: { $sum: { $cond: [{ $eq: ['$overallRating', 5] }, 1, 0] } }
                        }
                    }
                ]),
                Provider.aggregate([
                    { $match: dateFilter },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: 1 },
                            verified: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'approved'] }, 1, 0] } },
                            pending: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'pending'] }, 1, 0] } }
                        }
                    }
                ])
            ]);

            const appointmentData = appointmentMetrics[0] || {};
            const paymentData = {};
            const reviewData = reviewMetrics[0] || {};
            const providerData = providerMetrics[0] || {};

            return {
                appointmentMetrics: {
                    total: appointmentData.total || 0,
                    completed: appointmentData.completed || 0,
                    cancelled: appointmentData.cancelled || 0,
                    noShow: appointmentData.noShow || 0,
                    completionRate: appointmentData.total ? (appointmentData.completed / appointmentData.total) * 100 : 0
                },
                paymentMetrics: {
                    total: 0,
                    completed: 0,
                    failed: 0,
                    totalAmount: 0,
                    successRate: 0
                },
                reviewMetrics: {
                    total: reviewData.total || 0,
                    averageRating: reviewData.averageRating || 0,
                    fiveStarCount: reviewData.fiveStar || 0,
                    fiveStarPercentage: reviewData.total ? (reviewData.fiveStar / reviewData.total) * 100 : 0
                },
                providerMetrics: {
                    total: providerData.total || 0,
                    verified: providerData.verified || 0,
                    pending: providerData.pending || 0,
                    verificationRate: providerData.total ? (providerData.verified / providerData.total) * 100 : 0
                }
            };
        } catch (error) {
            throw new Error(`Error getting performance metrics: ${error.message}`);
        }
    }

    // Helper method to get appointment status breakdown
    static getAppointmentStatusBreakdown(appointments) {
        const breakdown = {
            pending: 0,
            confirmed: 0,
            completed: 0,
            cancelled: 0,
            no_show: 0
        };

        appointments.forEach(appointment => {
            if (breakdown.hasOwnProperty(appointment.status)) {
                breakdown[appointment.status]++;
            }
        });

        return breakdown;
    }

    // Real-time dashboard data
    static async getDashboardData() {
        try {
            const today = new Date();
            const startOfDay = new Date(today.setHours(0, 0, 0, 0));
            const endOfDay = new Date(today.setHours(23, 59, 59, 999));

            const [
                todayAppointments,
                todayRevenue,
                pendingVerifications,
                recentReviews
            ] = await Promise.all([
                Appointment.countDocuments({
                    date: { $gte: startOfDay, $lte: endOfDay }
                }),

                Provider.countDocuments({ verificationStatus: 'pending' }),
                Review.aggregate([
                    {
                        $match: { status: 'pending' }
                    },
                    {
                        $lookup: {
                            from: 'patients',
                            localField: 'patient',
                            foreignField: '_id',
                            as: 'patient'
                        }
                    },
                    {
                        $unwind: {
                            path: '$patient',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $lookup: {
                            from: 'providers',
                            localField: 'provider',
                            foreignField: '_id',
                            as: 'provider'
                        }
                    },
                    {
                        $unwind: {
                            path: '$provider',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $project: {
                            patient: {
                                firstName: 1,
                                lastName: 1
                            },
                            provider: {
                                firstName: 1,
                                lastName: 1
                            },
                            rating: 1,
                            comment: 1,
                            status: 1,
                            createdAt: 1
                        }
                    },
                    {
                        $sort: { createdAt: -1 }
                    },
                    {
                        $limit: 5
                    }
                ])
            ]);

            return {
                todayAppointments: todayAppointments,
                todayRevenue: 0,
                pendingVerifications: pendingVerifications,
                recentReviews: recentReviews
            };
        } catch (error) {
            throw new Error(`Error getting dashboard data: ${error.message}`);
        }
    }
}

module.exports = AnalyticsService;