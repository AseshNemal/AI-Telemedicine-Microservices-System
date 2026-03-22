const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const reportController = require('../controllers/reportController');
const recordsController = require('../controllers/recordsController');
const { authenticateFirebaseToken, requireRole } = require('../middleware/authMiddleware');
const { protectInternalRoute } = require('../middleware/internalAuth');
const { uploadMedicalReport } = require('../middleware/uploadMiddleware');

// Internal endpoint called by auth service after registration
router.post('/internal/create', protectInternalRoute, profileController.createDefaultProfileInternal);

// Self-service endpoints
router.get('/me', authenticateFirebaseToken, requireRole(['PATIENT']), profileController.getMyProfile);
router.put('/me', authenticateFirebaseToken, requireRole(['PATIENT']), profileController.updateMyProfile);
router.post(
    '/me/reports',
    authenticateFirebaseToken,
    requireRole(['PATIENT']),
    uploadMedicalReport,
    reportController.uploadMyReport
);
router.get('/me/reports', authenticateFirebaseToken, requireRole(['PATIENT']), reportController.listMyReports);
router.delete('/me/reports/:reportId', authenticateFirebaseToken, requireRole(['PATIENT']), reportController.deleteMyReport);
router.get('/me/prescriptions', authenticateFirebaseToken, requireRole(['PATIENT']), recordsController.listMyPrescriptions);
router.get('/me/history', authenticateFirebaseToken, requireRole(['PATIENT']), recordsController.listMyMedicalHistory);

router.get('/internal/:authUserId', protectInternalRoute, profileController.getByAuthUserId);

module.exports = router;
