require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5002;

const start = async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`[patient-service] Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    });
};

start();
