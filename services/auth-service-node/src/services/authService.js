const User = require('../models/User');
const sanitizeUser = require('../utils/sanitizeUser');

const ALLOWED_ROLES = ['PATIENT', 'DOCTOR', 'ADMIN'];

const normalizeRole = (role) => {
    const normalized = String(role || 'PATIENT').toUpperCase();
    return ALLOWED_ROLES.includes(normalized) ? normalized : 'PATIENT';
};

const upsertAppUserMirror = async ({ firebaseUid, fullName, email, phone, role, isVerified }) => {
    const normalizedRole = normalizeRole(role);

    const user = await User.findOneAndUpdate(
        { firebaseUid },
        {
            $set: {
                fullName,
                email,
                phone: phone || null,
                role: normalizedRole,
                isVerified: Boolean(isVerified),
                isActive: true,
                lastSyncedAt: new Date(),
            },
            $setOnInsert: {
                firebaseUid,
            },
        },
        { upsert: true, new: true, runValidators: true }
    );

    return user;
};

const findAppUserByUid = async (firebaseUid) => {
    return User.findOne({ firebaseUid });
};

const buildMeResponse = (decodedToken, appUser) => {
    const roleFromClaims = decodedToken.role || (decodedToken.claims && decodedToken.claims.role) || null;
    const roleFromMirror = appUser ? appUser.role : null;

    return {
        uid: decodedToken.uid,
        email: decodedToken.email || null,
        fullName: decodedToken.name || (appUser && appUser.fullName) || null,
        role: roleFromClaims || roleFromMirror || 'PATIENT',
        emailVerified: Boolean(decodedToken.email_verified),
        appUser: appUser ? sanitizeUser(appUser) : null,
    };
};

module.exports = {
    ALLOWED_ROLES,
    normalizeRole,
    upsertAppUserMirror,
    findAppUserByUid,
    buildMeResponse,
};
