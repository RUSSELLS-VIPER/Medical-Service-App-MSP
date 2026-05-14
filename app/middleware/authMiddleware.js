
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const Patient = require('../models/Patient');
const Provider = require('../models/Provider');
const Admin = require('../models/Admin');

exports.protect = async (req, res, next) => {
    try {

        if (req.isAuthenticated && req.isAuthenticated() && req.user) {
            return next();
        }

        if (req.user && req.session && req.session.userRole) {
            return next();
        }

        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
            console.log('🔍 Auth middleware: Token found in Authorization header');
        } else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
            console.log('🔍 Auth middleware: Token found in cookie');
        } else if (req.query && req.query.token) {
            token = req.query.token;
            console.log('🔍 Auth middleware: Token found in query');
        }

        if (!token) {
            console.log('❌ Auth middleware: No token found and no session user');
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(401).json({
                    success: false,
                    message: 'Please log in to access this resource'
                });
            }
            return res.status(401).render('error', {
                title: 'Unauthorized',
                message: 'Please log in to access this page',
                statusCode: 401,
                user: null,
                env: process.env.NODE_ENV || 'development',
                showFullError: process.env.NODE_ENV === 'development' || process.env.SHOW_ERRORS === 'true'
            });
        }


        try {
            const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

            let user;
            let roleName = decoded.role;

            switch (roleName) {
                case 'patient':
                    user = await Patient.findById(decoded.id);
                    if (user) user.roleName = 'patient';
                    break;
                case 'provider':
                    user = await Provider.findById(decoded.id);
                    if (user) user.roleName = 'provider';
                    break;
                case 'admin':
                    user = await Admin.findById(decoded.id);
                    if (user) user.roleName = 'admin';
                    break;
                default:
                    break;
            }

            if (!user) {
                if (req.xhr || req.headers.accept?.includes('application/json')) {
                    return res.status(401).json({
                        success: false,
                        message: 'User no longer exists'
                    });
                }
                return res.status(401).render('error', {
                    title: 'Unauthorized',
                    message: 'User no longer exists',
                    statusCode: 401,
                    user: null,
                    env: process.env.NODE_ENV || 'development',
                    showFullError: process.env.NODE_ENV === 'development' || process.env.SHOW_ERRORS === 'true'
                });
            }


            if (!user.roleName) {
                user.roleName = roleName || 'patient'; // default to patient if not set
            }

            req.user = user;

            // Create session for future requests
            if (req.login) {
                req.login(user, (err) => {
                    if (err) {
                        console.error('❌ Auth middleware: Session creation error:', err);
                        return next(err);
                    }

                    console.log('✅ Auth middleware: Session created successfully');
                    next();
                });
            } else {
                // If req.login is not available, just proceed
                console.log('⚠️ Auth middleware: req.login not available, proceeding without session');
                next();
            }

        } catch (err) {
            console.error('❌ Auth middleware: Token verification error:', err);
            let message = 'Not authorized to access this resource';
            if (err.name === 'JsonWebTokenError') {
                message = 'Invalid token - please log in again';
            } else if (err.name === 'TokenExpiredError') {
                message = 'Your session has expired - please log in again';
            }

            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(401).json({
                    success: false,
                    message
                });
            }
            return res.status(401).render('error', {
                title: 'Unauthorized',
                message,
                statusCode: 401,
                user: null,
                env: process.env.NODE_ENV || 'development',
                showFullError: process.env.NODE_ENV === 'development' || process.env.SHOW_ERRORS === 'true'
            });
        }
    } catch (err) {
        console.error('❌ Auth middleware: General error:', err);
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(500).json({
                success: false,
                message: 'Authentication error'
            });
        }
        return res.status(500).render('error', {
            title: 'Server Error',
            message: 'We are working to fix this. Please try again later.',
            statusCode: 500,
            user: null,
            env: process.env.NODE_ENV || 'development',
            showFullError: process.env.NODE_ENV === 'development' || process.env.SHOW_ERRORS === 'true'
        });
    }
};

exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(401).json({
                    success: false,
                    message: 'Please log in to access this resource'
                });
            }
            return res.status(401).render('error', {
                title: 'Unauthorized',
                message: 'Please log in to access this page',
                statusCode: 401,
                user: null,
                env: process.env.NODE_ENV || 'development',
                showFullError: process.env.NODE_ENV === 'development' || process.env.SHOW_ERRORS === 'true'
            });
        }

        let userRole;

        if (req.user.roleName) {
            userRole = req.user.roleName;
        }
        else if (typeof req.user.role === 'string') {
            userRole = req.user.role;
        }
        else if (req.user.role && typeof req.user.role === 'object' && req.user.role.name) {
            userRole = req.user.role.name;
        }
        else if (req.session && req.session.userRole) {
            userRole = req.session.userRole;
        }
        else {
            userRole = 'unknown';
        }


        if (!roles.includes(userRole)) {
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to access this resource'
                });
            }
            return res.status(403).render('error', {
                title: 'Forbidden',
                message: 'You do not have permission to access this page',
                statusCode: 403,
                user: req.user,
                env: process.env.NODE_ENV || 'development',
                showFullError: process.env.NODE_ENV === 'development' || process.env.SHOW_ERRORS === 'true'
            });
        }

        next();
    };
};