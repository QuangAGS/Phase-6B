/**
 * PATH: backend/src/services/mediaService.js
 * DATETIME: 14-04-2026 22:00
 * VERSION: 1.0.0
 * DESCRIPTION: Quản lý Multimedia và Tài liệu. Hỗ trợ lưu trữ tập trung.
 */

const { prisma } = require('../lib/prisma');
const { v4: uuidv4 } = require('uuid');
const auditService = require('./auditService');

const mediaService = {
  /**
   * ĐĂNG KÝ MEDIA: Lưu thông tin file sau khi đã upload lên Storage
   * @param {Object} fileData - Thông tin từ Storage provider trả về
   * @param {Object} currentUser - Thông tin người thực hiện
   */
  registerMedia: async (fileData, currentUser) => {
    const { userId, tenantId } = currentUser;
    const { 
      entity_id, 
      entity_type, 
      file_url, 
      file_name, 
      file_type, 
      file_size,
      change_reason 
    } = fileData;

    const newMedia = await prisma.media.create({
      data: {
        id: uuidv4(),
        entity_id,
        entity_type,
        file_url,
        file_name,
        file_type,
        file_size,
        tenant_id: tenantId,
        uploaded_by: userId,
        changed_by: userId
      }
    });

    await auditService.logAction(
      'THEM_MOI', 
      'media', 
      newMedia.id, 
      null, 
      newMedia, 
      userId, 
      change_reason || `Tải lên tài liệu cho ${entity_type}`, 
      tenantId
    );

    return newMedia;
  },

  /**
   * LẤY MEDIA THEO THỰC THỂ: (Ví dụ: Lấy tất cả ảnh của 1 thành viên)
   */
  getByEntity: async (entityType, entityId) => {
    return await prisma.media.findMany({
      where: {
        entity_type: entityType,
        entity_id: entityId,
        deleted_at: null
      },
      orderBy: { created_at: 'desc' }
    });
  },

  /**
   * XÓA MEDIA: (Xóa mềm trong DB và logic xóa trên Cloud Storage)
   */
  deleteMedia: async (id, currentUser, reason) => {
    const { userId, tenantId, role } = currentUser;

    const oldMedia = await prisma.media.findUnique({ where: { id } });
    if (!oldMedia) throw new Error("File không tồn tại.");

    // Ownership Check: Chỉ người upload hoặc Admin mới được xóa
    if (role === 'USER' && oldMedia.uploaded_by !== userId) {
      throw new Error("Bảo mật: Bạn không có quyền xóa tài liệu của người khác.");
    }

    const deleted = await prisma.media.delete({ where: { id } });

    await auditService.logAction(
      'XOA', 
      'media', 
      id, 
      oldMedia, 
      null, 
      userId, 
      reason || "Xóa tài liệu", 
      tenantId
    );

    return deleted;
  }
};

module.exports = mediaService;