const express = require('express');
const router = express.Router();
const path = require('path');
const mongoose = require('mongoose');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const adminController = require('../controllers/adminController');
const ServiceCategory = require('../models/ServiceCategory');
const ServiceOffering = require('../models/ServiceOffering');
const DoctorService = require('../models/DoctorService');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Provider = require('../models/Provider');
const Notification = require('../models/Notification');
const ProviderVerification = require('../models/ProviderVerification');

// Middleware to redirect users to their appropriate dashboard
const redirectToAppropriateDashboard = (req, res, next) => {
    if (req.user) {
        const userRole = req.user.role || req.user.roleName;
        const requestedRole = req.path.split('/')[1]; // Extract role from path

        if (userRole && requestedRole && userRole !== requestedRole) {
            console.log(`🔄 Redirecting ${userRole} user from ${requestedRole} dashboard to ${userRole} dashboard`);
            return res.redirect(`/${userRole}/dashboard`);
        }
    }
    next();
};

// Service category edit route
router.get('/admin/services/categories/:id/edit', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const [category, categories] = await Promise.all([
            ServiceCategory.findById(req.params.id),
            ServiceCategory.find().sort({ name: 1 })
        ]);

        if (!category) {
            return res.status(404).render('error', {
                title: 'Error',
                message: 'Service category not found'
            });
        }

        res.render('admin/edit-service-category', {
            title: 'Edit Service Category',
            category,
            categories,
            isEdit: true
        });
    } catch (error) {
        next(error);
    }
});

// Public Routes
router.get('/', async (req, res, next) => {
    try {
        // Fetch dynamic data for the landing page
        const [
            serviceCategories,
            featuredServices,
            topProviders,
            stats
        ] = await Promise.all([
            // Get active service categories
            ServiceCategory.find({ isActive: true }).limit(8),

            // Get featured services from providers
            ServiceOffering.aggregate([
                {
                    $match: {
                        isActive: true,
                        approvalStatus: 'approved',
                        isFeatured: true
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
                    $unwind: '$provider'
                },
                {
                    $project: {
                        provider: {
                            firstName: 1,
                            lastName: 1,
                            professionalTitle: 1
                        },
                        category: 1,
                        averageRating: 1,
                        serviceName: 1,
                        description: 1,
                        basePrice: 1,
                        duration: 1,
                        isActive: 1,
                        approvalStatus: 1,
                        isFeatured: 1
                    }
                },
                {
                    $lookup: {
                        from: 'servicecategories',
                        localField: 'category',
                        foreignField: '_id',
                        as: 'category'
                    }
                },
                {
                    $unwind: '$category'
                },
                {
                    $project: {
                        provider: 1,
                        category: {
                            name: 1
                        },
                        averageRating: 1,
                        serviceName: 1,
                        description: 1,
                        basePrice: 1,
                        duration: 1,
                        isActive: 1,
                        approvalStatus: 1,
                        isFeatured: 1
                    }
                },
                {
                    $sort: { averageRating: -1 }
                },
                {
                    $limit: 6
                }
            ]),

            // Get top-rated providers
            Provider.find({
                verificationStatus: 'approved',
                isActive: true
            })
                .select('firstName lastName professionalTitle specialization rating')
                .limit(4)
                .sort({ 'rating.average': -1 }),

            // Get platform statistics
            Promise.all([
                Patient.countDocuments(),
                Provider.countDocuments({ verificationStatus: 'approved' }),
                ServiceOffering.countDocuments({ approvalStatus: 'approved', isActive: true }),
                Appointment.countDocuments()
            ])
        ]);

        const [patientCount, providerCount, serviceCount, appointmentCount] = stats;

        // If logged in, you can decide whether to still redirect them
        // or always show the homepage
        if (req.user) {
            return res.render('index', {
                title: 'Welcome',
                user: req.user,
                currentPage: 'home',
                serviceCategories,
                featuredServices,
                topProviders,
                stats: {
                    patients: patientCount,
                    providers: providerCount,
                    services: serviceCount,
                    appointments: appointmentCount
                }
            });
        }

        res.render('index', {
            title: 'Welcome',
            user: null,
            currentPage: 'home',
            serviceCategories,
            featuredServices,
            topProviders,
            stats: {
                patients: patientCount,
                providers: providerCount,
                services: serviceCount,
                appointments: appointmentCount
            }
        });
    } catch (err) {
        next(err);
    }
});



// Logout route for view pages
router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {

        }
        req.session.destroy((err) => {
            if (err) {

            }
            res.clearCookie('connect.sid');
            res.redirect('/login');
        });
    });
});

// Main login page - redirects to role-specific login pages
router.get('/login', (req, res) => {
    if (req.user) {
        return res.redirect(`/${req.user.role || req.user.roleName}/dashboard`);
    }
    res.render('auth/login', {
        title: 'Login',
        error: req.flash('error'),
        currentPage: 'login'
    });
});

router.post('/login', express.urlencoded({ extended: true }), (req, res) => {
    const { email, password, role } = req.body;

    if (!['patient', 'provider', 'admin'].includes(role)) {
        req.flash('error', 'Invalid role selected');
        return res.redirect('/login');
    }

    if (!email || !password) {
        req.flash('error', 'Email and password are required');
        return res.redirect('/login');
    }

    req.session.loginAttempt = {
        email: email.trim().toLowerCase(),
        password,
        role
    };

    switch (role) {
        case 'patient':
            return res.redirect('/auth/patient/login');
        case 'provider':
            return res.redirect('/auth/provider/login');
        case 'admin':
            return res.redirect('/auth/admin/login');
        default:
            req.flash('error', 'Invalid role selected');
            return res.redirect('/login');
    }
});

router.get('/register/patient', (req, res) => {
    res.render('auth/patient-register', {
        title: 'Patient Registration',
        user: null,
        currentPage: 'register'
    });
});

// Patient-specific login page
router.get('/auth/patient/login', (req, res) => {
    if (req.user && (req.user.role === 'patient' || req.user.roleName === 'patient')) {
        return res.redirect('/patient/dashboard');
    }
    res.render('auth/patient-login', {
        title: 'Patient Login',
        error: req.flash('error'),
        currentPage: 'login'
    });
});

// Provider-specific login page
router.get('/auth/provider/login', (req, res) => {
    if (req.user && (req.user.role === 'provider' || req.user.roleName === 'provider')) {
        return res.redirect('/provider/dashboard');
    }
    res.render('auth/provider-login', {
        title: 'Provider Login',
        error: req.flash('error'),
        currentPage: 'login'
    });
});

router.get('/register/provider', (req, res) => {
    res.render('auth/provider-register', {
        title: 'Provider Registration',
        user: null,
        currentPage: 'register'
    });
});

router.get('/register/admin', (req, res) => {
    res.render('auth/admin-register', {
        title: 'Admin Registration',
        user: null,
        currentPage: 'register'
    });
});

// Admin registration form submission
router.post('/register/admin', express.urlencoded({ extended: true }), async (req, res) => {
    try {
        const { firstName, lastName, email, password, phone } = req.body;

        // Basic validation
        if (!firstName || !lastName || !email || !password || !phone) {
            req.flash('error', 'All required fields must be filled');
            return res.redirect('/register/admin');
        }

        // Enhanced phone validation
        const phonePattern = /^\+?[\d\s\-\(\)]{7,20}$/;
        if (!phonePattern.test(phone)) {
            req.flash('error', 'Please enter a valid phone number (7-20 characters). Examples: +1234567890, 123-456-7890, (555) 123-4567');
            return res.redirect('/register/admin');
        }

        // Password validation
        if (password.length < 6) {
            req.flash('error', 'Password must be at least 6 characters long');
            return res.redirect('/register/admin');
        }

        const Admin = require('../models/Admin');

        // Check if email already exists
        const existing = await Admin.findOne({ email });
        if (existing) {
            req.flash('error', 'Email already registered');
            return res.redirect('/register/admin');
        }

        // Create admin
        const admin = await Admin.create({
            firstName,
            lastName,
            email,
            password,
            phone,
            role: 'admin',
            isVerified: true,
            isActive: true
        });

        req.flash('success_msg', 'Admin registration successful! You can now login.');
        res.redirect('/auth/admin/login');

    } catch (error) {
        console.error('Admin registration error:', error);

        // Handle specific validation errors
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            req.flash('error', `Validation error: ${validationErrors.join(', ')}`);
        } else {
            req.flash('error', 'An error occurred during registration. Please try again.');
        }

        res.redirect('/register/admin');
    }
});

