const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const authController = require('./controllers/authController');
const { registerValidation } = require('./middleware/authValidation');
const validateRequest = require('./middleware/validateRequest');
const { authenticateFirebaseToken } = require('./middleware/authMiddleware');
const swaggerSpec = require('./docs/swagger');

const app = express();

// Security & parsing middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => res.status(200).json(swaggerSpec));

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'auth-service' });
});

// Routes
app.use('/api/auth', authRoutes);

// Backwards-compatible root routes (some clients call /register, /me directly)
app.post('/register', registerValidation, validateRequest, authController.register);
app.get('/me', authenticateFirebaseToken, authController.me);
app.post('/logout', authenticateFirebaseToken, authController.logout);

// 404
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// Centralised error handler
app.use(errorHandler);

module.exports = app;
