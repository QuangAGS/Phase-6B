/**
 * PATH: backend/src/routes/achievementRoutes.js
 * DATETIME: 14-04-2026 21:45
 * VERSION: 1.0.0
 */

const express = require('express');
const router = express.Router();
const baseController = require('../controllers/baseController');
const { verifyToken, checkRole } = require('../middlewares/authMiddleware');
const validateMiddleware = require('../middlewares/validateMiddleware');

const achievementCtrl = baseController('achievements');

router.get('/search', verifyToken, achievementCtrl.search);
router.get('/', verifyToken, achievementCtrl.getAll);
router.get('/:id', verifyToken, achievementCtrl.getById);

router.post('/', verifyToken, checkRole(['USER', 'CLAN_ADMIN']), validateMiddleware('achievements'), achievementCtrl.create);
router.put('/:id', verifyToken, checkRole(['USER', 'CLAN_ADMIN']), validateMiddleware('achievements'), achievementCtrl.update);
router.delete('/:id', verifyToken, checkRole(['CLAN_ADMIN']), achievementCtrl.delete);

module.exports = router;