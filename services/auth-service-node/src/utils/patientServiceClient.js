const axios = require('axios');

const createDefaultPatientProfile = async ({ authUserId, fullName, email, phone }) => {
    const patientServiceUrl = process.env.PATIENT_SERVICE_URL;

    if (!patientServiceUrl) {
        throw new Error('PATIENT_SERVICE_URL is not configured');
    }

    if (!process.env.INTERNAL_SERVICE_KEY) {
        throw new Error('INTERNAL_SERVICE_KEY is not configured');
    }

    const baseUrls = [patientServiceUrl.replace(/\/$/, '')];
    const port = process.env.PATIENT_PORT || '5002';

    // Local runs often keep docker-style PATIENT_SERVICE_URL in .env; try localhost fallbacks automatically.
    if (patientServiceUrl.includes('patient-service')) {
        baseUrls.push(`http://localhost:${port}`, `http://127.0.0.1:${port}`);
    }

    const uniqueBaseUrls = [...new Set(baseUrls)];
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

module.exports = {
    createDefaultPatientProfile,
};
