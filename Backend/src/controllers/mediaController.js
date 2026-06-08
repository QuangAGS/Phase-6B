/**
 * PATH: backend/src/controllers/mediaController.js
 */
const mediaService = require('../services/mediaService');
// Giả định bạn dùng Cloudinary làm dịch vụ lưu trữ
// const cloudinary = require('../config/cloudinary'); 

const mediaController = {
  uploadFile: async (req, res) => {
    try {
      if (!req.file) throw new Error("Không có file nào được tải lên.");

      // 1. Logic đẩy file lên Cloud (Giả định Cloudinary/S3)
      // const cloudResult = await cloudinary.uploader.upload_stream(req.file.buffer);
      const mockCloudUrl = `https://storage.clan-management.com/${Date.now()}_${req.file.originalname}`;

      // 2. Chuẩn bị data cho Service
      const mediaData = {
        entity_id: req.body.entity_id,
        entity_type: req.body.entity_type, // MEMBER, BRANCH, WORSHIP...
        file_url: mockCloudUrl,
        file_name: req.file.originalname,
        file_type: req.file.mimetype,
        file_size: req.file.size,
        change_reason: req.body.change_reason || "Tải lên tài liệu mới"
      };

      // 3. Đăng ký vào Database qua Service
      const result = await mediaService.registerMedia(mediaData, req.user);

      res.status(201).json({ status: 'success', data: result });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
};

module.exports = mediaController;