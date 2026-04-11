const { createFirebaseUserWithRole } = require('../services/firebaseAuthService');
const {
    upsertAppUserMirror,
    findAppUserByUid,
    buildMeResponse,
    listUsers,
    updateUserRole,
    updateUserActiveStatus,
    listPendingDoctors,
    updateDoctorVerificationStatus,
    ALLOWED_ROLES,
} = require('../services/authService');
const { setFirebaseUserRoleClaim, setFirebaseUserDisabledStatus } = require('../services/firebaseAuthService');
const { createDefaultPatientProfile, getOrCreatePatientProfile } = require('../utils/patientServiceClient');
const sanitizeUser = require('../utils/sanitizeUser');

// @route  POST /api/auth/register
// @access Public
exports.register = async (req, res, next) => {
    try {
        const { fullName, email, password, phone, role } = req.body;

        const firebaseUser = await createFirebaseUserWithRole({
            fullName,
            email,
            password,
            phone,
            role,
        });

        const appUser = await upsertAppUserMirror({
            firebaseUid: firebaseUser.uid,
            fullName: firebaseUser.fullName,
            email: firebaseUser.email,
            phone: firebaseUser.phone,
            role: firebaseUser.role,
            isVerified: firebaseUser.emailVerified,
        });

        let profileSync = {
            status: 'not-required',
        };

        // Practical student-project approach: registration succeeds even if downstream profile sync fails.
        if (firebaseUser.role === 'PATIENT') {
            try {
                await createDefaultPatientProfile({
                    authUserId: firebaseUser.uid,
                    fullName: firebaseUser.fullName,
                    email: firebaseUser.email,
                    phone: firebaseUser.phone,
                });

                profileSync = {
                    status: 'created',
                };
            } catch (profileErr) {
                console.error('[auth-service] Failed to create default patient profile:', profileErr.message);
                profileSync = {
                    status: 'pending-retry',
                    message: 'User created, but patient profile sync failed. Retry is required.',
                };
            }
        }

        return res.status(201).json({
            success: true,
            message: 'User registered in Firebase successfully',
            data: {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                fullName: firebaseUser.fullName,
                phone: firebaseUser.phone,
                role: firebaseUser.role,
                emailVerified: firebaseUser.emailVerified,
            },
            appUser,
            profileSync,
        });
    } catch (err) {
        if (err && err.code === 'auth/email-already-exists') {
            return res.status(409).json({
                success: false,
                message: 'Email already registered',
            });
        }

        if (err && err.code === 'auth/invalid-password') {
            return res.status(400).json({
                success: false,
                message: 'Password does not meet Firebase requirements',
            });
        }

        return next(err);
    }
};

// @route  GET /api/auth/me
// @access Private
exports.me = async (req, res, next) => {
    try {
        const uid = req.user && req.user.uid;

        if (!uid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        let appUser = await findAppUserByUid(uid);

        if (!appUser) {
            const fallbackName = req.user.email ? req.user.email.split('@')[0] : 'User';
            appUser = await upsertAppUserMirror({
                firebaseUid: uid,
                fullName: req.user.claims && req.user.claims.name ? req.user.claims.name : fallbackName,
                email: req.user.email,
                phone: null,
                role: req.user.role || 'PATIENT',
                isVerified: Boolean(req.user.claims && req.user.claims.email_verified),
            });
        }

        const meData = buildMeResponse(req.user, appUser);
        let profileSync = {
            status: 'not-required',
        };

        if (meData.role === 'PATIENT') {
            try {
                const profileResult = await getOrCreatePatientProfile({
                    authUserId: uid,
                    fullName: meData.fullName || (req.user.email ? req.user.email.split('@')[0] : 'User'),
                    email: meData.email,
                    phone: appUser ? appUser.phone : null,
                });

                profileSync = {
                    status: profileResult.status,
                };
            } catch (profileErr) {
                console.error('[auth-service] Failed to sync patient profile in /me:', profileErr.message);
                profileSync = {
                    status: 'pending-retry',
                    message: 'Patient profile sync failed. Retry is required.',
                };
            }
        }

        return res.status(200).json({
            success: true,
            data: meData,
            profileSync,
        });
    } catch (err) {
        return next(err);
    }
};

// @route  POST /api/auth/logout
// @access Private
exports.logout = async (req, res) => {
    // In Firebase-auth-only architecture, backend logout does not revoke local refresh tokens.
    // Frontend should clear local session and rely on Firebase client signOut().
    return res.status(200).json({
        success: true,
        message: 'Logout acknowledged. Clear client session/token on frontend.',
    });
};

// @route  GET /api/auth/admin/users
// @access Private (ADMIN)
exports.listUsersAdmin = async (req, res, next) => {
    try {
        const role = req.query.role ? String(req.query.role).toUpperCase() : undefined;
        if (role && !ALLOWED_ROLES.includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role filter. Allowed values: PATIENT, DOCTOR, ADMIN',
            });
        }

        let isActive;
        if (typeof req.query.isActive !== 'undefined') {
            isActive = String(req.query.isActive).toLowerCase() === 'true';
        }

        const result = await listUsers({
            role,
            isActive,
            page: req.query.page,
            limit: req.query.limit,
        });

        return res.status(200).json({
            success: true,
            data: result.items,
            pagination: result.pagination,
        });
    } catch (err) {
        return next(err);
    }
};

