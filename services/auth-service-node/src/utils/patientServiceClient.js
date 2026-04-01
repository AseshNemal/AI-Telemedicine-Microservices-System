const axios = require('axios');

const getCandidatePatientServiceBaseUrls = () => {
    const patientServiceUrl = process.env.PATIENT_SERVICE_URL;

    if (!patientServiceUrl) {
        throw new Error('PATIENT_SERVICE_URL is not configured');
    }

    const baseUrls = [patientServiceUrl.replace(/\/$/, '')];
    const port = process.env.PATIENT_PORT || '5002';

    // Local runs often keep docker-style PATIENT_SERVICE_URL in .env; try localhost fallbacks automatically.
    if (patientServiceUrl.includes('patient-service')) {
        baseUrls.push(`http://localhost:${port}`, `http://127.0.0.1:${port}`);
    }

    return [...new Set(baseUrls)];
};

const createDefaultPatientProfile = async ({ authUserId, fullName, email, phone }) => {
    if (!process.env.INTERNAL_SERVICE_KEY) {
        throw new Error('INTERNAL_SERVICE_KEY is not configured');
    }

    const uniqueBaseUrls = getCandidatePatientServiceBaseUrls();
    let lastError;

    for (const baseUrl of uniqueBaseUrls) {
        const endpoint = `${baseUrl}/api/patients/internal/create`;
        try {
            const response = await axios.post(
                endpoint,
                {
                    authUserId,
                    fullName,
                    email,
                    phone,
                },
                {
                    headers: {
                        'x-internal-key': process.env.INTERNAL_SERVICE_KEY,
                    },
                    timeout: 5000,
                }
            );

            return response.data;
        } catch (err) {
            lastError = err;
        }
    }

    throw lastError;
};

const getOrCreatePatientProfile = async ({ authUserId, fullName, email, phone }) => {
    if (!process.env.INTERNAL_SERVICE_KEY) {
        throw new Error('INTERNAL_SERVICE_KEY is not configured');
    }

    const uniqueBaseUrls = getCandidatePatientServiceBaseUrls();
    let lastError;

    for (const baseUrl of uniqueBaseUrls) {
        try {
            const existing = await axios.get(`${baseUrl}/api/patients/internal/${encodeURIComponent(authUserId)}`, {
                headers: {
                    'x-internal-key': process.env.INTERNAL_SERVICE_KEY,
                },
                timeout: 5000,
            });

            return {
                status: 'exists',
                data: existing.data,
            };
        } catch (err) {
            // If the profile does not exist yet, create it.
            if (err.response && err.response.status === 404) {
                const created = await axios.post(
                    `${baseUrl}/api/patients/internal/create`,
                    {
                        authUserId,
                        fullName,
                        email,
                        phone,
                    },
                    {
                        headers: {
                            'x-internal-key': process.env.INTERNAL_SERVICE_KEY,
                        },
                        timeout: 5000,
                    }
                );

                return {
                    status: 'created',
                    data: created.data,
                };
            }

            lastError = err;
        }
    }

    throw lastError;
};

module.exports = {
    createDefaultPatientProfile,
    getOrCreatePatientProfile,
};
