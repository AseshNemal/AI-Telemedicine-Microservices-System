const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadDir = path.join(__dirname, '../../uploads/reports');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, uniqueName);
    },
});

const fileFilter = (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
        const err = new Error('Unsupported file type. Only PDF, JPG, JPEG, PNG are allowed');
        err.status = 400;
        return cb(err);
    }

    return cb(null, true);
};

const uploadMedicalReport = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
}).single('file');

module.exports = {
    uploadMedicalReport,
};
