const admin = require('firebase-admin');
const { initFirebaseAdmin } = require('../config/firebaseAdmin');
const { normalizeRole } = require('./authService');

const createFirebaseUserWithRole = async ({ fullName, email, password, phone, role }) => {
    initFirebaseAdmin();

    const normalizedRole = normalizeRole(role);

    const userRecord = await admin.auth().createUser({
        displayName: fullName,
        email,
        password,
        phoneNumber: phone || undefined,
        disabled: false,
    });

    await admin.auth().setCustomUserClaims(userRecord.uid, {
        role: normalizedRole,
    });

    return {
        uid: userRecord.uid,
        email: userRecord.email,
        fullName: userRecord.displayName || fullName,
        phone: userRecord.phoneNumber || phone || null,
        role: normalizedRole,
        emailVerified: userRecord.emailVerified,
    };
};

const setFirebaseUserRoleClaim = async (uid, role) => {
    initFirebaseAdmin();

    const normalizedRole = normalizeRole(role);
    await admin.auth().setCustomUserClaims(uid, { role: normalizedRole });
    return normalizedRole;
};

const setFirebaseUserDisabledStatus = async (uid, isDisabled) => {
    initFirebaseAdmin();
    await admin.auth().updateUser(uid, { disabled: Boolean(isDisabled) });
};

module.exports = {
    createFirebaseUserWithRole,
    setFirebaseUserRoleClaim,
    setFirebaseUserDisabledStatus,
};
