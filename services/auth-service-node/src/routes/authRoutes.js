const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { registerValidation } = require('../middleware/authValidation');
const validateRequest = require('../middleware/validateRequest');
const { authenticateFirebaseToken } = require('../middleware/authMiddleware');

// POST /api/auth/register
router.post('/register', registerValidation, validateRequest, authController.register);

// GET /api/auth/me
router.get('/me', authenticateFirebaseToken, authController.me);

// POST /api/auth/logout
router.post('/logout', authenticateFirebaseToken, authController.logout);

module.exports = router;
