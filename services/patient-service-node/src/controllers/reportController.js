const path = require('path');
const fs = require('fs/promises');
const MedicalReport = require('../models/MedicalReport');
const { findPatientByFirebaseUid } = require('./patientControllerHelpers');

exports.uploadMyReport = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'File is required',
            });
        }

        const patient = await findPatientByFirebaseUid(req);

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
        const patient = await findPatientByFirebaseUid(req);
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
        const patient = await findPatientByFirebaseUid(req);

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