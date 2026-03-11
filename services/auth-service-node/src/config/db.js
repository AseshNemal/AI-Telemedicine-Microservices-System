const mongoose = require('mongoose');

const RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 3000;

const connectDB = async () => {
    const uri = process.env.MONGO_URI || process.env.AUTH_MONGO_URI || process.env.DATABASE_URL;
    if (!uri) {
        console.error('[auth-service] MONGO_URI/AUTH_MONGO_URI/DATABASE_URL is not defined in environment variables');
        process.exit(1);
    }

    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
        try {
            await mongoose.connect(uri);
            console.log('[auth-service] MongoDB connected successfully');
            return;
        } catch (err) {
            const isLast = attempt === RETRY_ATTEMPTS;
            console.error(`[auth-service] MongoDB connection attempt ${attempt}/${RETRY_ATTEMPTS} failed: ${err.message}`);

            if (isLast) {
                process.exit(1);
            }

            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }
};

module.exports = connectDB;
