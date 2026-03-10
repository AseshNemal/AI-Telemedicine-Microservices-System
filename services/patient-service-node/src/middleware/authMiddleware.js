const jwt = require('jsonwebtoken');

const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Missing or invalid authorization header',
        });
    }

    const token = authHeader.slice(7);

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload;
        return next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token',
        });
    }
};

const requireRole = (allowedRoles) => (req, res, next) => {
    const role = req.user && req.user.role;

    if (!role || !allowedRoles.includes(role)) {
        return res.status(403).json({
            success: false,
            message: 'Forbidden: insufficient role',
        });
    }

    return next();
};

module.exports = {
    authenticateJWT,
    requireRole,
};
