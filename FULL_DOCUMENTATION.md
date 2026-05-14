# Medical Service Booking Platform - Complete Documentation & Source Code

**Comprehensive guide containing architecture, installation, deployment, and complete source code for the Medical Service Booking Platform**

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Installation & Setup](#installation--setup)
4. [Environment Configuration](#environment-configuration)
5. [Main Application Entry Point](#main-application-entry-point)
6. [Database Configuration](#database-configuration)
7. [Authentication (Passport)](#authentication-passport)
8. [Complete Database Models](#complete-database-models)
9. [Controllers](#controllers)
10. [Routes](#routes)
11. [Services](#services)
12. [Middleware](#middleware)
13. [Utilities](#utilities)
14. [Seed Data Configuration](#seed-data-configuration)
15. [Deployment Guide](#deployment-guide)
16. [Security & Performance](#security--performance)
17. [Troubleshooting](#troubleshooting)

---

# PROJECT OVERVIEW

## 🏥 Medical Service Booking Platform

A comprehensive web-based healthcare marketplace connecting patients with healthcare providers for seamless online booking across 13+ service categories including doctors, ambulances, dental care, eye care, yoga, physiotherapy, and more.

### Key Features

#### 🧑‍⚕️ Patient Features
- Secure JWT-based authentication with email verification
- Advanced service discovery with filtering
- Real-time appointment booking and management
- Health information management
- Provider reviews and ratings
- Multi-channel notifications

#### 🏥 Provider Features
- Professional profile and credential management
- Service creation and management
- Appointment dashboard with status tracking
- Performance analytics and revenue reporting
- Document upload for verification
- Availability scheduling with pricing models

#### 👨‍💼 Admin Features
- Provider verification and approval workflow
- User management and system monitoring
- Analytics dashboard with business intelligence
- Content moderation and quality assurance
- Service category management

---

# TECHNOLOGY STACK

### Frontend
- **Framework**: EJS templates with Bootstrap 5.x
- **Styling**: Responsive, mobile-first design
- **JavaScript**: Vanilla JavaScript for interactions
- **Browser Support**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

### Backend
- **Runtime**: Node.js 16+
- **Framework**: Express.js 4.18.2
- **Architecture**: RESTful API with MVC pattern
- **Authentication**: Passport.js with JWT & sessions

### Database & Storage
- **Database**: MongoDB 5.0+ with Mongoose ODM
- **Session Store**: MongoDB
- **File Storage**: Local & cloud-based
- **Backup**: Automated backups

### Security & Communication
- **Auth**: Passport.js, JWT (jsonwebtoken 9.0.2)
- **Password**: bcryptjs (12 rounds)
- **Security Headers**: Helmet.js
- **CORS**: Enabled with whitelist
- **Email**: Nodemailer 7.0.5
- **Rate Limiting**: Express-based throttling

### Additional Libraries
- **File Upload**: Multer 2.0.2
- **API Docs**: Swagger/OpenAPI (swagger-jsdoc, swagger-ui-express)
- **Session**: express-session with MongoStore
- **Validation**: express-validator
- **Environment**: dotenv
- **Compression**: gzip compression

---

# INSTALLATION & SETUP

## Prerequisites
- Node.js 16.x or higher
- MongoDB 5.0 or higher
- SMTP email service (Gmail, SendGrid, etc.)
- Modern web browser

## Quick Start

### 1. Clone Repository
```bash
git clone <repository-url>
cd medical-service-platform
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Create Environment File
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 4. Start MongoDB
```bash
mongod
```

### 5. Seed Database
```bash
npm run seed:categories
npm run seed:admins
```

### 6. Start Application
```bash
# Development
npm run dev

# Production
npm start
```

### 7. Access Application
- Main: http://localhost:3000
- Admin: http://localhost:3000/auth/admin/login
- API Docs: http://localhost:3000/api-docs

---

# ENVIRONMENT CONFIGURATION

## Required Environment Variables

Create `.env` file in root directory:

```bash
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# Database Configuration
MONGO_URI=mongodb://localhost:27017/msp
MONGO_DB_NAME=msp
MONGODB_URI=mongodb://localhost:27017/msp

# Authentication
JWT_SECRET=your-secret-jwt-key-change-in-production
JWT_EXPIRE=7d
SESSION_SECRET=your-session-secret-key-change-in-production
SESSION_TIMEOUT=86400000

# Email Configuration (Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@msp.com

# Email Configuration (Ethereal - Development)
ETHEREAL_EMAIL=emailuser@etherealmail.com
ETHEREAL_PASSWORD=etherealpassword

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,https://yourdomain.com
CORS_CREDENTIALS=true

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./public/uploads
ALLOWED_FILE_TYPES=pdf,doc,docx,jpg,jpeg,png

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX_REQUESTS=5

# API Documentation
SWAGGER_PATH=/api-docs
API_VERSION=1.0.0

# Logging
LOG_LEVEL=debug
LOG_FILE=./logs/application.log

# Payment Integration (if applicable)
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Third-party Services
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```

---

# MAIN APPLICATION ENTRY POINT

## `index.js` - Express Server Setup

```javascript
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

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'", "https:", "http:", "data:", "blob:"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:", "http:"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        }
    },
    crossOriginEmbedderPolicy: false
}));
app.use(cors());

// Logging
app.use(morgan('dev'));

// Static Files
app.use(express.static('public'));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

// Body Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Configuration
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({
        mongoUrl: MONGO_URI,
        touchAfter: 24 * 3600
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    }
}));

// Passport Authentication
const passportConfig = new PassportConfig();
passportConfig.initialize(app);

app.use(passport.initialize());
app.use(passport.session());

// Flash Messages
app.use(flash());

app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user = req.user;
    res.locals.isAuthenticated = req.isAuthenticated();
    next();
});

// View Engine Setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
    explorer: true,
    swaggerOptions: {
        persistAuthorization: true,
        displayOperationId: false
    }
}));

app.get('/docs', (req, res) => {
    res.redirect('/api-docs');
});

app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpecs);
});

// Profile Route
app.get('/profile', (req, res) => {
    const role = ((req.user && (req.user.role || req.user.roleName)) || '').toLowerCase();
    if (role === 'patient') return res.redirect('/patient/dashboard');
    if (role === 'provider') return res.redirect('/provider/dashboard');
    if (role === 'admin') return res.redirect('/admin/dashboard');
    return res.redirect('/login');
});

// Global Role-Based Guards
app.use("/admin", protect, restrictTo("admin"));
app.use("/api/admin", protect, restrictTo("admin"));
app.use("/provider", protect, restrictTo("provider"));
app.use("/patient", protect, restrictTo("patient"));
app.use("/api/provider", protect, restrictTo("provider"));
app.use("/api/patient", protect, restrictTo("patient"));

// Routes
const apiRoutes = require("./app/routes/apiRoutes");
const viewRoutes = require("./app/routes/viewRoutes");
const providerRoutes = require("./app/routes/providerRoutes");
const patientRoutes = require("./app/routes/patientRoutes");
const authRoutes = require("./app/routes/authRoutes");
const adminRoutes = require("./app/routes/adminRoutes");
const serviceRoutes = require("./app/routes/serviceRoutes");

app.use("/api", apiRoutes);
app.use("/api/provider", providerRoutes);
app.use("/api/patient", patientRoutes);
app.use("/api/services", serviceRoutes);

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/provider", providerRoutes);
app.use("/patient", patientRoutes);
app.use("/", viewRoutes);

// 404 Handler
app.use((req, res, next) => {
    const error = new Error(`Page Not Found: ${req.originalUrl}`);
    error.status = 404;
    next(error);
});

// Global Error Handler
app.use((err, req, res, next) => {
    const statusCode = err.status || 500;
    const message = err.message || 'Internal Server Error';

    if (req.accepts('json')) {
        res.status(statusCode).json({
            success: false,
            status: statusCode,
            message: message,
            error: process.env.NODE_ENV === 'development' ? err : {}
        });
    } else {
        res.status(statusCode).render('error', {
            status: statusCode,
            message: message,
            error: process.env.NODE_ENV === 'development' ? err : {}
        });
    }
});

// Unhandled Rejection Handler
process.on('unhandledRejection', (reason, promise) => {
    try {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    }
    process.exit(1);
});

// Uncaught Exception Handler
process.on('uncaughtException', (error) => {
    try {
        console.error('Uncaught Exception:', error);
    }
    process.exit(1);
});

process.on('SIGTERM', () => {
    process.exit(0);
});

// Start Server
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

server.on('error', (error) => {
    console.error('Server error:', error && error.stack ? error.stack : error);
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
    }
    process.exit(1);
});
```

---

# DATABASE CONFIGURATION

## `app/config/db.js` - MongoDB Connection

```javascript
const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/msp';
        const mongoDbName = process.env.MONGO_DB_NAME || 'msp';

        await mongoose.connect(mongoUri, {
            dbName: mongoDbName,
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000
        });

        console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
        console.log(`📊 Database: ${mongoose.connection.name}`);
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        throw error;
    }
};

