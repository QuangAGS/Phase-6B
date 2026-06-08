/**
 * PATH       : src/services/authLogService.js
 * DATETIME   : 2026-05-06T17:45:00+07:00
 * VERSION    : 21.4.0
 * DESCRIPTION: 
 * - Bước 4 của Bản đồ V21.0.0: Cải tiến Logging & Monitoring
 * - Thêm helper getSuspiciousAttempts() để query attempt đáng ngờ theo IP
 * - Logging chi tiết hơn cho Turnstile, Honeypot, Block IP
 * - Bảo tồn 100% logic cũ của các hàm logAttempt, getLockoutMetadata, checkLockStatus, getAll (Q1)
 * - Tuân thủ Q2
 */

const { basePrisma } = require('../lib/prisma');
const { v4: uuidv4 } = require('uuid');

const LOCK_CONFIG = {
  MAX_ATTEMPTS: 5,
  WINDOW_MINUTES: 10,
  LOCK_DURATION_MINUTES: 10
};

const authLogService = {

  /**
   * GHI LOG THỬ ĐĂNG KÝ / ĐĂNG NHẬP - ĐÃ FIX attempt_count
   */
  logAttempt: async (data) => {
    const {
      identifier,
      ip_address,
      user_agent,
      status,
      failure_reason = null,
      turnstileSuccess = false,
      turnstileErrorCode = null,
      turnstileAction = 'register'
    } = data;

    try {
      const tenMinsAgo = new Date(Date.now() - LOCK_CONFIG.WINDOW_MINUTES * 60 * 1000);

      const failedAttempts = await basePrisma.auth_logs.count({
        where: {
          identifier,
          status: 'THAT_BAI',
          created_at: { gte: tenMinsAgo }
        }
      });

      const attemptCount = (status === 'THAT_BAI') ? failedAttempts + 1 : failedAttempts;

      console.log(`[authLogService] Logging → identifier: ${identifier}, status: ${status}, attemptCount: ${attemptCount}`);

      return await basePrisma.auth_logs.create({
        data: {
          id: uuidv4(),
          identifier: identifier || 'unknown',
          ip_address: ip_address || 'unknown',
          user_agent: user_agent || 'unknown',
          status: status || 'THAT_BAI',
          failure_reason,
          turnstile_success: turnstileSuccess,
          turnstile_error_code: turnstileErrorCode,
          turnstile_action: turnstileAction,
          attempt_count: attemptCount,
          created_at: new Date()
        }
      });
    } catch (err) {
      console.error('[authLogService] Lỗi ghi log:', err.message);
      return null;
    }
  },

  /**
   * LẤY THÔNG TIN KHÓA TÀI KHOẢN (Giữ nguyên)
   */
  getLockoutMetadata: async (identifier) => {
    const tenMinsAgo = new Date(Date.now() - LOCK_CONFIG.WINDOW_MINUTES * 60 * 1000);
    
    const attemptCount = await basePrisma.auth_logs.count({
      where: {
        identifier,
        status: 'THAT_BAI',
        created_at: { gte: tenMinsAgo }
      }
    });

    return {
      attemptCount,
      maxAttempts: LOCK_CONFIG.MAX_ATTEMPTS,
      remainingAttempts: Math.max(0, LOCK_CONFIG.MAX_ATTEMPTS - attemptCount),
      lockDurationMinutes: LOCK_CONFIG.LOCK_DURATION_MINUTES
    };
  },

  /**
   * KIỂM TRA TRẠNG THÁI KHÓA (Giữ nguyên)
   */
  checkLockStatus: async (identifier) => {
    const user = await basePrisma.users.findFirst({
      where: { 
        OR: [{ email: identifier }, { phone: identifier }], 
        deleted_at: null 
      }
    });
    return user?.status === 'BI_KHOA' && user.locked_until && user.locked_until > new Date();
  },

  /**
   * LẤY LỊCH SỬ LOG (Giữ nguyên)
   */
  getAll: async (limit = 1000) => {
    return await basePrisma.auth_logs.findMany({
      orderBy: { created_at: 'desc' },
      take: limit
    });
  },

  /**
   * HELPER MỚI (Bước 4): Lấy các attempt đáng ngờ của IP trong khoảng thời gian
   * Dùng cho monitoring, dashboard và quyết định block động
   */
  getSuspiciousAttempts: async (ip, timeWindowMinutes = 30) => {
    const since = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

    const attempts = await basePrisma.auth_logs.findMany({
      where: {
        ip_address: ip,
        created_at: { gte: since },
        status: 'THAT_BAI'
      },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        identifier: true,
        failure_reason: true,
        created_at: true,
        user_agent: true
      }
    });

    const summary = {
      total: attempts.length,
      honeypot: attempts.filter(a => a.failure_reason?.includes('HONEYPOT')).length,
      turnstile: attempts.filter(a => a.failure_reason?.includes('TURNSTILE')).length,
      wrong_password: attempts.filter(a => 
        a.failure_reason === 'WRONG_PASSWORD' || 
        a.failure_reason === 'INVALID_AUTH'
      ).length,
      latestAttempt: attempts[0]?.created_at || null
    };

    return {
      ip,
      timeWindowMinutes,
      attempts,
      summary,
      isSuspicious: summary.total >= 5 || summary.honeypot >= 2 || summary.turnstile >= 3
    };
  }
};

module.exports = authLogService;