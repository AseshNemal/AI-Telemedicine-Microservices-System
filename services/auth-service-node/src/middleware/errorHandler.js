// src/middleware/errorHandler.js

const errorHandler = (err, req, res, next) => {
    const status = err.status || 500;
    console.error(`[${new Date().toISOString()}] ${err.message}`);
    res.status(status).json({
        success: false,
        message: err.message || 'Internal Server Error',
    });
};

module.exports = errorHandler;
