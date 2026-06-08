/**
 * PATH: backend/src/controllers/notificationController.js
 * DATETIME: 14-04-2026 13:15
 * VERSION: 1.1.0
 * DESCRIPTION: Điều phối thông báo cá nhân.
 * SỬA LỖI: Đồng bộ thuộc tính userId từ req.user.
 */

const notificationService = require('../services/notificationService');

const notificationController = {
  // Lấy thông báo cá nhân
  getMyNotifications: async (req, res) => {
    try {
      // SỬA LỖI: Trong authMiddleware V1.6.0, chúng ta dùng userId thay vì id
      const userId = req.user.userId; 
      const data = await notificationService.getByUser(userId);
      res.status(200).json({ status: 'success', data });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  // Xử lý đánh dấu đã đọc
  markRead: async (req, res) => {
    try {
      const { id } = req.params;
      await notificationService.markAsRead(id);
      res.status(200).json({ status: 'success', message: "Đã đọc thông báo" });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
};

module.exports = notificationController;