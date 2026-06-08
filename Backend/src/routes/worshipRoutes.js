/**
 * PATH: backend/src/routes/worshipRoutes.js
 * DATETIME: 14-04-2026 17:30
 * VERSION: 1.6.0
 * DESCRIPTION: Định tuyến quản lý dữ liệu thờ cúng (worships).
 * ĐẢM BẢO: Tuân thủ luồng router -> baseController -> commonService và bảo mật Multi-tenant.
 */

const express = require('express');
const router = express.Router();
const baseController = require('../controllers/baseController');

// IMPORT Middleware bảo mật (Luồng số 2 trong Flow)
const { verifyToken, checkRole } = require('../middlewares/authMiddleware');
const validateMiddleware = require('../middlewares/validateMiddleware');

// Khởi tạo bộ điều khiển tổng quát cho bảng worships
const worshipCtrl = baseController('worships');

// --- NHÓM 1: ĐỌC DỮ LIỆU (Yêu cầu đăng nhập) ---
router.get('/search', verifyToken, worshipCtrl.search);
router.get('/', verifyToken, worshipCtrl.getAll);
router.get('/:id', verifyToken, worshipCtrl.getById);

// --- NHÓM 2: THAY ĐỔI DỮ LIỆU (Yêu cầu Role & Validation) ---

// Tạo mới: Chỉ USER hoặc ADMIN dòng họ
router.post(
    '/', 
    verifyToken, 
    checkRole(['USER', 'CLAN_ADMIN']), 
    validateMiddleware('worships'), 
    worshipCtrl.create
);

// Cập nhật: Chỉ USER hoặc ADMIN dòng họ (Service sẽ check Ownership sau)
router.put(
    '/:id', 
    verifyToken, 
    checkRole(['USER', 'CLAN_ADMIN']), 
    validateMiddleware('worships'), 
    worshipCtrl.update
);

// Xóa: Thường chỉ dành cho ADMIN dòng họ để đảm bảo an toàn dữ liệu tâm linh
router.delete(
    '/:id', 
    verifyToken, 
    checkRole(['CLAN_ADMIN']), 
    worshipCtrl.delete
);

module.exports = router;