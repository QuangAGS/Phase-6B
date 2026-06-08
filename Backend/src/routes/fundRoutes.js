/**
 * PATH: backend/src/routes/fundRoutes.js
 * DATETIME: 14-04-2026 21:45
 * VERSION: 1.0.0
 */

// fundactionRoutes.js
const express = require('express');
const router = express.Router();
const baseController = require('../controllers/baseController');
const { verifyToken, checkRole } = require('../middlewares/authMiddleware');

const fundCtrl = baseController('funds');

router.get('/', verifyToken, fundCtrl.getAll);
router.get('/:id', verifyToken, fundCtrl.getById);

// Chỉ Admin dòng họ mới được ghi chép thu chi
router.post('/', verifyToken, checkRole(['CLAN_ADMIN']), fundCtrl.create);
router.delete('/:id', verifyToken, checkRole(['CLAN_ADMIN']), fundCtrl.delete);

module.exports = router;