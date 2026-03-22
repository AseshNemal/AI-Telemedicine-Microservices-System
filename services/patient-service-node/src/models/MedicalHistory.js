const mongoose = require('mongoose');

const medicalHistorySchema = new mongoose.Schema(
    {
        patientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Patient',
            required: true,
            index: true,
        },
        diagnosis: {
            type: String,
            required: true,
            trim: true,
        },
        treatment: {
            type: String,
            required: true,
            trim: true,
        },
        doctorId: {
            type: String,
            required: true,
            trim: true,
        },
        consultationDate: {
            type: Date,
            required: true,
            default: Date.now,
        },
        notes: {
            type: String,
            default: '',
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

const MedicalHistory = mongoose.model('MedicalHistory', medicalHistorySchema);
module.exports = MedicalHistory;
