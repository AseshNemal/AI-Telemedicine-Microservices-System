const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        const role = req.user && req.user.role;

        if (!role || !roles.includes(role)) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden: insufficient role',
            });
        }

        return next();
    };
};

module.exports = {
    authorizeRoles,
};
