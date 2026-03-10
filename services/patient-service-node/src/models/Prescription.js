const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        dosage: { type: String, required: true, trim: true },
        frequency: { type: String, required: true, trim: true },
        duration: { type: String, required: true, trim: true },
    },
    { _id: false }
);

const prescriptionSchema = new mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true,
        index: true,
    },
    doctorId: {
        type: String,
        required: true,
        trim: true,
    },
    appointmentId: {
        type: String,
        default: null,
        trim: true,
    },
    medicines: {
        type: [medicineSchema],
        default: [],
    },
    notes: {
        type: String,
        default: '',
        trim: true,
    },
    issuedAt: {
        type: Date,
        default: Date.now,
    },
});

const Prescription = mongoose.model('Prescription', prescriptionSchema);
module.exports = Prescription;
