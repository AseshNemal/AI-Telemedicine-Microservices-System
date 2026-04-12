const Patient = require('../models/Patient');

const getFirebaseUidFromRequest = (req) => req.user && req.user.uid;

const buildDefaultPatientSeedFromRequest = (req) => {
    const firebaseUid = getFirebaseUidFromRequest(req);
    const emailFromToken = req.user && req.user.email ? String(req.user.email).trim().toLowerCase() : null;
    const fullNameFromClaims =
        req.user && req.user.claims && req.user.claims.name ? String(req.user.claims.name).trim() : null;
    const fallbackName = emailFromToken ? emailFromToken.split('@')[0] : 'Patient User';

    return {
        authUserId: firebaseUid,
        fullName: fullNameFromClaims || fallbackName,
        email: emailFromToken || `${firebaseUid}@unknown.local`,
    };
};

const findPatientByFirebaseUid = async (req) => {
    const firebaseUid = getFirebaseUidFromRequest(req);

    if (!firebaseUid) {
        const err = new Error('Authenticated Firebase UID is required');
        err.status = 401;
        throw err;
    }

    const patient = await Patient.findOne({ authUserId: firebaseUid });
    if (!patient) {
        const err = new Error('Patient profile not found');
        err.status = 404;
        throw err;
    }

    return patient;
};

const findOrCreatePatientByFirebaseUid = async (req) => {
    const firebaseUid = getFirebaseUidFromRequest(req);

    if (!firebaseUid) {
        const err = new Error('Authenticated Firebase UID is required');
        err.status = 401;
        throw err;
    }

    let patient = await Patient.findOne({ authUserId: firebaseUid });
    if (patient) {
        return patient;
    }

    const seed = buildDefaultPatientSeedFromRequest(req);

    try {
        patient = await Patient.create(seed);
        return patient;
    } catch (err) {
        // Handle race condition where another request created the profile concurrently.
        if (err && err.code === 11000) {
            patient = await Patient.findOne({ authUserId: firebaseUid });
            if (patient) {
                return patient;
            }
        }

        throw err;
    }
};

module.exports = {
    getFirebaseUidFromRequest,
    findPatientByFirebaseUid,
    findOrCreatePatientByFirebaseUid,
    buildDefaultPatientSeedFromRequest,
};