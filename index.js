require('dotenv').config({ path: './env.config' });

const express = require("express");
const path = require("path");
const morgan = require("morgan");
const connectDB = require("./app/config/db");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("passport");
const { PassportConfig } = require("./app/config/passport");
const flash = require("connect-flash");
const helmet = require("helmet");
const cors = require("cors");
const expressLayouts = require("express-ejs-layouts");
const { protect, restrictTo } = require("./app/middleware/authMiddleware");
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./app/config/swagger');

const app = express();
const PORT = process.env.PORT || 8000;

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/msp';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || 'msp';
const SESSION_SECRET = process.env.SESSION_SECRET || 'fallback-secret-key-change-in-production';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-jwt-secret-change-in-production';

try {
    connectDB();
} catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
}

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'", "https:", "http:", "data:", "blob:"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:", "http:"],
            scriptSrcAttr: ["'unsafe-inline'"],
            scriptSrcElem: ["'self'", "'unsafe-inline'", "https:", "http:"],
            styleSrc: ["'self'", "'unsafe-inline'", "https:", "http:"],
            styleSrcElem: ["'self'", "'unsafe-inline'", "https:", "http:"],
            styleSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "http:", "blob:"],
            connectSrc: ["'self'", "https:", "http:"],
            fontSrc: ["'self'", "https:", "http:", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "https:", "http:"],
            frameSrc: ["'self'", "https:", "http:"],
            workerSrc: ["'self'", "blob:"],
        },
    },
    crossOriginEmbedderPolicy: false
}));
app.use(cors());

// Configure morgan for logging
app.use(morgan('dev'));

// Serve static files
app.use(express.static('public'));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

// Serve static files with proper MIME types
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) {
            res.set('Content-Type', 'text/css');
        } else if (filePath.endsWith('.js')) {
            res.set('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
            res.set('Content-Type', 'image/jpeg');
        } else if (filePath.endsWith('.png')) {
            res.set('Content-Type', 'image/png');
        }
    }
}));

// Static file serving with proper MIME types
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path, stat) => {
        if (path.endsWith('.css')) {
            res.set('Content-Type', 'text/css');
        }
        if (path.endsWith('.js')) {
            res.set('Content-Type', 'application/javascript');
        }
    }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGO_URI,
        dbName: MONGO_DB_NAME,
        ttl: 24 * 60 * 60 // 1 day
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}));

const passportConfig = new PassportConfig();
passportConfig.initialize(app);

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user = req.user || null;
    res.locals.isDev = (process.env.NODE_ENV || 'development') !== 'production';
    res.locals.isAdminPage = req.path && req.path.startsWith('/admin');
    // Provide safe defaults for layout variables
    if (typeof res.locals.currentPage === 'undefined') {
        res.locals.currentPage = '';
    }
    next();
});

// app.use((req, res, next) => {
//     if (!req.url.startsWith('/css') && !req.url.startsWith('/js') && !req.url.startsWith('/uploads')) {
//         console.log(`📥 ${req.method} ${req.url}`);
//     }
//     next();
// });

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// EJS layouts
app.use(expressLayouts);
app.set('layout', 'layouts/main');

app.use(express.static(path.join(__dirname, "public")));

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'MSP API Documentation',
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true
    }
}));

// API Documentation redirect
app.get('/docs', (req, res) => {
    res.redirect('/api-docs');
});

// API Specification JSON endpoint
app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpecs);
});

// Direct profile handler (early) to avoid any routing order issues
app.get('/profile', (req, res) => {
    const role = ((req.user && (req.user.role || req.user.roleName)) || '').toLowerCase();
    if (!role) return res.redirect('/login');
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
    if (role === 'admin') return res.redirect('/admin/dashboard');
    return res.redirect('/login');
});

// Direct role-specific profile routes for robustness
app.get('/patient/profile', protect, restrictTo('patient'), (req, res) => {
    return res.render('patient/profile', {
        title: 'Patient Profile',
        user: req.user,
        currentPage: 'patient/profile'
    });
});

app.get('/provider/profile', protect, restrictTo('provider'), (req, res) => {
    return res.render('provider/profile', {
        title: 'Provider Profile',
        user: req.user,
        currentPage: 'provider/profile'
    });
});

// Global role-based guards
app.use("/admin", protect, restrictTo("admin"));
app.use("/api/admin", protect, restrictTo("admin"));
app.use("/provider", protect, restrictTo("provider"));
app.use("/patient", protect, restrictTo("patient"));
app.use("/api/provider", protect, restrictTo("provider"));
app.use("/api/patient", protect, restrictTo("patient"));

const apiRoutes = require("./app/routes/apiRoutes");
const viewRoutes = require("./app/routes/viewRoutes");
const providerRoutes = require("./app/routes/providerRoutes");
const patientRoutes = require("./app/routes/patientRoutes");
const authRoutes = require("./app/routes/authRoutes");
const adminRoutes = require("./app/routes/adminRoutes");

app.use("/api", apiRoutes);
app.use("/api/provider", providerRoutes);
app.use("/api/patient", patientRoutes);

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/provider", providerRoutes);
app.use("/patient", patientRoutes);
app.use("/", viewRoutes);

// Fallback unified profile route (ensures /profile works even if router cache not reloaded)
app.get('/profile', protect, (req, res) => {
    const role = ((req.user && (req.user.role || req.user.roleName)) || '').toLowerCase();
    if (role === 'provider') return res.redirect('/provider/profile');
    if (role === 'patient') return res.redirect('/patient/profile');
    if (role === 'admin') return res.redirect('/admin/dashboard');
    return res.redirect('/login');
});

app.use((req, res, next) => {
    const error = new Error(`Page Not Found: ${req.originalUrl}`);
    error.status = 404;
    next(error);
});

app.use((err, req, res, next) => {
    const statusCode = err.status || 500;


    res.status(statusCode);

    res.render("error", {
        title: statusCode === 404 ? "Page Not Found" : "Server Error",
        message: err.message || 'An unexpected error occurred',
        error: process.env.NODE_ENV === 'development' ? err : {},
        errorData: process.env.NODE_ENV === 'development' ? err : {},
        env: process.env.NODE_ENV || "development",
        statusCode: statusCode,
        currentPage: 'error',
        req: req,
        timestamp: new Date().toISOString(),
        showFullError: process.env.NODE_ENV === 'development' || process.env.SHOW_ERRORS === 'true'
    });
});

process.on('unhandledRejection', (reason, promise) => {
    try {
        console.error('Unhandled Promise Rejection:', reason);
    } catch { }
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    try {
        console.error('Uncaught Exception:', error && error.stack ? error.stack : error);
    } catch { }
    process.exit(1);
});

process.on('SIGTERM', () => {
    process.exit(0);
});

const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    // console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
    // console.log(`⏰ Started at: ${new Date().toISOString()}`);
});

server.on('error', (error) => {
    console.error('Server error:', error && error.stack ? error.stack : error);
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use.`);
        process.exit(1);
    } else {
        process.exit(1);
    }
});