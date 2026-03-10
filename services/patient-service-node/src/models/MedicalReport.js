const mongoose = require('mongoose');

const medicalReportSchema = new mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true,
        index: true,
    },
    fileName: {
        type: String,
        required: true,
    },
    fileUrl: {
        type: String,
        required: true,
    },
    fileType: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        default: '',
        trim: true,
    },
    uploadedAt: {
        type: Date,
        default: Date.now,
    },
});

const MedicalReport = mongoose.model('MedicalReport', medicalReportSchema);
module.exports = MedicalReport;
