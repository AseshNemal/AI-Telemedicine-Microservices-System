const sanitizeUser = (userDoc) => ({
    id: userDoc._id,
    fullName: userDoc.fullName,
    email: userDoc.email,
    phone: userDoc.phone,
    role: userDoc.role,
    isActive: userDoc.isActive,
    isVerified: userDoc.isVerified,
    createdAt: userDoc.createdAt,
    updatedAt: userDoc.updatedAt,
});

module.exports = sanitizeUser;
