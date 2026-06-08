/**
 * PATH: backend/src/routes/cemeteryRoutes.js
 * DATETIME: 14-04-2026 21:45
 * VERSION: 1.0.0
 */


const express = require('express');
const router = express.Router();
const baseController = require('../controllers/baseController');
const { verifyToken, checkRole } = require('../middlewares/authMiddleware');

const cemeteryCtrl = baseController('cemetery');

router.get('/search', verifyToken, cemeteryCtrl.search);
router.get('/', verifyToken, cemeteryCtrl.getAll);
router.get('/:id', verifyToken, cemeteryCtrl.getById);

router.post('/', verifyToken, checkRole(['USER', 'CLAN_ADMIN']), cemeteryCtrl.create);
router.put('/:id', verifyToken, checkRole(['USER', 'CLAN_ADMIN']), cemeteryCtrl.update);
router.delete('/:id', verifyToken, checkRole(['CLAN_ADMIN']), cemeteryCtrl.delete);

module.exports = router;
