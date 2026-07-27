const User = require('../models/User');
const sanitizeUser = require('../utils/sanitizeUser');

const ALLOWED_ROLES = ['PATIENT', 'DOCTOR', 'ADMIN'];

const normalizeRole = (role) => {
    const normalized = String(role || 'PATIENT').toUpperCase();
    return ALLOWED_ROLES.includes(normalized) ? normalized : 'PATIENT';
};

const upsertAppUserMirror = async ({ firebaseUid, fullName, email, phone, role, isVerified }) => {
    const normalizedRole = normalizeRole(role);
    const doctorVerificationStatus = normalizedRole === 'DOCTOR' ? 'PENDING' : 'NOT_REQUIRED';

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
                doctorVerificationStatus,
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

const listUsers = async ({ role, isActive, page = 1, limit = 20 }) => {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

    const filters = {};
    if (role) {
        filters.role = normalizeRole(role);
    }
    if (typeof isActive === 'boolean') {
        filters.isActive = isActive;
    }

    const [items, total] = await Promise.all([
        User.find(filters)
            .sort({ createdAt: -1 })
            .skip((safePage - 1) * safeLimit)
            .limit(safeLimit),
        User.countDocuments(filters),
    ]);

    return {
        items: items.map(sanitizeUser),
        pagination: {
            page: safePage,
            limit: safeLimit,
            total,
            totalPages: Math.ceil(total / safeLimit) || 1,
        },
    };
};

const updateUserRole = async (firebaseUid, role) => {
    const normalizedRole = normalizeRole(role);

    const roleAwareFields =
        normalizedRole === 'DOCTOR'
            ? {
                  doctorVerificationStatus: 'PENDING',
                  doctorVerificationNotes: '',
                  doctorVerifiedBy: null,
                  doctorVerifiedAt: null,
              }
            : {
                  doctorVerificationStatus: 'NOT_REQUIRED',
                  doctorVerificationNotes: '',
                  doctorVerifiedBy: null,
                  doctorVerifiedAt: null,
              };

    const user = await User.findOneAndUpdate(
        { firebaseUid },
        {
            $set: {
                role: normalizedRole,
                ...roleAwareFields,
                lastSyncedAt: new Date(),
            },
        },
        { new: true, runValidators: true }
    );

    return user;
};

const updateUserActiveStatus = async (firebaseUid, isActive) => {
    const user = await User.findOneAndUpdate(
        { firebaseUid },
        {
            $set: {
                isActive: Boolean(isActive),
                lastSyncedAt: new Date(),
            },
        },
        { new: true, runValidators: true }
    );

    return user;
};

const listPendingDoctors = async ({ page = 1, limit = 20 }) => {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

    const filters = {
        role: 'DOCTOR',
        doctorVerificationStatus: 'PENDING',
    };

    const [items, total] = await Promise.all([
        User.find(filters)
            .sort({ createdAt: -1 })
            .skip((safePage - 1) * safeLimit)
            .limit(safeLimit),
        User.countDocuments(filters),
    ]);

    return {
        items: items.map(sanitizeUser),
        pagination: {
            page: safePage,
            limit: safeLimit,
            total,
            totalPages: Math.ceil(total / safeLimit) || 1,
        },
    };
};

const updateDoctorVerificationStatus = async ({ firebaseUid, status, notes, verifiedBy }) => {
    const normalizedStatus = String(status || '').toUpperCase();
    if (!['VERIFIED', 'REJECTED'].includes(normalizedStatus)) {
        const err = new Error('status must be VERIFIED or REJECTED');
        err.status = 400;
        throw err;
    }

    const user = await User.findOneAndUpdate(
        { firebaseUid, role: 'DOCTOR' },
        {
            $set: {
                doctorVerificationStatus: normalizedStatus,
                doctorVerificationNotes: notes || '',
                doctorVerifiedBy: verifiedBy || null,
                doctorVerifiedAt: new Date(),
                lastSyncedAt: new Date(),
            },
        },
        { new: true, runValidators: true }
    );

    return user;
};

module.exports = {
    ALLOWED_ROLES,
    normalizeRole,
    upsertAppUserMirror,
    findAppUserByUid,
    buildMeResponse,
    listUsers,
    updateUserRole,
    updateUserActiveStatus,
    listPendingDoctors,
    updateDoctorVerificationStatus,
};
