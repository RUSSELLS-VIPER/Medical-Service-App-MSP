const { protect } = require('./authMiddleware');

const adminViewAuth = async (req, res, next) => {
    try {
        // First run the protect middleware
        await new Promise((resolve, reject) => {
            protect(req, res, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        // Now check if user is admin
        if (!req.user) {
            return res.status(401).render('error', {
                title: 'Unauthorized',
                message: 'Please log in to access this page',
                user: null,
                env: process.env.NODE_ENV || 'development',
                showFullError: process.env.NODE_ENV === 'development' || process.env.SHOW_ERRORS === 'true'
            });
        }

        // Get user role with all possible cases
        let userRole;

        if (req.user.roleName) {
            userRole = req.user.roleName;
        } else if (req.user.role && typeof req.user.role === 'object' && req.user.role.name) {
            userRole = req.user.role.name;
        } else if (typeof req.user.role === 'string') {
            userRole = req.user.role;
        } else if (req.session?.userRole) {
            userRole = req.session.userRole;
        } else {
            userRole = 'unknown';
        }



        if (userRole !== 'admin') {
            return res.status(403).render('error', {
                title: 'Forbidden',
                message: 'You do not have permission to access the admin area',
                user: req.user,
                env: process.env.NODE_ENV || 'development',
                showFullError: process.env.NODE_ENV === 'development' || process.env.SHOW_ERRORS === 'true'
            });
        }

        next();
    } catch (error) {

        res.status(500).render('error', {
            title: 'Server Error',
            message: 'An error occurred during authentication',
            user: null,
            env: process.env.NODE_ENV || 'development',
            showFullError: process.env.NODE_ENV === 'development' || process.env.SHOW_ERRORS === 'true'
        });
    }
};

module.exports = adminViewAuth;