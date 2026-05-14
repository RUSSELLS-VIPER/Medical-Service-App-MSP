const { protect } = require('./authMiddleware');

exports.adminViewAuth = (req, res, next) => {
    protect(req, res, (err) => {
        if (err) return next(err);

        const userRole = req.user.roleName || req.user.role?.name || req.user.role;
        if (userRole !== 'admin') {
            return res.status(403).render('error', {
                title: 'Forbidden',
                message: 'You do not have permission to access this page',
                user: req.user || null,
                env: process.env.NODE_ENV || 'development',
                showFullError: process.env.NODE_ENV === 'development' || process.env.SHOW_ERRORS === 'true'
            });
        }
        next();
    });
};