const mongoose = require('mongoose');

const connectDB = async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error('[auth-service] MONGO_URI is not defined in environment variables');
        process.exit(1);
    }

    try {
        await mongoose.connect(uri);
        console.log('[auth-service] MongoDB connected successfully');
    } catch (err) {
        console.error('[auth-service] MongoDB connection error:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
