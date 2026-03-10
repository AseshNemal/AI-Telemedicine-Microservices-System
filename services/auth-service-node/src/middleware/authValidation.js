const { body } = require('express-validator');

const allowedRoles = ['PATIENT', 'DOCTOR', 'ADMIN'];

const registerValidation = [
    body('fullName').trim().notEmpty().withMessage('fullName is required'),
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password')
        .isString()
        .withMessage('password must be a string')
        .isLength({ min: 8 })
        .withMessage('password must be at least 8 characters long'),
    body('phone').optional({ nullable: true }).isString().withMessage('phone must be a string'),
    body('role')
        .optional()
        .isIn(allowedRoles)
        .withMessage('role must be one of PATIENT, DOCTOR, ADMIN'),
];

const loginValidation = [
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isString().withMessage('password is required').notEmpty().withMessage('password is required'),
];

module.exports = {
    registerValidation,
    loginValidation,
};
