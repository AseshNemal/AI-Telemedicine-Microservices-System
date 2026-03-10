const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { authenticateJWT, requireRole } = require('../middleware/authMiddleware');
const { protectInternalRoute } = require('../middleware/internalAuth');
const { uploadMedicalReport } = require('../middleware/uploadMiddleware');

router.post('/', patientController.createPatientProfile);

// Internal endpoint called by auth service after registration
router.post('/internal/create', protectInternalRoute, patientController.createDefaultProfileInternal);

// Self-service endpoints
router.get('/me', authenticateJWT, requireRole(['PATIENT']), patientController.getMyProfile);
router.put('/me', authenticateJWT, requireRole(['PATIENT']), patientController.updateMyProfile);
router.post(
    '/me/reports',
    authenticateJWT,
    requireRole(['PATIENT']),
    uploadMedicalReport,
    patientController.uploadMyReport
);
router.get('/me/reports', authenticateJWT, requireRole(['PATIENT']), patientController.listMyReports);
router.delete('/me/reports/:reportId', authenticateJWT, requireRole(['PATIENT']), patientController.deleteMyReport);
router.get('/me/prescriptions', authenticateJWT, requireRole(['PATIENT']), patientController.listMyPrescriptions);
router.get('/me/history', authenticateJWT, requireRole(['PATIENT']), patientController.listMyMedicalHistory);

router.get('/:authUserId', patientController.getByAuthUserId);

module.exports = router;
