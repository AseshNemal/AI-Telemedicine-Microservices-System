const sanitizeUser = (userDoc) => ({
    id: userDoc.firebaseUid || userDoc._id,
    uid: userDoc.firebaseUid || userDoc._id,
    fullName: userDoc.fullName,
    email: userDoc.email,
    phone: userDoc.phone,
    role: userDoc.role,
    isActive: userDoc.isActive,
    isVerified: userDoc.isVerified,
    doctorVerificationStatus: userDoc.doctorVerificationStatus,
    doctorVerificationNotes: userDoc.doctorVerificationNotes,
    doctorVerifiedBy: userDoc.doctorVerifiedBy,
    doctorVerifiedAt: userDoc.doctorVerifiedAt,
    lastSyncedAt: userDoc.lastSyncedAt,
    createdAt: userDoc.createdAt,
    updatedAt: userDoc.updatedAt,
});

module.exports = sanitizeUser;
