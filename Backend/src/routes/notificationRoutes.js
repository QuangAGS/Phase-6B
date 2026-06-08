/**
 * PATH: backend/src/routes/notificationRoutes.js
 * DATETIME: 14-04-2026 21:50
 * VERSION: 1.2.0
 */
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { verifyToken } = require('../middlewares/authMiddleware');

// Lấy danh sách thông báo của tôi
router.get('/', verifyToken, notificationController.getMyNotifications);

// Đánh dấu đã đọc: Dùng Patch và cấu trúc rõ ràng
// Lưu ý: Đưa các route thao tác cụ thể lên trên nếu có route /:id tổng quát
router.patch('/:id/read', verifyToken, notificationController.markRead);

module.exports = router;