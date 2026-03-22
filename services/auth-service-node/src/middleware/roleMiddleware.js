const User = require('../models/User');

const authorizeRoles = (...roles) => {
    return async (req, res, next) => {
        try {
            const claimRole = req.user && (req.user.role || (req.user.claims && req.user.claims.role));
            let resolvedRole = claimRole || null;

            if (!resolvedRole && req.user && req.user.uid) {
                const appUser = await User.findOne({ firebaseUid: req.user.uid }).select('role');
                resolvedRole = appUser ? appUser.role : null;
            }

            if (resolvedRole) {
                req.user.role = resolvedRole;
            }

            if (!resolvedRole || !roles.includes(resolvedRole)) {
                return res.status(403).json({
                    success: false,
                    message: 'Forbidden: insufficient role',
                });
            }

            return next();
        } catch (err) {
            return next(err);
        }
    };
};

module.exports = {
    authorizeRoles,
};
