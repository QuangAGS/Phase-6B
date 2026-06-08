/**
 * PATH       : src/controllers/authController.js
 * DATETIME   : 2026-05-07T16:55:00+07:00
 * VERSION    : 23.0.2
 * DESCRIPTION: 
 * - Fix triệt để BI_CAM và BI_KHOA đặc biệt (từ authService)
 * - Backend trả về isPermanent rõ ràng để LoginForm hiển thị đúng
 * - Bảo tồn 100% logic cũ của V23.0.1 (IP Block, Turnstile, Honeypot, suspicious, debug route, approve/reject...)
 * - Tuân thủ nghiêm ngặt Q1 & Q2
 */

const authService = require('../services/authService');
const authLogService = require('../services/authLogService');
const { validateTurnstile } = require('../utils/turnstile');
const securityConfig = require('../config/securityConfig');
const { 
  ipBlockMiddleware, 
  isIPBlocked, 
  blockIP, 
  ipBlockList 
} = require('../middlewares/ipBlockMiddleware');


// <2026-05-07T16:55> Debug route chỉ hoạt động ở development
if (securityConfig.NODE_ENV !== 'production') {
  console.log('🧪 [DEBUG] Route /debug/unblock-all đã được kích hoạt');
}

const authController = {

  checkIdentity: async (req, res) => {
    try {
      const { type, value } = req.query;
      const result = await authService.checkIdentity(type, value);
      res.status(200).json({ status: 'success', ...result });
    } catch (error) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  },

  register: async (req, res) => {
    try {
      const { turnstileToken, hp_field, ...payload } = req.body;
      const ip = req.headers['cf-connecting-ip'] || req.ip || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      if (isIPBlocked(ip)) {
        const record = ipBlockList.get(ip);
        const minutesLeft = Math.ceil((record.blockedUntil - Date.now()) / 60000);
        return res.status(403).json({
          error: `IP của bạn đang bị tạm khóa. Vui lòng thử lại sau ${minutesLeft} phút.`
        });
      }

      if (hp_field && hp_field.trim().length > 0) {
        blockIP(ip, securityConfig.HONEYPOT_BLOCK_MINUTES, 'HONEYPOT_DETECTED');
        await authLogService.logAttempt({
          identifier: payload.phone || payload.email || 'unknown',
          ip_address: ip,
          user_agent: userAgent,
          status: 'THAT_BAI',
          failure_reason: 'HONEYPOT_DETECTED'
        });
        return res.status(403).json({ error: 'Hành vi đáng ngờ. Vui lòng thử lại sau.' });
      }

      if (!turnstileToken) {
        return res.status(403).json({ error: 'Vui lòng hoàn thành CAPTCHA' });
      }

      const turnstileResult = await validateTurnstile(turnstileToken, ip, 'register');
      if (!turnstileResult.success) {
        await authLogService.logAttempt({
          identifier: payload.phone || payload.email || 'unknown',
          ip_address: ip,
          user_agent: userAgent,
          status: 'THAT_BAI',
          failure_reason: `TURNSTILE_FAILED_${turnstileResult.errors?.join(',') || 'unknown'}`
        });
        return res.status(403).json({ 
          error: turnstileResult.message || 'CAPTCHA không hợp lệ. Vui lòng thử lại.' 
        });
      }

      const suspicious = await authLogService.getSuspiciousAttempts(
        ip, 
        securityConfig.SUSPICIOUS_TIME_WINDOW_MINUTES
      );
      if (suspicious.attempts >= securityConfig.SUSPICIOUS_ATTEMPTS_THRESHOLD) {
        blockIP(ip, securityConfig.IP_BLOCK_MINUTES, 'REPEATED_SUSPICIOUS_ACTIVITY');
      }

      const extraData = { ip_address: ip, user_agent: userAgent };
      const result = await authService.registerUser(payload, extraData);
      
      res.status(201).json({ 
        status: 'success', 
        data: result,
        message: 'Hồ sơ đăng ký đã được gửi thành công và đang chờ phê duyệt.' 
      });

    } catch (error) {
      console.error('[Register Error]:', error);
      res.status(error.status || 500).json({ 
        status: 'error', 
        code: error.code || 'REGISTER_FAILED',
        message: error.message || 'Không thể hoàn tất đăng ký'
      });
    }
  },

  login: async (req, res) => {
    try {
      const { identifier, password, turnstileToken, hp_field } = req.body;
      const ip = req.headers['cf-connecting-ip'] || req.ip || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      if (isIPBlocked(ip)) {
        const record = ipBlockList.get(ip);
        const minutesLeft = Math.ceil((record.blockedUntil - Date.now()) / 60000);
        return res.status(403).json({
          error: `IP của bạn đang bị tạm khóa. Vui lòng thử lại sau ${minutesLeft} phút.`
        });
      }

      if (hp_field && hp_field.trim().length > 0) {
        blockIP(ip, securityConfig.HONEYPOT_BLOCK_MINUTES, 'HONEYPOT_DETECTED');
        await authLogService.logAttempt({
          identifier: identifier || 'unknown',
          ip_address: ip,
          user_agent: userAgent,
          status: 'THAT_BAI',
          failure_reason: 'HONEYPOT_DETECTED'
        });
        return res.status(403).json({ error: 'Hành vi đáng ngờ.' });
      }

      if (!turnstileToken) {
        return res.status(403).json({ error: 'Vui lòng hoàn thành CAPTCHA' });
      }

      const turnstileResult = await validateTurnstile(turnstileToken, ip, 'login');
      if (!turnstileResult.success) {
        await authLogService.logAttempt({
          identifier: identifier || 'unknown',
          ip_address: ip,
          user_agent: userAgent,
          status: 'THAT_BAI',
          failure_reason: `TURNSTILE_FAILED_${turnstileResult.errors?.join(',') || 'unknown'}`
        });
        return res.status(403).json({ error: 'CAPTCHA không hợp lệ.' });
      }

      const suspicious = await authLogService.getSuspiciousAttempts(
        ip, 
        securityConfig.SUSPICIOUS_TIME_WINDOW_MINUTES
      );
      /* if (suspicious.attempts >= securityConfig.SUSPICIOUS_ATTEMPTS_THRESHOLD)
       * 25-May-2026 Phát hiện bug không block IP suspicious khi tiến hành EGAL 
      */
      if (suspicious.summary.total >= securityConfig.SUSPICIOUS_ATTEMPTS_THRESHOLD){
        blockIP(ip, securityConfig.IP_BLOCK_MINUTES, 'REPEATED_SUSPICIOUS_ACTIVITY');
      }

      const extraData = { ip_address: ip, user_agent: userAgent };
      const result = await authService.loginUser(identifier, password, extraData);
      
      res.status(200).json({ status: 'success', data: result });

    } catch (error) {
      if (error.status === 423) {
        const isPermanent = error.isPermanent || false;
        const minutesLeft = error.minutesLeft || 0;

        let message = '';
        if (isPermanent) {
          message = 'Tài khoản đã bị cấm vĩnh viễn. Xin liên hệ hỗ trợ trực tiếp.';
        } else {
          message = `Tài khoản tạm khóa. Vui lòng thử lại sau ${minutesLeft} phút.`;
        }

        return res.status(423).json({
          status: 'error',
          code: 'ACCOUNT_LOCKED',
          message,
          minutesLeft,
          isPermanent,
          lockType: error.lockType || 'UNKNOWN',
          reasonCode: error.reasonCode || 'UNKNOWN_LOCK_REASON'
        });
      }

      if (error.status === 401) {
        return res.status(401).json({
          status: 'error',
          code: 'INVALID_AUTH',
          message: 'Thông tin đăng nhập không chính xác.',
          remainingAttempts: error.metadata?.remainingAttempts || 0
        });
      }

      res.status(500).json({ status: 'error', message: error.message || 'Lỗi server.' });
    }
  },

  // Debug route giữ nguyên
  debugUnblockAll: (req, res) => {
    if (securityConfig.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Route không tồn tại trong production' });
    }

    const debugKey = req.headers['x-debug-key'];
    if (debugKey !== securityConfig.DEBUG_SECRET_KEY) {
      return res.status(403).json({ error: 'Debug key không hợp lệ' });
    }

    const beforeCount = ipBlockList.size;
    ipBlockList.clear();

    console.log(`🧹 [DEBUG] ĐÃ XÓA ${beforeCount} IP BLOCK`);
    
    res.json({ 
      success: true, 
      message: `Đã xóa ${beforeCount} IP block`,
      timestamp: new Date().toISOString()
    });
  },

  forgotPassword: async (req, res) => {
    try {
      /**
       * <2026-05-13T00:00:00+07:00>
       * Sprint FP-Security-6:
       * - Thêm anti-bot/IP block guard cho forgot-password.
       * - Chặn IP đã bị block trước khi xử lý.
       * - Sau Turnstile success, kiểm tra suspicious attempts.
       * - Bảo tồn Q1/Q2.
       */
      const { identifier, turnstileToken, hp_field } = req.body;
      const ip = req.headers['cf-connecting-ip'] || req.ip || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      if (isIPBlocked(ip)) {
        const record = ipBlockList.get(ip);
        const minutesLeft = Math.ceil(
          (record.blockedUntil - Date.now()) / 60000
        );

        return res.status(429).json({
          status: 'error',
          code: 'IP_TEMPORARILY_BLOCKED',
          message: `Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ${minutesLeft} phút.`,
          minutesLeft,
        });
      }

      if (hp_field && hp_field.trim().length > 0) {
        blockIP(ip, securityConfig.HONEYPOT_BLOCK_MINUTES, 'HONEYPOT_DETECTED');

        await authLogService.logAttempt({
          identifier: identifier || 'unknown',
          ip_address: ip,
          user_agent: userAgent,
          status: 'THAT_BAI',
          failure_reason: 'FORGOT_PASSWORD_HONEYPOT_DETECTED',
        });

        return res.status(403).json({
          status: 'error',
          code: 'HONEYPOT_DETECTED',
          message: 'Hành vi đáng ngờ. Vui lòng thử lại sau.',
        });
      }

      if (!turnstileToken) {
        return res.status(403).json({
          status: 'error',
          code: 'TURNSTILE_REQUIRED',
          message: 'Vui lòng hoàn thành CAPTCHA',
        });
      }

      const turnstileResult = await validateTurnstile(
        turnstileToken,
        ip,
        'forgot-password'
      );

      if (!turnstileResult.success) {
        await authLogService.logAttempt({
          identifier: identifier || 'unknown',
          ip_address: ip,
          user_agent: userAgent,
          status: 'THAT_BAI',
          failure_reason: `FORGOT_PASSWORD_TURNSTILE_FAILED_${
            turnstileResult.errors?.join(',') || 'unknown'
          }`,
        });

        return res.status(403).json({
          status: 'error',
          code: 'TURNSTILE_FAILED',
          message: 'Yêu cầu không hợp lệ',
        });
      }

      /**
       * Suspicious guard:
       * - Đặt sau Turnstile để tránh block nhầm trước khi xác minh bot.
       * - Dùng auth_logs hiện có để phát hiện spam.
       */
      const suspicious = await authLogService.getSuspiciousAttempts(
        ip,
        securityConfig.SUSPICIOUS_TIME_WINDOW_MINUTES
      );

      if (suspicious.attempts >= securityConfig.SUSPICIOUS_ATTEMPTS_THRESHOLD) {
        const blockMinutes = Math.max(
          securityConfig.IP_BLOCK_MINUTES || 15,
          securityConfig.RESET_IDENTIFIER_NOT_FOUND_BLOCK_MINUTES || 15
        );

        blockIP(ip, blockMinutes, 'FORGOT_PASSWORD_SUSPICIOUS_ACTIVITY');

        await authLogService.logAttempt({
          identifier: identifier || 'unknown',
          ip_address: ip,
          user_agent: userAgent,
          status: 'THAT_BAI',
          failure_reason: 'FORGOT_PASSWORD_IP_BLOCKED_SUSPICIOUS_ACTIVITY',
        });

        return res.status(429).json({
          status: 'error',
          code: 'IP_TEMPORARILY_BLOCKED',
          message: `Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ${blockMinutes} phút.`,
          minutesLeft: blockMinutes,
        });
      }

      const result = await authService.forgotPassword(identifier, {
        ip_address: ip,
        user_agent: userAgent,
      });

      return res.status(200).json({
        status: 'success',
        data: result,
        message:
          'Nếu thông tin hợp lệ, mã xác nhận sẽ được gửi qua kênh liên lạc đã đăng ký.',
      });
    } catch (error) {
      console.error('[ForgotPassword Error]:', error);

      return res.status(error.status || 400).json({
        status: 'error',
        code: error.code || 'FORGOT_PASSWORD_FAILED',
        message:
          error.message ||
          'Không thể gửi yêu cầu. Vui lòng kiểm tra lại thông tin hoặc thử lại sau.',
        waitSeconds: error.waitSeconds || undefined,
        minutesLeft: error.minutesLeft || undefined,
      });
    }
  },

  verifyResetCode: async (req, res) => {
    try {
      /**
       * <2026-05-12T00:00:00+07:00>
       * Sprint 6g - Forgot Password Flow v2: VERIFY RESET CODE
       * - Xác minh OTP/reset code.
       * - Nếu hợp lệ, backend trả resetToken tạm thời cho bước đổi mật khẩu.
       */
      const { identifier, otp, turnstileToken, hp_field } = req.body;
      const ip = req.headers['cf-connecting-ip'] || req.ip || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      if (hp_field && hp_field.trim().length > 0) {
        blockIP(ip, securityConfig.HONEYPOT_BLOCK_MINUTES, 'HONEYPOT_DETECTED');
        return res.status(403).json({
          status: 'error',
          code: 'HONEYPOT_DETECTED',
          message: 'Hành vi đáng ngờ. Vui lòng thử lại sau.'
        });
      }

      if (!turnstileToken) {
        return res.status(403).json({
          status: 'error',
          code: 'TURNSTILE_REQUIRED',
          message: 'Vui lòng hoàn thành CAPTCHA'
        });
      }

      const turnstileResult = await validateTurnstile(
        turnstileToken,
        ip,
        'verify-reset-code'
      );

      if (!turnstileResult.success) {
        return res.status(403).json({
          status: 'error',
          code: 'TURNSTILE_FAILED',
          message: 'Yêu cầu không hợp lệ'
        });
      }

      const result = await authService.verifyResetCode(identifier, otp, {
        ip_address: ip,
        user_agent: userAgent
      });

      return res.status(200).json({
        status: 'success',
        data: result,
        message: 'Mã xác nhận hợp lệ.'
      });
    } catch (error) {
      console.error('[VerifyResetCode Error]:', error);

      return res.status(error.status || 400).json({
        status: 'error',
        code: error.code || 'VERIFY_RESET_CODE_FAILED',
        message: error.message || 'Mã xác nhận không hợp lệ hoặc đã hết hạn.'
      });
    }
  },

  changePasswordAfterReset: async (req, res) => {
    try {
      /**
       * <2026-05-12T00:00:00+07:00>
       * Sprint 6g - Forgot Password Flow v2: CHANGE PASSWORD
       * - Đổi mật khẩu bằng resetToken sau khi OTP đã xác minh.
       * - Không dùng login token.
       */
      const { identifier, resetToken, newPassword, hp_field } = req.body;
      const ip = req.headers['cf-connecting-ip'] || req.ip || 'unknown';

      if (hp_field && hp_field.trim().length > 0) {
        blockIP(ip, securityConfig.HONEYPOT_BLOCK_MINUTES, 'HONEYPOT_DETECTED');
        return res.status(403).json({
          status: 'error',
          code: 'HONEYPOT_DETECTED',
          message: 'Hành vi đáng ngờ. Vui lòng thử lại sau.'
        });
      }

      await authService.changePasswordAfterReset(identifier, resetToken, newPassword);

      return res.status(200).json({
        status: 'success',
        message: 'Mật khẩu đã được cập nhật thành công.'
      });
    } catch (error) {
      console.error('[ChangePasswordAfterReset Error]:', error);

      return res.status(error.status || 400).json({
        status: 'error',
        code: error.code || 'CHANGE_PASSWORD_AFTER_RESET_FAILED',
        message:
          error.message ||
          'Không thể đặt lại mật khẩu. Vui lòng thử lại.'
      });
    }
  },

  resetPassword: async (req, res) => {
    try {
      const { email, otp, newPassword } = req.body;
      await authService.resetPassword(email, otp, newPassword);
      res.status(200).json({ status: 'success', message: "Mật khẩu đã được cập nhật thành công." });
    } catch (error) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  },


  approve: async (req, res) => {
    try {
      const { userId } = req.params;
      const actorId = req.user.userId;
      const { role, tenantId: actorTenantId } = req.user;


      const result = await authService.approveUser(userId, actorId, role, actorTenantId);
      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      res.status(403).json({ status: 'error', message: error.message });
    }
  },


  reject: async (req, res) => {
    try {
      const { userId } = req.params;
      const actorId = req.user.userId;
      const { role, tenantId: actorTenantId } = req.user;
      const { reason } = req.body;


      await authService.rejectRegistration(userId, actorId, role, actorTenantId, reason);
      res.status(200).json({ status: 'success', message: "Đã từ chối đơn đăng ký." });
    } catch (error) {
      res.status(403).json({ status: 'error', message: error.message });
    }
  }
};


module.exports = authController;