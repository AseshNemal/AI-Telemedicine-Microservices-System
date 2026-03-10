require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5001;

const start = async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`[auth-service] Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    });
};

start();
