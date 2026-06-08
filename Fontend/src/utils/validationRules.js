/**
 * PATH       : src/utils/validationRules.js
 * DATETIME   : 18-04-2026 21:55
 * VERSION    : 2.0.0
 * DESCRIPTION:
 * - Bộ rule dùng chung cho auth forms.
 * - Giữ nguyên tên export để không phá các file schema hiện tại.
 */

import { z } from 'zod';

export const safeString = z.preprocess(
  (val) => {
    if (typeof val !== 'string') return val;
    const trimmed = val.trim();
    return trimmed === '' ? null : trimmed;
  },
  z.string().nullable()
);

export const emailRule = z
  .string()
  .trim()
  .toLowerCase()
  .email('Email không đúng định dạng');

export const optionalEmailRule = z
  .union([
    emailRule,
    z.literal(''),
  ])
  .optional();

export const phoneRule = z
  .string()
  .trim()
  .min(8, 'Số điện thoại quá ngắn')
  .max(20, 'Số điện thoại quá dài')
  .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/, 'Số điện thoại không hợp lệ');

export const birthYearRule = z.preprocess(
  (val) => {
    if (val === '' || val === null || typeof val === 'undefined') return null;
    const n = Number(val);
    return Number.isNaN(n) ? val : n;
  },
  z
    .number({
      invalid_type_error: 'Năm sinh không hợp lệ',
    })
    .int('Năm sinh phải là số nguyên')
    .min(1000, 'Năm sinh không hợp lệ')
    .max(new Date().getFullYear(), 'Năm sinh không hợp lệ')
    .nullable()
);