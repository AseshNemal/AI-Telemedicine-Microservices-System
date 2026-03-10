const swaggerJSDoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.3',
        info: {
            title: 'Patient Service API',
            version: '1.0.0',
            description: 'Patient profile, reports, prescriptions, and history APIs.',
        },
        servers: [
            {
                url: 'http://localhost:5002',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
                internalKey: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'x-internal-key',
                },
            },
            schemas: {
                InternalCreateRequest: {
                    type: 'object',
                    required: ['authUserId', 'fullName', 'email'],
                    properties: {
                        authUserId: { type: 'string' },
                        fullName: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                        phone: { type: 'string', nullable: true },
                    },
                },
                UpdateProfileRequest: {
                    type: 'object',
                    properties: {
                        phone: { type: 'string' },
                        address: { type: 'string' },
                        dob: { type: 'string', format: 'date' },
                        bloodGroup: { type: 'string', example: 'O+' },
                        allergies: { type: 'array', items: { type: 'string' } },
                        chronicConditions: { type: 'array', items: { type: 'string' } },
                        emergencyContact: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                relationship: { type: 'string' },
                                phone: { type: 'string' },
                            },
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
                        200: { description: 'Service healthy' },
                    },
                },
            },
            '/api/patients/internal/create': {
                post: {
                    tags: ['Internal'],
                    summary: 'Create default patient profile (internal auth service use)',
                    security: [{ internalKey: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/InternalCreateRequest' },
                            },
                        },
                    },
                    responses: {
                        201: { description: 'Patient profile created' },
                        401: { description: 'Invalid internal key' },
                    },
                },
            },
            '/api/patients/me': {
                get: {
                    tags: ['Patient'],
                    summary: 'Get own profile',
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: 'Profile returned' },
                        401: { description: 'Unauthorized' },
                        404: { description: 'Profile not found' },
                    },
                },
                put: {
                    tags: ['Patient'],
                    summary: 'Update own profile',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/UpdateProfileRequest' },
                            },
                        },
                    },
                    responses: {
                        200: { description: 'Profile updated' },
                        401: { description: 'Unauthorized' },
                    },
                },
            },
            '/api/patients/me/reports': {
                get: {
                    tags: ['Reports'],
                    summary: 'List own medical reports',
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: 'Reports returned' },
                        401: { description: 'Unauthorized' },
                    },
                },
                post: {
                    tags: ['Reports'],
                    summary: 'Upload own medical report',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'multipart/form-data': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        file: { type: 'string', format: 'binary' },
                                        description: { type: 'string' },
                                    },
                                    required: ['file'],
                                },
                            },
                        },
                    },
                    responses: {
                        201: { description: 'Report uploaded' },
                        400: { description: 'Invalid file/request' },
                    },
                },
            },
            '/api/patients/me/reports/{reportId}': {
                delete: {
                    tags: ['Reports'],
                    summary: 'Delete own report',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            in: 'path',
                            name: 'reportId',
                            required: true,
                            schema: { type: 'string' },
                        },
                    ],
                    responses: {
                        200: { description: 'Report deleted' },
                        404: { description: 'Report not found' },
                    },
                },
            },
            '/api/patients/me/prescriptions': {
                get: {
                    tags: ['Prescriptions'],
                    summary: 'List own prescriptions',
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: 'Prescriptions returned' },
                        401: { description: 'Unauthorized' },
                    },
                },
            },
            '/api/patients/me/history': {
                get: {
                    tags: ['Medical History'],
                    summary: 'List own medical history',
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: 'History returned' },
                        401: { description: 'Unauthorized' },
                    },
                },
            },
        },
    },
    apis: [],
};

module.exports = swaggerJSDoc(options);
