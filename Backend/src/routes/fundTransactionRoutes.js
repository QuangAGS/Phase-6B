/**
 * PATH: backend/src/routes/fundTransactionRoutes.js
 * DATETIME: 14-04-2026 21:45
 * VERSION: 1.0.0
 */

// fundTransactionRoutes.js
const express = require('express');
const router = express.Router();
const baseController = require('../controllers/baseController');
const { verifyToken, checkRole } = require('../middlewares/authMiddleware');

const fundTransCtrl = baseController('fund_transactions');

router.get('/', verifyToken, fundTransCtrl.getAll);
router.get('/:id', verifyToken, fundTransCtrl.getById);

// Chỉ Admin dòng họ mới được ghi chép thu chi
router.post('/', verifyToken, checkRole(['CLAN_ADMIN']), fundTransCtrl.create);
router.delete('/:id', verifyToken, checkRole(['CLAN_ADMIN']), fundTransCtrl.delete);

module.exports = router;