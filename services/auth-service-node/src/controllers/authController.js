const { registerUser, loginUser } = require('../services/authService');
const sanitizeUser = require('../utils/sanitizeUser');
const { signAccessToken } = require('../utils/jwt');
const RefreshToken = require('../models/RefreshToken');
const User = require('../models/User');
const { generateRefreshToken, hashToken, getRefreshExpiryDate } = require('../utils/tokenUtils');
const { createDefaultPatientProfile } = require('../utils/patientServiceClient');

// @route  POST /api/auth/register
// @access Public
exports.register = async (req, res, next) => {
    try {
        const { fullName, email, password, phone, role } = req.body;
        const user = await registerUser({ fullName, email, password, phone, role });

        let profileSync = {
            status: 'not-required',
        };

        // Student-project practical choice: keep user creation successful and log/profile-sync failure for retry.
        if (user.role === 'PATIENT') {
            try {
                await createDefaultPatientProfile({
                    authUserId: String(user.id),
                    fullName: user.fullName,
                    email: user.email,
                    phone: user.phone,
                });

                profileSync = {
                    status: 'created',
                };
            } catch (profileErr) {
                console.error('[auth-service] Failed to create default patient profile:', profileErr.message);
                profileSync = {
                    status: 'pending-retry',
                    message: 'User created, but patient profile sync failed. Retry is required.',
                };
            }
        }

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: user,
            profileSync,
        });
    } catch (err) {
        next(err);
    }
};

// @route  POST /api/auth/login
// @access Public
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await loginUser({ email, password });
        const accessToken = signAccessToken(user);
        const refreshToken = generateRefreshToken();
        const refreshTokenHash = hashToken(refreshToken);

        await RefreshToken.create({
            userId: user._id,
            tokenHash: refreshTokenHash,
            expiresAt: getRefreshExpiryDate(),
        });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            accessToken,
            refreshToken,
            user: sanitizeUser(user),
        });
    } catch (err) {
        next(err);
    }
};

// @route  POST /api/auth/refresh
// @access Public
exports.refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'refreshToken is required',
            });
        }

        const refreshTokenHash = hashToken(refreshToken);
        const existing = await RefreshToken.findOne({ tokenHash: refreshTokenHash, revokedAt: null }).lean();

        if (!existing || existing.expiresAt <= new Date()) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired refresh token',
            });
        }

        const user = await User.findById(existing.userId);
        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'User is not active',
            });
        }

        const newRefreshToken = generateRefreshToken();
        const newRefreshTokenHash = hashToken(newRefreshToken);

        await RefreshToken.findByIdAndUpdate(existing._id, {
            revokedAt: new Date(),
            replacedByTokenHash: newRefreshTokenHash,
        });

        await RefreshToken.create({
            userId: user._id,
            tokenHash: newRefreshTokenHash,
            expiresAt: getRefreshExpiryDate(),
        });

        const accessToken = signAccessToken(user);

        return res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            accessToken,
            refreshToken: newRefreshToken,
            user: sanitizeUser(user),
        });
    } catch (err) {
        return next(err);
    }
};

// @route  GET /api/auth/me
// @access Private
exports.me = async (req, res, next) => {
    try {
        const userId = req.user && (req.user.sub || req.user.id);
        const user = await User.findById(userId);

        if (!user) {
            const err = new Error('User not found');
            err.status = 404;
            return next(err);
        }

        return res.status(200).json({
            success: true,
            data: sanitizeUser(user),
        });
    } catch (err) {
        return next(err);
    }
};

// @route  POST /api/auth/logout
// @access Private
exports.logout = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'refreshToken is required',
            });
        }

        const tokenHash = hashToken(refreshToken);

        await RefreshToken.findOneAndUpdate(
            { tokenHash, revokedAt: null },
            { revokedAt: new Date() }
        );

        return res.status(200).json({
            success: true,
            message: 'Logged out successfully',
        });
    } catch (err) {
        return next(err);
    }
};
