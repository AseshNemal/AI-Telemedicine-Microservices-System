const bcrypt = require('bcryptjs');
const User = require('../models/User');
const sanitizeUser = require('../utils/sanitizeUser');

const registerUser = async ({ fullName, email, password, phone, role }) => {
    const existing = await User.findOne({ email });
    if (existing) {
        const err = new Error('Email already registered');
        err.status = 409;
        throw err;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
        fullName,
        email,
        passwordHash,
        phone,
        role,
        isActive: true,
        isVerified: role === 'DOCTOR' ? false : true,
    });

    return sanitizeUser(user);
};

const loginUser = async ({ email, password }) => {
    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user) {
        const err = new Error('Invalid email or password');
        err.status = 401;
        throw err;
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
        const err = new Error('Invalid email or password');
        err.status = 401;
        throw err;
    }

    if (!user.isActive) {
        const err = new Error('Account is inactive');
        err.status = 403;
        throw err;
    }

    return user;
};

module.exports = {
    registerUser,
    loginUser,
};
