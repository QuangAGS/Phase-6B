/**
 * PATH: backend/src/routes/tenantRoutes.js
 * DATETIME: 14-04-2026 15:45
 * VERSION: 1.6.6
 * DESCRIPTION: Sửa lỗi Shadowing và đồng bộ luồng Onboarding BR3.
 */
const express = require('express');
const router = express.Router();
const baseController = require('../controllers/baseController');
const { verifyToken, checkRole } = require('../middlewares/authMiddleware');
const validateMiddleware = require('../middlewares/validateMiddleware');

const tenantCtrl = baseController('tenants');

// --- NHÓM 1: PUBLIC ROUTES (Dành cho Onboarding/Guest) ---

// Tìm kiếm slug: Phải đặt lên đầu để tránh bị nhầm với :id
router.get('/search', tenantCtrl.search);

// Xem chi tiết: Công khai (Để lấy Logo/Màu sắc dòng họ khi xem cây công khai)
router.get('/:id', tenantCtrl.getById);


// --- NHÓM 2: PROTECTED ROUTES (Yêu cầu Token & Quyền hạn) ---

// 1. Xem danh sách: Chỉ SYSTEM_ADMIN
router.get('/', verifyToken, checkRole(['SYSTEM_ADMIN']), tenantCtrl.getAll);

// 2. Tạo mới (Quản trị): Chỉ SYSTEM_ADMIN tạo trực tiếp tại đây
// Lưu ý: Người dùng bình thường tạo Tenant qua route /api/auth/register
router.post(
    '/', 
    verifyToken, 
    checkRole(['SYSTEM_ADMIN']), 
    validateMiddleware('tenants'), 
    tenantCtrl.create
);

// 3. Cập nhật: CLAN_ADMIN sửa dòng họ mình
router.put(
    '/:id', 
    verifyToken, 
    checkRole(['CLAN_ADMIN']), 
    validateMiddleware('tenants'), 
    tenantCtrl.update
);

// 4. Xóa: Chỉ SYSTEM_ADMIN
router.delete('/:id', verifyToken, checkRole(['SYSTEM_ADMIN']), tenantCtrl.delete);

module.exports = router;