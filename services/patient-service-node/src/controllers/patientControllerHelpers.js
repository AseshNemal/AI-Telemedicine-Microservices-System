const Patient = require('../models/Patient');

const getFirebaseUidFromRequest = (req) => req.user && req.user.uid;

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

module.exports = {
    getFirebaseUidFromRequest,
    findPatientByFirebaseUid,
};