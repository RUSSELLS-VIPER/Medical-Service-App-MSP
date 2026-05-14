const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { passport } = require('../config/passport');
const upload = require('../utils/multer');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const multer = require('multer');

// Middleware to handle both JSON and form data
const handleLoginData = (req, res, next) => {
    // If content-type is multipart/form-data, parse it as form data
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
        // Use multer to parse form data
        const upload = multer().none();
        return upload(req, res, (err) => {
            if (err) {
                console.error('Form data parsing error:', err);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid form data'
                });
            }
            console.log('✅ Form data parsed successfully:', req.body);
            next();
        });
    }
    // Otherwise, let the JSON parser handle it
    console.log('✅ JSON data will be handled by express.json()');
    next();
};

// ======================
// Debug Routes (Remove in production)
// ======================
router.get('/debug/check-user/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const Patient = require('../models/Patient');

        const patient = await Patient.findOne({ email: email.toLowerCase().trim() }).select('+password');

        if (!patient) {
            return res.json({
                exists: false,
                message: 'User not found'
            });
        }

        res.json({
            exists: true,
            id: patient._id,
            email: patient.email,
            isVerified: patient.isVerified,
            hasPassword: !!patient.password,
            passwordLength: patient.password ? patient.password.length : 0
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Test JWT token endpoint
router.get('/debug/test-token', protect, (req, res) => {
    res.json({
        success: true,
        message: 'Token is valid!',
        user: {
            id: req.user._id,
            email: req.user.email,
            role: req.user.roleName || req.user.role
        }
    });
});

// ======================
// Registration Routes
// ======================
router.post('/register/patient', authController.registerPatient);
// Configure multer for provider registration with multiple file fields
const path = require('path');

// Set storage engine
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// Check file type
function checkFileType(file, cb) {
    const filetypes = /jpeg|jpg|png|pdf/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Error: Only PDF, JPG, JPEG, and PNG files are allowed!');
    }
}

// Create multer instance for provider registration
const providerUpload = multer({
    storage: storage,
    limits: { fileSize: 5000000 }, // 5MB per file
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
}).fields([
    { name: 'licenseDocument', maxCount: 1 },
    { name: 'additionalDocuments', maxCount: 5 }
]);

router.post('/register/provider', providerUpload, authController.registerProvider);

// ======================
// Login Routes (Role-Specific)
// ======================
router.post('/patient/login', handleLoginData, authController.loginPatient);

router.post('/provider/login', handleLoginData, (req, res, next) => {

    authController.loginProvider(req, res, next);
});

router.post('/admin/login', handleLoginData, authController.loginAdmin);

// ======================
// Verification Routes
// ======================
router.get('/verify-email', authController.verifyEmail);
router.post('/verify-email-otp', authController.verifyEmailOtp);
router.post('/patient/resend-verification', authController.resendVerificationEmail);
router.post('/provider/resend-verification', authController.resendProviderVerification);
router.get('/provider/verify', authController.verifyProvider);

// ======================
// Current User Route
// ======================
router.get('/me', protect, authController.getMe);

// ======================
// Password Reset Routes
// ======================
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

// ======================
// Provider Approval Route (Admin-only)
// ======================
router.put(
    '/admin/providers/:providerId/approve',
    protect,
    restrictTo('admin'),
    authController.approveProvider
);

// ======================
// Email Availability Check
// ======================
// router.post('/check-email', authController.verifyEmail);

// Add to authRoutes.js
router.post('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {

            return res.status(500).json({
                success: false,
                message: 'Error during logout'
            });
        }

        // Clear session and cookies
        req.session.destroy((err) => {
            if (err) {

            }
        });

        res.clearCookie('token');
        res.clearCookie('connect.sid'); // Session cookie

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    });
});

// Service approval routes (Admin only)
router.put(
    '/admin/services/:serviceId/approve',
    protect,
    restrictTo('admin'),
    authController.approveService
);

router.put(
    '/admin/services/:serviceId/reject',
    protect,
    restrictTo('admin'),
    authController.rejectService
);

module.exports = router;