// Registration form submissions
router.post('/register/patient', express.urlencoded({ extended: true }), async (req, res) => {
    try {
        const { firstName, lastName, email, password, phone, dateOfBirth, gender, address, healthInfo } = req.body;

        if (!firstName || !lastName || !email || !password || !phone || !dateOfBirth || !gender) {
            req.flash('error', 'All required fields must be filled');
            return res.redirect('/register/patient');
        }

        const Patient = require('../models/Patient');
        const { sendEmail } = require('../utils/emailService');
        const jwt = require('jsonwebtoken');

        // Check if email already exists
        const existing = await Patient.findOne({ email });
        if (existing) {
            req.flash('error', 'Email already registered');
            return res.redirect('/register/patient');
        }

        // Create patient
        const patient = await Patient.create({
            firstName,
            lastName,
            email,
            password,
            phone,
            dateOfBirth,
            gender,
            address,
            healthInfo,
            isVerified: false
        });

        // Generate verification token
        const token = jwt.sign(
            { id: patient._id, role: 'patient' },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        const url = `${process.env.SERVER_URL}/auth/verify-email?token=${token}`;

        // Send verification email
        await sendEmail({
            to: patient.email,
            subject: 'Verify Your Email',
            html: `<p>Click <a href="${url}">here</a> to verify your email. This link expires in 24 hours.</p>`
        });

        req.flash('success_msg', 'Registration successful! Please check your email for verification.');
        res.redirect('/auth/patient/login');

    } catch (error) {

        req.flash('error', 'An error occurred during registration');
        res.redirect('/register/patient');
    }
});

// Provider registration route moved to authRoutes.js to handle file uploads properly

router.post('/register/admin', express.urlencoded({ extended: true }), async (req, res) => {
    try {
        const { firstName, lastName, email, password, phone } = req.body;

        if (!firstName || !lastName || !email || !password || !phone) {
            req.flash('error', 'All required fields must be filled');
            return res.redirect('/register/admin');
        }

        const Admin = require('../models/Admin');

        // Check if email already exists
        const existing = await Admin.findOne({ email });
        if (existing) {
            req.flash('error', 'Email already registered');
            return res.redirect('/register/admin');
        }

        // Create admin
        const admin = await Admin.create({
            firstName,
            lastName,
            email,
            password,
            phone,
            isVerified: true // Admins are auto-verified
        });

        req.flash('success_msg', 'Admin registration successful! You can now login.');
        res.redirect('/auth/admin/login');

    } catch (error) {

        req.flash('error', 'An error occurred during registration');
        res.redirect('/register/admin');
    }
});

// Admin-specific login page
router.get('/auth/admin/login', (req, res) => {
    if (req.user && (req.user.role === 'admin' || req.user.roleName === 'admin')) {
        return res.redirect('/admin/dashboard');
    }
    res.render('auth/admin-login', {
        title: 'Admin Login',
        error: req.flash('error'),
        currentPage: 'login'
    });
});

// ======================
// POST Routes for Authentication
// ======================

router.get('/admin/test', protect, restrictTo('admin'), async (req, res) => {
    try {
        const patientCount = await Patient.countDocuments();

        res.json({
            message: 'Admin test route working',
            user: req.user,
            patientCount: patientCount,
            databaseConnected: mongoose.connection.readyState === 1
        });
    } catch (err) {
        res.status(500).json({
            error: err.message,
            stack: err.stack
        });
    }
});

// Error logging route for debugging
router.get('/admin/debug', protect, restrictTo('admin'), async (req, res) => {
    try {
        const debugInfo = {
            user: req.user,
            databaseConnected: mongoose.connection.readyState === 1,
            databaseState: mongoose.connection.readyState,
            models: {
                Patient: typeof Patient,
                Provider: typeof Provider,
                Appointment: typeof Appointment,
                ProviderVerification: typeof ProviderVerification
            },
            session: req.session ? 'exists' : 'not exists',
            authenticated: req.isAuthenticated()
        };

        res.json(debugInfo);
    } catch (err) {
        res.status(500).json({
            error: err.message,
            stack: err.stack
        });
    }
});

// Simple admin dashboard test route that shows errors in browser
router.get('/admin/dashboard-test', protect, restrictTo('admin'), async (req, res) => {
    try {
        res.render('admin/dashboard', {
            title: 'Admin Dashboard Test',
            isAdminPage: true,
            currentPage: 'admin/dashboard',
            stats: {
                patients: 0,
                providers: 0,
                appointments: 0,
                pendingVerifications: 0,
                pendingServices: 0,
                pendingDocuments: 0
            },
            recentAppointments: [],
            pendingVerifications: [],
            user: req.user
        });
    } catch (err) {
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to render admin dashboard test',
            error: err,
            statusCode: 500,
            user: req.user,
            env: process.env.NODE_ENV || 'development',
            showFullError: process.env.NODE_ENV === 'development' || process.env.SHOW_ERRORS === 'true'
        });
    }
});

// Admin login test route - no auth required
router.get('/admin/login-test', (req, res) => {
    try {
        console.log('🔍 Admin Login Test Route: Testing admin login page');
        res.render('auth/admin-login', {
            title: 'Admin Login Test',
            error: null,
            currentPage: 'login'
        });
    } catch (error) {
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to render admin login page',
            error: error,
            statusCode: 500,
            user: null,
            env: process.env.NODE_ENV || 'development',
            showFullError: process.env.NODE_ENV === 'development' || process.env.SHOW_ERRORS === 'true'
        });
    }
});

