const Patient = require('../models/Patient');
const Provider = require('../models/Provider');
const Admin = require('../models/Admin');
const Appointment = require('../models/Appointment');
const ServiceOffering = require('../models/ServiceOffering');
const DoctorService = require('../models/DoctorService');
const ServiceCategory = require('../models/ServiceCategory');
const Notification = require('../models/Notification');
const ProviderVerification = require('../models/ProviderVerification');
const { sendEmail } = require('../utils/emailService');
const Role = require('../models/Role');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const mongoose = require('mongoose');



class AdminController {
    register = async (req, res, next) => {
        try {
            const { firstName, lastName, email, password, phone } = req.body;

            const existingAdmin = await Admin.findOne({ email });
            if (existingAdmin) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already registered'
                });
            }

            const admin = await Admin.create({
                firstName,
                lastName,
                email,
                password,
                phone,
                role: 'admin'
            });

            // Create notification
            await Notification.create({
                recipient: admin._id,
                recipientModel: 'Admin',
                sender: admin._id,
                senderModel: 'System',
                type: 'account',
                title: 'Welcome to Medical Booking Platform',
                message: 'You have been added as an administrator to the Medical Booking Platform.',
                isRead: false
            });

            res.status(201).json({
                success: true,
                data: {
                    id: admin._id,
                    firstName: admin.firstName,
                    lastName: admin.lastName,
                    email: admin.email,
                    role: admin.role
                }
            });
        } catch (err) {
            next(err);
        }
    };

    login = async (req, res, next) => {
        try {
            passport.authenticate('admin-local', { session: true }, (err, admin, info) => {
                if (err) return next(err);

                if (!admin) {
                    req.flash('error', info?.message || 'Invalid credentials');
                    return res.redirect('/admin/login');
                }

                req.logIn(admin, (loginErr) => {
                    if (loginErr) {
                        req.flash('error', 'Login session error');
                        return res.redirect('/admin/login');
                    }

                    req.session.user = {
                        id: admin._id,
                        firstName: admin.firstName,
                        lastName: admin.lastName,
                        email: admin.email,
                        role: 'admin'
                    };

                    return res.redirect('/admin/dashboard');
                });
            })(req, res, next);
        } catch (err) {
            next(err);
        }
    };


    getPatients = async (req, res, next) => {
        try {
            const patients = await Patient.find().select('-password');

            res.render('admin/patients', {
                title: 'Patients Management',
                patients: patients,
                user: req.user
            });
        } catch (err) {
            next(err);
        }
    };

    getProviders = async (req, res, next) => {
        try {
            const { status } = req.query;
            const filter = {};

            if (status) {
                filter.verificationStatus = status;
            }

            const providers = await Provider.find(filter).select('-password');

            res.render('admin/providers', {
                title: 'Providers Management',
                providers: providers,
                user: req.user,
                currentFilter: status,
                getStatusClass: (status) => {
                    switch (status) {
                        case 'approved': return 'success';
                        case 'pending': return 'warning';
                        case 'rejected': return 'danger';
                        default: return 'secondary';
                    }
                },
                getStatusText: (status) => {
                    switch (status) {
                        case 'approved': return 'Approved';
                        case 'pending': return 'Pending';
                        case 'rejected': return 'Rejected';
                        default: return 'Unknown';
                    }
                }
            });
        } catch (err) {
            next(err);
        }
    };

    getProviderById = async (req, res, next) => {
        try {
            const { id } = req.params;
            const provider = await Provider.findById(id).select('-password');
            if (!provider) {
                return res.status(404).json({ success: false, message: 'Provider not found' });
            }
            return res.status(200).json({ success: true, data: provider });
        } catch (err) {
            next(err);
        }
    };

    getNewProviderForm = async (req, res, next) => {
        try {
            // This would typically render a form for creating a new provider
            // For now, we'll return a simple response indicating the route works
            res.status(200).json({
                success: true,
                message: 'New provider form endpoint reached',
                data: {
                    formType: 'newProvider',
                    fields: [
                        'firstName',
                        'lastName',
                        'email',
                        'phone',
                        'professionalTitle',
                        'specialization',
                        'licenseNumber',
                        'yearsOfExperience'
                    ]
                }
            });
        } catch (err) {
            next(err);
        }
    };

    testMethod = async (req, res, next) => {
        res.json({ success: true, message: 'Test method works' });
    };

    createProvider = async (req, res, next) => {
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
    };

    updateProviderById = async (req, res, next) => {
        try {
            const { id } = req.params;
            const allowedFields = [
                'firstName',
                'lastName',
                'email',
                'phone',
                'professionalTitle',
                'specialization',
                'licenseNumber',
                'yearsOfExperience',
                'verificationStatus',
                'isVerified',
                'isActive'
            ];

            const update = {};
            for (const key of allowedFields) {
                if (Object.prototype.hasOwnProperty.call(req.body, key)) {
                    update[key] = req.body[key];
                }
            }

            // Normalize some fields
            if (typeof update.email === 'string') update.email = update.email.toLowerCase().trim();
            if (typeof update.verificationStatus === 'string') update.verificationStatus = update.verificationStatus.toLowerCase();

            const updated = await Provider.findByIdAndUpdate(id, update, { new: true, runValidators: true }).select('-password');
            if (!updated) {
                return res.status(404).json({ success: false, message: 'Provider not found' });
            }

            return res.status(200).json({ success: true, data: updated });
        } catch (err) {
            next(err);
        }
    };

    getPendingVerifications = async (req, res, next) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;

            let verifications = await ProviderVerification.aggregate([
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

            // Get counts from ProviderVerification
            const pvApprovedCount = await ProviderVerification.countDocuments({ status: 'approved' });
            const pvRejectedCount = await ProviderVerification.countDocuments({ status: 'rejected' });

            // Fallback: if there are no ProviderVerification docs, derive from Provider records
            let providerPendingCount = 0;
            let providerApprovedCount = 0;
            let providerRejectedCount = 0;
            if (verifications.length === 0 && total === 0) {
                providerPendingCount = await Provider.countDocuments({ verificationStatus: 'pending' });
                providerApprovedCount = await Provider.countDocuments({ verificationStatus: 'approved' });
                providerRejectedCount = await Provider.countDocuments({ verificationStatus: 'rejected' });

                if (providerPendingCount > 0) {
                    const pendingProviders = await Provider.find({ verificationStatus: 'pending' })
                        .select('-password')
                        .lean();
                    verifications = pendingProviders.map((p) => ({
                        provider: p,
                        documents: Array.isArray(p.documents) ? p.documents : [],
                        status: 'pending',
                        createdAt: p.createdAt
                    }));
                }
            }

            const approvedCount = pvApprovedCount > 0 ? pvApprovedCount : providerApprovedCount;
            const rejectedCount = pvRejectedCount > 0 ? pvRejectedCount : providerRejectedCount;
            const pendingCount = total > 0 ? total : providerPendingCount;

            // Render the verifications management page with all necessary data
            return res.render('admin/verifications', {
                title: 'Verifications Management',
                user: req.user,
                verifications: verifications,
                currentPage: page,
                totalPages: totalPages,
                total: pendingCount,
                approvedCount: approvedCount,
                rejectedCount: rejectedCount,
                pendingCount: pendingCount,
                limit: limit,
                currentPagePath: 'admin/verifications',
                getStatusClass: (status) => {
                    switch (status) {
                        case 'approved': return 'success';
                        case 'pending': return 'warning';
                        case 'rejected': return 'danger';
                        default: return 'secondary';
                    }
                },
                getStatusText: (status) => {
                    switch (status) {
                        case 'approved': return 'Approved';
                        case 'pending': return 'Pending';
                        case 'rejected': return 'Rejected';
                        default: return 'Unknown';
                    }
                }
            });

        } catch (err) {
            next(err);
        }
    };

    reviewVerification = async (req, res, next) => {
        try {
            const { verificationId, providerId, status, reviewNotes } = req.body || {};

            if (!['approved', 'rejected'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status value'
                });
            }

            let verification = null;

            // Try to update an existing pending verification by id if valid
            if (verificationId && mongoose.Types.ObjectId.isValid(verificationId)) {
                verification = await ProviderVerification.findOneAndUpdate(
                    { _id: verificationId, status: 'pending' },
                    {
                        status,
                        reviewNotes,
                        admin: req.user?._id || req.user?.id,
                        reviewedAt: Date.now()
                    },
                    { new: true }
                );
            }

            // If not found, try to find by provider pending verification
            if (!verification && providerId && mongoose.Types.ObjectId.isValid(providerId)) {
                verification = await ProviderVerification.findOneAndUpdate(
                    { provider: providerId, status: 'pending' },
                    {
                        status,
                        reviewNotes,
                        admin: req.user?._id || req.user?.id,
                        reviewedAt: Date.now()
                    },
                    { new: true }
                );
            }

            // If still not found and we have a providerId, create a verification record to capture audit trail
            if (!verification && providerId && mongoose.Types.ObjectId.isValid(providerId)) {
                verification = await ProviderVerification.create({
                    provider: providerId,
                    status,
                    reviewNotes,
                    admin: req.user?._id || req.user?.id,
                    reviewedAt: Date.now()
                });
            }

            if (!verification) {
                return res.status(404).json({
                    success: false,
                    message: 'Verification not found. Provide a valid verificationId or providerId.'
                });
            }

            // Update provider verification status
            const provider = await Provider.findByIdAndUpdate(
                verification.provider,
                { verificationStatus: status },
                { new: true }
            ).select('-password');

            if (!provider) {
                return res.status(404).json({
                    success: false,
                    message: 'Provider not found'
                });
            }

            // Create notification (best-effort) with valid enum type
            try {
                const notificationType = status === 'approved' ? 'provider_approval' : 'provider_rejection';
                await Notification.create({
                    recipient: verification.provider,
                    recipientModel: 'Provider',
                    sender: (req.user?._id || req.user?.id),
                    senderModel: 'Admin',
                    type: notificationType,
                    title: `Verification ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                    message: `Your account verification has been ${status}. ${reviewNotes ? 'Notes: ' + reviewNotes : ''}`,
                    relatedProvider: verification.provider,
                    metadata: { verificationId: String(verification._id), status }
                });
            } catch (notifErr) {
                console.error('Notification create failed:', notifErr?.message || notifErr);
            }

            // Send verification result email (best-effort)
            try {
                await sendEmail({
                    to: provider.email,
                    subject: `Account Verification ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                    text: `Hello ${provider.firstName},\n\nYour account verification has been ${status} by the admin.\n\n${reviewNotes ? 'Admin Notes: ' + reviewNotes + '\n\n' : ''}Thank you for using our platform.`
                });
            } catch (emailErr) {
                // Log but don't fail the request
                console.error('Email send failed:', emailErr?.message || emailErr);
            }

            return res.status(200).json({
                success: true,
                message: `Verification ${status} successfully`,
                data: {
                    verification,
                    provider
                }
            });
        } catch (err) {
            next(err);
        }
    };

    getAllAppointments = async (req, res, next) => {
        try {
            const { status } = req.query;
            const filter = {};

            if (status) {
                filter.status = status;
            }

            const appointments = await Appointment.find(filter)
                .populate('patient', 'firstName lastName email')
                .populate('provider', 'firstName lastName specialization')
                .populate('service', 'name category')
                .sort({ date: 1, startTime: 1 });

            res.render('admin/appointments', {
                title: 'Appointments Management',
                appointments: appointments,
                user: req.user,
                currentFilter: status,
                getStatusClass: (status) => {
                    switch (status) {
                        case 'confirmed': return 'success';
                        case 'pending': return 'warning';
                        case 'cancelled': return 'danger';
                        case 'completed': return 'info';
                        default: return 'secondary';
                    }
                },
                getStatusText: (status) => {
                    switch (status) {
                        case 'confirmed': return 'Confirmed';
                        case 'pending': return 'Pending';
                        case 'cancelled': return 'Cancelled';
                        case 'completed': return 'Completed';
                        default: return 'Unknown';
                    }
                }
            });
        } catch (err) {
            next(err);
        }
    };

    getServiceCategories = async (req, res, next) => {
        try {
            const categories = await ServiceCategory.find();
            res.status(200).json({
                success: true,
                data: categories
            });
        } catch (err) {
            next(err);
        }
    };

    createServiceCategory = async (req, res, next) => {
        try {
            const { name, description } = req.body;
            const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

            const category = await ServiceCategory.create({
                name,
                description,
                imageUrl
            });

            res.status(201).json({
                success: true,
                data: category
            });
        } catch (err) {
            next(err);
        }
    };

    updateServiceCategory = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { name, description, isActive } = req.body;

            const category = await ServiceCategory.findByIdAndUpdate(
                id,
                { name, description, isActive },
                { new: true, runValidators: true }
            );

            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: 'Category not found'
                });
            }

            res.status(200).json({
                success: true,
                data: category
            });
        } catch (err) {
            next(err);
        }
    };

    getNotifications = async (req, res, next) => {
        try {
            const notifications = await Notification.find({
                $or: [
                    { recipientModel: 'Admin' },
                    { senderModel: 'System' }
                ]
            }).sort({ createdAt: -1 });

            res.status(200).json({
                success: true,
                count: notifications.length,
                data: notifications
            });
        } catch (err) {
            next(err);
        }
    };

    markNotificationAsRead = async (req, res, next) => {
        try {
            const { id } = req.params;

            const notification = await Notification.findOneAndUpdate(
                {
                    _id: id,
                    $or: [
                        { recipient: req.user.id, recipientModel: 'Admin' },
                        { senderModel: 'System' }
                    ]
                },
                { isRead: true },
                { new: true }
            );

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    message: 'Notification not found'
                });
            }

            res.status(200).json({
                success: true,
                data: notification
            });
        } catch (err) {
            next(err);
        }
    };

    createAdmin = async (req, res, next) => {
        try {
            const { firstName, lastName, email, password, phone, role } = req.body;

            const existingAdmin = await Admin.findOne({ email });
            if (existingAdmin) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already registered'
                });
            }

            const admin = await Admin.create({
                firstName,
                lastName,
                email,
                password,
                phone,
                role
            });

            await Notification.create({
                recipient: admin._id,
                recipientModel: 'Admin',
                senderModel: 'System',
                type: 'general',
                title: 'Welcome to Medical Booking Platform',
                message: 'You have been added as an administrator to the Medical Booking Platform.'
            });

            res.status(201).json({
                success: true,
                data: {
                    id: admin._id,
                    firstName: admin.firstName,
                    lastName: admin.lastName,
                    email: admin.email,
                    role: admin.role
                }
            });
        } catch (err) {
            next(err);
        }
    };

    updateProfile = async (req, res, next) => {
        try {
            const { firstName, lastName, phone } = req.body;

            const admin = await Admin.findByIdAndUpdate(
                req.user.id,
                { firstName, lastName, phone },
                { new: true, runValidators: true }
            ).select('-password');

            res.status(200).json({
                success: true,
                data: admin
            });
        } catch (err) {
            next(err);
        }
    };

    getDashboard = async (req, res, next) => {
        try {
            let patientsCount = 0, providersCount = 0, appointmentsCount = 0, servicesCount = 0;
            let activeServicesCount = 0, pendingServicesCount = 0, pendingVerificationsCount = 0;

            try {
                patientsCount = await Patient.countDocuments();
            } catch (error) {
                console.error("❌ Error counting patients:", error.message);
            }

            try {
                providersCount = await Provider.countDocuments();
            } catch (error) {
                console.error("❌ Error counting providers:", error.message);
            }

            try {
                appointmentsCount = await Appointment.countDocuments();
            } catch (error) {
                console.error("❌ Error counting appointments:", error.message);
            }

            try {
                servicesCount = await ServiceOffering.countDocuments();
            } catch (error) {
                console.error("❌ Error counting services:", error.message);
            }

            try {
                activeServicesCount = await ServiceOffering.countDocuments({ isActive: true });
            } catch (error) {
                console.error("❌ Error counting active services:", error.message);
            }

            try {
                pendingServicesCount = await ServiceOffering.countDocuments({ isActive: false });
            } catch (error) {
                console.error("❌ Error counting pending services:", error.message);
            }

            try {
                pendingVerificationsCount = await ProviderVerification.countDocuments({ status: "pending" });
            } catch (error) {
                console.error("❌ Error counting pending verifications:", error.message);
            }

            let recentAppointments = [], recentProviders = [], recentActivity = [], recentPatients = [];

            try {
                recentAppointments = await Appointment.find()
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .populate("patient")
                    .populate("provider");
            } catch (error) {
                console.error("❌ Error fetching recent appointments:", error.message);
            }

            try {
                recentProviders = await Provider.find()
                    .sort({ createdAt: -1 })
                    .limit(5);
            } catch (error) {
                console.error("❌ Error fetching recent providers:", error.message);
            }

            try {
                recentPatients = await Patient.find()
                    .select('firstName lastName email phone dateOfBirth gender isVerified createdAt')
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .lean();
            } catch (error) {
                console.error("❌ Error fetching recent patients:", error.message);
            }

            try {
                recentActivity = [
                    ...recentAppointments.map(a => ({
                        type: "appointment",
                        date: a.createdAt,
                        details: `Appointment with ${a.patient?.firstName || "Unknown"}`
                    })),
                    ...recentProviders.map(p => ({
                        type: "provider",
                        date: p.createdAt,
                        details: `New provider registered: ${p.firstName} ${p.lastName}`
                    }))
                ].sort((a, b) => b.date - a.date).slice(0, 5);
            } catch (error) {
                console.error("❌ Error preparing recent activity:", error.message);
            }

            const stats = {
                patients: patientsCount,
                providers: providersCount,
                appointments: appointmentsCount,
                services: servicesCount,
                activeServices: activeServicesCount,
                pendingServices: pendingServicesCount,
            };

            const changes = {
                patients: "0%",
                providers: "0%",
                appointments: "0%",
                services: "0%"
            };

            // Fetch admin notifications for header badge/dropdown
            let adminNotifications = [];
            let unreadAdminNotificationsCount = 0;
            try {
                adminNotifications = await Notification.find({
                    recipient: req.user?._id || req.user?.id,
                    recipientModel: 'Admin'
                }).sort({ createdAt: -1 }).limit(5).lean();

                unreadAdminNotificationsCount = await Notification.countDocuments({
                    recipient: req.user?._id || req.user?.id,
                    recipientModel: 'Admin',
                    isRead: false
                });
            } catch (notifErr) {
                adminNotifications = [];
                unreadAdminNotificationsCount = 0;
            }

            const templateData = {
                title: "Admin Dashboard",
                isAdminPage: true,
                currentPage: "admin/dashboard",

                totalUsers: patientsCount + providersCount,
                totalProviders: providersCount,
                totalPatients: patientsCount,
                totalServices: servicesCount,
                activeServices: activeServicesCount,
                pendingServices: pendingServicesCount,
                totalAppointments: appointmentsCount,
                pendingVerifications: pendingVerificationsCount,

                recentActivities: recentActivity.map(activity => {
                    try {
                        return {
                            ...activity,
                            user: {
                                firstName: activity.details && activity.details.includes('provider') ? 'Provider' : 'User',
                                lastName: ''
                            },
                            action: activity.details || 'Action performed',
                            timestamp: activity.date || new Date(),
                            type: activity.type || 'unknown'
                        };
                    } catch (error) {
                        console.error("❌ Error mapping activity:", error);
                        return {
                            user: { firstName: 'User', lastName: '' },
                            action: 'Action performed',
                            timestamp: new Date(),
                            type: 'unknown'
                        };
                    }
                }),
                recentProviders,
                recentAppointments,
                recentPatients,
                changes,
                user: req.user || null, // Handle case where no user is authenticated
                // Notifications for layout header
                notifications: adminNotifications,
                unreadNotificationsCount: unreadAdminNotificationsCount,

                stats: {
                    patients: patientsCount,
                    providers: providersCount,
                    appointments: appointmentsCount,
                    services: servicesCount,
                    activeServices: activeServicesCount,
                    pendingServices: pendingServicesCount,
                    pendingVerifications: pendingVerificationsCount
                },

                appointmentStatusStats: [],
                appointmentsByDay: [],
                pendingVerifications: []
            };

            res.render("admin/dashboard", templateData);
        } catch (error) {
            next(error);
        }
    };

    getPendingServices = async (req, res) => {
        try {
            const totalServices = await ServiceOffering.countDocuments();
            const pendingCount = await ServiceOffering.countDocuments({ approvalStatus: 'pending' });
            const approvedCount = await ServiceOffering.countDocuments({ approvalStatus: 'approved' });
            const rejectedCount = await ServiceOffering.countDocuments({ approvalStatus: 'rejected' });

            const pendingServices = await ServiceOffering.find({
                approvalStatus: 'pending'
            })
                .populate('provider', 'firstName lastName email phone specialization')
                .populate('category', 'name description')
                .sort({ createdAt: -1 });

            res.json({
                success: true,
                data: pendingServices,
                stats: {
                    total: totalServices,
                    pending: pendingCount,
                    approved: approvedCount,
                    rejected: rejectedCount
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error fetching pending services',
                error: error.message
            });
        }
    };

    approveService = async (req, res) => {
        try {
            const { id } = req.params;
            const { adminNotes } = req.body;


            // Try ServiceOffering first
            let updated = null;
            let providerIdForNotif = null;
            try {
                const offering = await ServiceOffering.findById(id);
                if (offering) {
                    if (offering.approvalStatus !== 'pending') {
                        return res.status(400).json({ success: false, message: 'Service is not pending approval' });
                    }
                    offering.approvalStatus = 'approved';
                    offering.isActive = true;
                    offering.approvalNotes = adminNotes || 'Approved by admin';
                    offering.approvedAt = new Date();
                    offering.approvedBy = req.user._id;
                    updated = await offering.save();
                    providerIdForNotif = offering.provider;
                }
            } catch { }

            // If not found as ServiceOffering, try DoctorService
            if (!updated) {
                const docService = await DoctorService.findById(id);
                if (!docService) {
                    return res.status(404).json({ success: false, message: 'Service not found' });
                }
                if (docService.approvalStatus !== 'pending') {
                    return res.status(400).json({ success: false, message: 'Service is not pending approval' });
                }
                docService.approvalStatus = 'approved';
                docService.isActive = true;
                docService.approvedAt = new Date();
                docService.approvedBy = req.user._id;
                updated = await docService.save();
                providerIdForNotif = docService.provider;
            }

            // Best-effort notification
            try {
                const NotificationService = require('../services/notificationService');
                await NotificationService.createNotification({
                    recipient: providerIdForNotif,
                    recipientModel: 'Provider',
                    sender: req.user._id,
                    senderModel: 'Admin',
                    type: 'service_approval',
                    title: 'Service Approved',
                    message: 'Your service has been approved and is now live on the platform.',
                    priority: 'high',
                    deliveryMethod: 'in_app',
                    relatedProvider: providerIdForNotif
                });
            } catch { }

            res.json({ success: true, message: 'Service approved successfully', data: updated });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error approving service',
                error: error.message
            });
        }
    };

    rejectService = async (req, res) => {
        try {
            const { id } = req.params;
            const { rejectionReason, adminNotes } = req.body;


            // Try ServiceOffering first
            let updated = null;
            let providerIdForNotif = null;
            try {
                const offering = await ServiceOffering.findById(id);
                if (offering) {
                    if (offering.approvalStatus !== 'pending') {
                        return res.status(400).json({ success: false, message: 'Service is not pending approval' });
                    }
                    offering.approvalStatus = 'rejected';
                    offering.isActive = false;
                    offering.approvalNotes = adminNotes || rejectionReason || 'Rejected by admin';
                    updated = await offering.save();
                    providerIdForNotif = offering.provider;
                }
            } catch { }

            // If not found as ServiceOffering, try DoctorService
            if (!updated) {
                const docService = await DoctorService.findById(id);
                if (!docService) {
                    return res.status(404).json({ success: false, message: 'Service not found' });
                }
                if (docService.approvalStatus !== 'pending') {
                    return res.status(400).json({ success: false, message: 'Service is not pending approval' });
                }
                docService.approvalStatus = 'rejected';
                docService.isActive = false;
                updated = await docService.save();
                providerIdForNotif = docService.provider;
            }

            // Best-effort notification
            try {
                const NotificationService = require('../services/notificationService');
                await NotificationService.createNotification({
                    recipient: providerIdForNotif,
                    recipientModel: 'Provider',
                    sender: req.user._id,
                    senderModel: 'Admin',
                    type: 'service_rejection',
                    title: 'Service Rejected',
                    message: 'Your service has been rejected. Check approval notes for details.',
                    priority: 'high',
                    deliveryMethod: 'in_app',
                    relatedProvider: providerIdForNotif
                });
            } catch { }

            res.json({ success: true, message: 'Service rejected successfully', data: updated });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error rejecting service',
                error: error.message
            });
        }
    };

    getServiceApprovalStats = async (req, res) => {
        try {

            const totalServices = await ServiceOffering.countDocuments();
            const pendingServices = await ServiceOffering.countDocuments({ approvalStatus: 'pending' });
            const approvedServices = await ServiceOffering.countDocuments({ approvalStatus: 'approved' });
            const rejectedServices = await ServiceOffering.countDocuments({ approvalStatus: 'rejected' });

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const approvedToday = await ServiceOffering.countDocuments({
                approvalStatus: 'approved',
                approvedAt: { $gte: today }
            });

            const rejectedToday = await ServiceOffering.countDocuments({
                approvalStatus: 'rejected',
                rejectedAt: { $gte: today }
            });


            res.json({
                success: true,
                data: {
                    total: totalServices,
                    pending: pendingServices,
                    approved: approvedServices,
                    rejected: rejectedServices,
                    approvedToday,
                    rejectedToday
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error fetching service approval statistics',
                error: error.message
            });
        }
    };

    // Toggle active status of a service category
    toggleServiceCategoryStatus = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { isActive } = req.body;
            const category = await ServiceCategory.findByIdAndUpdate(
                id,
                { isActive },
                { new: true, runValidators: true }
            );
            if (!category) {
                return res.status(404).json({ success: false, message: 'Category not found' });
            }
            res.status(200).json({ success: true, data: category });
        } catch (err) {
            next(err);
        }
    };

}

module.exports = new AdminController();