// @route  PATCH /api/auth/admin/users/:uid/role
// @access Private (ADMIN)
exports.updateUserRoleAdmin = async (req, res, next) => {
    try {
        const { uid } = req.params;
        const role = req.body && req.body.role ? String(req.body.role).toUpperCase() : null;

        if (!role || !ALLOWED_ROLES.includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'role must be one of PATIENT, DOCTOR, ADMIN',
            });
        }

        await setFirebaseUserRoleClaim(uid, role);
        const updated = await updateUserRole(uid, role);

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'User role updated',
            data: sanitizeUser(updated),
        });
    } catch (err) {
        if (err && err.code === 'auth/user-not-found') {
            return res.status(404).json({
                success: false,
                message: 'Firebase user not found',
            });
        }

        return next(err);
    }
};

// @route  PATCH /api/auth/admin/users/:uid/status
// @access Private (ADMIN)
exports.updateUserStatusAdmin = async (req, res, next) => {
    try {
        const { uid } = req.params;

        if (typeof req.body.isActive !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'isActive must be a boolean',
            });
        }

        const isActive = req.body.isActive;

        // Firebase uses "disabled", the app mirror uses "isActive".
        await setFirebaseUserDisabledStatus(uid, !isActive);
        const updated = await updateUserActiveStatus(uid, isActive);

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        return res.status(200).json({
            success: true,
            message: `User ${isActive ? 'activated' : 'deactivated'}`,
            data: sanitizeUser(updated),
        });
    } catch (err) {
        if (err && err.code === 'auth/user-not-found') {
            return res.status(404).json({
                success: false,
                message: 'Firebase user not found',
            });
        }

        return next(err);
    }
};

// @route  GET /api/auth/admin/doctors/pending
// @access Private (ADMIN)
exports.listPendingDoctorsAdmin = async (req, res, next) => {
    try {
        const result = await listPendingDoctors({
            page: req.query.page,
            limit: req.query.limit,
        });

        return res.status(200).json({
            success: true,
            data: result.items,
            pagination: result.pagination,
        });
    } catch (err) {
        return next(err);
    }
};

// @route  PATCH /api/auth/admin/doctors/:uid/verification
// @access Private (ADMIN)
exports.updateDoctorVerificationAdmin = async (req, res, next) => {
    try {
        const { uid } = req.params;
        const status = req.body && req.body.status;
        const notes = req.body && req.body.notes;
        const verifiedBy = req.user && req.user.uid;

        const updated = await updateDoctorVerificationStatus({
            firebaseUid: uid,
            status,
            notes,
            verifiedBy,
        });

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Doctor user not found',
            });
        }

        return res.status(200).json({
            success: true,
            message: `Doctor verification status updated to ${updated.doctorVerificationStatus}`,
            data: sanitizeUser(updated),
        });
    } catch (err) {
        return next(err);
    }
};
