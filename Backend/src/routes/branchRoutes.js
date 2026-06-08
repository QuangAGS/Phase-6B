/**
 * PATH: backend/src/routes/branchRoutes.js
 * DATETIME: 14-04-2026 17:00
 * VERSION: 1.6.0
 */
const express = require('express');
const router = express.Router();
const baseController = require('../controllers/baseController');
const branchController = require('../controllers/branchController'); // Giữ lại cho các hàm đặc thù
const { verifyToken, checkRole } = require('../middlewares/authMiddleware');

// 1. Lấy bộ Controller chuẩn cho bảng branches
const branchCtrl = baseController('branches');

// --- NHÓM 1: LOGIC ĐẶC THÙ (Specialized) ---
// Phải nằm trên các route CRUD để tránh bị shadowing
router.get('/tree', verifyToken, branchController.getBranchTree);

// --- NHÓM 2: CRUD CHUẨN (Qua baseController) ---
router.get('/search', verifyToken, branchCtrl.search);
router.get('/', verifyToken, branchCtrl.getAll);
router.get('/:id', verifyToken, branchCtrl.getById);

router.post('/', verifyToken, checkRole(['USER', 'CLAN_ADMIN']), branchCtrl.create);
router.put('/:id', verifyToken, checkRole(['USER', 'CLAN_ADMIN']), branchCtrl.update);
router.delete('/:id', verifyToken, checkRole(['CLAN_ADMIN']), branchCtrl.delete);

module.exports = router;