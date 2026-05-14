// adminRoutes.js - REPLACE THE ENTIRE FILE
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const multer = require('multer');
const Provider = require('../models/Provider');

// ========== PUBLIC ROUTES ==========
router.post('/register', adminController.register);
router.post('/login', adminController.login);

// ========== TEST ROUTES (NO AUTH REQUIRED) ==========
router.get('/dashboard-test', (req, res) => {
    try {
        console.log('🔍 Test Dashboard: Rendering without auth...');
        res.render('admin/dashboard', {
            title: 'Admin Dashboard (Test - No Auth)',
            currentPage: 'dashboard',
            totalUsers: 0,
            totalPatients: 0,
            totalProviders: 0,
            totalServices: 0,
            activeServices: 0,
            pendingServices: 0,
            totalAppointments: 0,
            pendingVerifications: 0,
            recentActivities: [],
            recentProviders: [],
            recentAppointments: [],
            changes: {
                patients: "0%",
                providers: "0%",
                appointments: "0%",
                services: "0%"
            },
            user: null,
            stats: {
                patients: 0,
                providers: 0,
                appointments: 0,
                services: 0,
                activeServices: 0,
                pendingServices: 0,
                pendingVerifications: 0
            },
            appointmentStatusStats: [],
            appointmentsByDay: [],
            pendingVerifications: []
        });
        console.log('✅ Test Dashboard: Rendered successfully');
    } catch (error) {
        console.error('❌ Test Dashboard: Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error rendering test dashboard',
            error: error.message
        });
    }
});

// Create admin user for testing
router.post('/create-admin', async (req, res) => {
    try {
        const Admin = require('../models/Admin');

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email: 'admin@msp.com' });
        if (existingAdmin) {
            return res.json({
                success: true,
                message: 'Admin user already exists',
                admin: {
                    email: existingAdmin.email,
                    firstName: existingAdmin.firstName,
                    lastName: existingAdmin.lastName
                }
            });
        }

        // Create new admin user
        const admin = await Admin.create({
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@msp.com',
            password: 'admin123',
            phone: '+1234567890',
            role: 'admin',
            isVerified: true,
            isActive: true
        });

        res.json({
            success: true,
            message: 'Admin user created successfully',
            admin: {
                email: admin.email,
                firstName: admin.firstName,
                lastName: admin.lastName
            }
        });
    } catch (error) {
        console.error('Error creating admin:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create admin user',
            error: error.message
        });
    }
});

// ========== PROTECTED ROUTES ==========
// Use the same auth middleware as your view routes
const protectAdmin = [protect, restrictTo('admin')];

// Dashboard - This will render the admin dashboard view
// Note: This route is handled by viewRoutes.js at /admin/dashboard
// router.get('/dashboard', protectAdmin, adminController.getDashboard);

// Test route to check if middleware is working
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Admin route is accessible',
        user: req.user || 'No user',
        isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : 'Unknown',
        session: req.session ? 'Session exists' : 'No session'
    });
});

