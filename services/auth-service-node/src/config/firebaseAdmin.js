const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const parsePrivateKey = (privateKey) => {
    if (!privateKey) {
        return null;
    }

    return privateKey.replace(/\\n/g, '\n');
};

const resolveServiceAccountPath = (serviceAccountPath) => {
    if (!serviceAccountPath) {
        return null;
    }

    if (path.isAbsolute(serviceAccountPath)) {
        return serviceAccountPath;
    }

    const candidates = [
        path.resolve(process.cwd(), serviceAccountPath),
        path.resolve(__dirname, '../../../../', serviceAccountPath),
    ];

    return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
};

const buildCredentialsFromEnv = () => {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

    if (!projectId || !clientEmail || !privateKey) {
        return null;
    }

    return {
        projectId,
        clientEmail,
        privateKey,
    };
};

const loadCredentials = () => {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        const serviceAccountPath = resolveServiceAccountPath(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
        if (fs.existsSync(serviceAccountPath)) {
            const fileContent = fs.readFileSync(serviceAccountPath, 'utf8');
            return JSON.parse(fileContent);
        }

        console.warn(`[auth-service] Firebase service account file not found at ${serviceAccountPath}; falling back to env-field credentials.`);
    }

    const envCredentials = buildCredentialsFromEnv();
    if (envCredentials) {
        return envCredentials;
    }

    throw new Error(
        'Firebase credentials are not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.'
    );
};

const initFirebaseAdmin = () => {
    if (admin.apps.length > 0) {
        return admin.app();
    }

    const credentials = loadCredentials();
    return admin.initializeApp({
        credential: admin.credential.cert(credentials),
    });
};

const verifyFirebaseIdToken = async (idToken) => {
    initFirebaseAdmin();
    return admin.auth().verifyIdToken(idToken, true);
};

module.exports = {
    initFirebaseAdmin,
    verifyFirebaseIdToken,
};
