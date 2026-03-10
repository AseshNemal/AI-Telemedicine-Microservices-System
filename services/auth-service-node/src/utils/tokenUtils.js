const crypto = require('crypto');
const { signAccessToken } = require('./jwt');

const generateRefreshToken = () => crypto.randomBytes(40).toString('hex');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const getRefreshExpiryDate = () => {
    const days = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 30);
    const now = new Date();
    now.setDate(now.getDate() + days);
    return now;
};

const buildAuthResponse = ({ user, refreshToken }) => {
    const accessToken = signAccessToken(user);
    return {
        message: 'Authentication successful',
        accessToken,
        refreshToken,
    };
};

module.exports = {
    generateRefreshToken,
    hashToken,
    getRefreshExpiryDate,
    buildAuthResponse,
};
