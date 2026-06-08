/**
 * PATH: backend/src/controllers/baseController.js
 * DATETIME: 20-04-2026 09:45
 * VERSION: 2.2.0
 * DESCRIPTION: 
 * - NÂNG CẤP: Hàm search thông minh, tự động đóng gói toàn bộ req.query thành bộ lọc.
 * - BIZ RULE: Ép lọc status='DA_DUYET' khi tìm kiếm bảng 'tenants' để gia nhập.
 * - Q1: Bảo tồn cấu trúc flat controller. Q2: Ghi chú nghiệp vụ.
 */

const commonService = require('../services/commonService');

const baseController = (tableName) => {
  return {
    getAll: async (req, res) => {
      try {
        const data = await commonService.getAll(tableName);
        res.status(200).json({ status: 'success', data });
      } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
      }
    },

    getById: async (req, res) => {
      try {
        const data = await commonService.getById(tableName, req.params.id);
        if (!data) return res.status(404).json({ status: 'error', message: 'Không tìm thấy bản ghi' });
        res.status(200).json({ status: 'success', data });
      } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
      }
    },

    create: async (req, res) => {
      try {
        // Truyền currentUser (req.user) từ Middleware xuống
        const result = await commonService.create(tableName, req.body, req.user);
        res.status(201).json({ status: 'success', data: result });
      } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
      }
    },

    update: async (req, res) => {
      try {
        const result = await commonService.update(tableName, req.params.id, req.body, req.user);
        res.status(200).json({ status: 'success', data: result });
      } catch (error) {
        // Trả về 403 nếu lỗi vi phạm Ownership Check
        const status = error.message.includes('Bảo mật') ? 403 : 500;
        res.status(status).json({ status: 'error', message: error.message });
      }
    },

    delete: async (req, res) => {
      try {
        const { change_reason } = req.body;
        const result = await commonService.delete(tableName, req.params.id, req.user, change_reason);
        res.status(200).json({ status: 'success', message: 'Xóa thành công' });
      } catch (error) {
        const status = error.message.includes('Bảo mật') ? 403 : 500;
        res.status(status).json({ status: 'error', message: error.message });
      }
    },

    /**
     * SEARCH: Đa năng
     */
    search: async (req, res) => {
      try {
        const { q, field = 'name', ...otherFilters } = req.query;
        
        // 1. Đóng gói filters
        let searchCriteria = { ...otherFilters };
        if (q) searchCriteria[field] = q;

        // 2. BIZ RULE: Nếu đang tìm kiếm dòng họ công khai, chỉ lấy những dòng đã duyệt
        if (tableName === 'tenants') {
          searchCriteria.status = 'DA_DUYET';
        }

        const data = await commonService.search(tableName, searchCriteria);
        res.status(200).json({ status: 'success', data });
      } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
      }
    }
  };
};

module.exports = baseController;