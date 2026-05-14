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
        if (!process.env.JWT_SECRET) {
            console.error('❌ JWT_SECRET environment variable is not set!');
            throw new Error('JWT_SECRET environment variable is required');
        }

        this.jwtOptions = {
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: process.env.JWT_SECRET
        };

        this.initializeStrategies();
    }

    initializeStrategies() {
        this._initializeLocalStrategies();
        this._initializeJwtStrategy();
        this._initializeSerialization();
    }

    _initializeLocalStrategies() {
        passport.use('patient-local', new LocalStrategy({
            usernameField: 'email',
            passwordField: 'password',
            passReqToCallback: true
        }, async (req, email, password, done) => {
            try {
                const patient = await Patient.findOne({
                    email: email.toLowerCase().trim()
                }).select('+password');

                if (!patient) {
                    return done(null, false, { message: 'Invalid email or password' });
                }

                const isMatch = await patient.comparePassword(password);

                if (!isMatch) {
                    return done(null, false, { message: 'Invalid email or password' });
                }
                const patientObj = patient.toObject();
                delete patientObj.password;
                patientObj.role = 'patient';

                return done(null, patientObj);
            } catch (err) {
                return done(err);
            }
        }));

        passport.use('provider-local', new LocalStrategy({
            usernameField: 'email',
            passwordField: 'password',
            passReqToCallback: true
        }, async (req, email, password, done) => {
            try {
                const provider = await Provider.findOne({
                    email: email.toLowerCase().trim()
                }).select('+password');

                if (!provider) {
                    return done(null, false, { message: 'Invalid email or password' });
                }

                const isMatch = await provider.comparePassword(password);
                if (!isMatch) {
                    return done(null, false, { message: 'Invalid email or password' });
                }

                if (!provider.isVerified) {
                    return done(null, false, {
                        message: 'Please verify your email first',
                        errorCode: 'EMAIL_NOT_VERIFIED'
                    });
                }

                const providerObj = provider.toObject();
                delete providerObj.password;
                providerObj.role = 'provider';

                return done(null, providerObj);
            } catch (err) {
                return done(err);
            }
        }));

        passport.use('admin-local', new LocalStrategy({
            usernameField: 'email',
            passwordField: 'password',
            passReqToCallback: true
        }, async (req, email, password, done) => {
            try {
                const admin = await Admin.findOne({
                    email: email.toLowerCase().trim()
                }).select('+password');

                if (!admin) {
                    return done(null, false, { message: 'Invalid email or password' });
                }

                const isMatch = await admin.comparePassword(password);
                if (!isMatch) {
                    return done(null, false, { message: 'Invalid email or password' });
                }

                const adminObj = admin.toObject();
                delete adminObj.password;
                adminObj.role = 'admin';

                return done(null, adminObj);
            } catch (err) {
                return done(err);
            }
        }));
    }

    _initializeJwtStrategy() {
        passport.use('jwt', new JwtStrategy(this.jwtOptions, async (payload, done) => {
            try {
                let user;

                switch (payload.role) {
                    case 'patient':
                        user = await Patient.findById(payload.id);
                        break;
                    case 'provider':
                        user = await Provider.findById(payload.id);
                        break;
                    case 'admin':
                        user = await Admin.findById(payload.id);
                        break;
                    default:
                        return done(null, false);
                }

                if (!user) {
                    return done(null, false, { message: 'User not found' });
                }

                const userObj = user.toObject();
                userObj.role = payload.role;

                return done(null, userObj);
            } catch (err) {
                return done(err, false);
            }
        }));
    }

    _initializeSerialization() {
        passport.serializeUser((user, done) => {
            done(null, {
                id: user._id || user.id,
                role: user.role
            });
        });

        passport.deserializeUser(async (obj, done) => {
            try {
                let user;

                switch (obj.role) {
                    case 'patient':
                        user = await Patient.findById(obj.id);
                        break;
                    case 'provider':
                        user = await Provider.findById(obj.id);
                        break;
                    case 'admin':
                        user = await Admin.findById(obj.id);
                        break;
                    default:
                        return done(new Error('Invalid user role'));
                }

                if (!user) {
                    return done(new Error('User not found'));
                }

                const userObj = user.toObject();
                userObj.role = obj.role;

                done(null, userObj);
            } catch (err) {
                done(err);
            }
        });
    }

    static generateToken(user) {
        return jwt.sign(
            {
                id: user._id || user.id,
                role: user.role,
                email: user.email
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
    }

    initialize(app) {
        app.use(passport.initialize());
        app.use(passport.session());
        return this;
    }
}

module.exports = {
    passport,
    PassportConfig,
    generateToken: PassportConfig.generateToken
};
