/**
 * PATH       : src/services/authService.js
 * DATETIME   : 2026-05-13T00:00:00+07:00
 * VERSION    : 25.0.1 PHASE 6.1B
 * DESCRIPTION:
 * - Patch registerUser() để gọi propagateFromRegistration() sau khi tạo user mới.
 * - Refactor cấu hình security sang centralized securityConfig.
 * - Không đọc process.env trực tiếp trong Forgot Password flow.
 * - Giữ nguyên login/register/approve/reject flow hiện có.
 * - Giữ password_reset_sessions flow:
 *   + forgotPassword
 *   + verifyResetCode
 *   + changePasswordAfterReset
 * - Bảo tồn Q1/Q2.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const { basePrisma } = require('../lib/prisma');
const authLogService = require('./authLogService');
const { cleanInput, formatNumericSlug } = require('../utils/slugUtils');
const securityConfig = require('../config/securityConfig');
const emailService = require('./emailService');
const {
  propagateFromRegistration,
} = require('../modules/notifications/services/communicationPropagation.service');

//EGAL-25.x R6.3
const notificationOrchestrator = require(
  '../modules/notifications/orchestrator/notificationOrchestrator'
);

/**
 * <2026-05-13T00:00:00+07:00>
 * Helper hash cho password reset session security.
 * - Config lấy từ centralized securityConfig.
 */
const hashResetSecret = (value) => {
  return crypto
    .createHash('sha256')
    .update(String(value))
    .digest('hex');
};

