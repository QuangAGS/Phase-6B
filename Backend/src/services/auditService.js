/**
 * PATH: backend/src/services/authService.js
 * DATETIME: 22-04-2026 11:30
 * VERSION: v6.0.0
 * DESCRIPTION: 
 * - NÂNG CẤP: Tích hợp cơ chế cấp Slug số (YYYYNNNNNN) thông qua bảng slug_counters.
 * - TRANSACTION: Đảm bảo tính Atomic khi tăng bộ đếm và tạo Tenant/User.
 * - Q1: Bảo tồn nguyên vẹn các hàm approveUser, loginUser và các khối theo dõi.
 * - Q2: Metadata chuẩn, giải thích chi tiết logic cấp phát số định danh.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { basePrisma } = require('../lib/prisma');
const auditService = require('./auditService');
const { cleanInput, formatNumericSlug } = require('../utils/slugUtils'); // Sử dụng hàm format mới
const authLogService = require('./authLogService');

const authService = {
  /**
   * 1. SINH TOKEN XÁC THỰC (Bảo tồn)
   */
  generateToken: (user) => {
    return jwt.sign(
      { userId: user.id, tenant_id: user.tenant_id, role: user.role, status: user.status },
      process.env.JWT_SECRET || 'gia_pha_secret_key_2026',
      { expiresIn: '7d' }
    );
  },

  /**
   * 2. ĐĂNG NHẬP (Bảo tồn Q1)
   */
  loginUser: async (identifier, password, extraData = {}) => {
    const { ip_address, user_agent } = extraData;
    const cleanId = cleanInput(identifier, identifier.includes('@') ? 'email' : 'phone');

    const user = await basePrisma.users.findFirst({
      where: { OR: [{ phone: cleanId }, { email: cleanId }], deleted_at: null },
    });

    if (!user) {
      const err = new Error('INVALID_AUTH');
      err.status = 401;
      throw err;
    }

    if (user.status === 'BI_KHOA' && user.locked_until) {
      const now = new Date();
      if (user.locked_until > now) {
        const timeLeft = Math.ceil((user.locked_until - now) / 1000 / 60);
        const err = new Error('ACCOUNT_LOCKED');
        err.status = 423; 
        err.minutesLeft = timeLeft;
        throw err;
      } else {
        await basePrisma.users.update({
          where: { id: user.id },
          data: { status: 'DA_DUYET', locked_until: null }
        });
        user.status = 'DA_DUYET';
      }
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await authLogService.logAttempt({
        identifier: cleanId, ip_address, user_agent,
        status: 'THAT_BAI', failure_reason: 'SAI_MAT_KHAU'
      });
      const meta = await authLogService.getLockoutMetadata(cleanId);
      const err = new Error('INVALID_AUTH');
      err.status = 401;
      err.metadata = meta;
      throw err;
    }

    const token = authService.generateToken(user);
    await authLogService.logAttempt({ identifier: cleanId, ip_address, user_agent, status: 'THANH_CONG' });
    return { token, user };
  },

  /**
   * 3. KIỂM TRA ĐỊNH DANH (Bảo tồn Q1 - Đã tinh chỉnh cho Slug số)
   */
  checkIdentity: async (type, value) => {
      const cleanedValue = cleanInput(value, type);
      if (!cleanedValue) {
          return { available: false, suggestion: null, message: "Dữ liệu không hợp lệ" };
      }
      let existing = null;
      switch (type) {
        case 'slug': existing = await basePrisma.tenants.findUnique({ where: { slug: cleanedValue } }); break;
        case 'email': existing = await basePrisma.users.findUnique({ where: { email: cleanedValue } }); break;
        case 'phone': existing = await basePrisma.users.findUnique({ where: { phone: cleanedValue } }); break;
        default: throw new Error('INVALID_TYPE');
      }
      return {
        available: !existing,
        isReady: type === 'slug' && existing ? existing.status === 'DA_DUYET' : true,
        suggestion: null // Không gợi ý slug chữ cho hệ thống định danh số
      };
  },

  /**
   * 4. ĐĂNG KÝ NGƯỜI DÙNG & DÒNG HỌ (V6.0.0 - NUMERIC SLUG)
   * @description Tích hợp logic Upsert bảng slug_counters để cấp mã vĩnh cửu.
   */
  registerUser: async (payload, extraData = {}) => {
    const { isNewClan, clanName, description, tenantId, onboardingData, ...userData } = payload;
    const { ip_address, user_agent } = extraData;

    try {
        const result = await basePrisma.$transaction(async (tx) => {
            let tid = tenantId;
            let tenantSlug = 'USER';

            // --- BƯỚC 1: XỬ LÝ TENANT & CẤP MÃ SỐ ĐỊNH DANH ---
            if (isNewClan) {
                const currentYear = new Date().getFullYear();
                
                // Thực hiện Upsert trên slug_counters để lấy số thứ tự tiếp theo
                // Sử dụng lock nội bộ của Prisma/DB để đảm bảo tính Atomic
                const counter = await tx.slug_counters.upsert({
                    where: { year: currentYear },
                    update: { last_value: { increment: 1 } },
                    create: { year: currentYear, last_value: 1 }
                });

                // Định dạng slug: YYYYNNNNNN
                const finalSlug = formatNumericSlug(currentYear, counter.last_value);
                
                const newTenant = await tx.tenants.create({
                    data: {
                        name: clanName,
                        slug: finalSlug,
                        description: description,
                        status: 'CHO_DUYET'
                    }
                });
                tid = newTenant.id;
                tenantSlug = finalSlug;
            } else if (tid) {
                const tenant = await tx.tenants.findUnique({ where: { id: tid } });
                tenantSlug = tenant?.slug || 'USER';
            }

            // --- BƯỚC 2: SINH USERNAME KỸ THUẬT ---
            const randomDigits = Math.floor(1000 + Math.random() * 9000);
            const technicalName = `${tenantSlug}_${randomDigits}`;
            const hashedPassword = await bcrypt.hash(userData.password, 10);

            // --- BƯỚC 3: TẠO USER ---
            const nu = await tx.users.create({
                data: {
                    id: crypto.randomUUID(),
                    name: technicalName,
                    email: userData.email ? cleanInput(userData.email, 'email') : null,
                    phone: cleanInput(userData.phone, 'phone'),
                    password: hashedPassword,
                    tenant_id: tid,
                    role: isNewClan ? 'CLAN_ADMIN' : 'VIEWER',
                    status: 'CHO_DUYET',
                    temp_full_name: onboardingData?.temp_full_name || userData.name || 'Thành viên mới',
                    temp_birth_year: onboardingData?.temp_birth_year ? parseInt(onboardingData.temp_birth_year) : null,
                    temp_relationship: onboardingData?.temp_relationship || 'CON_DE',
                    temp_address: onboardingData?.temp_address || null,
                },
            });

            return { userId: nu.id, tenantId: tid, slug: tenantSlug, status: nu.status, phone: userData.phone };
        });

        await authLogService.logAttempt({
            identifier: result.phone, ip_address, user_agent,
            status: 'THANH_CONG', failure_reason: 'REGISTER_SUCCESS'
        });

        return result;

    } catch (error) {
        await authLogService.logAttempt({
            identifier: userData.phone || 'unknown', ip_address, user_agent,
            status: 'THAT_BAI', failure_reason: `REGISTER_ERROR: ${error.message}`
        });
        throw error;
    }
  },

  /**
   * 5. PHÊ DUYỆT THÀNH VIÊN (Bảo tồn Q1)
   */
  approveUser: async (targetId, actorId, role, actorTenantId) => {
    return await basePrisma.$transaction(async (tx) => {
      const target = await tx.users.findUnique({ where: { id: targetId } });
      if (!target || (role !== 'SYSTEM_ADMIN' && target.tenant_id !== actorTenantId)) {
        throw new Error('DENIED');
      }

      const updatedUser = await tx.users.update({
        where: { id: targetId },
        data: { status: 'DA_DUYET', changed_by: actorId },
      });

      const newMember = await tx.members.create({
        data: {
          id: uuidv4(),
          full_name: target.temp_full_name || target.name,
          gender: 'KHAC',
          tenant_id: target.tenant_id,
          changed_by: actorId,
        }
      });

      await tx.users.update({
        where: { id: targetId },
        data: { member_id: newMember.id }
      });

      await auditService.logAction('APPROVE_USER', 'users', targetId, target, updatedUser, actorId, 'Duyệt thành viên mới', target.tenant_id);
      return updatedUser;
    });
  },

  /**
   * 6. TỪ CHỐI ĐĂNG KÝ (Bảo tồn Q1)
   */
  rejectRegistration: async (targetId, actorId, role, actorTenantId, reason) => {
    const target = await basePrisma.users.findUnique({
      where: { id: targetId },
      include: { tenants: true },
    });
    if (!target || (role !== 'SYSTEM_ADMIN' && target.tenant_id !== actorTenantId)) {
      throw new Error('ACCESS_DENIED');
    }
    const tid = target.tenant_id;
    return await basePrisma.$transaction(async (tx) => {
      await auditService.logAction('REJECT_REGISTRATION', 'users', targetId, target, null, actorId, reason || "Thông tin không hợp lệ.", tid);
      await tx.users.delete({ where: { id: targetId } });
      if (target.role === 'CLAN_ADMIN' && target.tenants) {
        await tx.tenants.update({
            where: { id: tid },
            data: { deleted_at: new Date() } // Soft delete cho tenant
        });
      }
      return true;
    });
  },

  // --- CÁC HÀM PHỤ TRỢ (BẢO TỒN 100%) ---
  saveResetToken: async (userId, otp) => {
    return await basePrisma.users.update({
      where: { id: userId },
      data: { reset_token: otp, reset_expires: new Date(Date.now() + 10 * 60 * 1000) }
    });
  },
  verifyOTP: async (email, otp) => {
    return await basePrisma.users.findFirst({
      where: { email, reset_token: otp, reset_expires: { gte: new Date() } }
    });
  },
  updatePassword: async (email, newPassword) => {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    return await basePrisma.users.update({
      where: { email },
      data: { password: hashedPassword, reset_token: null, reset_expires: null }
    });
  }
};

module.exports = authService;