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
        },
    },
    apis: [],
};

module.exports = swaggerJSDoc(options);
