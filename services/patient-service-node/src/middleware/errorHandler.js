const errorHandler = (err, req, res, next) => {
    if (err && err.name === 'MulterError') {
        return res.status(400).json({
            success: false,
            message: err.message,
        });
    }

    const status = err.status || 500;
    console.error(`[${new Date().toISOString()}] ${err.message}`);
    res.status(status).json({
        success: false,
        message: err.message || 'Internal Server Error',
    });
};

module.exports = errorHandler;
