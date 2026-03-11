const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const app = require('./app');
const connectDB = require('./config/db');
const { initFirebaseAdmin } = require('./config/firebaseAdmin');

const PORT = process.env.AUTH_PORT || process.env.PORT || 5001;

const start = async () => {
    initFirebaseAdmin();
    await connectDB();
    app.listen(PORT, () => {
        console.log(`[auth-service] Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    });
};

start();
