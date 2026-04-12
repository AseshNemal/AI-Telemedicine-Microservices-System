const Patient = require('../models/Patient');
const {
    getFirebaseUidFromRequest,
    findPatientByFirebaseUid,
    findOrCreatePatientByFirebaseUid,
    buildDefaultPatientSeedFromRequest,
} = require('./patientControllerHelpers');

exports.createPatientProfile = async (req, res, next) => {
    try {
        const payload = req.body;
        const patient = await Patient.create(payload);

        return res.status(201).json({
            success: true,
            data: patient,
        });
    } catch (err) {
        return next(err);
    }
};

exports.createDefaultProfileInternal = async (req, res, next) => {
    try {
        const { authUserId, fullName, email, phone } = req.body;

        if (!authUserId || !fullName || !email) {
            return res.status(400).json({
                success: false,
                message: 'authUserId, fullName, and email are required',
            });
        }

        const existing = await Patient.findOne({ authUserId });
        if (existing) {
            const err = new Error('Patient profile already exists for this auth user');
            err.status = 409;
            return next(err);
        }

        const patient = await Patient.create({
            authUserId,
            fullName,
            email,
            phone: phone || null,
        });

        return res.status(201).json({
            success: true,
            message: 'Default patient profile created',
            data: patient,
        });
    } catch (err) {
        return next(err);
    }
};

exports.getMyProfile = async (req, res, next) => {
    try {
        const patient = await findOrCreatePatientByFirebaseUid(req);

        return res.status(200).json({
            success: true,
            data: patient,
        });
    } catch (err) {
        return next(err);
    }
};

exports.updateMyProfile = async (req, res, next) => {
    try {
        const firebaseUid = getFirebaseUidFromRequest(req);

        if (!firebaseUid) {
            return res.status(401).json({
                success: false,
                message: 'Authenticated Firebase UID is required',
            });
        }

        const allowedFields = [
            'phone',
            'address',
            'dob',
            'gender',
            'bloodGroup',
            'allergies',
            'chronicConditions',
            'emergencyContact',
        ];

        const updates = {};
        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                updates[field] = req.body[field];
            }
        }

        let patient = await Patient.findOneAndUpdate(
            { authUserId: firebaseUid },
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!patient) {
            const seed = buildDefaultPatientSeedFromRequest(req);
            patient = await Patient.create({
                ...seed,
                ...updates,
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Patient profile updated',
            data: patient,
        });
    } catch (err) {
        return next(err);
    }
};

exports.getByAuthUserId = async (req, res, next) => {
    try {
        const { authUserId } = req.params;
        const patient = await Patient.findOne({ authUserId });

        if (!patient) {
            const err = new Error('Patient profile not found');
            err.status = 404;
            return next(err);
        }

        return res.status(200).json({ success: true, data: patient });
    } catch (err) {
        return next(err);
    }
};

module.exports._private = {
    getFirebaseUidFromRequest,
    findPatientByFirebaseUid,
};