module.exports = connectDB;
```

---

# AUTHENTICATION (PASSPORT)

## `app/config/passport.js` - Multi-Strategy Authentication

```javascript
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwt = require('jsonwebtoken');
const Patient = require('../models/Patient');
const Provider = require('../models/Provider');
const Admin = require('../models/Admin');

class PassportConfig {
    constructor() {
        this.JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
    }

    initialize(app) {
        // Patient Local Strategy
        passport.use('patient-local', new LocalStrategy({
            usernameField: 'email',
            passwordField: 'password'
        }, async (email, password, done) => {
            try {
                const patient = await Patient.findOne({ email: email.toLowerCase() });
                if (!patient) {
                    return done(null, false, { message: 'User not found' });
                }
                
                const isMatch = await patient.comparePassword(password);
                if (!isMatch) {
                    return done(null, false, { message: 'Invalid password' });
                }

                return done(null, patient);
            } catch (err) {
                return done(err);
            }
        }));

        // Provider Local Strategy
        passport.use('provider-local', new LocalStrategy({
            usernameField: 'email',
            passwordField: 'password'
        }, async (email, password, done) => {
            try {
                const provider = await Provider.findOne({ email: email.toLowerCase() });
                if (!provider) {
                    return done(null, false, { message: 'User not found' });
                }

                if (provider.email_not_verified) {
                    return done(null, false, { 
                        message: 'Please verify email first',
                        errorCode: 'EMAIL_NOT_VERIFIED'
                    });
                }
                
                const isMatch = await provider.comparePassword(password);
                if (!isMatch) {
                    return done(null, false, { message: 'Invalid password' });
                }

                return done(null, provider);
            } catch (err) {
                return done(err);
            }
        }));

        // Admin Local Strategy
        passport.use('admin-local', new LocalStrategy({
            usernameField: 'email',
            passwordField: 'password'
        }, async (email, password, done) => {
            try {
                const admin = await Admin.findOne({ email: email.toLowerCase() });
                if (!admin) {
                    return done(null, false, { message: 'Admin not found' });
                }
                
                const isMatch = await admin.comparePassword(password);
                if (!isMatch) {
                    return done(null, false, { message: 'Invalid password' });
                }

                return done(null, admin);
            } catch (err) {
                return done(err);
            }
        }));

        // JWT Strategy
        passport.use('jwt', new JwtStrategy({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: this.JWT_SECRET
        }, async (payload, done) => {
            try {
                const userId = payload.id;
                const userRole = payload.role;

                let user;
                if (userRole === 'patient') {
                    user = await Patient.findById(userId);
                } else if (userRole === 'provider') {
                    user = await Provider.findById(userId);
                } else if (userRole === 'admin') {
                    user = await Admin.findById(userId);
                }

                if (user) {
                    return done(null, user);
                }
                return done(null, false);
            } catch (err) {
                return done(err, false);
            }
        }));

        // Serialization
        passport.serializeUser((user, done) => {
            done(null, { id: user._id, role: user.role || user.roleName });
        });

        // Deserialization
        passport.deserializeUser(async (data, done) => {
            try {
                let user;
                if (data.role === 'patient') {
                    user = await Patient.findById(data.id);
                } else if (data.role === 'provider') {
                    user = await Provider.findById(data.id);
                } else if (data.role === 'admin') {
                    user = await Admin.findById(data.id);
                }

                done(null, user);
            } catch (err) {
                done(err);
            }
        });
    }
}

