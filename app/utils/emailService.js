const nodemailer = require('nodemailer');

// Check if email configuration is available
const isEmailConfigured = () => {
    return process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS;
};

const isResendConfigured = () => {
    return !!process.env.RESEND_API_KEY;
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

    const smtpPort = parseInt(process.env.EMAIL_PORT || '587', 10);
    const smtpSecure = process.env.EMAIL_SECURE === 'true' || smtpPort === 465;
    const requireTls = process.env.EMAIL_REQUIRE_TLS === 'true';
    const forceIpv4 = process.env.EMAIL_FORCE_IPV4 === 'true';

    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: smtpPort,
        secure: smtpSecure,
        requireTLS: requireTls,
        family: forceIpv4 ? 4 : undefined,
        connectionTimeout: parseInt(process.env.EMAIL_CONNECTION_TIMEOUT || '15000', 10),
        greetingTimeout: parseInt(process.env.EMAIL_GREETING_TIMEOUT || '10000', 10),
        socketTimeout: parseInt(process.env.EMAIL_SOCKET_TIMEOUT || '20000', 10),
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

const sendWithResend = async (mailOptions) => {
    if (!isResendConfigured()) {
        throw new Error('Resend fallback is not configured.');
    }

    const timeoutMs = parseInt(process.env.RESEND_TIMEOUT || '15000', 10);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: mailOptions.from,
                to: [mailOptions.to],
                subject: mailOptions.subject,
                html: mailOptions.html
            }),
            signal: controller.signal
        });

        const result = await response.json();

        if (!response.ok) {
            const errorMessage = result && result.message ? result.message : 'Unknown Resend API error';
            throw new Error(errorMessage);
        }

        return {
            messageId: result && result.id ? result.id : 'resend-message-id'
        };
    } finally {
        clearTimeout(timeout);
    }
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
        let info;
        const provider = (process.env.EMAIL_PROVIDER || 'auto').toLowerCase();
        const preferResend = provider === 'resend' || (provider === 'auto' && process.env.NODE_ENV === 'production' && isResendConfigured());

        if (preferResend && isResendConfigured()) {
            info = await sendWithResend(mailOptions);
        } else if (isEmailConfigured()) {
            const transporter = createTransporter();
            info = await transporter.sendMail(mailOptions);
        } else if (isResendConfigured()) {
            info = await sendWithResend(mailOptions);
        } else {
            throw new Error('Email configuration is required. Configure SMTP or RESEND_API_KEY.');
        }

        console.log('✅ Email sent successfully:', {
            messageId: info.messageId,
            to: options.to,
            subject: options.subject
        });

        return info;
    } catch (error) {
        const isSmtpNetworkError = error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT' || error.code === 'ESOCKET';

        if (isSmtpNetworkError && isResendConfigured()) {
            try {
                const fallbackInfo = await sendWithResend(mailOptions);
                console.log('✅ Email sent successfully via Resend fallback:', {
                    messageId: fallbackInfo.messageId,
                    to: options.to,
                    subject: options.subject
                });
                return fallbackInfo;
            } catch (fallbackError) {
                console.error('❌ Resend fallback failed:', {
                    error: fallbackError.message,
                    to: options.to,
                    subject: options.subject
                });
            }
        }

        console.error('❌ Email sending failed:', {
            error: error.message,
            to: options.to,
            subject: options.subject,
            code: error.code,
            emailHost: process.env.EMAIL_HOST,
            emailPort: process.env.EMAIL_PORT,
            emailSecure: process.env.EMAIL_SECURE
        });

        // Provide more specific error messages
        if (error.code === 'EAUTH') {
            throw new Error('Email authentication failed. Please check EMAIL_USER and EMAIL_PASS.');
        } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT' || error.code === 'ESOCKET') {
            throw new Error('Email connection failed or timed out. Please check EMAIL_HOST, EMAIL_PORT, and provider network access.');
        } else {
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }
};

// Helper function to check email configuration status
exports.isEmailConfigured = isEmailConfigured;
exports.isResendConfigured = isResendConfigured;
