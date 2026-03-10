const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { registerValidation, loginValidation } = require('../middleware/authValidation');
const validateRequest = require('../middleware/validateRequest');
const { authenticateJWT } = require('../middleware/authMiddleware');

// POST /api/auth/register
router.post('/register', registerValidation, validateRequest, authController.register);

// POST /api/auth/login
router.post('/login', loginValidation, validateRequest, authController.login);

// POST /api/auth/refresh
router.post('/refresh', authController.refresh);

// GET /api/auth/me
router.get('/me', authenticateJWT, authController.me);

// POST /api/auth/logout
router.post('/logout', authenticateJWT, authController.logout);

module.exports = router;