// Basic HTML test route
router.get('/html-test', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>HTML Test</title>
        </head>
        <body>
            <h1>Admin Route HTML Test</h1>
            <p>If you can see this, the route is working!</p>
            <p>Time: ${new Date().toISOString()}</p>
        </body>
        </html>
    `);
});

// Minimal dashboard route for testing
router.get('/dashboard-minimal', (req, res) => {
    try {
        console.log('🔍 Minimal Dashboard: Rendering...');
        res.render('admin/dashboard-minimal', {
            title: 'Admin Dashboard (Minimal)',
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
        console.log('✅ Minimal Dashboard: Rendered successfully');
    } catch (error) {
        console.error('❌ Minimal Dashboard: Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error rendering minimal dashboard',
            error: error.message
        });
    }
});

// Simple dashboard route for testing (no auth required)
router.get('/dashboard-simple', (req, res) => {
    try {
        console.log('🔍 Simple Dashboard: Rendering...');
        res.render('admin/dashboard', {
            title: 'Admin Dashboard (Simple)',
            currentPage: 'dashboard',
            totalUsers: 0,
            totalPatients: 0,
            totalProviders: 0,
            totalAppointments: 0,
            pendingVerifications: 0,
            pendingServices: 0,
            pendingDocuments: 0,
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
            appointmentStatusStats: [],
            appointmentsByDay: [],
            recentActivity: [],
            changes: {
                patients: 0,
                providers: 0,
                appointments: 0
            },
            user: null
        });
        console.log('✅ Simple Dashboard: Rendered successfully');
    } catch (error) {
        console.error('❌ Simple Dashboard: Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error rendering simple dashboard',
            error: error.message
        });
    }
});

// Users
router.get('/patients', protectAdmin, adminController.getPatients);
router.get('/providers', protectAdmin, adminController.getProviders);
router.get('/providers/new', protectAdmin, adminController.getNewProviderForm);
router.get('/test', adminController.testMethod);
router.post('/providers', protectAdmin, async (req, res, next) => {
    try {
        const {
            firstName,
            lastName,
            email,
            phone,
            professionalTitle,
            specialization,
            licenseNumber,
            yearsOfExperience,
            password,
            isActive
        } = req.body;

        // Check if provider already exists
        const existingProvider = await Provider.findOne({
            $or: [
                { email: email.toLowerCase() },
                { licenseNumber: licenseNumber }
            ]
        });

        if (existingProvider) {
            return res.status(400).json({
                success: false,
                message: 'Provider with this email or license number already exists'
            });
        }

        // Create new provider
        const provider = await Provider.create({
            firstName,
            lastName,
            email: email.toLowerCase(),
            phone,
            professionalTitle: professionalTitle || 'Provider',
            specialization,
            licenseNumber,
            yearsOfExperience: yearsOfExperience || 0,
            password,
            role: 'provider',
            roleName: 'provider',
            verificationStatus: 'pending',
            isVerified: false,
            isActive: isActive !== false
        });

        // Remove password from response
        const providerResponse = provider.toObject();
        delete providerResponse.password;

        res.status(201).json({
            success: true,
            message: 'Provider created successfully',
            data: providerResponse
        });
    } catch (err) {
        next(err);
    }
});
router.get('/providers/:id', protectAdmin, adminController.getProviderById);
router.put('/providers/:id', protectAdmin, adminController.updateProviderById);

// CSV import for providers
const csvUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        const name = (file.originalname || '').toLowerCase();
        const type = (file.mimetype || '').toLowerCase();
        // Accept common CSV mimetypes seen across browsers/OS (Windows often uses application/vnd.ms-excel)
        const allowedTypes = new Set([
            'text/csv',
            'application/csv',
            'application/vnd.ms-excel',
            'text/plain',
            'application/octet-stream'
        ]);
        const looksLikeCsv = name.endsWith('.csv') || allowedTypes.has(type);
        if (looksLikeCsv) return cb(null, true);
        cb(new Error('Only CSV files are allowed'));
    }
});

router.post('/providers/import-csv', protectAdmin, csvUpload.fields([{ name: 'file', maxCount: 1 }, { name: 'csv', maxCount: 1 }]), async (req, res) => {
    try {
        const uploadedFile = (req.files && ((req.files.file && req.files.file[0]) || (req.files.csv && req.files.csv[0]))) || req.file;
        if (!uploadedFile || !uploadedFile.buffer) {
            return res.status(400).json({ success: false, message: 'CSV file is required' });
        }

        const csvText = uploadedFile.buffer.toString('utf-8');
        const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) {
            return res.status(400).json({ success: false, message: 'CSV is empty' });
        }

        // Detect delimiter and parse header (supports comma or semicolon; trims quotes)
        const detectDelimiter = (line) => {
            const commas = (line.match(/,/g) || []).length;
            const semis = (line.match(/;/g) || []).length;
            return semis > commas ? ';' : ',';
        };
        const delimiter = detectDelimiter(lines[0]);
        const splitRow = (row, delim) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < row.length; i++) {
                const ch = row[i];
                if (ch === '"') {
                    if (inQuotes && row[i + 1] === '"') { current += '"'; i++; }
                    else { inQuotes = !inQuotes; }
                } else if (ch === delim && !inQuotes) {
                    result.push(current);
                    current = '';
                } else {
                    current += ch;
                }
            }
            result.push(current);
            return result.map(s => s.trim().replace(/^"|"$/g, ''));
        };

        const header = splitRow(lines[0], delimiter);

        // Expected columns with synonyms (order-insensitive)
        const synonyms = {
            firstName: ['firstname', 'first_name', 'givenname', 'given_name', 'name_first'],
            lastName: ['lastname', 'last_name', 'surname', 'familyname', 'family_name', 'name_last'],
            email: ['email', 'emailaddress', 'email_address'],
            password: ['password', 'pass', 'pwd'],
            phone: ['phone', 'mobile', 'contact', 'contactnumber', 'contact_number', 'phone_number'],
            professionalTitle: ['professionaltitle', 'title', 'designation'],
            specialization: ['specialization', 'specialisation', 'speciality', 'specialty'],
            licenseNumber: ['licensenumber', 'license', 'license_no', 'license number'],
            yearsOfExperience: ['yearsofexperience', 'experience', 'exp_years', 'years']
        };

        const findIndexBySynonyms = (colName) => {
            const targets = [colName.toLowerCase(), ...(synonyms[colName] || [])];
            return header.findIndex(h => targets.includes(String(h).toLowerCase().replace(/\s+/g, '')));
        };

        const idx = {
            firstName: findIndexBySynonyms('firstName'),
            lastName: findIndexBySynonyms('lastName'),
            email: findIndexBySynonyms('email'),
            password: findIndexBySynonyms('password'),
            phone: findIndexBySynonyms('phone'),
            professionalTitle: findIndexBySynonyms('professionalTitle'),
            specialization: findIndexBySynonyms('specialization'),
            licenseNumber: findIndexBySynonyms('licenseNumber'),
            yearsOfExperience: findIndexBySynonyms('yearsOfExperience')
        };

        // Optional: allow single 'name' column -> split into first/last
        const nameColIdx = header.findIndex(h => String(h).toLowerCase().replace(/\s+/g, '') === 'name');
        const idxMissing = Object.entries(idx).filter(([, v]) => v === -1).map(([k]) => k);
        if (idxMissing.length > 0 && !(idxMissing.length === 2 && idxMissing.includes('firstName') && idxMissing.includes('lastName') && nameColIdx !== -1)) {
            return res.status(400).json({ success: false, message: `Missing columns: ${idxMissing.join(', ')}` });
        }

        let created = 0;
        let skipped = 0;
        const errors = [];

        // Row splitter using detected delimiter
        const splitRowData = (row) => splitRow(row, delimiter);

        for (let li = 1; li < lines.length; li++) {
            const raw = lines[li];
            if (!raw || raw.trim() === '') continue;
            try {
                const cols = splitRowData(raw);
                const getVal = (i) => (typeof i === 'number' && i >= 0) ? (cols[i] || '') : '';
                let firstName = getVal(idx.firstName);
                let lastName = getVal(idx.lastName);
                if ((!firstName || !lastName) && nameColIdx !== -1) {
                    const parts = (cols[nameColIdx] || '').trim().split(/\s+/);
                    firstName = firstName || parts[0] || '';
                    lastName = lastName || parts.slice(1).join(' ') || '';
                }
                const email = getVal(idx.email).toLowerCase();
                const passwordRaw = getVal(idx.password);
                const phone = getVal(idx.phone) || '0000000000';
                const professionalTitle = getVal(idx.professionalTitle) || 'Provider';
                const specialization = getVal(idx.specialization) || 'General';
                const licenseNumber = getVal(idx.licenseNumber) || `TEMP-${Date.now()}-${li}`;
                const yearsOfExperience = Number(getVal(idx.yearsOfExperience) || 0);

                // Basic validation with sensible fallbacks
                if (!firstName || !lastName || !email) { skipped++; errors.push({ line: li + 1, error: 'Missing name or email' }); continue; }
                const password = passwordRaw || Math.random().toString(36).slice(-10);

                const payload = { firstName, lastName, email, password, phone, professionalTitle, specialization, licenseNumber, yearsOfExperience };

                // Skip duplicates by email or license
                const exists = await Provider.findOne({ $or: [{ email: payload.email.toLowerCase() }, { licenseNumber: payload.licenseNumber }] });
                if (exists) { skipped++; continue; }

                // Create provider (password hashed by schema pre-save)
                await Provider.create({
                    ...payload,
                    email: payload.email.toLowerCase(),
                    role: 'provider',
                    roleName: 'provider',
                    verificationStatus: 'pending',
                    isVerified: false
                });
                created++;
            } catch (rowErr) {
                skipped++; errors.push({ line: li + 1, error: rowErr.message || 'Row error' });
            }
        }

        return res.json({ success: true, message: 'CSV processed', created, skipped, errors });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to process CSV', error: err.message });
    }
});

// Verifications
router.get('/verifications', protectAdmin, adminController.getPendingVerifications);
router.get('/verifications/pending', protectAdmin, adminController.getPendingVerifications);
router.post('/verifications/review', protectAdmin, adminController.reviewVerification);
router.put('/verifications/:id/review', protectAdmin, adminController.reviewVerification);

// Service Approvals
router.get('/services/pending', protectAdmin, adminController.getPendingServices);
router.put('/services/:id/approve', protectAdmin, adminController.approveService);
router.put('/services/:id/reject', protectAdmin, adminController.rejectService);
router.get('/services/approval-stats', protectAdmin, adminController.getServiceApprovalStats);

// Appointments
router.get('/appointments', protectAdmin, adminController.getAllAppointments);

// Service categories
const upload = require('../utils/multer');
router.get('/service-categories', protectAdmin, adminController.getServiceCategories); // API route for fetching categories
router.post('/services/categories', protectAdmin, upload('image', 1), adminController.createServiceCategory);
router.put('/services/categories/:id', protectAdmin, adminController.updateServiceCategory);

// Toggle service category active status
router.patch('/services/categories/:id/status', protectAdmin, adminController.toggleServiceCategoryStatus);

// Notifications (JSON endpoints)
router.get('/notifications.json', protectAdmin, adminController.getNotifications);
router.put('/notifications/:id/read', protectAdmin, adminController.markNotificationAsRead);

// Admins
router.post('/admins', protectAdmin, adminController.createAdmin);

// Profile
router.put('/profile', protectAdmin, adminController.updateProfile);

// Create initial service categories and offerings
router.post('/setup-services', protect, restrictTo('admin'), async (req, res) => {
    try {
        const ServiceCategory = require('../models/ServiceCategory');
        const ServiceOffering = require('../models/ServiceOffering');
        const Provider = require('../models/Provider');

        // Service categories to create
        const categories = [
            { name: 'Ambulance', description: 'Emergency ambulance services and medical transportation' },
            { name: 'Ayurvedic Message Centre', description: 'Traditional Ayurvedic massage and wellness services' },
            { name: 'Druggist and Chemist', description: 'Pharmacy and medication services' },
            { name: 'Dental Care', description: 'Dental health and oral care services' },
            { name: 'Doctor Chamber', description: 'General and specialist medical consultations' },
            { name: 'Eye Care', description: 'Ophthalmology and vision care services' },
            { name: 'Gym and Fitness', description: 'Physical fitness and wellness services' },
            { name: 'Hospitals', description: 'Hospital and medical facility services' },
            { name: 'Maternity and Children', description: 'Maternal and pediatric healthcare services' },
            { name: 'Nurse/Aya', description: 'Nursing and caregiving services' },
            { name: 'Nursing Home', description: 'Long-term care and nursing home services' },
            { name: 'Radiology', description: 'Medical imaging and diagnostic services' },
            { name: 'Yoga', description: 'Yoga and meditation wellness services' }
        ];

        // Create categories
        const createdCategories = [];
        for (const category of categories) {
            const existingCategory = await ServiceCategory.findOne({ name: category.name });
            if (!existingCategory) {
                const newCategory = await ServiceCategory.create(category);
                createdCategories.push(newCategory);
            } else {
                createdCategories.push(existingCategory);
            }
        }

        // Get approved providers
        const approvedProviders = await Provider.find({
            verificationStatus: 'approved',
            isActive: true
        });

        if (approvedProviders.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No approved providers found. Please approve some providers first.'
            });
        }

        // Create service offerings for each category
        const createdOfferings = [];
        for (const category of createdCategories) {
            // Find a provider for this category (simple assignment)
            const provider = approvedProviders[Math.floor(Math.random() * approvedProviders.length)];

            // Check if offering already exists
            const existingOffering = await ServiceOffering.findOne({
                category: category._id,
                provider: provider._id
            });

            if (!existingOffering) {
                const offering = await ServiceOffering.create({
                    provider: provider._id,
                    category: category._id,
                    name: `${category.name} Service`,
                    description: `Professional ${category.name.toLowerCase()} services provided by experienced healthcare professionals.`,
                    shortDescription: `Expert ${category.name.toLowerCase()} care and consultation.`,
                    duration: 60, // 1 hour default
                    price: Math.floor(Math.random() * 100) + 50, // Random price between 50-150
                    approvalStatus: 'approved',
                    isActive: true,
                    isFeatured: Math.random() > 0.7 // 30% chance of being featured
                });
                createdOfferings.push(offering);
            }
        }

        res.json({
            success: true,
            message: 'Service categories and offerings created successfully',
            data: {
                categoriesCreated: createdCategories.length,
                offeringsCreated: createdOfferings.length,
                categories: createdCategories,
                offerings: createdOfferings
            }
        });

    } catch (error) {
        console.error('Setup services error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to setup services',
            error: error.message
        });
    }
});

// Chart data endpoint for AJAX requests
router.get('/dashboard/chart-data', protectAdmin, async (req, res) => {
    try {
        const Appointment = require('../models/Appointment');

        // Get appointments by day for the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const appointmentsByDay = await Appointment.aggregate([
            {
                $match: {
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        // Get appointments by status
        const appointmentsByStatus = await Appointment.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            appointmentsByDay: appointmentsByDay,
            appointmentsByStatus: appointmentsByStatus
        });
    } catch (error) {
        console.error('Error fetching chart data:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching chart data'
        });
    }
});

module.exports = router;