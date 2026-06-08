
/**
 * PATH: backend/src/routes/memberRoutes.js
 * DATETIME: 14-04-2026 21:00
 * VERSION: 1.6.0
 * DESCRIPTION: Đồng bộ Routes thành viên, sửa lỗi Shadowing.
 */
const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const { verifyToken, checkRole } = require('../middlewares/authMiddleware');

// --- NHÓM 1: ROUTE TĨNH & ĐẶC THÙ (ƯU TIÊN CAO NHẤT) ---
// Đưa các route này lên đầu để tránh bị nhầm với /:id
router.get('/stats/summary', verifyToken, memberController.getStats);
router.get('/tree/:branchId', verifyToken, memberController.getMemberTree);
router.get('/focal-tree/:id', verifyToken, memberController.getFocalTree);

// --- NHÓM 2: ĐỌC DỮ LIỆU CƠ BẢN ---
router.get('/', verifyToken, memberController.getAll);
router.get('/:id', verifyToken, memberController.getById);

// --- NHÓM 3: THAY ĐỔI DỮ LIỆU (CHẶN VIEWER) ---
router.post('/', verifyToken, checkRole(['USER', 'CLAN_ADMIN']), memberController.create);
router.put('/:id', verifyToken, checkRole(['USER', 'CLAN_ADMIN']), memberController.update);

// --- NHÓM 4: XÓA DỮ LIỆU (CHỈ CLAN_ADMIN) ---
router.delete('/:id', verifyToken, checkRole(['CLAN_ADMIN']), memberController.delete);

module.exports = router;







/* VERSION 1.5.5

 * DATETIME: 13-04-2026 22:00
 * PATH: backend/src/routes/memberRoutes.js
 * VERSION: 1.6.0
 * UPDATE: 
 * 1. Sửa lỗi Shadowing ID (đưa route tĩnh lên đầu).
 * 2. Đồng bộ 100% tên hàm với memberController.
 * 3. Phân quyền chặt chẽ (VIEWER chỉ được xem).



const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const { verifyToken, checkRole } = require('../middlewares/authMiddleware');

// --- NHÓM 1: CÁC ROUTE TĨNH & ĐẶC THÙ (ƯU TIÊN CAO NHẤT) ---

// Thống kê (Phải nằm trên /:id để không bị hiểu nhầm 'stats' là một ID)
router.get('/stats/summary', verifyToken, memberController.getStats);

// Lấy cây theo chi họ
router.get('/tree/:branchId', verifyToken, memberController.getMemberTree);

// Lấy cây tập trung theo cá nhân
router.get('/focal-tree/:id', verifyToken, memberController.getFocalTree);


// --- NHÓM 2: ĐỌC DỮ LIỆU CƠ BẢN (VIEWER, USER, ADMIN) ---

// Danh sách thành viên
router.get('/', verifyToken, memberController.getAll);

// Chi tiết 1 thành viên
router.get('/:id', verifyToken, memberController.getById);


// --- NHÓM 3: THAY ĐỔI DỮ LIỆU (CHẶN VIEWER) ---

// Tạo mới: Chỉ USER (con cháu) hoặc CLAN_ADMIN
router.post(
    '/', 
    verifyToken, 
    checkRole(['USER', 'CLAN_ADMIN']), 
    memberController.create
);

// Cập nhật: Chỉ USER hoặc CLAN_ADMIN
router.put(
    '/:id', 
    verifyToken, 
    checkRole(['USER', 'CLAN_ADMIN']), 
    memberController.update
);


// --- NHÓM 4: XÓA DỮ LIỆU (CHỈ ADMIN) ---

// Xóa: Chỉ Admin dòng họ mới có quyền thực hiện
router.delete(
    '/:id', 
    verifyToken, 
    checkRole(['CLAN_ADMIN']), 
    memberController.delete
);

module.exports = router;
*/