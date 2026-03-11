const Prescription = require('../models/Prescription');
const MedicalHistory = require('../models/MedicalHistory');
const { findPatientByFirebaseUid } = require('./patientControllerHelpers');

exports.listMyPrescriptions = async (req, res, next) => {
    try {
        const patient = await findPatientByFirebaseUid(req);
        const prescriptions = await Prescription.find({ patientId: patient._id }).sort({ issuedAt: -1 });

        return res.status(200).json({
            success: true,
            data: prescriptions,
        });
    } catch (err) {
        return next(err);
    }
};

exports.listMyMedicalHistory = async (req, res, next) => {
    try {
        const patient = await findPatientByFirebaseUid(req);
        const history = await MedicalHistory.find({ patientId: patient._id }).sort({ consultationDate: -1 });

        return res.status(200).json({
            success: true,
            data: history,
        });
    } catch (err) {
        return next(err);
    }
};