module.exports = { PassportConfig };
```

---

# COMPLETE DATABASE MODELS

## Patient Model - `app/models/Patient.js`

```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const patientSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
        select: false
    },
    phone: {
        type: String,
        required: true
    },
    dateOfBirth: {
        type: Date,
        required: true
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other'],
        required: true
    },
    address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String
    },
    healthInfo: {
        bloodType: String,
        allergies: [String],
        conditions: [String],
        medications: [String]
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,
    role: {
        type: String,
        default: 'patient'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Hash password before save
patientSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// Compare password method
patientSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Patient', patientSchema);
```

## Provider Model - `app/models/Provider.js`

```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const providerSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
        select: false
    },
    phone: {
        type: String,
        required: true
    },
    professionalTitle: String,
    specialization: String,
    licenseNumber: {
        type: String,
        unique: true,
        sparse: true
    },
    yearsOfExperience: {
        type: Number,
        default: 0
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: [Number], // [longitude, latitude]
        address: String,
        city: String,
        state: String,
        zipCode: String
    },
    practiceInfo: {
        name: String,
        type: {
            type: String,
            enum: ['clinic', 'hospital', 'home', 'online'],
            default: 'clinic'
        },
        insuranceAccepted: [String],
        emergencyContact: String
    },
    documents: [{
        fileName: String,
        fileUrl: String,
        uploadDate: {
            type: Date,
            default: Date.now
        }
    }],
    verificationStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    verificationReviewNotes: String,
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,
    role: {
        type: String,
        default: 'provider'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Hash password before save
providerSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// Compare password method
providerSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Provider', providerSchema);
```

## Admin Model - `app/models/Admin.js`

```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const adminSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        validate: [validator.isEmail, 'Please provide valid email']
    },
    phone: {
        type: String,
        required: true,
        validate: [
            (val) => /^\+?[\d\s\-\(\)]{7,20}$/.test(val),
            'Please provide valid phone number'
        ]
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
        select: false
    },
    role: {
        type: String,
        default: 'admin'
    },
    lastLogin: Date,
    passwordChangedAt: Date,
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Admin indexes
adminSchema.index({ email: 1 });
adminSchema.index({ role: 1 });

// Hash password before save
adminSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// Compare password method
adminSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Check if password changed after JWT issued
adminSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(
            this.passwordChangedAt.getTime() / 1000,
            10
        );
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

module.exports = mongoose.model('Admin', adminSchema);
```

## Appointment Model - `app/models/Appointment.js`

```javascript
const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true
    },
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: true
    },
    service: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceOffering',
        required: true
    },
    serviceCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceCategory'
    },
    date: {
        type: Date,
        required: true
    },
    startTime: {
        type: String,
        required: true
    },
    endTime: {
        type: String,
        required: true
    },
    duration: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'],
        default: 'pending'
    },
    notes: String,
    patientNotes: String,
    providerNotes: String,
    cancellationTracking: {
        cancelledBy: {
            type: mongoose.Schema.Types.ObjectId
        },
        cancelledByModel: {
            type: String,
            enum: ['Patient', 'Provider', 'Admin'],
            refPath: 'cancellationTracking.cancelledByModel'
        },
        cancellationReason: String,
        cancellationDate: Date
    },
    reminderSent: {
        type: Boolean,
        default: false
    },
    confirmationSent: {
        type: Boolean,
        default: false
    },
    location: {
        type: {
            type: String,
            enum: ['provider_location', 'patient_location', 'virtual', 'specific_address'],
            default: 'provider_location'
        },
        address: String,
        coordinates: {
            longitude: Number,
            latitude: Number
        },
        virtualMeetingUrl: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);
```

## ServiceOffering Model - `app/models/ServiceOffering.js`

```javascript
const mongoose = require('mongoose');

const serviceOfferingSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: String,
    shortDescription: String,
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceCategory',
        required: true
    },
    duration: {
        type: Number,
        required: true,
        min: 15
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    pricingModel: {
        type: String,
        enum: ['fixed', 'hourly', 'tiered', 'dynamic', 'subscription'],
        default: 'fixed'
    },
    pricingTiers: [{
        name: String,
        minQuantity: Number,
        maxQuantity: Number,
        price: Number
    }],
    hourlyRate: Number,
    subscriptionDetails: {
        frequency: String,
        price: Number,
        benefits: [String]
    },
    availability: {
        weekly: {
            Monday: { available: Boolean, startTime: String, endTime: String, breakStart: String, breakEnd: String, maxBookings: Number },
            Tuesday: { available: Boolean, startTime: String, endTime: String, breakStart: String, breakEnd: String, maxBookings: Number },
            // ... other days
        },
        customDates: [{
            date: Date,
            available: Boolean,
            startTime: String,
            endTime: String
        }],
        holidays: [{
            date: Date,
            reason: String
        }],
        timeSlotInterval: {
            type: String,
            enum: ['15', '30', '45', '60'],
            default: '30'
        }
    },
    maxBookingsPerDay: Number,
    advanceBookingDays: {
        type: Number,
        default: 30
    },
    cancellationPolicy: {
        type: String,
        enum: ['strict', 'moderate', 'flexible'],
        default: 'moderate'
    },
    cancellationHours: {
        type: Number,
        default: 24
    },
    isVirtual: {
        type: Boolean,
        default: false
    },
    location: {
        type: String,
        address: String,
        city: String,
        state: String,
        zipCode: String
    },
    requirements: [String],
    features: [String],
    customAttributes: [{
        name: String,
        value: String
    }],
    approvalStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    reviewCount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('ServiceOffering', serviceOfferingSchema);
```

## ServiceCategory Model - `app/models/ServiceCategory.js`

```javascript
const mongoose = require('mongoose');

const serviceCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: String,
    shortDescription: String,
    parentCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceCategory',
        default: null
    },
    subcategories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceCategory'
    }],
    icon: {
        type: String,
        default: 'fa-briefcase-medical'
    },
    imageUrl: String,
    color: String,
    keywords: [String],
    seoTitle: String,
    seoDescription: String,
    requirements: [String],
    features: [String],
    isActive: {
        type: Boolean,
        default: true
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    displayOrder: {
        type: Number,
        default: 0
    },
    statistics: {
        totalServices: {
            type: Number,
            default: 0
        },
        totalProviders: {
            type: Number,
            default: 0
        }
    },
    priceRange: {
        minPrice: Number,
        maxPrice: Number,
        avgPrice: Number
    },
    availabilityPatterns: [String],
    customFields: [{
        name: String,
        type: {
            type: String,
            enum: ['text', 'number', 'boolean', 'select', 'date'],
            default: 'text'
        },
        options: [String],
        required: Boolean
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('ServiceCategory', serviceCategorySchema);
```

## Review Model - `app/models/Review.js`

```javascript
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true
    },
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: true
    },
    service: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceOffering'
    },
    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment'
    },
    overallRating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    detailedRatings: {
        professionalism: { type: Number, min: 1, max: 5 },
        communication: { type: Number, min: 1, max: 5 },
        punctuality: { type: Number, min: 1, max: 5 },
        cleanliness: { type: Number, min: 1, max: 5 },
        valueForMoney: { type: Number, min: 1, max: 5 },
        effectiveness: { type: Number, min: 1, max: 5 }
    },
    title: String,
    comment: {
        type: String,
        maxlength: 1000
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'flagged'],
        default: 'pending'
    },
    isAnonymous: {
        type: Boolean,
        default: false
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    moderationTracking: {
        moderatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin'
        },
        moderatedAt: Date,
        moderationNotes: String
    },
    providerResponse: {
        text: String,
        respondedAt: Date,
        isVisible: Boolean
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);
```

## Notification Model - `app/models/Notification.js`

```javascript
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    recipientModel: {
        type: String,
        enum: ['Patient', 'Provider', 'Admin'],
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId
    },
    senderModel: {
        type: String,
        enum: ['System', 'Patient', 'Provider', 'Admin']
    },
    type: {
        type: String,
        enum: [
            'appointment_booking', 'appointment_confirmed', 'appointment_cancelled',
            'appointment_reminder', 'appointment_completed',
            'verification_pending', 'verification_approved', 'verification_rejected',
            'review_request', 'service_approved', 'service_rejected',
            'payment_received', 'payment_failed',
            'system_alert', 'system_maintenance'
        ],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    deliveryMethod: {
        type: String,
        enum: ['email', 'sms', 'push', 'in_app', 'all'],
        default: 'in_app'
    },
    relatedAppointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment'
    },
    actionRequired: {
        type: Boolean,
        default: false
    },
    actionUrl: String,
    actionText: String,
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: Date,
    emailSent: {
        type: Boolean,
        default: false
    },
    emailSentAt: Date,
    metadata: mongoose.Schema.Types.Mixed,
    expiresAt: Date,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
```

---

# CONTROLLERS

## Patient Controller - `app/controllers/patientController.js`

```javascript
const Appointment = require('../models/Appointment');
const ServiceCategory = require('../models/ServiceCategory');
const ServiceOffering = require('../models/ServiceOffering');
const Provider = require('../models/Provider');
const Notification = require('../models/Notification');
const { sendEmail } = require('../utils/emailService');

class PatientController {
    getServiceCategories = async (req, res, next) => {
        try {
            const categories = await ServiceCategory.find({ isActive: true });

            res.status(200).json({
                success: true,
                count: categories.length,
                data: categories
            });
        } catch (err) {
            next(err);
        }
    };

