const swaggerJSDoc = require('swagger-jsdoc');

const authPort = process.env.AUTH_PORT || process.env.PORT || '5001';
const authServerUrl = `http://localhost:${authPort}`;

const options = {
    definition: {
        openapi: '3.0.3',
        info: {
            title: 'Auth Service API',
            version: '2.0.0',
            description: 'Firebase-auth-only user registration and identity APIs for telemedicine platform.',
        },
        servers: [
            {
                url: authServerUrl,
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'Firebase ID Token',
                },
            },
            schemas: {
                RegisterRequest: {
                    type: 'object',
                    required: ['fullName', 'email', 'password'],
                    properties: {
                        fullName: { type: 'string', example: 'John Doe' },
                        email: { type: 'string', format: 'email', example: 'john@example.com' },
                        password: { type: 'string', minLength: 8, example: 'Pass1234!' },
                        phone: { type: 'string', example: '+94771234567' },
                        role: { type: 'string', enum: ['PATIENT', 'DOCTOR', 'ADMIN'], example: 'PATIENT' },
                    },
                },
                MeResponse: {
                    type: 'object',
                    properties: {
                        uid: { type: 'string' },
                        email: { type: 'string', format: 'email', nullable: true },
                        fullName: { type: 'string', nullable: true },
                        role: { type: 'string', enum: ['PATIENT', 'DOCTOR', 'ADMIN'] },
                        emailVerified: { type: 'boolean' },
                        appUser: {
                            type: 'object',
                            nullable: true,
                        },
                    },
                },
                UpdateRoleRequest: {
                    type: 'object',
                    required: ['role'],
                    properties: {
                        role: { type: 'string', enum: ['PATIENT', 'DOCTOR', 'ADMIN'] },
                    },
                },
                UpdateStatusRequest: {
                    type: 'object',
                    required: ['isActive'],
                    properties: {
                        isActive: { type: 'boolean' },
                    },
                },
                UpdateDoctorVerificationRequest: {
                    type: 'object',
                    required: ['status'],
                    properties: {
                        status: { type: 'string', enum: ['VERIFIED', 'REJECTED'] },
                        notes: { type: 'string' },
                    },
                },
            },
        },
        paths: {
            '/health': {
                get: {
                    tags: ['System'],
                    summary: 'Health check',
                    responses: {
                        200: {
                            description: 'Service healthy',
                        },
                    },
                },
            },
            '/api/auth/register': {
                post: {
                    tags: ['Auth'],
                    summary: 'Register user in Firebase and assign role claim',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/RegisterRequest' },
                            },
                        },
                    },
                    responses: {
                        201: { description: 'User registered' },
                        400: { description: 'Validation or Firebase input error' },
                        409: { description: 'Email already exists' },
                    },
                },
            },
            '/api/auth/me': {
                get: {
                    tags: ['Auth'],
                    summary: 'Get current Firebase-authenticated user profile',
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: {
                            description: 'Profile returned',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            success: { type: 'boolean' },
                                            data: { $ref: '#/components/schemas/MeResponse' },
                                        },
                                    },
                                },
                            },
                        },
                        401: { description: 'Unauthorized' },
                    },
                },
            },
            '/api/auth/logout': {
                post: {
                    tags: ['Auth'],
                    summary: 'Acknowledge logout for Firebase-auth-only clients',
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: 'Logout acknowledged' },
                        401: { description: 'Unauthorized' },
                    },
                },
            },
            '/api/auth/admin/users': {
                get: {
                    tags: ['Admin'],
                    summary: 'List platform users with optional filters',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            in: 'query',
                            name: 'role',
                            schema: { type: 'string', enum: ['PATIENT', 'DOCTOR', 'ADMIN'] },
                        },
                        {
                            in: 'query',
                            name: 'isActive',
                            schema: { type: 'boolean' },
                        },
                        {
                            in: 'query',
                            name: 'page',
                            schema: { type: 'integer', minimum: 1 },
                        },
                        {
                            in: 'query',
                            name: 'limit',
                            schema: { type: 'integer', minimum: 1, maximum: 100 },
                        },
                    ],
                    responses: {
                        200: { description: 'Users returned' },
                        401: { description: 'Unauthorized' },
                        403: { description: 'Forbidden' },
                    },
                },
            },
            '/api/auth/admin/users/{uid}/role': {
                patch: {
                    tags: ['Admin'],
                    summary: 'Update user role claim and mirror record',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            in: 'path',
                            name: 'uid',
                            required: true,
                            schema: { type: 'string' },
                        },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/UpdateRoleRequest' },
                            },
                        },
                    },
                    responses: {
                        200: { description: 'Role updated' },
                        400: { description: 'Validation failed' },
                        401: { description: 'Unauthorized' },
                        403: { description: 'Forbidden' },
                        404: { description: 'User not found' },
                    },
                },
            },
            '/api/auth/admin/users/{uid}/status': {
                patch: {
                    tags: ['Admin'],
                    summary: 'Activate or deactivate user account',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            in: 'path',
                            name: 'uid',
                            required: true,
                            schema: { type: 'string' },
                        },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/UpdateStatusRequest' },
                            },
                        },
                    },
                    responses: {
                        200: { description: 'Status updated' },
                        400: { description: 'Validation failed' },
                        401: { description: 'Unauthorized' },
                        403: { description: 'Forbidden' },
                        404: { description: 'User not found' },
                    },
                },
            },
            '/api/auth/admin/doctors/pending': {
                get: {
                    tags: ['Admin'],
                    summary: 'List pending doctor registrations for verification',
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: 'Pending doctors returned' },
                        401: { description: 'Unauthorized' },
                        403: { description: 'Forbidden' },
                    },
                },
            },
            '/api/auth/admin/doctors/{uid}/verification': {
                patch: {
                    tags: ['Admin'],
                    summary: 'Verify or reject a doctor registration',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            in: 'path',
                            name: 'uid',
                            required: true,
                            schema: { type: 'string' },
                        },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/UpdateDoctorVerificationRequest' },
                            },
                        },
                    },
                    responses: {
                        200: { description: 'Doctor verification updated' },
                        400: { description: 'Validation failed' },
                        401: { description: 'Unauthorized' },
                        403: { description: 'Forbidden' },
                        404: { description: 'Doctor not found' },
                    },
                },
            },
        },
    },
    apis: [],
};

module.exports = swaggerJSDoc(options);
