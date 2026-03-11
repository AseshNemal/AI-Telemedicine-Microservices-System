const { verifyFirebaseIdToken } = require('../config/firebaseAdmin');

const authenticateFirebaseToken = async (req, res, next) => {
    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Missing or invalid authorization header',
        });
    }

    const token = authHeader.slice(7);

    try {
        const decodedToken = await verifyFirebaseIdToken(token);

        req.user = {
            uid: decodedToken.uid,
            sub: decodedToken.uid,
            email: decodedToken.email || null,
            role: decodedToken.role || null,
            claims: decodedToken,
        };

        return next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token',
        });
    }
};

const resolveRoleFromUser = (user) => {
    if (!user) {
        return null;
    }

    const role = user.role || (user.claims && user.claims.role) || null;
    return role ? String(role).toUpperCase() : null;
};

const requireRole = (allowedRoles) => (req, res, next) => {
    const role = resolveRoleFromUser(req.user);

    if (!role || !allowedRoles.includes(role)) {
        return res.status(403).json({
            success: false,
            message: 'Forbidden: insufficient role',
        });
    }

    return next();
};

module.exports = {
    authenticateFirebaseToken,
    requireRole,
    resolveRoleFromUser,
};
