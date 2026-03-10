const mongoose = require('mongoose');

const connectDB = async () => {
    const uri = process.env.MONGO_URI;

    if (!uri) {
        console.error('[patient-service] MONGO_URI is not defined in environment variables');
        process.exit(1);
    }

    try {
        await mongoose.connect(uri);
        console.log('[patient-service] MongoDB connected successfully');
    } catch (err) {
        console.error('[patient-service] MongoDB connection error:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
