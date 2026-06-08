/**
 * PATH: backend/src/routes/assetRoutes.js
 * DATETIME: 14-04-2026 21:45
 * VERSION: 1.0.0
 */

const express = require('express');
const router = express.Router();
const baseController = require('../controllers/baseController');
const { verifyToken, checkRole } = require('../middlewares/authMiddleware');

const assetCtrl = baseController('assets');

router.get('/search', verifyToken, assetCtrl.search);
router.get('/', verifyToken, assetCtrl.getAll);
router.get('/:id', verifyToken, assetCtrl.getById);

router.post('/', verifyToken, checkRole(['CLAN_ADMIN']), assetCtrl.create);
router.put('/:id', verifyToken, checkRole(['CLAN_ADMIN']), assetCtrl.update);
router.delete('/:id', verifyToken, checkRole(['CLAN_ADMIN']), assetCtrl.delete);

module.exports = router;