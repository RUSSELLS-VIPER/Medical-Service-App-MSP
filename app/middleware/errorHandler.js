const ErrorResponse = require('../utils/errorResponse');

const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;


    if (err.name === 'CastError') {
        const message = `Resource not found with id of ${err.value}`;
        error = new ErrorResponse(message, 404);
    }

    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const value = err.keyValue[field];
        const message = `Duplicate field value entered: ${field} '${value}' already exists`;
        error = new ErrorResponse(message, 409);
    }

    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(val => val.message);
        const message = `Validation failed: ${messages.join(', ')}`;
        error = new ErrorResponse(message, 400);
    }

    if (err.name === 'JsonWebTokenError') {
        const message = 'Invalid authentication token';
        error = new ErrorResponse(message, 401);
    }

    if (err.name === 'TokenExpiredError') {
        const message = 'Authentication token expired';
        error = new ErrorResponse(message, 401);
    }

    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        const message = 'Invalid JSON payload in request body';
        error = new ErrorResponse(message, 400);
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
        const message = 'File size too large';
        error = new ErrorResponse(message, 413);
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        const message = 'Unexpected file field';
        error = new ErrorResponse(message, 400);
    }

    const statusCode = error.statusCode || 500;
    const errorMessage = error.message || 'Internal Server Error';

    const isViewRoute = req.path.startsWith('/patient/') ||
        req.path.startsWith('/provider/') ||
        req.path.startsWith('/admin/') ||
        req.path === '/' ||
        req.path === '/login' ||
        req.path === '/register' ||
        req.headers.accept?.includes('text/html');

    if (isViewRoute) {
        return res.status(statusCode).render('error', {
            title: 'Error',
            message: errorMessage,
            user: req.user || null,
            currentPage: 'error',
            error: {
                status: statusCode,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            env: process.env.NODE_ENV || 'development',
            showFullError: process.env.NODE_ENV === 'development' || process.env.SHOW_ERRORS === 'true'
        });
    } else {
        const response = {
            success: false,
            error: errorMessage,
            ...(process.env.NODE_ENV === 'development' && {
                stack: err.stack,
                details: {
                    errorName: err.name,
                    errorCode: err.code,
                    path: req.path,
                    timestamp: new Date().toISOString()
                }
            })
        };
        res.status(statusCode).json(response);
    }
};

module.exports = errorHandler;