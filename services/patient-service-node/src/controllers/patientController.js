const Patient = require('../models/Patient');
const MedicalReport = require('../models/MedicalReport');
const Prescription = require('../models/Prescription');
const MedicalHistory = require('../models/MedicalHistory');
const path = require('path');
const fs = require('fs/promises');

exports.createPatientProfile = async (req, res, next) => {
    try {
        const payload = req.body;
        const patient = await Patient.create(payload);

        res.status(201).json({
            success: true,
            data: patient,
        });
    } catch (err) {
        next(err);
    }
};

exports.createDefaultProfileInternal = async (req, res, next) => {
    try {
        const { authUserId, fullName, email, phone } = req.body;

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
            phone,
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
        const authUserId = req.user && (req.user.sub || req.user.id);

        const patient = await Patient.findOne({ authUserId });
        if (!patient) {
            const err = new Error('Patient profile not found');
            err.status = 404;
            return next(err);
        }

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
        const authUserId = req.user && (req.user.sub || req.user.id);

        const allowedFields = [
            'phone',
            'address',
            'dob',
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

        const patient = await Patient.findOneAndUpdate(
            { authUserId },
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!patient) {
            const err = new Error('Patient profile not found');
            err.status = 404;
            return next(err);
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

        res.status(200).json({ success: true, data: patient });
    } catch (err) {
        next(err);
    }
};

exports.uploadMyReport = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'File is required',
            });
        }

        const authUserId = req.user && (req.user.sub || req.user.id);
        const patient = await Patient.findOne({ authUserId });

        if (!patient) {
            const err = new Error('Patient profile not found');
            err.status = 404;
            return next(err);
        }

        const report = await MedicalReport.create({
            patientId: patient._id,
            fileName: req.file.originalname,
            fileUrl: `/uploads/reports/${req.file.filename}`,
            fileType: req.file.mimetype,
            description: req.body.description || '',
        });

        return res.status(201).json({
            success: true,
            message: 'Medical report uploaded successfully',
            data: report,
        });
    } catch (err) {
        return next(err);
    }
};

exports.listMyReports = async (req, res, next) => {
    try {
        const authUserId = req.user && (req.user.sub || req.user.id);
        const patient = await Patient.findOne({ authUserId });

        if (!patient) {
            const err = new Error('Patient profile not found');
            err.status = 404;
            return next(err);
        }

        const reports = await MedicalReport.find({ patientId: patient._id }).sort({ uploadedAt: -1 });

        return res.status(200).json({
            success: true,
            data: reports,
        });
    } catch (err) {
        return next(err);
    }
};

exports.deleteMyReport = async (req, res, next) => {
    try {
        const { reportId } = req.params;
        const authUserId = req.user && (req.user.sub || req.user.id);

        const patient = await Patient.findOne({ authUserId });
        if (!patient) {
            const err = new Error('Patient profile not found');
            err.status = 404;
            return next(err);
        }

        const report = await MedicalReport.findOne({ _id: reportId, patientId: patient._id });
        if (!report) {
            const err = new Error('Medical report not found');
            err.status = 404;
            return next(err);
        }

        await MedicalReport.deleteOne({ _id: report._id });

        if (report.fileUrl && report.fileUrl.startsWith('/uploads/reports/')) {
            const fileName = path.basename(report.fileUrl);
            const absolutePath = path.join(__dirname, '../../uploads/reports', fileName);

            try {
                await fs.unlink(absolutePath);
            } catch (fileErr) {
                if (fileErr.code !== 'ENOENT') {
                    throw fileErr;
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Medical report deleted successfully',
        });
    } catch (err) {
        return next(err);
    }
};

exports.listMyPrescriptions = async (req, res, next) => {
    try {
        const authUserId = req.user && (req.user.sub || req.user.id);
        const patient = await Patient.findOne({ authUserId });

        if (!patient) {
            const err = new Error('Patient profile not found');
            err.status = 404;
            return next(err);
        }

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
        const authUserId = req.user && (req.user.sub || req.user.id);
        const patient = await Patient.findOne({ authUserId });

        if (!patient) {
            const err = new Error('Patient profile not found');
            err.status = 404;
            return next(err);
        }

        const history = await MedicalHistory.find({ patientId: patient._id }).sort({ consultationDate: -1 });

        return res.status(200).json({
            success: true,
            data: history,
        });
    } catch (err) {
        return next(err);
    }
};
