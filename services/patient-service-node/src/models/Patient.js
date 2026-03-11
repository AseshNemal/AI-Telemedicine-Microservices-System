const mongoose = require('mongoose');

const emergencyContactSchema = new mongoose.Schema(
    {
        name: { type: String, trim: true },
        relationship: { type: String, trim: true },
        phone: { type: String, trim: true },
    },
    { _id: false }
);

const patientSchema = new mongoose.Schema(
    {
        // Link back to Firebase Authentication user identity (uid)
        authUserId: {
            type: String,
            required: [true, 'authUserId is required'],
            unique: true,
            index: true,
            trim: true,
        },

        fullName: {
            type: String,
            required: [true, 'Full name is required'],
            trim: true,
        },

        email: {
            type: String,
            required: [true, 'Email is required'],
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
        },

        phone: {
            type: String,
            trim: true,
            default: null,
        },

        dob: {
            type: Date,
            default: null,
        },

        gender: {
            type: String,
            enum: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'],
            default: 'PREFER_NOT_TO_SAY',
        },

        address: {
            type: String,
            trim: true,
            default: null,
        },

        bloodGroup: {
            type: String,
            enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
            default: null,
        },

        allergies: {
            type: [String],
            default: [],
        },

        chronicConditions: {
            type: [String],
            default: [],
        },

        emergencyContact: {
            type: emergencyContactSchema,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

const Patient = mongoose.model('Patient', patientSchema);
module.exports = Patient;
