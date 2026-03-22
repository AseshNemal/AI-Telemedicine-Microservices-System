const protectInternalRoute = (req, res, next) => {
    const requestKey = req.headers['x-internal-key'];

    if (!process.env.INTERNAL_SERVICE_KEY) {
        return res.status(500).json({
            success: false,
            message: 'INTERNAL_SERVICE_KEY is not configured',
        });
    }

    if (!requestKey || requestKey !== process.env.INTERNAL_SERVICE_KEY) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized internal request',
        });
    }

    return next();
};

module.exports = {
    protectInternalRoute,
};
