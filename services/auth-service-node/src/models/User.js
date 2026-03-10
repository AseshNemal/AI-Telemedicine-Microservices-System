const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
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

        // bcrypt hash — never returned in API responses (select: false)
        passwordHash: {
            type: String,
            required: [true, 'Password is required'],
            select: false,
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
    },
    {
        // Automatically adds createdAt and updatedAt fields
        timestamps: true,
    }
);

const User = mongoose.model('User', userSchema);
module.exports = User;