// Ultra simple test route - just return JSON
router.get('/admin/simple-test', protect, restrictTo('admin'), async (req, res) => {
    try {
        res.json({
            message: 'Ultra simple test works',
            user: req.user,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('❌ Ultra simple test error:', err);
        res.status(500).json({
            error: err.message,
            stack: err.stack
        });
    }
});

// Simple provider dashboard test route (no auth required)
router.get('/provider/dashboard-test-simple', (req, res) => {
    try {
        console.log('🔍 Simple Provider Test Route: /provider/dashboard-test-simple accessed');
        res.render('provider/dashboard', {
            title: 'Provider Dashboard Test (Simple)',
            user: { _id: 'test', email: 'test@test.com', role: 'provider' },
            appointments: [],
            services: [],
            activeServices: 0,
            pendingReviews: 0,
            totalAppointments: 0,
            todayAppointments: 0,
            recentAppointments: [],
            servicePerformance: [],
            serviceStats: { total: 0, pending: 0, approved: 0, rejected: 0, documentStatus: 'unknown' },
            stats: { totalAppointments: 0, todayAppointments: 0, monthlyRevenue: 0, averageRating: null, totalReviews: 0, totalServices: 0, pendingServices: 0, approvedServices: 0, rejectedServices: 0, verificationStatus: 'unknown' },
            nextAppointment: 'None',
            currentPage: 'provider/dashboard'
        });
        console.log('✅ Simple Provider Test Route: Rendered successfully');
    } catch (error) {
        console.error('❌ Simple Provider Test Route: Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error rendering simple provider test dashboard',
            error: error.message
        });
    }
});

// Simple admin dashboard test route (no auth required)
router.get('/admin/dashboard-test-simple', (req, res) => {
    try {
        console.log('🔍 Simple Test Route: /admin/dashboard-test-simple accessed');
        res.render('admin/dashboard-minimal', {
            title: 'Admin Dashboard Test (Simple)',
            currentPage: 'dashboard',
            totalUsers: 0,
            totalPatients: 0,
            totalProviders: 0,
            totalAppointments: 0,
            pendingVerifications: 0,
            pendingServices: 0,
            pendingDocuments: 0,
            recentAppointments: [],
            pendingVerifications: [],
            recentActivity: [],
            changes: {
                patients: 0,
                providers: 0,
                appointments: 0
            },
            user: null
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error rendering simple test dashboard',
            error: error.message
        });
    }
});

router.get('/admin/dashboard', protect, redirectToAppropriateDashboard, restrictTo('admin'), async (req, res, next) => {
    try {
        await adminController.getDashboard(req, res, next);
    } catch (error) {
        next(error);
    }
});

// Admin verifications route - render the verifications page
router.get('/admin/verifications', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        console.log('🔍 Rendering admin verifications page...');

        const ServiceOffering = require('../models/ServiceOffering');
        const ProviderVerification = require('../models/ProviderVerification');

        // Load provider verification requests (pending)
        const providerVerifications = await ProviderVerification.aggregate([
            { $match: { status: 'pending' } },
            {
                $lookup: {
                    from: 'providers',
                    localField: 'provider',
                    foreignField: '_id',
                    as: 'provider'
                }
            },
            { $unwind: '$provider' },
            { $sort: { createdAt: -1 } },
            { $limit: 20 }
        ]);

        // Load pending ServiceOffering items for approval
        const pendingServices = await ServiceOffering.aggregate([
            { $match: { approvalStatus: 'pending' } },
            {
                $lookup: {
                    from: 'providers',
                    localField: 'provider',
                    foreignField: '_id',
                    as: 'provider'
                }
            },
            { $unwind: '$provider' },
            {
                $lookup: {
                    from: 'servicecategories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
            { $sort: { createdAt: -1 } },
            { $limit: 20 }
        ]);

        const [verifsPending, verifsApproved, verifsRejected] = await Promise.all([
            ProviderVerification.countDocuments({ status: 'pending' }),
            ProviderVerification.countDocuments({ status: 'approved' }),
            ProviderVerification.countDocuments({ status: 'rejected' })
        ]);

        res.render('admin/verifications', {
            title: 'Verifications & Approvals',
            currentPage: 'verifications',
            user: req.user,
            providerVerifications,
            pendingServices,
            stats: { pending: verifsPending, approved: verifsApproved, rejected: verifsRejected },
            layout: false
        });

        console.log('✅ Admin verifications page rendered successfully');
    } catch (error) {
        console.error('❌ Error rendering verifications page:', error);
        next(error);
    }
});

router.get('/services', async (req, res, next) => {
    try {
        // Fetch all service categories with their services and providers
        const categories = await ServiceCategory.find({ isActive: true });

        const showAll = (req.query.showAll === '1' || req.query.all === '1');

        // Get all approved service offerings with provider details
        const serviceOfferings = await ServiceOffering.aggregate([
            {
                $match: showAll ? {} : {
                    isActive: true,
                    approvalStatus: 'approved'
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
            { $unwind: '$provider' },
            ...(showAll ? [] : [{ $match: { 'provider.verificationStatus': 'approved' } }]),
            {
                $lookup: {
                    from: 'servicecategories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            { $unwind: '$category' },
            {
                $project: {
                    _id: 1,
                    provider: {
                        firstName: 1,
                        lastName: 1,
                        professionalTitle: 1,
                        specialization: 1,
                        rating: 1
                    },
                    category: {
                        _id: 1,
                        name: 1,
                        description: 1
                    },
                    name: 1,
                    description: 1,
                    shortDescription: 1,
                    price: 1,
                    duration: 1,
                    averageRating: 1,
                    totalReviews: 1,
                    isActive: 1,
                    approvalStatus: 1,
                    isFeatured: 1
                }
            },
            { $sort: { averageRating: -1 } }
        ]);

        // Get all approved doctor services (individual provider services)
        const doctorServices = await DoctorService.aggregate([
            {
                $match: showAll ? {} : {
                    isActive: true,
                    approvalStatus: 'approved'
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
            { $unwind: '$provider' },
            ...(showAll ? [] : [{ $match: { 'provider.verificationStatus': 'approved' } }]),
            {
                $project: {
                    _id: 1,
                    provider: {
                        firstName: 1,
                        lastName: 1,
                        professionalTitle: 1,
                        specialization: 1,
                        rating: 1
                    },
                    specialization: 1,
                    serviceName: 1,
                    description: 1,
                    basePrice: 1,
                    duration: 1,
                    isActive: 1,
                    approvalStatus: 1,
                    rating: 1
                }
            },
            { $sort: { 'rating.average': -1 } }
        ]);

        // Group services by category with better matching logic
        const servicesByCategory = {};
        categories.forEach(category => {
            const categoryServices = serviceOfferings.filter(service => {
                const serviceCategoryId = service && service.category ? (service.category._id || service.category) : null;
                const categoryId = category && (category._id || category.id);
                return serviceCategoryId && categoryId && String(serviceCategoryId) === String(categoryId);
            });

            const categoryDoctorServices = doctorServices.filter(doctor => {
                const doctorSpecialization = (doctor && doctor.specialization ? String(doctor.specialization) : '').toLowerCase();
                const categoryName = (category && category.name ? String(category.name) : '').toLowerCase();
                if (!doctorSpecialization || !categoryName) return false;

                // More flexible matching - check if specialization contains category name or vice versa
                return doctorSpecialization.includes(categoryName) ||
                    categoryName.includes(doctorSpecialization) ||
                    doctorSpecialization === categoryName;
            });

            servicesByCategory[category._id] = {
                category: category,
                services: categoryServices,
                doctorServices: categoryDoctorServices
            };
        });

        // Flatten list of all services for modal dropdown (from ServiceCategory only per request)
        const allServices = categories.map(c => ({ _id: c._id, name: c.name, duration: 60 }));

        // If no categories exist, create a default category for all services
        if (categories.length === 0) {
            const allServicesOfferings = serviceOfferings;
            const allDoctorServices = doctorServices;

            servicesByCategory['default'] = {
                category: { name: 'Healthcare Services', description: 'Professional healthcare services' },
                services: allServicesOfferings,
                doctorServices: allDoctorServices
            };
        }

        // Get statistics
        const stats = await Promise.all([
            ServiceCategory.countDocuments({ isActive: true }),
            ServiceOffering.countDocuments({ isActive: true, approvalStatus: 'approved' }),
            DoctorService.countDocuments({ isActive: true, approvalStatus: 'approved' }),
            Provider.countDocuments({ verificationStatus: 'approved' })
        ]);

        res.render('services/index', {
            title: 'Our Services',
            categories: categories.length > 0 ? categories : [{ name: 'Healthcare Services', description: 'Professional healthcare services' }],
            // EJS expects serviceCategories; provide both for compatibility
            serviceCategories: categories.length > 0 ? categories : [{ name: 'Healthcare Services', description: 'Professional healthcare services' }],
            servicesByCategory,
            selectedCategoryId: req.query.category || null,
            totalServices: stats[1] + stats[2],
            totalProviders: stats[3],
            user: req.user || null,
            currentPage: 'services',
            allServices,
            showAll
        });
    } catch (err) {
        console.error('Services page error:', err);
        next(err);
    }
});

// Service Category Detail Page - Shows all providers for a specific category
router.get('/services/category/:categoryId', async (req, res, next) => {
    try {
        const { categoryId } = req.params;
        const { page = 1, limit = 12, sort = 'rating' } = req.query;

        // Find the category
        const category = await ServiceCategory.findById(categoryId);
        if (!category) {
            return res.status(404).render('error', {
                title: 'Category Not Found',
                message: 'The requested service category was not found.',
                user: req.user || null,
                currentPage: 'error'
            });
        }

        const showAll = (req.query.showAll === '1' || req.query.all === '1');
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get all approved service offerings for this category
        const serviceOfferings = await ServiceOffering.aggregate([
            {
                $match: {
                    category: new mongoose.Types.ObjectId(categoryId),
                    ...(showAll ? {} : {
                        isActive: true,
                        approvalStatus: 'approved'
                    })
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
            { $unwind: '$provider' },
            ...(showAll ? [] : [{ $match: { 'provider.verificationStatus': 'approved' } }]),
            {
                $lookup: {
                    from: 'servicecategories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            { $unwind: '$category' },
            {
                $project: {
                    _id: 1,
                    provider: {
                        _id: 1,
                        firstName: 1,
                        lastName: 1,
                        professionalTitle: 1,
                        specialization: 1,
                        rating: 1,
                        yearsOfExperience: 1,
                        location: 1,
                        practiceInfo: 1,
                        profileImage: 1
                    },
                    category: {
                        _id: 1,
                        name: 1,
                        description: 1
                    },
                    name: 1,
                    description: 1,
                    shortDescription: 1,
                    price: 1,
                    duration: 1,
                    averageRating: 1,
                    totalReviews: 1,
                    isActive: 1,
                    approvalStatus: 1,
                    isFeatured: 1,
                    isVirtual: 1
                }
            },
            { $sort: { [sort]: sort === 'rating' ? -1 : 1 } },
            { $skip: skip },
            { $limit: parseInt(limit) }
        ]);

        // Get total count for pagination
        const totalServices = await ServiceOffering.countDocuments({
            category: new mongoose.Types.ObjectId(categoryId),
            ...(showAll ? {} : {
                isActive: true,
                approvalStatus: 'approved'
            })
        });

        // Get all approved doctor services that match this category
        const doctorServices = await DoctorService.aggregate([
            {
                $match: showAll ? {} : {
                    isActive: true,
                    approvalStatus: 'approved'
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
            { $unwind: '$provider' },
            ...(showAll ? [] : [{ $match: { 'provider.verificationStatus': 'approved' } }]),
            {
                $match: {
                    $or: [
                        { specialization: { $regex: category.name, $options: 'i' } },
                        { serviceName: { $regex: category.name, $options: 'i' } }
                    ]
                }
            },
            {
                $project: {
                    _id: 1,
                    provider: {
                        _id: 1,
                        firstName: 1,
                        lastName: 1,
                        professionalTitle: 1,
                        specialization: 1,
                        rating: 1,
                        yearsOfExperience: 1,
                        location: 1,
                        practiceInfo: 1,
                        profileImage: 1
                    },
                    specialization: 1,
                    serviceName: 1,
                    description: 1,
                    basePrice: 1,
                    duration: 1,
                    isActive: 1,
                    approvalStatus: 1,
                    rating: 1,
                    isVirtual: 1
                }
            },
            { $sort: { 'rating.average': -1 } },
            { $skip: skip },
            { $limit: parseInt(limit) }
        ]);

        // Get total count for doctor services
        const totalDoctorServices = await DoctorService.countDocuments({
            ...(showAll ? {} : {
                isActive: true,
                approvalStatus: 'approved'
            }),
            $or: [
                { specialization: { $regex: category.name, $options: 'i' } },
                { serviceName: { $regex: category.name, $options: 'i' } }
            ]
        });

        // Combine and sort all services
        const allServices = [...serviceOfferings, ...doctorServices];
        const totalCount = totalServices + totalDoctorServices;

        // Get category statistics
        const stats = {
            totalServices: totalCount,
            totalProviders: new Set(allServices.map(s => s.provider._id.toString())).size,
            averageRating: allServices.length > 0 ?
                (allServices.reduce((sum, s) => sum + (s.averageRating || s.rating?.average || 0), 0) / allServices.length).toFixed(1) : 0,
            totalReviews: allServices.reduce((sum, s) => sum + (s.totalReviews || s.rating?.count || 0), 0)
        };

        // Pagination info
        const pagination = {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            hasNext: skip + parseInt(limit) < totalCount,
            hasPrev: parseInt(page) > 1,
            totalItems: totalCount,
            itemsPerPage: parseInt(limit)
        };

        res.render('services/category', {
            title: `${category.name} Services`,
            category,
            services: allServices,
            stats,
            pagination,
            user: req.user || null,
            currentPage: 'services',
            showAll,
            sortOptions: [
                { value: 'rating', label: 'Highest Rated' },
                { value: 'price', label: 'Price: Low to High' },
                { value: 'duration', label: 'Duration: Short to Long' },
                { value: 'name', label: 'Name: A to Z' }
            ],
            currentSort: sort
        });
    } catch (err) {
        console.error('Service category page error:', err);
        next(err);
    }
});

router.get('/services/doctors', async (req, res, next) => {
    try {
        // Only show approved services to patients/public
        const query = { isActive: true };

        // If user is admin, show all services
        if (req.user && (req.user.role === 'admin' || req.user.roleName === 'admin')) {
            // Admin can see all services
        } else if (req.user && (req.user.role === 'provider' || req.user.roleName === 'provider')) {
            // Provider can see their own services regardless of approval status
            query.provider = req.user._id;
        } else {
            // Patients and public can only see services from providers with approved documents
            // AND services that are approved
            query.approvalStatus = 'approved';
            // We'll need to populate and filter by provider verification status
        }

        let doctors = await DoctorService.aggregate([
            {
                $match: query
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
                $unwind: '$provider'
            },
            {
                $project: {
                    provider: {
                        firstName: 1,
                        lastName: 1,
                        professionalTitle: 1,
                        verificationStatus: 1
                    },
                    specialization: 1,
                    serviceName: 1,
                    description: 1,
                    basePrice: 1,
                    duration: 1,
                    isActive: 1,
                    approvalStatus: 1
                }
            }
        ]);

        // For patients/public, filter out services from providers with pending/rejected documents
        if (!req.user || (req.user.role !== 'admin' && req.user.roleName !== 'admin' && req.user.role !== 'provider' && req.user.roleName !== 'provider')) {
            doctors = doctors.filter(doctor =>
                doctor.provider && doctor.provider.verificationStatus === 'approved'
            );
        }

        const specializations = [...new Set(doctors.map(d => d.specialization))];

        res.render('services/doctors', {
            title: 'Find Doctors',
            doctors,
            specializations,
            user: req.user || null,
            currentPage: 'services/doctors'
        });
    } catch (err) {
        next(err);
    }
});

router.get('/verify-provider', (req, res) => {
    res.render('auth/verify-provider', {
        title: 'Email Verified',
        user: null,
        currentPage: 'verify'
    });
});

router.get('/verify-email', (req, res) => {
    res.render('auth/verify-email', {
        title: 'Email Verification',
        user: null,
        currentPage: 'verify'
    });
});

// Test route for debugging
router.get('/patient/test', protect, restrictTo('patient'), (req, res) => {
    res.render('error', {
        title: 'Test Page',
        message: 'This is a test page to check if rendering works',
        user: req.user,
        currentPage: 'test',
        statusCode: 200,
        env: process.env.NODE_ENV || 'development',
        error: {},
        errorData: {},
        req: req,
        timestamp: new Date().toISOString(),
        showFullError: process.env.NODE_ENV === 'development' || process.env.SHOW_ERRORS === 'true'
    });
});

// Test route for debugging
router.get('/test-dashboard', (req, res) => {
    res.json({
        message: 'Test route working',
        user: req.user || 'No user',
        session: req.session ? 'Session exists' : 'No session',
        authenticated: req.isAuthenticated(),
        cookies: req.cookies ? Object.keys(req.cookies) : 'No cookies',
        headers: {
            authorization: req.headers.authorization ? 'Present' : 'Missing',
            cookie: req.headers.cookie ? 'Present' : 'Missing'
        }
    });
});

// Test route for dashboard rendering without authentication
router.get('/test-dashboard-render', (req, res) => {
    try {
        res.render('patient/dashboard', {
            title: 'Patient Dashboard',
            user: {
                _id: 'test-user-id',
                firstName: 'Test',
                lastName: 'User',
                email: 'test@example.com',
                role: 'patient'
            },
            appointments: [],
            notifications: [],
            stats: {
                total: 0,
                upcoming: 0,
                pending: 0,
                completed: 0,
                cancelled: 0
            },
            chartData: {
                monthly: [],
                status: []
            },
            currentPage: 'patient/dashboard'
        });
    } catch (error) {
        console.error('Render error:', error);
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

// Test route for patient dashboard without authentication (temporary)
router.get('/test-patient-dashboard', (req, res) => {
    try {
        res.render('patient/dashboard', {
            title: 'Patient Dashboard',
            user: {
                _id: 'test-user-id',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@example.com',
                role: 'patient'
            },
            appointments: [
                {
                    _id: 'appointment-1',
                    date: new Date('2024-01-15'),
                    startTime: '10:00 AM',
                    endTime: '11:00 AM',
                    status: 'confirmed',
                    providerInfo: {
                        firstName: 'Dr. Sarah',
                        lastName: 'Johnson',
                        specialization: 'Cardiology'
                    }
                }
            ],
            notifications: [
                {
                    title: 'Appointment Confirmed',
                    message: 'Your appointment with Dr. Sarah Johnson has been confirmed for January 15th, 2024.',
                    createdAt: new Date()
                }
            ],
            stats: {
                total: 5,
                upcoming: 2,
                pending: 1,
                completed: 2,
                cancelled: 0
            },
            chartData: {
                monthly: [],
                status: []
            },
            currentPage: 'patient/dashboard'
        });
    } catch (error) {
        console.error('Render error:', error);
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

// Test route for provider dashboard without authentication (temporary)
router.get('/test-provider-dashboard', (req, res) => {
    try {
        res.render('provider/dashboard', {
            title: 'Provider Dashboard',
            user: {
                _id: 'test-provider-id',
                firstName: 'Dr. Sarah',
                lastName: 'Johnson',
                email: 'sarah.johnson@example.com',
                role: 'provider'
            },
            appointments: [
                {
                    _id: 'appointment-1',
                    date: new Date('2024-01-15'),
                    startTime: '10:00 AM',
                    endTime: '11:00 AM',
                    status: 'confirmed',
                    patient: {
                        firstName: 'John',
                        lastName: 'Doe'
                    },
                    serviceName: 'General Consultation'
                }
            ],
            services: [],
            serviceStats: {
                total: 0,
                pending: 0,
                approved: 0,
                rejected: 0,
                documentStatus: 'unknown'
            },
            stats: {
                totalAppointments: 25,
                todayAppointments: 3,
                totalServices: 5,
                approvedServices: 4,
                pendingServices: 1,
                rejectedServices: 0,
                averageRating: 4.8,
                totalReviews: 12,
                verificationStatus: 'approved'
            },
            nextAppointment: '10:00 AM - John Doe',
            currentPage: 'provider/dashboard'
        });
    } catch (error) {
        console.error('Render error:', error);
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

// Test route to create a provider account (for development only)
router.get('/create-test-provider', async (req, res) => {
    try {
        // Check if provider already exists
        const existingProvider = await Provider.findOne({ email: 'local.provider@yopmail.com' });

        if (existingProvider) {
            return res.json({
                message: 'Provider already exists',
                provider: {
                    id: existingProvider._id,
                    email: existingProvider.email,
                    firstName: existingProvider.firstName,
                    lastName: existingProvider.lastName
                }
            });
        }

        // Create test provider
        const testProvider = await Provider.create({
            firstName: 'Dr. Local',
            lastName: 'Provider',
            email: 'local.provider@yopmail.com',
            password: 'local.provider@yopmail.com',
            phone: '+1234567890',
            professionalTitle: 'General Practitioner',
            specialization: 'General Medicine',
            licenseNumber: 'TEST123456',
            yearsOfExperience: 5,
            isVerified: true,
            verificationStatus: 'approved'
        });

        res.json({
            message: 'Test provider created successfully',
            provider: {
                id: testProvider._id,
                email: testProvider.email,
                firstName: testProvider.firstName,
                lastName: testProvider.lastName
            }
        });
    } catch (error) {
        console.error('Error creating test provider:', error);
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

// Test route to create an admin account (for development only)
router.get('/create-test-admin', async (req, res) => {
    try {
        const Admin = require('../models/Admin');

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email: 'admin@test.com' });

        if (existingAdmin) {
            return res.json({
                message: 'Admin already exists',
                admin: {
                    id: existingAdmin._id,
                    email: existingAdmin.email,
                    firstName: existingAdmin.firstName,
                    lastName: existingAdmin.lastName
                }
            });
        }

        // Create test admin
        const testAdmin = await Admin.create({
            firstName: 'Test',
            lastName: 'Admin',
            email: 'admin@test.com',
            password: 'admin123',
            phone: '+1234567890',
            isVerified: true
        });

        res.json({
            message: 'Test admin created successfully',
            admin: {
                id: testAdmin._id,
                email: testAdmin.email,
                firstName: testAdmin.firstName,
                lastName: testAdmin.lastName
            }
        });
    } catch (error) {
        console.error('Error creating test admin:', error);
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

// Test route for debugging JWT token
router.get('/test-jwt', async (req, res) => {
    try {
        const jwt = require('jsonwebtoken');
        const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.json({
                message: 'No token found',
                cookies: req.cookies,
                authHeader: req.headers.authorization
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Try to find the user in the database
        let user = null;
        let userFound = false;

        try {
            switch (decoded.role) {
                case 'patient':
                    user = await Patient.findById(decoded.id);
                    break;
                case 'provider':
                    user = await Provider.findById(decoded.id);
                    break;
                case 'admin':
                    user = await Admin.findById(decoded.id);
                    break;
            }

            if (user) {
                userFound = true;
            }
        } catch (dbError) {
        }

        res.json({
            message: 'Token decoded successfully',
            decoded,
            token: token.substring(0, 20) + '...',
            userFound,
            user: userFound ? {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: decoded.role
            } : null,
            databaseConnected: mongoose.connection.readyState === 1
        });
    } catch (error) {
        res.json({
            message: 'Token verification failed',
            error: error.message,
            token: req.cookies?.token ? req.cookies.token.substring(0, 20) + '...' : 'No token'
        });
    }
});

// Protected Routes - Patient
router.get('/patient/dashboard', protect, redirectToAppropriateDashboard, restrictTo('patient'), async (req, res, next) => {
    try {
        const patientId = req.user._id;

        // Check if database is connected
        if (mongoose.connection.readyState !== 1) {
            console.log('⚠️  Database not connected, showing dashboard with mock data');
            return res.render('patient/dashboard', {
                title: 'Patient Dashboard',
                user: req.user,
                appointments: [],
                notifications: [],
                stats: {
                    total: 0,
                    upcoming: 0,
                    pending: 0,
                    completed: 0,
                    cancelled: 0
                },
                chartData: {
                    monthly: [],
                    status: []
                },
                currentPage: 'patient/dashboard'
            });
        }

        // Get appointments with aggregation
        let appointments = [];
        try {
            appointments = await Appointment.aggregate([
                {
                    $match: {
                        patient: patientId
                    }
                },
                {
                    $lookup: {
                        from: 'providers',
                        localField: 'provider',
                        foreignField: '_id',
                        as: 'providerInfo'
                    }
                },
                {
                    $unwind: {
                        path: '$providerInfo',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $lookup: {
                        from: 'serviceofferings',
                        localField: 'service',
                        foreignField: '_id',
                        as: 'serviceInfo'
                    }
                },
                {
                    $unwind: {
                        path: '$serviceInfo',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $sort: {
                        date: -1,
                        startTime: -1
                    }
                }
            ]);
        } catch (appointmentsError) {
            console.error('Error fetching appointments:', appointmentsError);
            appointments = [];
        }

        console.log('🔍 Patient dashboard - Found appointments:', appointments.length);
        console.log('🔍 Patient ID:', patientId);

        // Debug: Check total appointments in database
        const totalAppointments = await Appointment.countDocuments();
        console.log('📊 Total appointments in database:', totalAppointments);

        // Debug: Check appointments for any patient
        const anyAppointments = await Appointment.find().limit(3);
        console.log('📊 Sample appointments in DB:', anyAppointments.map(apt => ({
            _id: apt._id,
            patient: apt.patient,
            status: apt.status,
            date: apt.date
        })));

        // If no appointments found, create a test appointment for this user
        if (appointments.length === 0) {
            console.log('🧪 Creating test appointment for user:', patientId);
            try {
                // Find a service to use for the test appointment
                const ServiceOffering = require('../models/ServiceOffering');
                const testService = await ServiceOffering.findOne();

                if (testService) {
                    const testAppointment = new Appointment({
                        patient: patientId,
                        provider: testService.provider,
                        service: testService._id,
                        serviceCategory: testService.category,
                        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
                        startTime: '10:00',
                        endTime: '11:00',
                        duration: 60,
                        status: 'pending',
                        notes: 'Test appointment created automatically',
                        patientNotes: 'Test appointment',
                        location: {
                            address: '',
                            city: '',
                            state: '',
                            zipCode: ''
                        },
                        isVirtual: false
                    });

                    await testAppointment.save();
                    console.log('✅ Test appointment created:', testAppointment._id);

                    // Re-fetch appointments with the new test appointment
                    appointments = await Appointment.aggregate([
                        {
                            $match: {
                                patient: patientId
                            }
                        },
                        {
                            $lookup: {
                                from: 'providers',
                                localField: 'provider',
                                foreignField: '_id',
                                as: 'providerInfo'
                            }
                        },
                        {
                            $unwind: {
                                path: '$providerInfo',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $lookup: {
                                from: 'serviceofferings',
                                localField: 'service',
                                foreignField: '_id',
                                as: 'serviceInfo'
                            }
                        },
                        {
                            $unwind: {
                                path: '$serviceInfo',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $sort: {
                                date: -1,
                                startTime: -1
                            }
                        }
                    ]);

                    console.log('📊 After creating test appointment - Found:', appointments.length);
                }
            } catch (testError) {
                console.error('❌ Error creating test appointment:', testError);
            }
        }

        // Get appointment statistics with aggregation
        let stats = [];
        try {
            stats = await Appointment.aggregate([
                {
                    $match: {
                        patient: patientId
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        upcoming: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$status', 'confirmed'] },
                                            { $gte: ['$date', new Date()] }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },
                        pending: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$status', 'pending'] },
                                    1,
                                    0
                                ]
                            }
                        },
                        completed: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$status', 'completed'] },
                                    1,
                                    0
                                ]
                            }
                        },
                        cancelled: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$status', 'cancelled'] },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                }
            ]);
        } catch (statsError) {
            console.error('Error fetching appointment stats:', statsError);
            stats = [];
        }

        // Get appointment data for charts
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        let monthlyAppointments = [];
        try {
            monthlyAppointments = await Appointment.aggregate([
                {
                    $match: {
                        patient: patientId,
                        date: { $gte: sixMonthsAgo }
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$date' },
                            month: { $month: '$date' }
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: {
                        '_id.year': 1,
                        '_id.month': 1
                    }
                }
            ]);
        } catch (monthlyError) {
            console.error('Error fetching monthly appointments:', monthlyError);
            monthlyAppointments = [];
        }

        // Get appointment status distribution
        let statusDistribution = [];
        try {
            statusDistribution = await Appointment.aggregate([
                {
                    $match: {
                        patient: patientId
                    }
                },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]);
        } catch (statusError) {
            console.error('Error fetching status distribution:', statusError);
            statusDistribution = [];
        }

        // Fetch notifications for the patient
        let notifications = [];
        let unreadNotificationsCount = 0;
        try {
            notifications = await Notification.find({
                recipient: patientId,
                recipientModel: 'Patient'
            })
                .sort({ createdAt: -1 })
                .limit(5)
                .lean();

            unreadNotificationsCount = await Notification.countDocuments({
                recipient: patientId,
                recipientModel: 'Patient',
                isRead: false
            });
        } catch (notificationError) {
            console.error('Error fetching notifications:', notificationError);
            notifications = [];
            unreadNotificationsCount = 0;
        }

        // Format the stats object
        const statsData = stats[0] || {
            total: 0,
            upcoming: 0,
            pending: 0,
            completed: 0,
            cancelled: 0
        };

        // Format appointments for the template
        const formattedAppointments = appointments.map(apt => ({
            ...apt,
            serviceName: apt.serviceInfo ? apt.serviceInfo.name : 'Appointment',
            providerName: apt.providerInfo ? `${apt.providerInfo.firstName} ${apt.providerInfo.lastName}` : 'Provider',
            formattedDate: new Date(apt.date).toLocaleDateString(),
            formattedTime: apt.startTime
        }));

        console.log('Dashboard data prepared, rendering view...');
        console.log('Stats data:', statsData);
        console.log('Appointments count:', appointments.length);
        console.log('Formatted appointments count:', formattedAppointments.length);
        console.log('Notifications count:', notifications.length);

        // Test with minimal data first
        try {
            console.log('Attempting to render dashboard with minimal data...');
            res.render('patient/dashboard', {
                title: 'Patient Dashboard',
                user: req.user,
                appointments: formattedAppointments || [],
                recentAppointments: formattedAppointments.slice(0, 3) || [],
                notifications: notifications || [],
                unreadNotificationsCount: unreadNotificationsCount || 0,
                stats: statsData,
                chartData: {
                    monthly: monthlyAppointments || [],
                    status: statusDistribution || []
                },
                // Template expects these specific variable names
                appointmentsCount: statsData.total || 0,
                upcomingAppointments: statsData.upcoming || 0,
                completedAppointments: statsData.completed || 0,
                doctorsConsulted: new Set(appointments.map(apt => apt.provider)).size,
                currentPage: 'patient/dashboard'
            });
            console.log('Dashboard rendered successfully');
        } catch (renderError) {
            console.error('Render error:', renderError);
            console.error('Render error stack:', renderError.stack);
            throw renderError;
        }
    } catch (err) {
        console.error('Patient dashboard error:', err);
        console.error('Error stack:', err.stack);
        console.error('Error name:', err.name);
        console.error('Error message:', err.message);

        // For view routes, always render an error page instead of returning JSON
        return res.status(500).render('error', {
            title: 'Dashboard Error',
            message: 'An error occurred while loading your dashboard. Please try again.',
            user: req.user,
            currentPage: 'error',
            statusCode: 500,
            env: process.env.NODE_ENV || 'development',
            error: process.env.NODE_ENV === 'development' ? err : {},
            errorData: process.env.NODE_ENV === 'development' ? err : {},
            req: req,
            timestamp: new Date().toISOString(),
            showFullError: process.env.NODE_ENV === 'development' || process.env.SHOW_ERRORS === 'true'
        });
    }
});

router.get('/patient/book-appointment', protect, restrictTo('patient'), async (req, res, next) => {
    try {
        const categories = await ServiceCategory.find({ isActive: true }).select('name');

        res.render('patient/book-appointment', {
            title: 'Book Appointment',
            user: req.user,
            categories,
            currentPage: 'patient/book-appointment'
        });
    } catch (err) {
        next(err);
    }
});

// Patient appointments route moved to patientRoutes.js to avoid conflicts

// Protected Routes - Provider
router.get('/provider/dashboard', protect, redirectToAppropriateDashboard, restrictTo('provider'), async (req, res, next) => {
    try {
        console.log('🔥🔥🔥 PROVIDER DASHBOARD ROUTE ACCESSED 🔥🔥🔥');
        console.log('User object:', req.user);
        console.log('User ID:', req.user._id);
        console.log('User role:', req.user.role || req.user.roleName);

        // Check if database is connected
        if (mongoose.connection.readyState !== 1) {
            console.log('⚠️  Database not connected, showing dashboard with mock data');
            return res.render('provider/dashboard', {
                title: 'Provider Dashboard',
                user: req.user,
                appointments: [],
                services: [],
                serviceStats: {
                    total: 0,
                    pending: 0,
                    approved: 0,
                    rejected: 0,
                    documentStatus: 'unknown'
                },
                stats: {
                    totalAppointments: 0,
                    todayAppointments: 0,
                    monthlyRevenue: 0,
                    averageRating: null,
                    totalReviews: 0,
                    totalServices: 0,
                    pendingServices: 0,
                    approvedServices: 0,
                    rejectedServices: 0,
                    verificationStatus: 'unknown'
                },
                nextAppointment: 'None',
                currentPage: 'provider/dashboard'
            });
        }

        console.log('✅ Database connection status:', mongoose.connection.readyState);
        console.log('✅ Database name:', mongoose.connection.name);

        // Check if collections exist and have data
        try {
            const serviceOfferingCount = await ServiceOffering.countDocuments();
            const appointmentCount = await Appointment.countDocuments();
            console.log('📊 Collection stats - ServiceOffering:', serviceOfferingCount, 'Appointment:', appointmentCount);
        } catch (collectionError) {
            console.log('⚠️  Could not check collection stats:', collectionError.message);
        }

        // Get appointments with error handling
        let appointments = [];
        try {
            console.log('🔍 Fetching appointments for provider:', req.user._id);
            appointments = await Appointment.aggregate([
                {
                    $match: { provider: req.user._id }
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
                    $unwind: '$patient'
                },
                {
                    $project: {
                        patient: {
                            firstName: 1,
                            lastName: 1
                        },
                        date: 1,
                        startTime: 1,
                        endTime: 1,
                        status: 1,
                        notes: 1,
                        createdAt: 1
                    }
                },
                {
                    $sort: { date: -1 }
                },
                {
                    $limit: 5
                }
            ]);
            console.log('✅ Appointments fetched successfully, count:', appointments.length);
        } catch (appointmentsError) {
            console.error('❌ Error fetching appointments:', appointmentsError);
            console.error('Appointments error stack:', appointmentsError.stack);
            appointments = [];
        }

        // Get provider's services with error handling
        let services = [];
        try {
            console.log('🔍 Fetching services for provider:', req.user._id);
            services = await ServiceOffering.find({ provider: req.user._id })
                .populate('category', 'name')
                .sort({ createdAt: -1 });
            console.log('✅ Services fetched successfully, count:', services.length);

            // If no services found, check if this is a new provider
            if (services.length === 0) {
                console.log('ℹ️  No services found for provider. This is normal for new registrations.');
                console.log('ℹ️  Services will be created when the provider completes their profile setup.');
            }
        } catch (servicesError) {
            console.error('❌ Error fetching services:', servicesError);
            console.error('Services error stack:', servicesError.stack);
            services = [];
        }

        // Get provider's document verification status with error handling
        let provider = null;
        try {
            console.log('🔍 Fetching provider details for:', req.user._id);
            provider = await Provider.findById(req.user._id).select('verificationStatus');
            console.log('✅ Provider details fetched successfully');
        } catch (providerError) {
            console.error('❌ Error fetching provider:', providerError);
            console.error('Provider error stack:', providerError.stack);
            provider = null;
        }

        // Count services by status
        const serviceStats = {
            total: services.length,
            pending: services.filter(s => s.approvalStatus === 'pending').length,
            approved: services.filter(s => s.approvalStatus === 'approved').length,
            rejected: services.filter(s => s.approvalStatus === 'rejected').length,
            documentStatus: provider ? provider.verificationStatus : 'unknown'
        };

        // Prepare stats for the dashboard view
        const stats = {
            totalAppointments: appointments.length,
            todayAppointments: appointments.filter(apt => {
                const today = new Date();
                const aptDate = new Date(apt.date);
                return aptDate.toDateString() === today.toDateString();
            }).length,
            monthlyRevenue: 0, // You can calculate this based on your business logic
            averageRating: null, // Will be calculated from reviews when available
            totalReviews: 0,
            totalServices: serviceStats.total,
            pendingServices: serviceStats.pending,
            approvedServices: serviceStats.approved,
            rejectedServices: serviceStats.rejected,
            verificationStatus: serviceStats.documentStatus
        };

        // Get next appointment
        const nextAppointment = appointments.length > 0 ?
            `${appointments[0].startTime} - ${appointments[0].patient ? appointments[0].patient.firstName + ' ' + appointments[0].patient.lastName : 'Unknown Patient'}` :
            'None';

        console.log('Provider dashboard data prepared, rendering view...');
        console.log('Stats:', stats);
        console.log('Appointments count:', appointments.length);
        console.log('Services count:', services.length);

        // Fetch provider notifications
        let notifications = [];
        let unreadNotificationsCount = 0;
        try {
            const Notification = require('../models/Notification');
            notifications = await Notification.find({ recipient: req.user._id, recipientModel: 'Provider' })
                .sort({ createdAt: -1 })
                .limit(5)
                .lean();
            unreadNotificationsCount = await Notification.countDocuments({ recipient: req.user._id, recipientModel: 'Provider', isRead: false });
        } catch (e) {
            notifications = [];
            unreadNotificationsCount = 0;
        }

        // Check if provider has any services
        if (services.length === 0) {
            console.log('ℹ️  Provider has no services yet - this is normal for new registrations');
        }

        // Ensure all data is properly defined before rendering
        const dashboardData = {
            title: 'Provider Dashboard',
            user: req.user,
            appointments: appointments || [],
            services: services || [],
            activeServices: serviceStats ? serviceStats.approved : 0,
            monthlyRevenue: stats ? stats.monthlyRevenue : 0,
            pendingReviews: 0, // This will be calculated when review system is implemented
            // Add direct access to commonly used stats for template compatibility
            totalAppointments: stats ? stats.totalAppointments : 0,
            todayAppointments: stats ? stats.todayAppointments : 0,
            recentAppointments: appointments || [],
            servicePerformance: services || [],
            serviceStats: serviceStats || {
                total: 0,
                pending: 0,
                approved: 0,
                rejected: 0,
                documentStatus: 'unknown'
            },
            stats: stats || {
                totalAppointments: 0,
                todayAppointments: 0,
                monthlyRevenue: 0,
                averageRating: null,
                totalReviews: 0,
                totalServices: 0,
                pendingServices: 0,
                approvedServices: 0,
                rejectedServices: 0,
                verificationStatus: 'unknown'
            },
            nextAppointment: nextAppointment || 'None',
            currentPage: 'provider/dashboard'
        };

        console.log('🎯 Rendering dashboard with data:', {
            appointmentsCount: dashboardData.appointments.length,
            servicesCount: dashboardData.services.length,
            statsKeys: Object.keys(dashboardData.stats)
        });

        res.render('provider/dashboard', { ...dashboardData, notifications, unreadNotificationsCount });
    } catch (err) {
        console.error('Provider dashboard error:', err);
        console.error('Error stack:', err.stack);
        console.error('Error name:', err.name);
        console.error('Error message:', err.message);

        // For view routes, always render an error page instead of returning JSON
        return res.status(500).render('error', {
            title: 'Dashboard Error',
            message: 'An error occurred while loading your dashboard. Please try again.',
            user: req.user,
            currentPage: 'error',
            statusCode: 500,
            env: process.env.NODE_ENV || 'development',
            error: process.env.NODE_ENV === 'development' ? err : {},
            errorData: process.env.NODE_ENV === 'development' ? err : {},
            req: req,
            timestamp: new Date().toISOString(),
            showFullError: process.env.NODE_ENV === 'development' || process.env.SHOW_ERRORS === 'true'
        });
    }
});

// Protected Routes - Admin
router.get('/admin/patients', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const patients = await Patient.find().select('-password').sort({ createdAt: -1 });

        // Pass patient data to the template for fallback
        res.render('admin/patients', {
            title: 'Manage Patients',
            user: req.user,
            patients: patients,
            currentPage: 'admin/patients',
            // Pass data as JSON for JavaScript access
            patientsData: JSON.stringify(patients),
            layout: false
        });
    } catch (err) {
        next(err);
    }
});

router.get('/admin/providers', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const { status } = req.query;
        const filter = status ? { verificationStatus: status } : {};

        const providers = await Provider.find(filter).select('-password').sort({ createdAt: -1 });
        res.render('admin/providers', {
            title: 'Manage Providers',
            user: req.user,
            providers: providers,
            currentFilter: status,
            currentPage: 'admin/providers',
            layout: false
        });
    } catch (err) {
        next(err);
    }
});

router.get('/admin/verifications/pending', protect, restrictTo('admin'), async (req, res, next) => {
    try {


        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const skip = (page - 1) * limit;

        const verifications = await ProviderVerification.aggregate([
            { $match: { status: 'pending' } },
            {
                $lookup: {
                    from: 'providers',
                    localField: 'provider',
                    foreignField: '_id',
                    as: 'provider'
                }
            },
            { $unwind: '$provider' },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        ]);

        const total = await ProviderVerification.countDocuments({ status: 'pending' });
        const totalPages = Math.ceil(total / limit);

        // Get counts for all verification statuses
        const approvedCount = await ProviderVerification.countDocuments({ status: 'approved' });
        const rejectedCount = await ProviderVerification.countDocuments({ status: 'rejected' });
        const pendingCount = total;

        res.render('admin/verification-review', {
            title: 'Pending Verifications',
            user: req.user,
            verifications: verifications,
            currentPage: page,
            totalPages: totalPages,
            total: total,
            approvedCount: approvedCount,
            rejectedCount: rejectedCount,
            pendingCount: pendingCount,
            currentPagePath: 'admin/verifications',
            layout: false
        });
    } catch (err) {
        next(err);
    }
});

router.get('/admin/appointments', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const { status } = req.query;
        const filter = status ? { status: status } : {};

        const appointments = await Appointment.aggregate([
            {
                $match: filter
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
                $unwind: '$patient'
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
                $unwind: '$provider'
            },
            {
                $project: {
                    patient: {
                        firstName: 1,
                        lastName: 1,
                        email: 1
                    },
                    provider: {
                        firstName: 1,
                        lastName: 1,
                        professionalTitle: 1
                    },
                    date: 1,
                    startTime: 1,
                    endTime: 1,
                    status: 1,
                    notes: 1,
                    createdAt: 1
                }
            },
            {
                $sort: { date: -1, createdAt: -1 }
            }
        ]);

        res.render('admin/appointments', {
            title: 'Manage Appointments',
            user: req.user,
            appointments: appointments,
            currentFilter: status,
            currentPage: 'admin/appointments',
            layout: false
        });
    } catch (err) {
        next(err);
    }
});

router.get('/admin/notifications', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const notifications = await Notification.aggregate([
            {
                $match: {
                    $or: [
                        { recipientModel: 'Admin' },
                        { senderModel: 'System' }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'admins',
                    localField: 'recipient',
                    foreignField: '_id',
                    as: 'recipient'
                }
            },
            {
                $unwind: {
                    path: '$recipient',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    recipient: {
                        firstName: 1,
                        lastName: 1,
                        email: 1
                    },
                    type: 1,
                    title: 1,
                    message: 1,
                    priority: 1,
                    isRead: 1,
                    createdAt: 1
                }
            },
            {
                $sort: { createdAt: -1 }
            }
        ]);

        res.render('admin/notifications', {
            title: 'Notifications',
            user: req.user,
            notifications: notifications,
            currentPage: 'admin/notifications',
            // use default layout
        });
    } catch (err) {
        next(err);
    }
});

// Admin categories route (alias for services/categories)
router.get('/admin/categories', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const categories = await ServiceCategory.find().sort({ displayOrder: 1, name: 1 });

        // Pass category data to the template for fallback
        res.render('admin/service-categories', {
            title: 'Service Categories',
            user: req.user,
            categories: categories,
            currentPage: 'admin/categories',
            // Pass data as JSON for JavaScript access
            categoriesData: JSON.stringify(categories),
            layout: false
        });
    } catch (err) {
        next(err);
    }
});

router.get('/admin/services/categories', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const categories = await ServiceCategory.find().sort({ name: 1 });
        res.render('admin/service-categories', {
            title: 'Service Categories',
            user: req.user,
            categories: categories,
            currentPage: 'admin/services/categories',
            layout: false
        });
    } catch (err) {
        next(err);
    }
});

router.get('/admin/services/categories/create', protect, restrictTo('admin'), (req, res) => {
    res.render('admin/service-category-form', {
        title: 'Create Service Category',
        user: req.user,
        category: null,
        currentPage: 'admin/services/categories',
        layout: false
    });
});

router.get('/admin/services/categories/:id/edit', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const category = await ServiceCategory.findById(req.params.id);
        if (!category) {
            return res.status(404).render('error', {
                title: 'Not Found',
                message: 'Category not found',
                user: req.user,
                currentPage: 'error',
                statusCode: 404,
                env: process.env.NODE_ENV || 'development',
                error: {},
                errorData: {},
                req: req,
                timestamp: new Date().toISOString(),
                showFullError: process.env.NODE_ENV === 'development' || process.env.SHOW_ERRORS === 'true'
            });
        }

        res.render('admin/service-category-form', {
            title: 'Edit Service Category',
            user: req.user,
            category: category,
            currentPage: 'admin/services/categories',
            layout: false
        });
    } catch (err) {
        next(err);
    }
});

// Admin services main route (redirects to pending services)
router.get('/admin/services', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        // Redirect to pending services by default
        res.redirect('/admin/services/pending');
    } catch (err) {
        next(err);
    }
});

// Admin service approval routes
router.get('/admin/services/pending', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const pendingServices = await DoctorService.aggregate([
            {
                $match: {
                    approvalStatus: 'pending',
                    isActive: true
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
                $unwind: '$provider'
            },
            {
                $project: {
                    provider: {
                        firstName: 1,
                        lastName: 1,
                        email: 1,
                        professionalTitle: 1
                    },
                    specialization: 1,
                    serviceName: 1,
                    description: 1,
                    basePrice: 1,
                    duration: 1,
                    isActive: 1,
                    approvalStatus: 1,
                    createdAt: 1
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $skip: skip
            },
            {
                $limit: limit
            }
        ]);

        const total = await DoctorService.countDocuments({
            approvalStatus: 'pending',
            isActive: true
        });
        const totalPages = Math.ceil(total / limit);

        res.render('admin/pending-services', {
            title: 'Pending Service Approvals',
            user: req.user,
            services: pendingServices,
            currentPage: page,
            totalPages: totalPages,
            total: total,
            currentPagePath: 'admin/services',
            // Pass data as JSON for JavaScript access
            servicesData: JSON.stringify(pendingServices),
            layout: false
        });
    } catch (err) {
        next(err);
    }
});

router.get('/admin/services/approved', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const approvedServices = await DoctorService.aggregate([
            {
                $match: {
                    approvalStatus: 'approved',
                    isActive: true
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
                $unwind: '$provider'
            },
            {
                $lookup: {
                    from: 'admins',
                    localField: 'approvedBy',
                    foreignField: '_id',
                    as: 'approvedBy'
                }
            },
            {
                $unwind: {
                    path: '$approvedBy',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    provider: {
                        firstName: 1,
                        lastName: 1,
                        email: 1,
                        professionalTitle: 1
                    },
                    approvedBy: {
                        firstName: 1,
                        lastName: 1
                    },
                    specialization: 1,
                    serviceName: 1,
                    description: 1,
                    basePrice: 1,
                    duration: 1,
                    isActive: 1,
                    approvalStatus: 1,
                    approvedAt: 1
                }
            },
            {
                $sort: { approvedAt: -1 }
            },
            {
                $skip: skip
            },
            {
                $limit: limit
            }
        ]);

        const total = await DoctorService.countDocuments({
            approvalStatus: 'approved',
            isActive: true
        });
        const totalPages = Math.ceil(total / limit);

        res.render('admin/approved-services', {
            title: 'Approved Services',
            user: req.user,
            services: approvedServices,
            currentPage: page,
            totalPages: totalPages,
            total: total,
            currentPagePath: 'admin/services',
            layout: false
        });
    } catch (err) {
        next(err);
    }
});

// Admin route to check provider status
router.get('/admin/check-providers', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const Provider = require('../models/Provider');

        const providers = await Provider.find({}).select('firstName lastName email verificationStatus');

        res.json({
            success: true,
            message: 'Provider status check',
            providers: providers,
            total: providers.length,
            verified: providers.filter(p => p.verificationStatus === 'approved').length,
            approved: providers.filter(p => p.verificationStatus === 'approved').length,
            pending: providers.filter(p => p.verificationStatus === 'pending').length,
            rejected: providers.filter(p => p.verificationStatus === 'rejected').length
        });

    } catch (err) {
        console.error('Error checking providers:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to check providers',
            error: err.message
        });
    }
});

// Admin route to create a service for approved provider (for testing)
router.get('/admin/create-test-service', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const DoctorService = require('../models/DoctorService');
        const Provider = require('../models/Provider');

        // Find the approved provider
        const provider = await Provider.findOne({
            verificationStatus: 'approved'
        });

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'No approved provider found'
            });
        }

        // Create a sample service
        const service = await DoctorService.create({
            provider: provider._id,
            doctorName: `Dr. ${provider.firstName} ${provider.lastName}`,
            specialization: provider.specialization || 'General Medicine',
            serviceName: 'General Consultation',
            description: 'Comprehensive health consultation and examination',
            basePrice: 50,
            duration: 30, // minutes
            isActive: true,
            approvalStatus: 'pending' // Will need admin approval
        });

        res.json({
            success: true,
            message: 'Test service created successfully',
            service: {
                id: service._id,
                doctorName: service.doctorName,
                specialization: service.specialization,
                status: service.approvalStatus
            },
            nextSteps: [
                'Go to: /admin/services/pending to approve the service',
                'After approval, check: /services to see it on public page'
            ]
        });

    } catch (err) {
        console.error('Error creating test service:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to create test service',
            error: err.message
        });
    }
});

// Admin route to create services for approved providers
router.get('/admin/create-services-for-providers', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const DoctorService = require('../models/DoctorService');
        const ServiceOffering = require('../models/ServiceOffering');
        const ServiceCategory = require('../models/ServiceCategory');
        const Provider = require('../models/Provider');

        // Find all approved providers
        const providers = await Provider.find({
            verificationStatus: 'approved'
        });

        if (providers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No approved providers found'
            });
        }

        // Create service categories if they don't exist
        const categories = [
            { name: 'Cardiology', description: 'Heart and cardiovascular health services' },
            { name: 'Dermatology', description: 'Skin, hair, and nail health services' },
            { name: 'Neurology', description: 'Brain and nervous system health services' },
            { name: 'Orthopedics', description: 'Bone and joint health services' },
            { name: 'Pediatrics', description: 'Child and adolescent health services' },
            { name: 'General Medicine', description: 'General health consultation and treatment' },
            { name: 'Nursing Care', description: 'Professional nursing and care services' },
            { name: 'Mental Health', description: 'Psychological and psychiatric services' }
        ];

        for (const categoryData of categories) {
            const existingCategory = await ServiceCategory.findOne({ name: categoryData.name });
            if (!existingCategory) {
                await ServiceCategory.create(categoryData);
            }
        }

        const createdServices = [];

        for (const provider of providers) {
            // Check if provider already has a service
            const existingService = await DoctorService.findOne({ provider: provider._id });

            if (!existingService) {
                // Create a DoctorService for this provider
                const doctorService = await DoctorService.create({
                    provider: provider._id,
                    doctorName: `${provider.professionalTitle} ${provider.firstName} ${provider.lastName}`,
                    specialization: provider.specialization || 'General Medicine',
                    serviceName: `${provider.specialization || 'General Medicine'} Consultation`,
                    description: `Professional ${provider.specialization || 'General Medicine'} consultation and treatment services. Experienced healthcare provider with ${provider.yearsOfExperience} years of experience.`,
                    basePrice: 50 + Math.floor(Math.random() * 100), // Random price between 50-150
                    duration: 30, // minutes
                    isActive: true,
                    approvalStatus: 'approved', // Auto-approve for testing
                    rating: {
                        average: 4.0 + Math.random() * 1.0, // Random rating between 4.0-5.0
                        count: Math.floor(Math.random() * 20) + 5 // Random review count 5-25
                    }
                });

                // Create a ServiceOffering for this provider
                const category = await ServiceCategory.findOne({
                    name: provider.specialization || 'General Medicine'
                });

                if (category) {
                    await ServiceOffering.create({
                        provider: provider._id,
                        category: category._id,
                        name: `${provider.specialization || 'General Medicine'} Consultation`,
                        description: `Professional ${provider.specialization || 'General Medicine'} consultation and treatment services.`,
                        shortDescription: `Expert ${provider.specialization || 'General Medicine'} care from an experienced provider.`,
                        duration: 30,
                        price: doctorService.basePrice,
                        isActive: true,
                        approvalStatus: 'approved', // Auto-approve for testing
                        isFeatured: true,
                        averageRating: doctorService.rating.average,
                        totalReviews: doctorService.rating.count
                    });
                }

                createdServices.push({
                    id: doctorService._id,
                    doctorName: doctorService.doctorName,
                    specialization: doctorService.specialization,
                    provider: provider.email
                });
            }
        }

        res.json({
            success: true,
            message: `Created ${createdServices.length} services for approved providers`,
            services: createdServices,
            nextSteps: [
                'Check: /services to see providers on public page',
                'Check: /admin/services/pending to see pending services'
            ]
        });

    } catch (err) {
        console.error('Error creating services for providers:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to create services for providers',
            error: err.message
        });
    }
});

