/**
 * PATH: backend/src/routes/authLogRoutes.js
 * DATETIME: 14-04-2026 11:55
 * VERSION: 1.1.0
 * DESCRIPTION: Định tuyến log bảo mật. Chỉ dành cho SYSTEM_ADMIN.
 */

const express = require('express');
const router = express.Router();
const authLogController = require('../controllers/authLogController');

// Import Middleware từ đúng thư mục src
const { verifyToken, checkRole } = require('../middlewares/authMiddleware');

/**
 * TRUY VẤN NHẬT KÝ XÁC THỰC
 * Bảo vệ 2 lớp: Token hợp lệ + Role SYSTEM_ADMIN
 */
router.get(
    '/', 
    verifyToken, 
    checkRole(['SYSTEM_ADMIN']), 
    authLogController.getLogs
);

module.exports = router;