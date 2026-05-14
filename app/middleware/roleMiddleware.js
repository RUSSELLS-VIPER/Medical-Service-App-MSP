const Role = require('../models/Role');
const mongoose = require('mongoose')

class RoleMiddleware {
    checkRole(...allowedRoles) {
        return async (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            try {
                // Handle both ObjectId and string roles
                let roleName;
                if (req.user.role instanceof mongoose.Types.ObjectId) {
                    const roleDoc = await Role.findById(req.user.role);
                    roleName = roleDoc?.name;
                } else {
                    roleName = req.user.role;
                }

                if (!roleName || !allowedRoles.includes(roleName)) {
                    return res.status(403).json({
                        success: false,
                        message: `Role '${roleName}' is not authorized`
                    });
                }

                next();
            } catch (err) {
        
                return res.status(500).json({
                    success: false,
                    message: 'Error verifying user role'
                });
            }
        };
    }
}

module.exports = new RoleMiddleware();