// Error Handling
router.use((req, res) => {
    res.status(404).render('error', {
        title: 'Page Not Found',
        message: 'The page you are looking for does not exist.',
        user: req.user || null,
        currentPage: 'error',
        statusCode: 404,
        env: process.env.NODE_ENV || 'development',
        error: {},
        errorData: {},
        req: req,
        timestamp: new Date().toISOString(),
        showFullError: process.env.NODE_ENV === 'development' || process.env.SHOW_ERRORS === 'true'
    });
});

router.use((err, req, res, next) => {
    const statusCode = err.status || 500;
    const isDevelopment = process.env.NODE_ENV === 'development';
    const showFullError = isDevelopment || process.env.SHOW_ERRORS === 'true';

    res.status(statusCode).render('error', {
        title: 'Something Went Wrong',
        message: err.message || 'An unexpected error occurred.',
        user: req.user || null,
        currentPage: 'error',
        statusCode: statusCode,
        env: process.env.NODE_ENV || 'development',
        error: showFullError ? err : {},
        errorData: showFullError ? err : {},
        req: req,
        timestamp: new Date().toISOString(),
        showFullError: showFullError
    });
});

router.get('/provider/dashboard', protect, restrictTo('provider'), async (req, res, next) => {
    try {
        // Fetch provider data
        const totalAppointments = await Appointment.countDocuments({ provider: req.user._id });
        const todayAppointments = await Appointment.countDocuments({
            provider: req.user._id,
            date: { $gte: new Date().setHours(0, 0, 0, 0), $lte: new Date().setHours(23, 59, 59, 999) }
        });
        const services = await ServiceOffering.find({ provider: req.user._id });
        const activeServices = services.filter(s => s.isActive).length;

        // Example: fake data until you implement reviews & performance
        const pendingReviews = 0;
        const recentAppointments = await Appointment.find({ provider: req.user._id })
            .sort({ date: -1 }).limit(5).populate('patient');
        const servicePerformance = [];

        res.render('provider/dashboard', {
            title: 'Provider Dashboard',
            user: req.user,
            totalAppointments,
            todayAppointments,
            activeServices,
            pendingReviews,
            recentAppointments,
            servicePerformance,
            serviceStats: { total: services.length, pending: 0, approved: activeServices, rejected: 0 },
            stats: { totalAppointments, todayAppointments, totalServices: services.length },
            nextAppointment: recentAppointments[0] ? recentAppointments[0].date : 'None',
            currentPage: 'provider/dashboard'
        });
    } catch (error) {
        console.error('❌ Provider dashboard error:', error);
        next(error);
    }
});

