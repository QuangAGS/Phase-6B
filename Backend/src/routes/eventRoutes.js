/**
 * PATH: backend/src/routes/eventRoutes.js
 * DATETIME: 14-04-2026 21:45
 * VERSION: 1.0.0
 */

const express = require('express');
const router = express.Router();
const baseController = require('../controllers/baseController');
const { verifyToken, checkRole } = require('../middlewares/authMiddleware');

const eventCtrl = baseController('events');

router.get('/search', verifyToken, eventCtrl.search);
router.get('/', verifyToken, eventCtrl.getAll);
router.get('/:id', verifyToken, eventCtrl.getById);

router.post('/', verifyToken, checkRole(['CLAN_ADMIN']), eventCtrl.create);
router.put('/:id', verifyToken, checkRole(['CLAN_ADMIN']), eventCtrl.update);
router.delete('/:id', verifyToken, checkRole(['CLAN_ADMIN']), eventCtrl.delete);

module.exports = router;