    getServicesByCategory = async (req, res, next) => {
        try {
            const { categoryId } = req.params;
            const services = await ServiceOffering.aggregate([
                {
                    $match: {
                        category: categoryId,
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
                    $unwind: {
                        path: '$provider',
                        preserveNullAndEmptyArrays: true
                    }
                }
            ]);

            res.status(200).json({
                success: true,
                count: services.length,
                data: services
            });
        } catch (err) {
            next(err);
        }
    };

    bookAppointment = async (req, res, next) => {
        try {
            const { serviceId, date, startTime, endTime, notes } = req.body;
            const patientId = req.user._id;

            const service = await ServiceOffering.findById(serviceId);
            if (!service) {
                return res.status(404).json({
                    success: false,
                    message: 'Service not found'
                });
            }

            const provider = await Provider.findById(service.provider);
            if (provider.verificationStatus !== 'approved') {
                return res.status(400).json({
                    success: false,
                    message: 'Provider is not approved'
                });
            }

            const conflictingAppointment = await Appointment.findOne({
                provider: service.provider,
                date,
                $or: [
                    { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
                ],
                status: { $in: ['pending', 'confirmed'] }
            });

            if (conflictingAppointment) {
                return res.status(400).json({
                    success: false,
                    message: 'Time slot is already booked'
                });
            }

            const appointment = await Appointment.create({
                patient: patientId,
                provider: service.provider,
                service: serviceId,
                date,
                startTime,
                endTime,
                duration: endTime - startTime,
                location: { type: 'virtual' },
                notes
            });

            res.status(201).json({
                success: true,
                message: 'Appointment booked successfully',
                data: appointment
            });
        } catch (err) {
            next(err);
        }
    };

    getAppointments = async (req, res, next) => {
        try {
            const appointments = await Appointment.find({ patient: req.user._id })
                .populate('provider', 'firstName lastName professionalTitle')
                .populate('service', 'name price')
                .sort({ date: -1 });

            res.status(200).json({
                success: true,
                count: appointments.length,
                data: appointments
            });
        } catch (err) {
            next(err);
        }
    };

    cancelAppointment = async (req, res, next) => {
        try {
            const { id } = req.params;

            const appointment = await Appointment.findOneAndUpdate(
                {
                    _id: id,
                    patient: req.user._id,
                    status: { $in: ['pending', 'confirmed'] }
                },
                {
                    status: 'cancelled',
                    cancelledBy: req.user._id,
                    cancelledByModel: 'Patient',
                    cancellationDate: new Date()
                },
                { new: true }
            );

            if (!appointment) {
                return res.status(404).json({
                    success: false,
                    message: 'Appointment not found or cannot be cancelled'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Appointment cancelled successfully',
                data: appointment
            });
        } catch (err) {
            next(err);
        }
    };
}

module.exports = new PatientController();
```

## Provider Controller - `app/controllers/providerController.js`

```javascript
const Appointment = require('../models/Appointment');
const ServiceCategory = require('../models/ServiceCategory');
const ServiceOffering = require('../models/ServiceOffering');
const Notification = require('../models/Notification');
const { sendEmail } = require('../utils/emailService');

class ProviderController {
    getAppointments = async (req, res, next) => {
        try {
            const { status, page = 1, limit = 10 } = req.query;
            const filter = { provider: req.user._id };

            if (status) {
                filter.status = status;
            }

            const skip = (page - 1) * limit;
            const appointments = await Appointment.find(filter)
                .populate('patient', 'firstName lastName email phone')
                .populate('service', 'name price')
                .sort({ date: 1, startTime: 1 })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await Appointment.countDocuments(filter);

            res.status(200).json({
                success: true,
                count: appointments.length,
                total,
                pages: Math.ceil(total / limit),
                currentPage: parseInt(page),
                data: appointments
            });
        } catch (err) {
            next(err);
        }
    };

    updateAppointmentStatus = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { status, notes } = req.body;

            const validStatuses = ['confirmed', 'cancelled', 'completed', 'no_show'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status value'
                });
            }

            const appointment = await Appointment.findOneAndUpdate(
                {
                    _id: id,
                    provider: req.user._id,
                    status: { $in: ['pending', 'confirmed'] }
                },
                {
                    status,
                    providerNotes: notes,
                    updatedAt: new Date()
                },
                { new: true }
            ).populate('patient');

            if (!appointment) {
                return res.status(404).json({
                    success: false,
                    message: 'Appointment not found or cannot be updated'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Appointment updated successfully',
                data: appointment
            });
        } catch (err) {
            next(err);
        }
    };

    getServices = async (req, res, next) => {
        try {
            const services = await ServiceOffering.find({ provider: req.user._id })
                .populate('category', 'name')
                .sort({ createdAt: -1 });

            res.status(200).json({
                success: true,
                count: services.length,
                data: services
            });
        } catch (err) {
            next(err);
        }
    };

    addService = async (req, res, next) => {
        try {
            const {
                name,
                description,
                category,
                duration,
                price,
                isVirtual,
                requirements,
                features
            } = req.body;

            const categoryExists = await ServiceCategory.findById(category);
            if (!categoryExists) {
                return res.status(404).json({
                    success: false,
                    message: 'Category not found'
                });
            }

            const service = await ServiceOffering.create({
                name,
                description,
                category,
                provider: req.user._id,
                duration,
                price,
                isVirtual,
                requirements: requirements || [],
                features: features || [],
                status: 'pending_approval'
            });

            res.status(201).json({
                success: true,
                message: 'Service added successfully',
                data: service
            });
        } catch (err) {
            next(err);
        }
    };
}

