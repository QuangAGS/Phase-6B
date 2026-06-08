/**
 * PATH: backend/src/routes/addressRoutes.js
 * DATETIME: 14-04-2026 21:45
 * VERSION: 1.6.2
 */
const express = require('express');
const router = express.Router();
const baseController = require('../controllers/baseController');
const { verifyToken, checkRole } = require('../middlewares/authMiddleware');
const validateMiddleware = require('../middlewares/validateMiddleware'); // Thêm

const addressCtrl = baseController('addresses');

router.get('/search', verifyToken, addressCtrl.search);
router.get('/', verifyToken, addressCtrl.getAll);
router.get('/:id', verifyToken, addressCtrl.getById);

router.post(
    '/', 
    verifyToken, 
    checkRole(['USER', 'CLAN_ADMIN']), 
    validateMiddleware('addresses'), // Thêm validation
    addressCtrl.create
);

router.put(
    '/:id', 
    verifyToken, 
    checkRole(['USER', 'CLAN_ADMIN']), 
    validateMiddleware('addresses'), // Thêm validation
    addressCtrl.update
);

router.delete('/:id', verifyToken, checkRole(['CLAN_ADMIN']), addressCtrl.delete);

module.exports = router;