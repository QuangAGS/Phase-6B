/**
 * PATH: backend/src/routes/graveRoutes.js
 * DATETIME: 14-04-2026 21:45
 * VERSION: 1.0.0
 */


const express = require('express');
const router = express.Router();
const baseController = require('../controllers/baseController');
const { verifyToken, checkRole } = require('../middlewares/authMiddleware');

const graveCtrl = baseController('graves');

router.get('/search', verifyToken, graveCtrl.search);
router.get('/', verifyToken, graveCtrl.getAll);
router.get('/:id', verifyToken, graveCtrl.getById);

router.post('/', verifyToken, checkRole(['USER', 'CLAN_ADMIN']), graveCtrl.create);
router.put('/:id', verifyToken, checkRole(['USER', 'CLAN_ADMIN']), graveCtrl.update);
router.delete('/:id', verifyToken, checkRole(['CLAN_ADMIN']), graveCtrl.delete);

module.exports = router;