// Provider Service Management Page
router.get('/provider/service-management', protect, restrictTo('provider'), async (req, res, next) => {
    try {
        res.render('provider/service-management', {
            title: 'Service Management',
            user: req.user,
            currentPage: 'service-management'
        });
    } catch (error) {
        console.error('❌ Service management error:', error);
        next(error);
    }
});



// Removed duplicate minimal /services route to avoid overriding the data-rich route above

// Unified profile page by role
router.get('/profile', protect, async (req, res) => {
    try {
        const role = (req.user.role || req.user.roleName || '').toLowerCase();
        if (role === 'provider') {
            return res.render('provider/profile', {
                title: 'Provider Profile',
                user: req.user,
                currentPage: 'provider/profile'
            });
        }
        if (role === 'patient') {
            return res.render('patient/profile', {
                title: 'Patient Profile',
                user: req.user,
                currentPage: 'patient/profile'
            });
        }
        if (role === 'admin') {
            return res.redirect('/admin/dashboard');
        }
        return res.redirect('/login');
    } catch (e) {
        return res.status(500).render('error', {
            title: 'Profile Error',
            message: 'Failed to load profile page',
            user: req.user,
            currentPage: 'error'
        });
    }
});

// Role-specific aliases
router.get('/provider/profile', protect, restrictTo('provider'), (req, res) => {
    return res.render('provider/profile', {
        title: 'Provider Profile',
        user: req.user,
        currentPage: 'provider/profile'
    });
});

router.get('/patient/profile', protect, restrictTo('patient'), (req, res) => {
    return res.render('patient/profile', {
        title: 'Patient Profile',
        user: req.user,
        currentPage: 'patient/profile'
    });
});

module.exports = router;