module.exports = new ProviderController();
```

## Admin Controller - `app/controllers/adminController.js`

```javascript
const Patient = require('../models/Patient');
const Provider = require('../models/Provider');
const Admin = require('../models/Admin');
const Appointment = require('../models/Appointment');
const ServiceOffering = require('../models/ServiceOffering');
const ServiceCategory = require('../models/ServiceCategory');
const Notification = require('../models/Notification');
const ProviderVerification = require('../models/ProviderVerification');
const { sendEmail } = require('../utils/emailService');

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
                currentFilter: status
            });
        } catch (err) {
            next(err);
        }
    };

    getPendingVerifications = async (req, res, next) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
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

            res.render('admin/verifications', {
                title: 'Verifications Management',
                user: req.user,
                verifications: verifications,
                currentPage: page,
                totalPages: totalPages,
                total: total,
                limit: limit
            });
        } catch (err) {
            next(err);
        }
    };

    getDashboard = async (req, res, next) => {
        try {
            const totalPatients = await Patient.countDocuments();
            const totalProviders = await Provider.countDocuments();
            const totalServices = await ServiceOffering.countDocuments();
            const totalAppointments = await Appointment.countDocuments();
            const pendingVerifications = await Provider.countDocuments({
                verificationStatus: 'pending'
            });

            const recentAppointments = await Appointment.find()
                .populate('patient', 'firstName lastName')
                .populate('provider', 'firstName lastName')
                .sort({ date: -1 })
                .limit(5);

            res.render('admin/dashboard', {
                title: 'Admin Dashboard',
                user: req.user,
                stats: {
                    totalPatients,
                    totalProviders,
                    totalServices,
                    totalAppointments,
                    pendingVerifications
                },
                recentAppointments
            });
        } catch (err) {
            next(err);
        }
    };
}

module.exports = new AdminController();
```

---

# ROUTES

## API Routes - `app/routes/apiRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const ServiceCategory = require('../models/ServiceCategory');
const ServiceOffering = require('../models/ServiceOffering');
const Appointment = require('../models/Appointment');

