const jwt = require('jsonwebtoken');
const passport = require('passport');
const { generateToken } = require('../config/passport');
const Patient = require('../models/Patient');
const Provider = require('../models/Provider');
const Admin = require('../models/Admin');
const Notification = require('../models/Notification');
const DoctorService = require('../models/DoctorService');
const { sendEmail } = require('../utils/emailService');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const ProviderVerification = require('../models/ProviderVerification');
const crypto = require('crypto')

function generateVerificationToken(userId, role) {
    return jwt.sign(
        { id: userId, role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
}

function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtp(otp) {
    return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

async function setEmailOtp(user) {
    const otp = generateOtp();
    user.verificationOtpHash = hashOtp(otp);
    user.verificationOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    return otp;
}

function buildOtpVerificationUrl(email, role) {
    const base = process.env.SERVER_URL || '';
    return `${base}/verify-email-otp?email=${encodeURIComponent(email)}&role=${encodeURIComponent(role)}`;
}



class AuthController {
    registerPatient = async (req, res) => {

        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, errors: errors.array() });
            }

            const { firstName, lastName, email, password, phone, dateOfBirth, gender, address, healthInfo } = req.body;


            // Check if email already exists
            const existing = await Patient.findOne({ email });
            if (existing) {
                return res.status(409).json({ success: false, message: 'Email already registered' });
            }

            // Create patient with all required fields
            const patient = await Patient.create({
                firstName,
                lastName,
                email,
                password,
                phone,
                dateOfBirth,  // ✅ include required field
                gender,       // ✅ include required field
                address,
                healthInfo,
                isVerified: false
            });

            console.log('✅ Patient created successfully:', patient._id);
            console.log('🔍 Patient email:', patient.email);
            console.log('🔍 Patient password (hashed):', patient.password ? 'HASHED' : 'NOT HASHED');

            const otp = await setEmailOtp(patient);
            const url = buildOtpVerificationUrl(patient.email, 'patient');

            let emailWarning = null;
            try {
                // Send verification email
                await sendEmail({
                    to: patient.email,
                    subject: 'Your Email Verification OTP',
                    html: `
                        <p>Your verification code is: <strong style="font-size: 20px; letter-spacing: 2px;">${otp}</strong></p>
                        <p>This OTP expires in 10 minutes.</p>
                        <p>You can verify here: <a href="${url}">${url}</a></p>
                    `
                });
            } catch (emailError) {
                console.error('❌ Email sending failed during patient registration:', emailError.message);
                emailWarning = 'Email service temporarily unavailable. Please use resend verification later.';
            }

            // If this was a form submission (HTML), render a success page; otherwise return JSON
            const prefersHtml = (req.headers['accept'] || '').includes('text/html');
            const isFormPost = req.is('application/x-www-form-urlencoded') || req.is('multipart/form-data');

            if (prefersHtml || isFormPost) {
                return res.status(201).render('auth/check-inbox', {
                    title: 'Check Your Email',
                    message: emailWarning
                        ? 'Registration successful. Verification email is delayed. Please use resend verification from login page.'
                        : 'Registration successful. Please check your email to verify.',
                    email: patient.email,
                    role: 'patient',
                    redirectUrl: '/auth/patient/login'
                });
            }

            res.status(201).json({
                success: true,
                message: emailWarning
                    ? 'Registration successful. Verification email could not be sent right now.'
                    : 'Registration successful. Please check your email to verify.',
                warning: emailWarning
            });



        } catch (err) {
            console.error('❌ Registration error:', err);
            res.status(500).json({ success: false, message: 'Server error during patient registration' });
        }
    };

    registerProvider = async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                // Check if this is a form submission or API call
                const prefersHtml = (req.headers['accept'] || '').includes('text/html');
                const isFormPost = req.is('application/x-www-form-urlencoded') || req.is('multipart/form-data');

                if (prefersHtml || isFormPost) {
                    req.flash('error', 'Please fill in all required fields correctly.');
                    return res.redirect('/register/provider');
                }

                return res.status(400).json({ success: false, errors: errors.array() });
            }

            const {
                firstName, lastName, email, password, phone, professionalTitle, specialization,
                licenseNumber, yearsOfExperience, selectedServices, additionalInfo,
                // Location data
                practiceName, practiceType, address, city, state, zipCode,
                // Practice info
                languages, acceptsInsurance, insuranceProviders
            } = req.body;

            // Check if email or license already exists
            const existingEmail = await Provider.findOne({ email });
            const existingLicense = await Provider.findOne({ licenseNumber });
            if (existingEmail || existingLicense) {
                // Check if this is a form submission or API call
                const prefersHtml = (req.headers['accept'] || '').includes('text/html');
                const isFormPost = req.is('application/x-www-form-urlencoded') || req.is('multipart/form-data');

                if (prefersHtml || isFormPost) {
                    req.flash('error', 'Email or License number already registered');
                    return res.redirect('/register/provider');
                }

                return res.status(409).json({ success: false, message: 'Email or License number already registered' });
            }

            // Validate selected services
            if (!selectedServices || selectedServices.length === 0) {
                // Check if this is a form submission or API call
                const prefersHtml = (req.headers['accept'] || '').includes('text/html');
                const isFormPost = req.is('application/x-www-form-urlencoded') || req.is('multipart/form-data');

                if (prefersHtml || isFormPost) {
                    req.flash('error', 'Please select at least one service category');
                    return res.redirect('/register/provider');
                }

                return res.status(400).json({ success: false, message: 'Please select at least one service category' });
            }

            // Prepare location data
            const locationData = {};
            if (address || city || state || zipCode) {
                locationData.address = address;
                locationData.city = city;
                locationData.state = state;
                locationData.zipCode = zipCode;
                locationData.country = 'USA'; // Default to USA
            }

            // Prepare practice info data
            const practiceInfoData = {};
            if (practiceName || practiceType || languages || acceptsInsurance) {
                practiceInfoData.practiceName = practiceName;
                practiceInfoData.practiceType = practiceType || 'private';
                practiceInfoData.languages = Array.isArray(languages) ? languages : (languages ? [languages] : ['English']);
                practiceInfoData.acceptsInsurance = acceptsInsurance === 'true' || acceptsInsurance === true;
                practiceInfoData.insuranceProviders = Array.isArray(insuranceProviders) ? insuranceProviders : (insuranceProviders ? [insuranceProviders] : []);
            }

            // Create provider
            const provider = await Provider.create({
                firstName,
                lastName,
                email,
                password,
                phone,
                professionalTitle,
                specialization,
                licenseNumber,
                yearsOfExperience,
                isVerified: false,
                verificationStatus: 'pending',
                location: Object.keys(locationData).length > 0 ? locationData : undefined,
                practiceInfo: Object.keys(practiceInfoData).length > 0 ? practiceInfoData : undefined
            });

            // Create initial service offerings for selected categories
            const ServiceOffering = require('../models/ServiceOffering');
            const ServiceCategory = require('../models/ServiceCategory');

            // Validate that all selected service categories exist
            const categoryValidationPromises = selectedServices.map(async (categoryId) => {
                try {
                    const category = await ServiceCategory.findById(categoryId);
                    if (!category) {
                        throw new Error(`Service category with ID ${categoryId} not found`);
                    }
                    return category;
                } catch (error) {
                    if (error.name === 'CastError') {
                        throw new Error(`Invalid service category ID format: ${categoryId}`);
                    }
                    throw error;
                }
            });

            const validatedCategories = await Promise.all(categoryValidationPromises);

            // Create service offerings for validated categories
            const servicePromises = validatedCategories.map(async (category) => {
                const serviceData = {
                    provider: provider._id,
                    category: category._id,
                    name: `${category.name} - ${professionalTitle} ${firstName} ${lastName}`,
                    description: `Professional ${category.name.toLowerCase()} services provided by ${professionalTitle} ${firstName} ${lastName}`,
                    shortDescription: `${category.name} services by certified ${specialization} specialist`,
                    duration: 30, // Default 30 minutes
                    price: 100, // Default price - can be updated later
                    pricingModel: 'fixed',
                    isActive: false, // Initially inactive until approved
                    approvalStatus: 'pending'
                };

                // Add location data to service if available
                if (Object.keys(locationData).length > 0) {
                    serviceData.location = {
                        address: locationData.address,
                        city: locationData.city,
                        state: locationData.state,
                        zipCode: locationData.zipCode,
                        coordinates: locationData.coordinates
                    };
                    serviceData.isVirtual = practiceType === 'telemedicine_only';
                }

                return ServiceOffering.create(serviceData);
            });

            await Promise.all(servicePromises);

            // Handle uploaded documents
            if (req.files) {
                const documents = [];

                // Process license document
                if (req.files.licenseDocument && req.files.licenseDocument[0]) {
                    documents.push({
                        documentType: 'license',
                        documentUrl: `/uploads/${req.files.licenseDocument[0].filename}`,
                        uploadedAt: new Date()
                    });
                }

                // Process additional documents
                if (req.files.additionalDocuments && req.files.additionalDocuments.length > 0) {
                    req.files.additionalDocuments.forEach(file => {
                        documents.push({
                            documentType: 'certification',
                            documentUrl: `/uploads/${file.filename}`,
                            uploadedAt: new Date()
                        });
                    });
                }

                // Update provider with document information
                if (documents.length > 0) {
                    await Provider.findByIdAndUpdate(provider._id, {
                        $push: { documents: { $each: documents } }
                    });
                }
            }

            const otp = await setEmailOtp(provider);
            const url = buildOtpVerificationUrl(provider.email, 'provider');

            try {
                await sendEmail({
                    to: provider.email,
                    subject: 'Your Provider Verification OTP',
                    html: `
                        <p>Your provider verification code is: <strong style="font-size: 20px; letter-spacing: 2px;">${otp}</strong></p>
                        <p>This OTP expires in 10 minutes.</p>
                        <p>Verify here: <a href="${url}">${url}</a></p>
                    `
                });

                // Check if this is a form submission or API call
                const prefersHtml = (req.headers['accept'] || '').includes('text/html');
                const isFormPost = req.is('application/x-www-form-urlencoded') || req.is('multipart/form-data');

                if (prefersHtml || isFormPost) {
                    req.flash('success_msg', 'Registration successful! Please check your email for verification.');
                    return res.redirect('/auth/provider/login');
                }

                res.status(201).json({ success: true, message: 'Provider registered. Please check your email to verify.' });
            } catch (emailError) {
                console.error('❌ Email sending failed during provider registration:', emailError);

                // Still save the provider but inform about email issue
                res.status(201).json({
                    success: true,
                    message: 'Provider registered successfully. However, verification email could not be sent. Please contact support for verification.',
                    warning: 'Email service temporarily unavailable'
                });
            }
        } catch (err) {
            console.error('❌ Provider registration error:', err);

            // Check if this is a form submission or API call
            const prefersHtml = (req.headers['accept'] || '').includes('text/html');
            const isFormPost = req.is('application/x-www-form-urlencoded') || req.is('multipart/form-data');

            if (prefersHtml || isFormPost) {
                req.flash('error', 'An error occurred during registration. Please try again.');
                return res.redirect('/register/provider');
            }

            res.status(500).json({ success: false, message: 'Server error during provider registration' });
        }
    };

    verifyProvider = async (req, res) => {
        try {
            const { token } = req.query;
            if (!token) {
                return res.status(400).json({ success: false, message: 'Verification token is missing' });
            }

            let decoded;
            try {
                decoded = jwt.verify(token, process.env.JWT_SECRET);
            } catch (err) {
                return res.status(400).json({ success: false, message: 'Invalid or expired verification link' });
            }

            const provider = await Provider.findByIdAndUpdate(
                decoded.id,
                { isVerified: true },
                { new: true }
            );

            if (!provider) {
                return res.status(404).json({ success: false, message: 'Provider not found' });
            }

            return res.status(200).send(`
            <html>
                <head>
                    <title>Email Verified</title>
                    <meta http-equiv="refresh" content="3;url=${process.env.CLIENT_URL}/login" />
                </head>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h1>Email verified successfully!</h1>
                    <p>You will be redirected to the login page in 3 seconds...</p>
                </body>
            </html>
        `);

        } catch (err) {

            return res.status(500).json({ success: false, message: 'Internal server error during verification' });
        }
    };

    resendProviderVerification = async (req, res) => {
        try {
            const { email } = req.body;
            const provider = await Provider.findOne({ email });

            // Always return a generic response to avoid account enumeration
            if (!provider) {
                return res.status(200).json({
                    success: true,
                    message: 'If an account exists, a verification email has been sent'
                });
            }

            if (provider.isVerified) {
                return res.status(400).json({
                    success: false,
                    message: 'Email is already verified'
                });
            }

            const otp = await setEmailOtp(provider);
            const url = buildOtpVerificationUrl(provider.email, 'provider');

            try {
                await sendEmail({
                    to: provider.email,
                    subject: 'Your Provider Verification OTP',
                    html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #3498db;">Provider Account Verification</h1>
                        <p>Your OTP is <strong style="font-size: 20px; letter-spacing: 2px;">${otp}</strong></p>
                        <p>This OTP expires in 10 minutes.</p>
                        <p>Verify here: <a href="${url}">${url}</a></p>
                    </div>
                `
                });

                return res.json({
                    success: true,
                    message: 'Verification email resent successfully'
                });
            } catch (emailError) {
                console.error('❌ Email sending failed during resend verification:', emailError);

                return res.status(500).json({
                    success: false,
                    message: 'Failed to send verification email. Please check your email configuration or contact support.'
                });
            }

        } catch (err) {
            console.error('❌ Resend verification error:', err);
            return res.status(500).json({
                success: false,
                message: 'Failed to resend verification email'
            });
        }
    };

    approveProvider = async (req, res) => {
        try {
            const { providerId } = req.params;
            const { approved } = req.body;

            console.log('🔍 Approving provider:', providerId, 'approved:', approved);

            const provider = await Provider.findByIdAndUpdate(
                providerId,
                {
                    verificationStatus: approved ? 'approved' : 'rejected'
                },
                { new: true }
            );

            if (!provider) {
                return res.status(404).json({
                    success: false,
                    message: 'Provider not found'
                });
            }

            console.log('✅ Provider updated:', provider.verificationStatus);

            // Notify provider of status change
            await Notification.create({
                recipient: provider._id,
                recipientModel: 'Provider',
                sender: req.user.id,
                senderModel: 'Admin',
                type: approved ? 'provider_approval' : 'provider_rejection',
                title: `Account ${approved ? 'Approved' : 'Rejected'}`,
                message: `Your provider account has been ${approved ? 'approved' : 'rejected'}`,
                isRead: false
            });

            return res.json({
                success: true,
                message: `Provider ${approved ? 'approved' : 'rejected'} successfully`,
                verificationStatus: provider.verificationStatus
            });

        } catch (err) {
            console.error('❌ Error in approveProvider:', err);
            return res.status(500).json({
                success: false,
                message: 'Failed to update provider status'
            });
        }
    };

    loginPatient = (req, res, next) => {

        passport.authenticate('patient-local', { session: true }, (err, patient, info) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'Server error during login'
                });
            }

            if (!patient) {
                return res.status(401).json({
                    success: false,
                    message: info?.message || 'Invalid credentials',
                    errorCode: info?.errorCode
                });
            }


            // Log in the user and create session
            req.logIn(patient, (loginErr) => {
                if (loginErr) {
                    return res.status(500).json({
                        success: false,
                        message: 'Session creation failed',
                        errorCode: 'SESSION_ERROR'
                    });
                }

                // Set user role in session
                req.session.userRole = patient.role;

                // Generate JWT token for API access
                const token = generateToken(patient);

                res.json({
                    success: true,
                    message: 'Login successful',
                    token,
                    data: {
                        id: patient._id,
                        firstName: patient.firstName,
                        lastName: patient.lastName,
                        email: patient.email,
                        role: patient.role
                    }
                });
            });
        })(req, res, next);
    };

    loginProvider = (req, res, next) => {
        passport.authenticate('provider-local', { session: true }, async (err, provider, info) => {
            try {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: 'Authentication server error',
                        errorCode: 'SERVER_ERROR'
                    });
                }

                if (!provider) {
                    // Check if it's a specific error from Passport strategy
                    if (info?.errorCode) {
                        const statusCode = info.errorCode === 'EMAIL_NOT_VERIFIED' || info.errorCode === 'PENDING_APPROVAL' ? 403 : 401;
                        return res.status(statusCode).json({
                            success: false,
                            message: info.message,
                            errorCode: info.errorCode,
                            ...(info.verificationStatus && { verificationStatus: info.verificationStatus }),
                            ...(info.canResendVerification && { canResendVerification: info.canResendVerification })
                        });
                    }

                    return res.status(401).json({
                        success: false,
                        message: info?.message || 'Invalid email or password',
                        errorCode: 'INVALID_CREDENTIALS'
                    });
                }



                // Log in the user and create session
                req.logIn(provider, (loginErr) => {
                    if (loginErr) {
                        return res.status(500).json({
                            success: false,
                            message: 'Session creation failed',
                            errorCode: 'SESSION_ERROR'
                        });
                    }

                    // Set user role in session
                    req.session.userRole = provider.role;

                    // Redirect to provider dashboard
                    return res.redirect('/provider/dashboard');
                });

            } catch (error) {

                return res.status(500).json({
                    success: false,
                    message: 'Internal server error during login',
                    errorCode: 'INTERNAL_ERROR'
                });
            }
        })(req, res, next);
    };

    loginAdmin = (req, res, next) => {
        passport.authenticate('admin-local', { session: true }, (err, admin, info) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'Authentication server error',
                    errorCode: 'SERVER_ERROR'
                });
            }

            if (!admin) {
                return res.status(401).json({
                    success: false,
                    message: info?.message || 'Invalid credentials',
                    errorCode: 'INVALID_CREDENTIALS'
                });
            }

            // Log in the user and create session
            req.logIn(admin, (loginErr) => {
                if (loginErr) {
                    return res.status(500).json({
                        success: false,
                        message: 'Session creation failed',
                        errorCode: 'SESSION_ERROR'
                    });
                }

                // Generate JWT token for API access
                const token = generateToken(admin);

                // Set user role in session
                req.session.userRole = admin.role;

                return res.json({
                    success: true,
                    message: 'Login successful',
                    token,
                    data: {
                        id: admin._id,
                        firstName: admin.firstName,
                        lastName: admin.lastName,
                        email: admin.email,
                        role: admin.role
                    }
                });
            });
        })(req, res, next);
    };

    getMe = async (req, res, next) => {
        try {
            // Check if user still exists first
            let userExists;
            const role = req.user.roleName || req.user.role;

            switch (role) {
                case 'patient':
                    userExists = await Patient.findById(req.user._id);
                    break;
                case 'provider':
                    userExists = await Provider.findById(req.user._id);
                    break;
                case 'admin':
                    userExists = await Admin.findById(req.user._id);
                    break;
            }

            if (!userExists) {
                // Don't try to logout since we're not using sessions
                return res.status(410).json({ // 410 Gone - resource no longer available
                    success: false,
                    message: 'Your account has been deleted',
                    errorCode: 'USER_DELETED'
                });
            }

            // If user exists, proceed with normal lookup
            let user;
            switch (role) {
                case 'patient':
                    user = await Patient.findById(req.user._id).select('-password');
                    break;
                case 'provider':
                    user = await Provider.findById(req.user._id).select('-password');
                    break;
                case 'admin':
                    user = await Admin.findById(req.user._id).select('-password');
                    break;
            }

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found',
                    errorCode: 'USER_NOT_FOUND'
                });
            }

            const userObj = user.toObject ? user.toObject() : user;
            userObj.roleName = role;

            return res.status(200).json({
                success: true,
                data: userObj
            });
        } catch (err) {

            next(err);
        }
    };

    forgotPassword = async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        try {
            const { email } = req.body;

            let user = await Patient.findOne({ email }) ||
                await Provider.findOne({ email }) ||
                await Admin.findOne({ email });

            if (!user) {
                // Don't reveal whether email exists for security
                return res.status(200).json({
                    success: true,
                    message: 'If an account exists with this email, a reset link has been sent'
                });
            }

            const resetToken = jwt.sign(
                { id: user._id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

            await Notification.create({
                recipient: user._id,
                recipientModel: user.constructor.modelName,
                senderModel: 'System',
                type: 'password-reset',
                title: 'Password Reset Request',
                message: 'You have requested to reset your password. Please follow the link sent to your email.'
            });

            await sendEmail({
                to: user.email,
                subject: 'Password Reset Request',
                html: `
                    <h1>Password Reset</h1>
                    <p>You are receiving this email because you requested a password reset.</p>
                    <p>Please click the following link to reset your password (expires in 1 hour):</p>
                    <a href="${resetUrl}">Reset Password</a>
                    <p>If you didn't request this, please ignore this email.</p>
                `
            });

            return res.status(200).json({
                success: true,
                message: 'Password reset email sent if account exists'
            });
        } catch (err) {
            next(err);
        }
    };

    resetPassword = async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        try {
            const { token } = req.params;
            const { password } = req.body;

            let decoded;
            try {
                decoded = jwt.verify(token, process.env.JWT_SECRET);
            } catch (err) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid or expired token',
                    errorCode: 'INVALID_TOKEN'
                });
            }

            let user;
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
                default:
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid token',
                        errorCode: 'INVALID_TOKEN'
                    });
            }

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found',
                    errorCode: 'USER_NOT_FOUND'
                });
            }

            user.password = password;
            await user.save();

            await Notification.create({
                recipient: user._id,
                recipientModel: user.constructor.modelName,
                senderModel: 'System',
                type: 'password-reset',
                title: 'Password Reset Successful',
                message: 'Your password has been successfully reset.'
            });

            return res.status(200).json({
                success: true,
                message: 'Password updated successfully'
            });
        } catch (err) {
            next(err);
        }
    };

    verifyEmailOtp = async (req, res) => {
        try {
            const { email, otp, role } = req.body;
            if (!email || !otp || !role) {
                return res.status(400).json({ success: false, message: 'Email, role and OTP are required' });
            }

            const normalizedRole = String(role).toLowerCase();
            if (!['patient', 'provider'].includes(normalizedRole)) {
                return res.status(400).json({ success: false, message: 'Invalid role' });
            }

            const Model = normalizedRole === 'patient' ? Patient : Provider;
            const user = await Model.findOne({ email: String(email).toLowerCase().trim() });
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            if (user.isVerified) {
                return res.status(200).json({ success: true, message: 'Email already verified' });
            }

            if (!user.verificationOtpHash || !user.verificationOtpExpires) {
                return res.status(400).json({ success: false, message: 'OTP not generated. Please resend OTP.' });
            }

            if (new Date(user.verificationOtpExpires).getTime() < Date.now()) {
                return res.status(400).json({ success: false, message: 'OTP expired. Please resend OTP.' });
            }

            const submittedHash = hashOtp(otp);
            if (submittedHash !== user.verificationOtpHash) {
                return res.status(400).json({ success: false, message: 'Invalid OTP' });
            }

            user.isVerified = true;
            user.verificationOtpHash = undefined;
            user.verificationOtpExpires = undefined;
            await user.save({ validateBeforeSave: false });

            const loginUrl = normalizedRole === 'provider' ? '/auth/provider/login?verified=1' : '/auth/patient/login?verified=1';
            return res.status(200).json({ success: true, message: 'Email verified successfully', redirectUrl: loginUrl });
        } catch (err) {
            console.error('OTP verification error:', err);
            return res.status(500).json({ success: false, message: 'Failed to verify OTP' });
        }
    };

    verifyEmail = async (req, res) => {
        try {
            const { token } = req.query;
            if (!token) {
                return res.status(400).json({ success: false, message: 'Token is required' });
            }

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const { id, role } = decoded;



            let user;
            if (role === 'patient') {
                user = await Patient.findByIdAndUpdate(
                    id,
                    { isVerified: true },
                    { new: true }
                ).lean();
            } else if (role === 'provider') {
                user = await Provider.findByIdAndUpdate(
                    id,
                    { isVerified: true },
                    { new: true }
                ).lean();
            }



            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found',
                    details: {
                        idFromToken: id,
                        roleFromToken: role,
                        searchedCollection: role === 'patient' ? 'patients' : 'providers'
                    }
                });
            }

            // Successful verification - redirect directly to role login page
            if (role === 'provider') {
                return res.redirect('/auth/provider/login?verified=1');
            }

            return res.redirect('/auth/patient/login?verified=1');

        } catch (err) {

            if (err.name === 'TokenExpiredError') {
                return res.status(400).json({
                    success: false,
                    message: 'Verification link has expired'
                });
            }
            return res.status(400).json({
                success: false,
                message: 'Invalid verification link',
                error: err.message
            });
        }
    };


    resendVerificationEmail = async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        try {
            const { email } = req.body;

            const patient = await Patient.findOne({ email });
            if (!patient) {
                return res.status(200).json({
                    success: true,
                    message: 'If an account exists with this email, a verification link has been sent'
                });
            }

            if (patient.isVerified) {
                return res.status(400).json({
                    success: false,
                    message: 'Email is already verified',
                    errorCode: 'ALREADY_VERIFIED'
                });
            }

            const otp = await setEmailOtp(patient);
            const url = buildOtpVerificationUrl(patient.email, 'patient');

            await sendEmail({
                to: patient.email,
                subject: 'Your Email Verification OTP',
                html: `
                    <h1>Verify Your Email</h1>
                    <p>Your OTP is: <strong style="font-size: 20px; letter-spacing: 2px;">${otp}</strong></p>
                    <p>This OTP expires in 10 minutes.</p>
                    <p>Verify here: <a href="${url}">${url}</a></p>
                    <p>If you didn't request this, please ignore this email.</p>
                `
            });

            return res.status(200).json({
                success: true,
                message: 'Verification email resent successfully'
            });
        } catch (err) {
            next(err);
        }
    };

    approveService = async (req, res) => {
        try {
            const { serviceId } = req.params;
            const { reason } = req.body;

            const service = await DoctorService.findByIdAndUpdate(
                serviceId,
                {
                    approvalStatus: 'approved',
                    approvedBy: req.user._id,
                    approvedAt: new Date()
                },
                { new: true }
            );

            if (!service) {
                return res.status(404).json({
                    success: false,
                    message: 'Service not found'
                });
            }

            // Get service with provider details
            const serviceWithProvider = await DoctorService.aggregate([
                {
                    $match: { _id: service._id }
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
                            email: 1
                        },
                        doctorName: 1,
                        specialization: 1,
                        serviceName: 1,
                        approvalStatus: 1,
                        approvedBy: 1,
                        approvedAt: 1
                    }
                }
            ]);

            const populatedService = serviceWithProvider[0];

            // Notify provider of service approval
            await Notification.create({
                recipient: populatedService.provider._id,
                recipientModel: 'Provider',
                sender: req.user._id,
                senderModel: 'Admin',
                type: 'service-approval',
                title: 'Service Approved',
                message: `Your service "${populatedService.doctorName}" has been approved and is now visible to patients.`,
                isRead: false
            });

            return res.json({
                success: true,
                message: 'Service approved successfully',
                service: {
                    id: populatedService._id,
                    doctorName: populatedService.doctorName,
                    specialization: populatedService.specialization,
                    provider: populatedService.provider
                }
            });

        } catch (err) {

            return res.status(500).json({
                success: false,
                message: 'Failed to approve service'
            });
        }
    };

    rejectService = async (req, res) => {
        try {
            const { serviceId } = req.params;
            const { reason } = req.body;

            const service = await DoctorService.findByIdAndUpdate(
                serviceId,
                {
                    approvalStatus: 'rejected',
                    approvedBy: req.user._id,
                    approvedAt: new Date()
                },
                { new: true }
            );

            if (!service) {
                return res.status(404).json({
                    success: false,
                    message: 'Service not found'
                });
            }

            // Get service with provider details
            const serviceWithProvider = await DoctorService.aggregate([
                {
                    $match: { _id: service._id }
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
                            email: 1
                        },
                        doctorName: 1,
                        specialization: 1,
                        serviceName: 1,
                        approvalStatus: 1,
                        approvedBy: 1,
                        approvedAt: 1
                    }
                }
            ]);

            const populatedService = serviceWithProvider[0];

            // Notify provider of service rejection
            await Notification.create({
                recipient: populatedService.provider._id,
                recipientModel: 'Provider',
                sender: req.user._id,
                senderModel: 'Admin',
                type: 'service-rejection',
                title: 'Service Rejected',
                message: `Your service "${populatedService.doctorName}" has been rejected.${reason ? ` Reason: ${reason}` : ''}`,
                isRead: false
            });

            return res.json({
                success: true,
                message: 'Service rejected successfully',
                service: {
                    id: populatedService._id,
                    doctorName: populatedService.doctorName,
                    specialization: populatedService.specialization,
                    provider: populatedService.provider
                }
            });

        } catch (err) {

            return res.status(500).json({
                success: false,
                message: 'Failed to reject service'
            });
        }
    };

    registerAdmin = async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, errors: errors.array() });
            }

            const { firstName, lastName, email, password, phone } = req.body;

            // Check if email already exists
            const existing = await Admin.findOne({ email });
            if (existing) {
                return res.status(409).json({ success: false, message: 'Email already registered' });
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

            res.status(201).json({
                success: true,
                message: 'Admin registration successful. You can now login.'
            });

        } catch (err) {

            res.status(500).json({ success: false, message: 'Server error during admin registration' });
        }
    };
}

module.exports = new AuthController();
