/**
 * PATH: backend/src/routes/suggestionRoutes.js
 * DATETIME: 14-04-2026 21:45
 * VERSION: 1.0.0
 */

const express = require('express');
const router = express.Router();
const baseController = require('../controllers/baseController');
const { verifyToken, checkRole } = require('../middlewares/authMiddleware');

const suggestionCtrl = baseController('suggestions');

router.get('/search', verifyToken, suggestionCtrl.search);
router.get('/', verifyToken, suggestionCtrl.getAll);
router.get('/:id', verifyToken, suggestionCtrl.getById);

router.post('/', verifyToken, checkRole(['CLAN_ADMIN']), suggestionCtrl.create);
router.put('/:id', verifyToken, checkRole(['CLAN_ADMIN']), suggestionCtrl.update);
router.delete('/:id', verifyToken, checkRole(['CLAN_ADMIN']), suggestionCtrl.delete);

module.exports = router;