const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        // Firebase Authentication UID (primary identity key across services)
        firebaseUid: {
            type: String,
            required: [true, 'firebaseUid is required'],
            unique: true,
            index: true,
            trim: true,
        },

        // Legal full name of the user
        fullName: {
            type: String,
            required: [true, 'Full name is required'],
            trim: true,
        },

        // Unique login identifier; stored lowercase
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
        },

        // Optional contact number
        phone: {
            type: String,
            trim: true,
            default: null,
        },

        // Access-control role
        role: {
            type: String,
            enum: ['PATIENT', 'DOCTOR', 'ADMIN'],
            default: 'PATIENT',
        },

        // Soft-delete / account suspension flag
        isActive: {
            type: Boolean,
            default: true,
        },

        // Email-verification flag
        isVerified: {
            type: Boolean,
            default: false,
        },

        // Last time Auth service successfully synced Firebase user metadata
        lastSyncedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        // Automatically adds createdAt and updatedAt fields
        timestamps: true,
    }
);

const User = mongoose.model('User', userSchema);
module.exports = User;
