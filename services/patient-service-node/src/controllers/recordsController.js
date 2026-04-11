const Prescription = require('../models/Prescription');
const MedicalHistory = require('../models/MedicalHistory');
const Patient = require('../models/Patient');
const { findPatientByFirebaseUid } = require('./patientControllerHelpers');

exports.createMedicalHistoryEntry = async (req, res, next) => {
    try {
        const { authUserId, diagnosis, treatment, consultationDate, notes } = req.body;
        const doctorId = req.body.doctorId || (req.user && req.user.uid);

        if (!authUserId || !diagnosis || !treatment) {
            return res.status(400).json({
                success: false,
                message: 'authUserId, diagnosis, and treatment are required',
            });
        }

        if (!doctorId) {
            return res.status(400).json({
                success: false,
                message: 'doctorId is required',
            });
        }

        const patient = await Patient.findOne({ authUserId });
        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient profile not found',
            });
        }

        const history = await MedicalHistory.create({
            patientId: patient._id,
            diagnosis,
            treatment,
            doctorId,
            consultationDate: consultationDate || undefined,
            notes: notes || '',
        });

        return res.status(201).json({
            success: true,
            message: 'Medical history entry created',
            data: history,
        });
    } catch (err) {
        return next(err);
    }
};

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