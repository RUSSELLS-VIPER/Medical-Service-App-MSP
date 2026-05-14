const nodemailer = require('nodemailer');

// Check if email configuration is available
const isEmailConfigured = () => {
    return process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS;
};

// Create transporter with fallback for development
const createTransporter = () => {
    if (!isEmailConfigured()) {
        console.warn('⚠️  Email configuration not found. Using development fallback.');

        // For development, create a test account or use a mock transporter
        if (process.env.NODE_ENV === 'development') {
            // Use ethereal email for testing in development
            return nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: 'test@ethereal.email',
                    pass: 'test123'
                }
            });
        }

        throw new Error('Email configuration is required. Please set EMAIL_HOST, EMAIL_USER, and EMAIL_PASS environment variables.');
    }

    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

exports.sendEmail = async (options) => {
    if (!options.to) {
        throw new Error('No recipient specified');
    }

    if (typeof options.to !== 'string' || !options.to.includes('@')) {
        throw new Error('Invalid recipient email format');
    }

    if (!options.subject) {
        throw new Error('Email subject is required');
    }

    if (!options.html) {
        throw new Error('Email content is required');
    }

    const mailOptions = {
        from: process.env.EMAIL_FROM || 'no-reply@yourdomain.com',
        to: options.to,
        subject: options.subject,
        html: options.html
    };

    try {
        const transporter = createTransporter();
        const info = await transporter.sendMail(mailOptions);

        console.log('✅ Email sent successfully:', {
            messageId: info.messageId,
            to: options.to,
            subject: options.subject
        });

        return info;
    } catch (error) {
        console.error('❌ Email sending failed:', {
            error: error.message,
            to: options.to,
            subject: options.subject,
            code: error.code
        });

        // Provide more specific error messages
        if (error.code === 'EAUTH') {
            throw new Error('Email authentication failed. Please check EMAIL_USER and EMAIL_PASS.');
        } else if (error.code === 'ECONNECTION') {
            throw new Error('Email connection failed. Please check EMAIL_HOST and EMAIL_PORT.');
        } else {
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }
};

// Helper function to check email configuration status
exports.isEmailConfigured = isEmailConfigured;