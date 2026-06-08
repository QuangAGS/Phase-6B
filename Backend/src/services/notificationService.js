/**
 * PATH: backend/src/services/notificationService.js
 * DATETIME: 14-04-2026 13:10
 * VERSION: 1.1.0
 * DESCRIPTION: Quản lý thông báo người dùng.
 * SỬA LỖI: Cập nhật đường dẫn import ../lib/prisma chính xác.
 */

const { basePrisma } = require('../lib/prisma');
const { v4: uuidv4 } = require('uuid');

const notificationService = {
  // Tạo thông báo khi Approve/Reject
  create: async (userId, title, content, type = 'HE_THONG') => {
    return await basePrisma.notifications.create({
      data: {
        id: uuidv4(),
        user_id: userId,
        type,
        title,
        content,
        is_read: false
      }
    });
  },

  // Lấy thông báo theo người dùng
  getByUser: async (userId) => {
    // Luôn lọc deleted_at IS NULL để đảm bảo tính vét cạn
    return await basePrisma.notifications.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: { created_at: 'desc' }
    });
  },

  // Đánh dấu đã đọc
  markAsRead: async (id) => {
    return await basePrisma.notifications.update({
      where: { id },
      data: { is_read: true }
    });
  }
};

module.exports = notificationService;