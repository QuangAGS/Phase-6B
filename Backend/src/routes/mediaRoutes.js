/**
 * PATH: backend/src/routes/mediaRoutes.js
 */
const express = require('express');
const router = express.Router();
const mediaService = require('../services/mediaService');
const { verifyToken } = require('../middlewares/authMiddleware');
// Giả định bạn dùng multer để xử lý file upload
// const upload = require('../middlewares/uploadMiddleware'); 

router.post('/upload', verifyToken, async (req, res) => {
  try {
    // Logic: 1. Upload file lên Cloud -> 2. Lấy URL -> 3. Gọi mediaService.registerMedia
    // Ở đây tôi viết giả định bạn đã có file_url từ middleware upload
    const result = await mediaService.registerMedia(req.body, req.user);
    res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.get('/entity/:type/:id', verifyToken, async (req, res) => {
  try {
    const { type, id } = req.params;
    const data = await mediaService.getByEntity(type, id);
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;