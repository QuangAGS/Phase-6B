/**
 * PATH       : src/features/auth/utils/joinClanValidation.js
 * DATETIME   : 21-04-2026 08:30
 * VERSION    : 2.1.0
 * DESCRIPTION:
 * - Nâng cấp hỗ trợ preprocess cho birth_year để tránh lỗi ép kiểu.
 */

import { z } from 'zod';
import { safeString, optionalEmailRule, phoneRule, birthYearRule } from '@/utils/validationRules.js';

export const joinClanSchema = z.object({
  tenantId: z.string().min(1, 'Bạn bắt buộc phải chọn một dòng họ từ danh sách'),
  clanName: z.string().trim(),

  temp_full_name: safeString.refine((val) => val !== null, 'Họ tên trong phả hệ là bắt buộc'),
  temp_father_name: safeString.refine((val) => val !== null, 'Tên cha là bắt buộc'),
  temp_grandfather_name: safeString.optional(),
  
  // Ép kiểu về Number/Null để an toàn khi validate
  temp_birth_year: z.preprocess((val) => (val === "" ? null : Number(val)), birthYearRule),

  temp_relationship: z.enum(
    ['CON_DE', 'CON_DAU', 'CON_RE', 'CON_NUOI', 'CON_DO_DAU', 'KHAC'],
    { message: 'Quan hệ khai báo không hợp lệ' }
  ),

  temp_note: safeString.refine(
    (val) => val !== null && val.length > 10,
    'Lời nhắn tới Ban quản trị là bắt buộc'
  ),
  temp_address: safeString.optional(),
  temp_branch_name: safeString.optional(),
  
  name: z.string().optional().default(''),
  phone: phoneRule,
  email: optionalEmailRule,
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});