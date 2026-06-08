/**
 * DATETIME: 13-04-2026 21:55
 * PATH: backend/src/controllers/memberController.js
 * VERSION: 1.5.0
 * DESCRIPTION: Điều phối Thành viên. 
 * Đảm bảo đầy đủ các hàm getAll, getById, create, update, delete, getStats.
 */
const memberService = require('../services/memberService');

const memberController = {
  // Lấy danh sách toàn bộ thành viên trong Tenant
  getAll: async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      // Giả định memberService đã có hàm getAllMembers
      const result = await memberService.getAllMembers(tenantId);
      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  // Lấy chi tiết 1 thành viên
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      const result = await memberService.getMemberById(id, tenantId);
      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  // Tạo mới thành viên (Dùng lại logic createFullMember cũ)
  create: async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const result = await memberService.createFullMember(req.body, tenantId);
      res.status(201).json({ status: 'success', data: result });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  // Cập nhật thành viên (Dùng lại logic updateFullMember cũ)
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      const result = await memberService.updateFullMember(id, req.body, tenantId);
      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  // Xóa thành viên
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      await memberService.deleteMember(id, tenantId);
      res.status(200).json({ status: 'success', message: 'Đã xóa thành viên khỏi phả hệ' });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  // Cấu trúc cây phả hệ theo nhánh (Dùng cho giao diện Tree)
  getMemberTree: async (req, res) => {
    try {
      const { branchId } = req.params;
      const tenantId = req.user?.tenantId;
      const raw = await memberService.getRawMembersForTree(branchId, tenantId);
      const tree = memberService.buildTreeLogic(raw);
      res.status(200).json({ status: 'success', data: tree });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  // Cấu trúc cây tập trung vào 1 cá nhân (Focal Tree)
  getFocalTree: async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      const data = await memberService.getFocalTreeData(id, tenantId);
      res.status(200).json({ status: 'success', data });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  // Thống kê thành viên
  getStats: async (req, res) => {
    try {
      // Tạm thời trả về thông báo chờ xử lý service
      res.json({ status: 'success', message: "Tính năng thống kê đang được phát triển." });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },
};

module.exports = memberController;