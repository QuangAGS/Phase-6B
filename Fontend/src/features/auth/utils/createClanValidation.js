/**
 * PATH       : src/features/auth/utils/createClanValidation.js
 * DATETIME   : 22-04-2026 23:45
 * VERSION    : 2.2.0
 * DESCRIPTION:
 * - selectedSlug trở thành optional vì backend tự sinh slug.
 * - Giữ nguyên các rule validation cho các trường khác.
 * - Thêm hint và message rõ ràng hơn cho người dùng.
 */

import { z } from 'zod';
import { safeString, emailRule, phoneRule, birthYearRule } from '@/utils/validationRules.js';

export const createClanSchema = z.object({
  // --- KHỐI 1: THÔNG TIN DÒNG HỌ ---
  clanName: safeString.refine((val) => val !== null && val.length > 0, 'Tên dòng họ khởi tạo là bắt buộc'),

  description: z
    .string()
    .trim()
    .min(10, 'Mô tả dòng họ bắt buộc phải từ 10 ký tự trở lên')
    .max(500, 'Mô tả không được vượt quá 500 ký tự'),

  // Slug: Không bắt buộc nữa vì backend tự sinh
  selectedSlug: z.string().optional().default(''),

  logo_url: z.string().url('Link logo phải là URL hợp lệ').optional().or(z.literal('')),

  // --- KHỐI 2: ĐỐI SOÁT NHÂN THÂN ---
  temp_full_name: safeString.refine((val) => val !== null && val.length > 0, 'Họ tên quản trị viên là bắt buộc'),

  temp_father_name: safeString.refine((val) => val !== null && val.length > 0, 'Tên cha/mẹ là bắt buộc'),

  temp_grandfather_name: safeString.optional(),

  temp_birth_year: z.preprocess(
    (val) => (val === "" || val === null ? null : Number(val)),
    birthYearRule
  ),

  temp_relationship: z.enum(
    ['CON_DE', 'CON_DAU', 'CON_RE', 'CON_NUOI', 'CON_DO_DAU', 'KHAC'],
    { message: 'Quan hệ khai báo không hợp lệ' }
  ),

  temp_branch_name: safeString.optional(),
  temp_address: safeString.optional(),

  temp_note: safeString.refine(
    (val) => val !== null && val.length > 10,
    'Lời nhắn tới Ban quản trị là bắt buộc'
  ),

  // --- KHỐI 3: THIẾT LẬP TÀI KHOẢN ---
  phone: phoneRule,
  email: emailRule,
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

export default createClanSchema;