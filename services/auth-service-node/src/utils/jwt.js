const jwt = require('jsonwebtoken');

const signAccessToken = (user) => {
    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '1h';

    if (!secret) {
        throw new Error('JWT_SECRET is not configured');
    }

    return jwt.sign(
        {
            sub: String(user._id),
            email: user.email,
            role: user.role,
        },
        secret,
        { expiresIn }
    );
};

module.exports = {
    signAccessToken,
};