const authService = {
  checkLockStatus: async (user) => {
    if (!user) return { isLocked: false };

    console.log(
      `[DEBUG checkLockStatus] User=${user.id} | Status=${user.status} | locked_until=${user.locked_until} | pre_lock_status=${user.pre_lock_status}`
    );

    if (user.status === 'BI_CAM') {
      console.log('[DEBUG] → BI_CAM → PERMANENT');
      return {
        isLocked: true,
        isPermanent: true,
        lockType: 'PERMANENT',
        reasonCode: 'ACCOUNT_BANNED',
      };
    }

    if (user.status === 'BI_KHOA') {
      let lockedUntilDate = null;

      if (user.locked_until) {
        try {
          lockedUntilDate = new Date(user.locked_until);
        } catch (e) {
          lockedUntilDate = null;
        }
      }

      const now = new Date();

      const hasValidLockTime =
        lockedUntilDate &&
        !isNaN(lockedUntilDate.getTime()) &&
        lockedUntilDate > now;

      const hasPreLockStatus =
        !!user.pre_lock_status &&
        user.pre_lock_status !== '' &&
        user.pre_lock_status !== null &&
        user.pre_lock_status !== 'null';

      console.log(
        `[DEBUG] hasValidLockTime=${hasValidLockTime}, hasPreLockStatus=${hasPreLockStatus}`
      );

      if (!hasValidLockTime || !hasPreLockStatus) {
        console.log(
          '[DEBUG] → BI_KHOA bị hỏng (null fields) → PERMANENT (không auto-unlock)'
        );

        return {
          isLocked: true,
          isPermanent: true,
          lockType: 'PERMANENT',
          reasonCode: 'INVALID_LOCK_STATE',
        };
      }

      const minutesLeft = Math.ceil((lockedUntilDate - now) / 60000);
      console.log(`[DEBUG] → TEMPORARY lock còn ${minutesLeft} phút`);

      return {
        isLocked: true,
        isPermanent: false,
        minutesLeft: Math.max(1, minutesLeft),
        lockType: 'TEMPORARY',
        reasonCode: 'TOO_MANY_ATTEMPTS',
      };
    }

    console.log('[DEBUG] → Status khác, không lock');
    return { isLocked: false };
  },

  loginUser: async (identifier, password, extraData = {}) => {
    const { ip_address, user_agent } = extraData;

    const cleanId = cleanInput(
      identifier,
      identifier?.includes('@') ? 'email' : 'phone'
    );

    try {
      let user = await basePrisma.users.findFirst({
        where: {
          OR: [{ phone: cleanId }, { email: cleanId }],
          deleted_at: null,
        },
      });

      console.log(
        `[DEBUG loginUser] Found user: ${!!user}, status=${user?.status}`
      );

      const lockStatus = await authService.checkLockStatus(user);

      if (lockStatus.isLocked) {
        const err = new Error('ACCOUNT_LOCKED');
        err.status = 423;
        err.minutesLeft = lockStatus.minutesLeft || 0;
        err.isPermanent = lockStatus.isPermanent || false;
        err.lockType = lockStatus.lockType || 'UNKNOWN';
        err.reasonCode = lockStatus.reasonCode || 'UNKNOWN';
        throw err;
      }

      const throwAuthError = async (reason) => {
        await authLogService.logAttempt({
          identifier: cleanId,
          ip_address,
          user_agent,
          status: 'THAT_BAI',
          failure_reason: reason,
        });

        if (!user) {
          const err = new Error('INVALID_AUTH');
          err.status = 401;
          throw err;
        }

        const currentAttempts = user.attempt_count || 0;
        const newCount = currentAttempts + 1;
        const updateData = { attempt_count: newCount };

        if (
          newCount >= securityConfig.MAX_LOGIN_ATTEMPTS &&
          user.status !== 'BI_KHOA' &&
          user.status !== 'BI_CAM'
        ) {
          updateData.pre_lock_status = user.status || 'DA_DUYET';
          updateData.status = 'BI_KHOA';
          updateData.locked_until = new Date(
            Date.now() + securityConfig.LOCKOUT_MINUTES * 60 * 1000
          );

          await basePrisma.users.update({
            where: { id: user.id },
            data: updateData,
          });

          const err = new Error('ACCOUNT_LOCKED');
          err.status = 423;
          err.minutesLeft = securityConfig.LOCKOUT_MINUTES;
          err.isPermanent = false;
          err.lockType = 'TEMPORARY';
          err.reasonCode = 'TOO_MANY_ATTEMPTS';
          throw err;
        }

        await basePrisma.users.update({
          where: { id: user.id },
          data: updateData,
        });

        const err = new Error('INVALID_AUTH');
        err.status = 401;
        err.metadata = {
          attemptCount: newCount,
          remainingAttempts: Math.max(
            0,
            securityConfig.MAX_LOGIN_ATTEMPTS - newCount
          ),
        };
        throw err;
      };

      if (!user) await throwAuthError('USER_NOT_FOUND');

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) await throwAuthError('WRONG_PASSWORD');

      await authLogService.logAttempt({
        identifier: cleanId,
        ip_address,
        user_agent,
        status: 'THANH_CONG',
      });

      await basePrisma.users.update({
        where: { id: user.id },
        data: {
          last_login_at: new Date(),
          attempt_count: 0,
        },
      });

      return {
        token: authService.generateToken(user),
        user,
      };
    } catch (error) {
      throw error;
    }
  },

  generateToken: (user) => {
    const secret = securityConfig.JWT_SECRET;

    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }

    return jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenant_id,
        role: user.role,
        status: user.status,
      },
      secret,
      { expiresIn: '7d' }
    );
  },

  registerUser: async (payload, extraData = {}) => {
    const { isNewClan, clanName, description, tenantId, ...userData } = payload;
    const { ip_address, user_agent } = extraData;

    const logIdentifier = cleanInput(userData.phone, 'phone');
    let transactionResult = null;

    /**
     * <2026-06-04T16:10:00+07:00>
     * Purpose:
     * - Pre-compute password hash before opening Prisma transaction.
     *
     * Notes:
     * - bcrypt is CPU-bound and should not hold interactive transaction open.
     * - Prevents "Transaction already closed" in CreateClan flow.
     * - Q1-safe:
     *   No business behavior change.
     */
    const hashedPassword = await bcrypt.hash(
      userData.password,
      10
    );

    try {
            transactionResult = await basePrisma.$transaction(
              async (tx) => {
                let tid = tenantId;
                let tenantSlug = 'SYSTEM_GENERATE';

                if (isNewClan) {
                  const currentYear = new Date().getFullYear();

                  const counter = await tx.slug_counters.upsert({
                    where: { year: currentYear },
                    update: { last_value: { increment: 1 } },
                    create: { year: currentYear, last_value: 1 },
                  });

                  tenantSlug = formatNumericSlug(currentYear, counter.last_value);

                  const newTenant = await tx.tenants.create({
                    data: {
                      name: clanName,
                      slug: tenantSlug,
                      description,
                      status: 'CHO_DUYET',
                    },
                  });

                  tid = newTenant.id;
                } else if (tid) {
                  const tenant = await tx.tenants.findUnique({
                    where: { id: tid },
                  });

                  tenantSlug = tenant?.slug || 'SYSTEM_GENERATE';
                }

                const shortId = crypto.randomBytes(4).toString('hex');
                const technicalName = `${tenantSlug}_${shortId}`;

                const newUser = await tx.users.create({
                  data: {
                    id: crypto.randomUUID(),
                    name: technicalName,
                    email: userData.email
                      ? cleanInput(userData.email, 'email')
                      : null,
                    phone: logIdentifier,
                    password: hashedPassword,
                    tenant_id: tid,
                    role: isNewClan ? 'CLAN_ADMIN' : 'VIEWER',
                    status: 'CHO_DUYET',
                    temp_full_name:
                      userData.temp_full_name ||
                      userData.name ||
                      'Thành viên mới',
                    temp_father_name: userData.temp_father_name,
                    temp_grandfather_name: userData.temp_grandfather_name,
                    temp_birth_year: userData.temp_birth_year
                      ? parseInt(userData.temp_birth_year, 10)
                      : null,
                    temp_relationship: userData.temp_relationship || 'CON_DE',
                    temp_address: userData.temp_address,
                    temp_branch_name: userData.temp_branch_name,
                    temp_note: userData.temp_note,
                    temp_social_profiles: userData.temp_social_profiles || {},
                  },
                });

                /**
                 * <2026-06-05T11:20:00+07:00>
                 * Purpose:
                 * - Propagate Register capture data into canonical communication tables.
                 *
                 * Notes:
                 * - Must stay inside the same transaction as user creation.
                 * - This is data propagation, not notification delivery.
                 * - If propagation fails, registration must rollback.
                 */
                await propagateFromRegistration({
                  tx,
                  user: {
                    id: newUser.id,
                    email: newUser.email,
                    phone: newUser.phone,
                    status: newUser.status,
                    role: newUser.role,
                    tenant_id: newUser.tenant_id,
                  },
                  rawUserData: userData,
                  isNewClan,
                });

                return {
                  userId: newUser.id,
                  tenantId: tid,
                  slug: tenantSlug,
                  status: newUser.status,
                };
              },
              {
                maxWait: 10000,
                timeout: 20000,
              }
            );

      await authLogService.logAttempt({
        identifier: logIdentifier,
        ip_address,
        user_agent,
        status: 'THANH_CONG',
        failure_reason: 'REGISTER_SUCCESS',
      });

      /**
       * <2026-06-07T00:00:00+07:00>
       * EGAL-25 Phase 6.3A
       *
       * Silent business emit:
       * USER_REGISTERED
       *
       * Doctrine:
       * - Persist only
       * - No delivery execution
       * - Must NOT break register flow
       */
      try {
        //EGAL-25.x R6.3A For test the Failure isolation only
        //throw new Error('TEST_SILENT_EMIT_FAILURE');
        
        await notificationOrchestrator.emit(
          'USER_REGISTERED',
          {
            userId: transactionResult.userId,

            metadata: {
              tenantId:
                transactionResult.tenantId,

              registrationType:
                isNewClan
                  ? 'NEW_CLAN'
                  : 'JOIN_CLAN',

              status:
                transactionResult.status,
            },

            executeImmediately: false,
          },
          null
        );
      } catch (emitError) {
        console.error(
          '[EGAL-25][SilentEmit][USER_REGISTERED]',
          emitError
        );

        // Q1:
        // registration must survive notification failure
      }

      return transactionResult;

    } catch (error) {
      await authLogService.logAttempt({
        identifier: logIdentifier || 'unknown',
        ip_address,
        user_agent,
        status: 'THAT_BAI',
        failure_reason: `REGISTER_FAILED: ${error.message}`,
      });

      throw error;
    }
  },

  checkIdentity: async (type, value) => {
    const cleanedValue = cleanInput(value, type);

    if (!cleanedValue) {
      return {
        available: false,
        message: 'Dữ liệu không hợp lệ',
      };
    }

    let existing = null;

    switch (type) {
      case 'slug':
        existing = await basePrisma.tenants.findUnique({
          where: { slug: cleanedValue },
        });
        break;

      case 'email':
        existing = await basePrisma.users.findUnique({
          where: { email: cleanedValue },
        });
        break;

      case 'phone':
        existing = await basePrisma.users.findUnique({
          where: { phone: cleanedValue },
        });
        break;

      default:
        throw new Error('INVALID_TYPE');
    }

    return { available: !existing };
  },

  approveUser: async (targetId, actorId, role, actorTenantId) => {
    return await basePrisma.$transaction(async (tx) => {
      const target = await tx.users.findUnique({
        where: { id: targetId },
      });

      if (
        !target ||
        (role !== 'SYSTEM_ADMIN' && target.tenant_id !== actorTenantId)
      ) {
        throw new Error('DENIED');
      }

      const updatedUser = await tx.users.update({
        where: { id: targetId },
        data: {
          status: 'DA_DUYET',
          changed_by: actorId,
        },
      });

      const newMember = await tx.members.create({
        data: {
          id: uuidv4(),
          full_name: target.temp_full_name || target.name,
          gender: 'KHAC',
          tenant_id: target.tenant_id,
          changed_by: actorId,
        },
      });

      await tx.users.update({
        where: { id: targetId },
        data: {
          member_id: newMember.id,
        },
      });

      return updatedUser;
    });
  },

  rejectRegistration: async (targetId, actorId, role, actorTenantId, reason) => {
    await basePrisma.users.update({
      where: { id: targetId },
      data: {
        status: 'TU_CHOI',
        temp_note: reason,
      },
    });
  },

  /**
   * <2026-05-13T00:00:00+07:00>
   * Forgot Password Flow v3: REQUEST RESET CODE
   * - Dùng bảng password_reset_sessions.
   * - Không dùng users.reset_token/reset_expires.
   * - Kiểm tra identifier tồn tại.
   * - Enforce resend cooldown.
   * - Enforce max request/window.
   * - OTP được hash trước khi lưu DB.
   */
  forgotPassword: async (identifier, extraData = {}) => {
    const { ip_address, user_agent } = extraData;

    const rawIdentifier = cleanInput(
      identifier,
      identifier?.includes('@') ? 'email' : 'phone'
    );

    if (!rawIdentifier) {
      const err = new Error('Dữ liệu không hợp lệ.');
      err.status = 400;
      err.code = 'INVALID_IDENTIFIER';
      throw err;
    }

    const user = await basePrisma.users.findFirst({
      where: {
        OR: [{ email: rawIdentifier }, { phone: rawIdentifier }],
        deleted_at: null,
      },
    });

    if (!user) {
      await authLogService.logAttempt({
        identifier: rawIdentifier,
        ip_address,
        user_agent,
        status: 'THAT_BAI',
        failure_reason: 'FORGOT_PASSWORD_IDENTIFIER_NOT_FOUND',
      });

      const err = new Error('Email hoặc số điện thoại này chưa được đăng ký.');
      err.status = 404;
      err.code = 'IDENTIFIER_NOT_FOUND';
      throw err;
    }

    if (!user.email) {
      await authLogService.logAttempt({
        identifier: rawIdentifier,
        ip_address,
        user_agent,
        status: 'THAT_BAI',
        failure_reason: 'FORGOT_PASSWORD_NO_EMAIL_CHANNEL',
      });

      const err = new Error('Tài khoản này chưa có email để nhận mã xác nhận.');
      err.status = 400;
      err.code = 'NO_EMAIL_CHANNEL';
      throw err;
    }

    const now = new Date();

    const requestWindowStart = new Date(
      now.getTime() -
        securityConfig.RESET_OTP_REQUEST_WINDOW_MINUTES * 60 * 1000
    );

    const recentRequestCount =
      await basePrisma.password_reset_sessions.count({
        where: {
          identifier: rawIdentifier,
          created_at: {
            gte: requestWindowStart,
          },
          deleted_at: null,
        },
      });

    if (
      recentRequestCount >=
      securityConfig.RESET_OTP_MAX_REQUESTS_PER_WINDOW
    ) {
      await authLogService.logAttempt({
        identifier: rawIdentifier,
        ip_address,
        user_agent,
        status: 'THAT_BAI',
        failure_reason: 'FORGOT_PASSWORD_REQUEST_LIMITED',
      });

      const err = new Error(
        'Bạn đã yêu cầu mã xác nhận quá nhiều lần. Vui lòng thử lại sau.'
      );
      err.status = 429;
      err.code = 'RESET_OTP_REQUEST_LIMITED';
      throw err;
    }

    const latestSession =
      await basePrisma.password_reset_sessions.findFirst({
        where: {
          user_id: user.id,
          identifier: rawIdentifier,
          status: {
            in: ['PENDING', 'VERIFIED'],
          },
          deleted_at: null,
        },
        orderBy: {
          created_at: 'desc',
        },
      });

    if (latestSession?.created_at) {
      const elapsedSeconds =
        (now.getTime() -
          new Date(latestSession.created_at).getTime()) /
        1000;

      if (
        elapsedSeconds <
        securityConfig.RESET_OTP_RESEND_COOLDOWN_SECONDS
      ) {
        const waitSeconds = Math.ceil(
          securityConfig.RESET_OTP_RESEND_COOLDOWN_SECONDS -
            elapsedSeconds
        );

        const err = new Error(
          `Mã xác nhận đã được gửi. Vui lòng chờ khoảng ${waitSeconds} giây trước khi yêu cầu lại.`
        );
        err.status = 429;
        err.code = 'RESET_OTP_COOLDOWN';
        err.waitSeconds = waitSeconds;
        throw err;
      }
    }

    await basePrisma.password_reset_sessions.updateMany({
      where: {
        user_id: user.id,
        status: {
          in: ['PENDING', 'VERIFIED', 'LOCKED'],
        },
        deleted_at: null,
      },
      data: {
        status: 'CANCELLED',
        updated_at: now,
      },
    });

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashResetSecret(otp);

    const expiresAt = new Date(
      now.getTime() +
        securityConfig.RESET_OTP_EXPIRES_MINUTES * 60 * 1000
    );

    const session = await basePrisma.password_reset_sessions.create({
      data: {
        user_id: user.id,
        identifier: rawIdentifier,
        otp_hash: otpHash,
        reset_token_hash: null,
        status: 'PENDING',
        request_count: recentRequestCount + 1,
        resend_count: 0,
        verify_attempt_count: 0,
        expires_at: expiresAt,
        verified_at: null,
        locked_until: null,
        ip_address: ip_address || null,
        user_agent: user_agent || null,
        metadata: {
          delivery_channel: 'EMAIL',
          delivery_email: user.email,
          otp_expires_minutes: securityConfig.RESET_OTP_EXPIRES_MINUTES,
        },
        updated_at: now,
      },
    });

    await emailService.sendOTP(user.email, otp);

    await authLogService.logAttempt({
      identifier: rawIdentifier,
      ip_address,
      user_agent,
      status: 'THANH_CONG',
      failure_reason: 'FORGOT_PASSWORD_OTP_SENT',
    });

    return {
      dispatched: true,
      channel: 'EMAIL',
      sessionId: session.id,
      expiresInMinutes: securityConfig.RESET_OTP_EXPIRES_MINUTES,
    };
  },

  /**
   * <2026-05-13T00:00:00+07:00>
   * Forgot Password Flow v3: VERIFY RESET CODE
   */
  verifyResetCode: async (identifier, otp, extraData = {}) => {
    const { ip_address, user_agent } = extraData;

    const rawIdentifier = cleanInput(
      identifier,
      identifier?.includes('@') ? 'email' : 'phone'
    );

    if (!rawIdentifier || !otp) {
      const err = new Error('Mã xác nhận không hợp lệ hoặc đã hết hạn.');
      err.status = 400;
      err.code = 'INVALID_RESET_CODE';
      throw err;
    }

    const now = new Date();

    const session = await basePrisma.password_reset_sessions.findFirst({
      where: {
        identifier: rawIdentifier,
        status: 'PENDING',
        deleted_at: null,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    if (!session) {
      await authLogService.logAttempt({
        identifier: rawIdentifier,
        ip_address,
        user_agent,
        status: 'THAT_BAI',
        failure_reason: 'VERIFY_RESET_CODE_SESSION_NOT_FOUND',
      });

      const err = new Error('Mã xác nhận không hợp lệ hoặc đã hết hạn.');
      err.status = 400;
      err.code = 'RESET_SESSION_NOT_FOUND';
      throw err;
    }

    if (session.locked_until && new Date(session.locked_until) > now) {
      const minutesLeft = Math.ceil(
        (new Date(session.locked_until).getTime() - now.getTime()) /
          60000
      );

      const err = new Error(
        `Bạn đã nhập sai mã quá nhiều lần. Vui lòng thử lại sau ${minutesLeft} phút.`
      );
      err.status = 429;
      err.code = 'RESET_OTP_LOCKED';
      err.minutesLeft = minutesLeft;
      throw err;
    }

    if (new Date(session.expires_at) < now) {
      await basePrisma.password_reset_sessions.update({
        where: { id: session.id },
        data: {
          status: 'EXPIRED',
          updated_at: now,
        },
      });

      const err = new Error(
        'Mã xác nhận đã hết hạn. Vui lòng yêu cầu mã mới.'
      );
      err.status = 400;
      err.code = 'RESET_OTP_EXPIRED';
      throw err;
    }

    const otpHash = hashResetSecret(otp);

    if (otpHash !== session.otp_hash) {
      const nextAttemptCount =
        (session.verify_attempt_count || 0) + 1;

      const shouldLock =
        nextAttemptCount >=
        securityConfig.RESET_OTP_MAX_VERIFY_ATTEMPTS;

      await basePrisma.password_reset_sessions.update({
        where: { id: session.id },
        data: {
          verify_attempt_count: nextAttemptCount,
          status: shouldLock ? 'LOCKED' : 'PENDING',
          locked_until: shouldLock
            ? new Date(
                now.getTime() +
                  securityConfig.RESET_OTP_LOCK_MINUTES *
                    60 *
                    1000
              )
            : session.locked_until,
          updated_at: now,
        },
      });

      await authLogService.logAttempt({
        identifier: rawIdentifier,
        ip_address,
        user_agent,
        status: 'THAT_BAI',
        failure_reason: shouldLock
          ? 'VERIFY_RESET_CODE_LOCKED'
          : 'VERIFY_RESET_CODE_WRONG_OTP',
      });

      const err = new Error(
        shouldLock
          ? `Bạn đã nhập sai mã quá nhiều lần. Vui lòng thử lại sau ${securityConfig.RESET_OTP_LOCK_MINUTES} phút.`
          : 'Mã xác nhận không đúng. Vui lòng kiểm tra lại.'
      );

      err.status = shouldLock ? 429 : 400;
      err.code = shouldLock
        ? 'RESET_OTP_LOCKED'
        : 'INVALID_RESET_CODE';

      err.remainingAttempts = Math.max(
        0,
        securityConfig.RESET_OTP_MAX_VERIFY_ATTEMPTS -
          nextAttemptCount
      );

      throw err;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = hashResetSecret(resetToken);

    const resetTokenExpiresAt = new Date(
      now.getTime() +
        securityConfig.RESET_TOKEN_EXPIRES_MINUTES * 60 * 1000
    );

    await basePrisma.password_reset_sessions.update({
      where: { id: session.id },
      data: {
        status: 'VERIFIED',
        reset_token_hash: resetTokenHash,
        verified_at: now,
        expires_at: resetTokenExpiresAt,
        updated_at: now,
        metadata: {
          ...(session.metadata || {}),
          reset_token_expires_minutes:
            securityConfig.RESET_TOKEN_EXPIRES_MINUTES,
          verified_ip_address: ip_address || null,
          verified_user_agent: user_agent || null,
        },
      },
    });

    await authLogService.logAttempt({
      identifier: rawIdentifier,
      ip_address,
      user_agent,
      status: 'THANH_CONG',
      failure_reason: 'VERIFY_RESET_CODE_SUCCESS',
    });

    return {
      resetToken,
      expiresInMinutes: securityConfig.RESET_TOKEN_EXPIRES_MINUTES,
    };
  },

  /**
   * <2026-05-13T00:00:00+07:00>
   * Forgot Password Flow v3: CHANGE PASSWORD AFTER RESET
   */
  changePasswordAfterReset: async (identifier, resetToken, newPassword) => {
    const rawIdentifier = cleanInput(
      identifier,
      identifier?.includes('@') ? 'email' : 'phone'
    );

    if (!rawIdentifier || !resetToken || !newPassword) {
      const err = new Error('Yêu cầu đặt lại mật khẩu không hợp lệ.');
      err.status = 400;
      err.code = 'INVALID_CHANGE_PASSWORD_REQUEST';
      throw err;
    }

    if (newPassword.length < 6) {
      const err = new Error('Mật khẩu mới cần có ít nhất 6 ký tự.');
      err.status = 400;
      err.code = 'WEAK_PASSWORD';
      throw err;
    }

    const now = new Date();
    const resetTokenHash = hashResetSecret(resetToken);

    const session = await basePrisma.password_reset_sessions.findFirst({
      where: {
        identifier: rawIdentifier,
        reset_token_hash: resetTokenHash,
        status: 'VERIFIED',
        deleted_at: null,
      },
      orderBy: {
        verified_at: 'desc',
      },
    });

    if (!session) {
      const err = new Error(
        'Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'
      );
      err.status = 400;
      err.code = 'INVALID_RESET_SESSION';
      throw err;
    }

    if (session.locked_until && new Date(session.locked_until) > now) {
      const minutesLeft = Math.ceil(
        (new Date(session.locked_until).getTime() - now.getTime()) /
          60000
      );

      const err = new Error(
        `Phiên đặt lại mật khẩu đang bị khóa. Vui lòng thử lại sau ${minutesLeft} phút.`
      );
      err.status = 429;
      err.code = 'RESET_SESSION_LOCKED';
      err.minutesLeft = minutesLeft;
      throw err;
    }

    if (new Date(session.expires_at) < now) {
      await basePrisma.password_reset_sessions.update({
        where: { id: session.id },
        data: {
          status: 'EXPIRED',
          updated_at: now,
        },
      });

      const err = new Error(
        'Phiên đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu mã mới.'
      );
      err.status = 400;
      err.code = 'RESET_TOKEN_EXPIRED';
      throw err;
    }

    const user = await basePrisma.users.findFirst({
      where: {
        id: session.user_id,
        deleted_at: null,
      },
    });

    if (!user) {
      const err = new Error('Tài khoản không còn tồn tại hoặc đã bị xóa.');
      err.status = 404;
      err.code = 'RESET_USER_NOT_FOUND';
      throw err;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await basePrisma.$transaction(async (tx) => {
      await tx.users.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          attempt_count: 0,
          updated_at: now,
        },
      });

      await tx.password_reset_sessions.update({
        where: { id: session.id },
        data: {
          status: 'COMPLETED',
          reset_token_hash: null,
          updated_at: now,
          metadata: {
            ...(session.metadata || {}),
            completed_at: now.toISOString(),
          },
        },
      });

      await tx.password_reset_sessions.updateMany({
        where: {
          user_id: user.id,
          id: {
            not: session.id,
          },
          status: {
            in: ['PENDING', 'VERIFIED', 'LOCKED'],
          },
          deleted_at: null,
        },
        data: {
          status: 'CANCELLED',
          updated_at: now,
        },
      });
    });

    return {
      userId: user.id,
      changed: true,
    };
  },

  /**
   * <2026-05-12T00:00:00+07:00>
   * Legacy compatibility.
   * - Giữ tương thích cho route /auth/reset-password cũ.
   * - Không dùng cho flow mới 3 bước.
   */
  resetPassword: async (email, otp, newPassword) => {
    const user = await authService.verifyOTP(email, otp);

    if (!user) {
      const err = new Error('Mã OTP không hợp lệ hoặc đã hết hạn.');
      err.status = 400;
      err.code = 'INVALID_OTP';
      throw err;
    }

    await authService.updatePassword(email, newPassword);

    return {
      changed: true,
    };
  },

  saveResetToken: async (userId, otp) => {
    return await basePrisma.users.update({
      where: { id: userId },
      data: {
        reset_token: otp,
        reset_expires: new Date(
          Date.now() +
            securityConfig.RESET_OTP_EXPIRES_MINUTES * 60 * 1000
        ),
      },
    });
  },

  verifyOTP: async (email, otp) => {
    return await basePrisma.users.findFirst({
      where: {
        email,
        reset_token: otp,
        reset_expires: {
          gte: new Date(),
        },
      },
    });
  },

  updatePassword: async (email, newPassword) => {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    return await basePrisma.users.update({
      where: { email },
      data: {
        password: hashedPassword,
        reset_token: null,
        reset_expires: null,
      },
    });
  },
};

module.exports = authService;