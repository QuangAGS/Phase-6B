// /** Lưu ý không phải dùng file này nữ (được thay bằng baseController)
// file: src/controllers/addressController.js
const commonService = require('../services/commonService');

// 1. Lấy danh sách (Khớp với addressCtrl.getAll trong Routes)
const getAll = async (req, res) => {
  try {
    const data = await commonService.getAll('addresses');
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// 2. Lấy chi tiết theo ID
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await commonService.getById('addresses', id);
    if (!data) return res.status(404).json({ status: 'error', message: 'Không tìm thấy địa chỉ' });
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// 3. Tạo mới
const create = async (req, res) => {
  try {
    const result = await commonService.create('addresses', req.body);
    res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// 4. Cập nhật
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await commonService.update('addresses', id, req.body);
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// 5. Xóa mềm
const deleteaddress = async (req, res) => {
  try {
    const { id } = req.params;
    const { changed_by, change_reason } = req.body;
    const result = await commonService.delete('addresses', id, changed_by, change_reason);
    res.status(200).json({ status: 'success', message: 'Xóa thành công', data: result });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// 6. Tìm kiếm
const search = async (req, res) => {
  try {
    const { q } = req.query;
    const result = await commonService.search('addresses', 'name', q);
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// Export theo dạng Object để Router gọi được addressCtrl.getAll
module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: deleteaddress, // Đổi tên để tránh trùng từ khóa hệ thống
  search
};