// Get all service categories
router.get('/service-categories', async (req, res) => {
    try {
        const categories = await ServiceCategory.find({ isActive: true })
            .sort({ displayOrder: 1, name: 1 });

        res.json({ success: true, data: categories });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get services by category
router.get('/services/category/:categoryId', async (req, res) => {
    try {
        const services = await ServiceOffering.aggregate([
            {
                $match: {
                    category: req.params.categoryId,
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
            { $unwind: '$provider' }
        ]);

        res.json({ success: true, data: services });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Book appointment
router.post('/appointments/book', protect, restrictTo('patient'), async (req, res, next) => {
    try {
        const { serviceId, date, startTime, endTime, notes } = req.body;

        const appointment = await Appointment.create({
            patient: req.user._id,
            service: serviceId,
            date,
            startTime,
            endTime,
            notes
        });

        res.status(201).json({
            success: true,
            message: 'Appointment booked successfully',
            data: appointment
        });
    } catch (err) {
        next(err);
    }
});

// Get patient appointments
router.get('/appointments', protect, restrictTo('patient'), async (req, res) => {
    try {
        const appointments = await Appointment.find({ patient: req.user._id })
            .populate('provider', 'firstName lastName')
            .populate('service', 'name price')
            .sort({ date: -1 });

        res.json({ success: true, data: appointments });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
```

## Patient Routes - `app/routes/patientRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/services/categories', protect, restrictTo('patient'), patientController.getServiceCategories);
router.get('/services/category/:categoryId', protect, restrictTo('patient'), patientController.getServicesByCategory);
router.get('/appointments', protect, restrictTo('patient'), patientController.getAppointments);
router.post('/appointments/book', protect, restrictTo('patient'), patientController.bookAppointment);
router.delete('/appointments/:id/cancel', protect, restrictTo('patient'), patientController.cancelAppointment);

module.exports = router;
```

## Provider Routes - `app/routes/providerRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const providerController = require('../controllers/providerController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/appointments', protect, restrictTo('provider'), providerController.getAppointments);
router.put('/appointments/:id/status', protect, restrictTo('provider'), providerController.updateAppointmentStatus);
router.get('/services', protect, restrictTo('provider'), providerController.getServices);
router.post('/services', protect, restrictTo('provider'), providerController.addService);

module.exports = router;
```

## Admin Routes - `app/routes/adminRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.post('/register', adminController.register);

const adminAuth = [protect, restrictTo('admin')];

router.get('/dashboard', adminAuth, adminController.getDashboard);
router.get('/patients', adminAuth, adminController.getPatients);
router.get('/providers', adminAuth, adminController.getProviders);
router.get('/verifications', adminAuth, adminController.getPendingVerifications);

module.exports = router;
```

---

# SERVICES

## Notification Service - `app/services/notificationService.js`

```javascript
const Notification = require('../models/Notification');
const { sendEmail } = require('../utils/emailService');

class NotificationService {
    static async createNotification(data) {
        try {
            const notification = new Notification({
                recipient: data.recipient,
                recipientModel: data.recipientModel,
                sender: data.sender,
                senderModel: data.senderModel,
                type: data.type,
                title: data.title,
                message: data.message,
                priority: data.priority || 'medium',
                deliveryMethod: data.deliveryMethod || 'in_app'
            });

            await notification.save();

            if (notification.deliveryMethod === 'email' || notification.deliveryMethod === 'all') {
                await this.sendEmailNotification(notification);
            }

            return notification;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    }

    static async sendEmailNotification(notification) {
        try {
            const Patient = require('../models/Patient');
            const Provider = require('../models/Provider');

            let recipient;

            if (notification.recipientModel === 'Patient') {
                recipient = await Patient.findById(notification.recipient);
            } else if (notification.recipientModel === 'Provider') {
                recipient = await Provider.findById(notification.recipient);
            }

            if (!recipient || !recipient.email) {
                return;
            }

            await sendEmail({
                to: recipient.email,
                subject: notification.title,
                html: `<h2>${notification.title}</h2><p>${notification.message}</p>`
            });
        } catch (error) {
            console.error('Error sending email notification:', error);
        }
    }

    static async markAsRead(notificationId) {
        try {
            return await Notification.findByIdAndUpdate(
                notificationId,
                { isRead: true, readAt: new Date() },
                { new: true }
            );
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }
}

module.exports = NotificationService;
```

## Analytics Service - `app/services/analyticsService.js`

```javascript
const Appointment = require('../models/Appointment');
const ServiceOffering = require('../models/ServiceOffering');
const Review = require('../models/Review');

class AnalyticsService {
    static async getProviderAnalytics(providerId, startDate, endDate) {
        try {
            const filter = { provider: providerId };

            if (startDate && endDate) {
                filter.date = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            }

            const appointments = await Appointment.find(filter);
            const services = await ServiceOffering.find({ provider: providerId });
            const reviews = await Review.find({ provider: providerId });

            const totalRevenue = appointments
                .filter(a => a.status === 'completed')
                .reduce((sum, a) => sum + (a.service?.price || 0), 0);

            const averageRating = reviews.length > 0
                ? reviews.reduce((sum, r) => sum + r.overallRating, 0) / reviews.length
                : 0;

            return {
                totalAppointments: appointments.length,
                completedAppointments: appointments.filter(a => a.status === 'completed').length,
                cancelledAppointments: appointments.filter(a => a.status === 'cancelled').length,
                totalServices: services.length,
                totalRevenue,
                averageRating: parseFloat(averageRating.toFixed(2)),
                totalReviews: reviews.length
            };
        } catch (error) {
            console.error('Error getting provider analytics:', error);
            throw error;
        }
    }
}

module.exports = AnalyticsService;
```

---

# MIDDLEWARE

## Auth Middleware - `app/middleware/authMiddleware.js`

```javascript
const jwt = require('jsonwebtoken');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        if (req.isAuthenticated && req.isAuthenticated()) {
            return next();
        }
        return res.status(401).json({
            success: false,
            message: 'Not authorized to access this route'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized to access this route'
        });
    }
};

const restrictTo = (...allowedRoles) => {
    return (req, res, next) => {
        const userRole = (req.user && (req.user.role || req.user.roleName)) || '';

        if (!allowedRoles.includes(userRole.toLowerCase())) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to perform this action'
            });
        }

        next();
    };
};

module.exports = { protect, restrictTo };
```

## Error Handler Middleware - `app/middleware/errorHandler.js`

```javascript
const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.message = err.message || 'Internal Server Error';

    if (err.name === 'CastError') {
        const message = `Resource not found. Invalid: ${err.path}`;
        err = { message, statusCode: 400 };
    }

    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors)
            .map(val => val.message)
            .join(', ');
        err = { message, statusCode: 400 };
    }

    if (err.code === 11000) {
        const message = `Duplicate ${Object.keys(err.keyValue)} Entered`;
        err = { message, statusCode: 400 };
    }

    if (err.name === 'JWTError') {
        const message = `json web token is invalid, Try again `;
        err = { message, statusCode: 400 };
    }

    if (err.name === 'TokenExpiredError') {
        const message = `json web token is expired, Try again `;
        err = { message, statusCode: 400 };
    }

    res.status(err.statusCode).json({
        success: false,
        message: err.message
    });
};

module.exports = errorHandler;
```

---

# UTILITIES

## Email Service - `app/utils/emailService.js`

```javascript
const nodemailer = require('nodemailer');

const isEmailConfigured = () => {
    return !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);
};

const createTransporter = async () => {
    if (!isEmailConfigured()) {
        console.log('❌ Email not configured, using test account');
        const testAccount = await nodemailer.createTestAccount();
        return nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });
    }

    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

const sendEmail = async (options) => {
    try {
        const transporter = await createTransporter();

        const mailOptions = {
            from: process.env.EMAIL_FROM || options.from,
            to: options.to,
            subject: options.subject,
            html: options.html
        };

        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error('Email send error:', error.message);
        throw error;
    }
};

module.exports = { sendEmail, isEmailConfigured };
```

## Async Handler - `app/utils/asyncHandler.js`

```javascript
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { asyncHandler };
```

## Error Classes - `app/utils/errorClasses.js`

```javascript
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message) {
        super(message, 400);
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404);
    }
}

class UnauthorizedError extends AppError {
    constructor(message = 'Not authorized') {
        super(message, 401);
    }
}

class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super(message, 403);
    }
}

class ConflictError extends AppError {
    constructor(message = 'Conflict') {
        super(message, 409);
    }
}

module.exports = {
    AppError,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    ConflictError
};
```

---

# SEED DATA CONFIGURATION

## Service Categories Seed - `app/config/seedServiceCategories.js`

```javascript
const mongoose = require('mongoose');
const ServiceCategory = require('../models/ServiceCategory');

