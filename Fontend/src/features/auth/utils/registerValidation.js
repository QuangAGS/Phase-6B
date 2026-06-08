/**
 * PATH: src/features/auth/utils/registerValidation.js
 * DATETIME: 15-04-2026 11:15
 * VERSION: 1.3.0
 * DESCRIPTION: Schema "ép" điều kiện nghiêm ngặt: 
 * - Gia nhập: Bắt buộc chọn Dòng họ (tenantId).
 * - Tạo mới: Bắt buộc Email và Mô tả (description).
 */
import { z } from 'zod';
import { safeString, emailRule, phoneRule, birthYearRule } from '@/utils/validationRules.js';

export const registerSchema = z.object({
  // Flag phân loại luồng
  isNewClan: z.boolean(),

  // Thông tin tài khoản
  name: safeString.refine(val => val !== null, "Tên hiển thị không được để trống"),
  email: emailRule.optional().or(z.literal('')), 
  phone: phoneRule, // Ép Mobile-first: Luôn phải có số điện thoại
  password: z.string().min(6, "Mật khẩu phải từ 6 ký tự"),

  // Dòng họ
  clanName: safeString.refine(val => val !== null, "Tên dòng họ không được để trống"),
  tenantId: z.string().optional(), // Sẽ validate qua superRefine
  description: safeString,         // Sẽ validate qua superRefine

  // Dữ liệu Vét cạn (temp_ fields) cho BR3
  temp_full_name: safeString.refine(val => val !== null, "Họ tên khai sinh là bắt buộc"),
  temp_father_name: safeString.refine(val => val !== null, "Tên cha là bắt buộc để đối soát"),
  temp_grandfather_name: safeString,
  temp_birth_year: birthYearRule,
  temp_address: safeString,
  temp_relationship: z.enum(["CON_DE", "CON_DAU", "CON_RE", "CON_NUOI", "KHAC"]),
  temp_note: safeString,
})
.superRefine((data, ctx) => {
  // 1. LUỒNG TẠO MỚI (CLAN_ADMIN)
  if (data.isNewClan) {
    if (!data.email || data.email === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tạo dòng họ mới bắt buộc phải có Email quản trị",
        path: ["email"]
      });
    }
    if (!data.description || data.description.length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Mô tả dòng họ bắt buộc (tối thiểu 10 ký tự)",
        path: ["description"]
      });
    }
  } 
  
  // 2. LUỒNG GIA NHẬP (USER) - "ÉP" CHỌN DÒNG HỌ
  else {
    if (!data.tenantId || data.tenantId === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bạn phải chọn một dòng họ cụ thể từ danh sách tìm kiếm",
        path: ["clanName"] // Hiển thị lỗi ngay ô Search
      });
    }
  }
});