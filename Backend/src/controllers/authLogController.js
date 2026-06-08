/*
 * DATETIME: 09-04-2026 17:15
 * PATH: backend/controller/authLogController.js
 * VERSION: 1.0.0
 * Mục đích: Phục vụ onboarding process.
 */

const authLogService = require('../services/authLogService');

const authLogController = {
  // Chỉ dùng cho Admin xem lịch sử
  getLogs: async (req, res) => {
    try {
      const data = await authLogService.getAll();
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

module.exports = authLogController;