/**
 * PATH       : src/routes/authRoutes.js
 * DATETIME   : 2026-05-07T14:55:00+07:00
 * VERSION    : 21.5.3
 * DESCRIPTION: 
 * - Thêm route debug /debug/unblock-all (chỉ hoạt động khi NODE_ENV !== 'production')
 * - Bảo tồn 100% các route cũ, rate limiter, protected routes (Q1)
 * - Tuân thủ Q2
 */

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { verifyToken, checkRole } = require('../middlewares/authMiddleware');
const { 
  loginRateLimiter, 
  registerRateLimiter,     
  resetRateLimiter 
} = require('../middlewares/rateLimitMiddleware');

// ==================== PUBLIC ROUTES ====================

// Kiểm tra định danh (slug, email, phone)
router.get('/check-identity', authController.checkIdentity);

// Đăng ký (JoinClan & CreateClan)
router.post('/register', registerRateLimiter, authController.register);

// Đăng nhập
router.post('/login', loginRateLimiter, authController.login);

// Quên mật khẩu & Đặt lại mật khẩu
// Quên mật khẩu & Đặt lại mật khẩu
router.post('/forgot-password', resetRateLimiter, authController.forgotPassword);
router.post('/reset-password', resetRateLimiter, authController.resetPassword);

/**
 * <2026-05-12T00:00:00+07:00>
 * Sprint 6f - Forgot Password Flow v2 routes
 * - Bổ sung 2 endpoint mới cho flow 3 bước:
 *   1) POST /auth/forgot-password
 *   2) POST /auth/verify-reset-code
 *   3) POST /auth/change-password-after-reset
 * - Bảo tồn Q1: Giữ nguyên /forgot-password và /reset-password cũ.
 * - /forgot-password sẽ được nâng cấp ở authController.js trong Sprint 6g.
 */
router.post('/verify-reset-code', resetRateLimiter, authController.verifyResetCode);
router.post('/change-password-after-reset', resetRateLimiter, authController.changePasswordAfterReset);

// ==================== DEBUG ROUTE (CHỈ DEVELOPMENT) ====================
if (process.env.NODE_ENV !== 'production') {
  console.log('🧪 [DEBUG] Route /api/auth/debug/unblock-all đã được kích hoạt');
  router.post('/debug/unblock-all', authController.debugUnblockAll);
}

// ==================== PROTECTED ROUTES ====================

// Lấy thông tin user hiện tại
router.get('/me', verifyToken, (req, res) => {
  res.status(200).json({ status: 'success', user: req.user });
});

// Phê duyệt đăng ký
router.patch(
  '/approve/:userId', 
  verifyToken, 
  checkRole(['CLAN_ADMIN', 'SYSTEM_ADMIN']), 
  authController.approve
);

// Từ chối đăng ký
router.delete(
  '/reject/:userId', 
  verifyToken, 
  checkRole(['CLAN_ADMIN', 'SYSTEM_ADMIN']), 
  authController.reject
);

module.exports = router;