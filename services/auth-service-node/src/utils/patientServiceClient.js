const axios = require('axios');

const createDefaultPatientProfile = async ({ authUserId, fullName, email, phone }) => {
    const patientServiceUrl = process.env.PATIENT_SERVICE_URL;

    if (!patientServiceUrl) {
        throw new Error('PATIENT_SERVICE_URL is not configured');
    }

    if (!process.env.INTERNAL_SERVICE_KEY) {
        throw new Error('INTERNAL_SERVICE_KEY is not configured');
    }

    const endpoint = `${patientServiceUrl.replace(/\/$/, '')}/api/patients/internal/create`;

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
};

module.exports = {
    createDefaultPatientProfile,
};
