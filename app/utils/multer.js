const multer = require('multer');
const path = require('path');

// Set storage engine
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// Check file type
function checkFileType(file, cb) {
    const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Error: Documents only (jpeg, jpg, png, gif, pdf, doc, docx)!');
    }
}

// Create upload middleware function
const createUpload = (fieldName, maxCount) => {
    return multer({
        storage: storage,
        limits: { fileSize: 10000000 }, // 10MB
        fileFilter: function (req, file, cb) {
            checkFileType(file, cb);
        }
    }).array(fieldName, maxCount);
};

module.exports = createUpload;