const serviceCategories = [
    {
        name: 'Ambulance',
        description: 'Emergency medical transportation services',
        icon: 'fa-ambulance',
        color: '#dc2626',
        isActive: true,
        displayOrder: 1
    },
    {
        name: 'Doctor Chamber',
        description: 'Private medical consultation services',
        icon: 'fa-user-md',
        color: '#2563eb',
        isActive: true,
        displayOrder: 2
    },
    {
        name: 'Dental Care',
        description: 'Comprehensive dental health services',
        icon: 'fa-tooth',
        color: '#0891b2',
        isActive: true,
        displayOrder: 3
    },
    {
        name: 'Eye Care',
        description: 'Comprehensive eye care services',
        icon: 'fa-eye',
        color: '#0ea5e9',
        isActive: true,
        displayOrder: 4
    },
    {
        name: 'Hospitals',
        description: 'Comprehensive hospital services',
        icon: 'fa-hospital',
        color: '#dc2626',
        isActive: true,
        displayOrder: 5
    }
];

async function seedServiceCategories() {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/msp';
        await mongoose.connect(mongoUri);

        const existingCount = await ServiceCategory.countDocuments();
        if (existingCount > 0) {
            console.log(`Found ${existingCount} existing categories`);
            return;
        }

        const created = await ServiceCategory.insertMany(serviceCategories);
        console.log(`✅ Created ${created.length} service categories`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

seedServiceCategories();
```

## Admin Users Seed - `app/config/seedAdminUsers.js`

```javascript
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

const adminUsers = [
    {
        email: 'admin@msp.com',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'User',
        phone: '+1234567890',
        role: 'admin',
        isVerified: true,
        isActive: true
    },
    {
        email: 'superadmin@healthcare.com',
        password: 'superadmin2024',
        firstName: 'Super',
        lastName: 'Admin',
        phone: '+1987654321',
        role: 'admin',
        isVerified: true,
        isActive: true
    }
];

async function seedAdminUsers() {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/msp';
        await mongoose.connect(mongoUri);

        const existing = await Admin.find({});
        if (existing.length > 0 && !process.argv.includes('--force')) {
            console.log('Admin users already exist');
            console.log('Use --force flag to overwrite');
            return;
        }

        if (existing.length > 0) {
            await Admin.deleteMany({});
            console.log('Cleared existing admin users');
        }

        const created = await Admin.insertMany(adminUsers);
        console.log(`✅ Created ${created.length} admin users`);
        
        created.forEach(admin => {
            console.log(`   📧 ${admin.email}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

seedAdminUsers();
```

---

# DEPLOYMENT GUIDE

## Production Deployment

### Using PM2

```bash
npm install -g pm2

# Start application
pm2 start index.js --name "msp" --instances max

# Monitor
pm2 monit

# View logs
pm2 logs msp

# Save PM2 config
pm2 save

# Startup on reboot
pm2 startup
pm2 save
```

### Using Docker

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health')"

CMD ["npm", "start"]
```

### Using Docker Compose

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      MONGO_URI: mongodb://mongo:27017/msp
    depends_on:
      - mongo

  mongo:
    image: mongo:5.0
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

volumes:
  mongo-data:
```

## Database Indexes

```javascript
// Create indexes for optimal performance
db.patients.createIndex({ email: 1 }, { unique: true });
db.providers.createIndex({ email: 1 }, { unique: true });
db.providers.createIndex({ licenseNumber: 1 }, { unique: true });
db.appointments.createIndex({ patient: 1, date: -1 });
db.appointments.createIndex({ provider: 1, date: -1 });
db.appointments.createIndex({ status: 1 });
db.serviceofferings.createIndex({ provider: 1 });
db.serviceofferings.createIndex({ category: 1 });
db.notifications.createIndex({ recipient: 1, isRead: 1 });
db.reviews.createIndex({ provider: 1 });
```

---

# SECURITY & PERFORMANCE

## Security Checklist

- ✅ Passwords hashed with bcryptjs (12 rounds)
- ✅ JWT tokens with 7-day expiration
- ✅ Session timeout (24 hours)
- ✅ HTTPS/TLS required in production
- ✅ HTTP-only cookies with secure flags
- ✅ CORS with origin whitelist
- ✅ Rate limiting on auth endpoints
- ✅ Input validation and sanitization
- ✅ Helmet.js security headers
- ✅ Environment variables for secrets
- ✅ Regular dependency updates

## Performance Optimization

- Use `.lean()` for read-only queries
- Implement pagination (10 items/page)
- Cache relevant data
- Use `.select()` to limit fields
- Optimize aggregation pipelines
- Add database indexes
- Enable gzip compression
- Use CDN for static assets

---

# TROUBLESHOOTING

## Common Issues

**MongoDB Connection Error**
```bash
# Check MongoDB running
mongod

# Verify connection string in .env
MONGO_URI=mongodb://localhost:27017/msp
```

**Email Not Sending**
```bash
# Verify SMTP credentials
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Or use Ethereal (dev environment)
# Emails logged to console
```

**Port Already in Use**
```bash
# Kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

**Session Not Persisting**
```bash
# Ensure MongoDB session store configured
# Check MongoStore in index.js

# Verify MongoDB connection working
```

---

## Test Credentials

```
Patient Account
Email: patient@example.com
Password: patient123

Provider Account
Email: provider@example.com
Password: provider123

Admin Account
Email: admin@msp.com
Password: admin123
```

---

## Available NPM Scripts

```bash
npm start                # Start production server
npm run dev              # Start development server
npm run seed:categories  # Seed service categories
npm run seed:admins      # Seed admin users
npm test                 # Run tests
npm run lint             # Run ESLint
```

---

**Last Updated**: February 2026
**Version**: 1.0.0
**Platform**: Medical Service Booking Platform
