/**
 * PATH       : src/features/a11y/recovery/guidedRecovery.service.js
 * DATETIME   : 2026-05-15T00:00:00+07:00
 * VERSION    : 24.0.0
 * DESCRIPTION:
 * - Sprint EGAL-6.3: Persistent Attention & Re-entry Recovery.
 * - Service lưu/đọc/xóa trạng thái guided recovery nhẹ cho auth flows.
 * - Chỉ persist metadata an toàn: flowKey, currentStep, activeField, lastAttentionMessage, lightweight draft.
 * - Không persist password, OTP, captchaToken, Turnstile token hoặc dữ liệu nhạy cảm.
 * - Frontend-only, non-invasive.
 * - Không thay đổi business logic, auth flow, validation hoặc API contract.
 * - Tuân thủ Q1/Q2.
 */

const RECOVERY_STORAGE_PREFIX = 'EGAL_GUIDED_RECOVERY';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24 giờ

const SENSITIVE_KEYS = [
  'password',
  'confirmPassword',
  'newPassword',
  'oldPassword',
  'otp',
  'code',
  'resetCode',
  'resetToken',
  'token',
  'captchaToken',
  'turnstileToken',
  'hp_field',
];

/**
 * <2026-05-15T00:00:00+07:00>
 * Kiểm tra môi trường có localStorage không.
 * Mục đích: tránh lỗi khi SSR/test/private browsing.
 */
export function canUseRecoveryStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Chuẩn hóa storage key theo flow.
 * Mục đích: mỗi flow có vùng recovery riêng, tránh đè dữ liệu.
 */
export function buildRecoveryStorageKey(flowKey = 'global') {
  const safeFlowKey = String(flowKey || 'global')
    .trim()
    .replace(/[^a-zA-Z0-9:_-]/g, '_');

  return `${RECOVERY_STORAGE_PREFIX}:${safeFlowKey}`;
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Kiểm tra key có nhạy cảm không.
 * Mục đích: không lưu password/OTP/token/captcha/honeypot vào localStorage.
 */
export function isSensitiveRecoveryKey(key) {
  const normalizedKey = String(key || '').toLowerCase();

  return SENSITIVE_KEYS.some((item) =>
    normalizedKey.includes(item.toLowerCase())
  );
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Lọc draft trước khi persist.
 * Mục đích: chỉ lưu dữ liệu nhẹ, không nhạy cảm.
 */
export function sanitizeRecoveryDraft(draft = {}) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return {};
  }

  return Object.keys(draft).reduce((acc, key) => {
    if (isSensitiveRecoveryKey(key)) {
      return acc;
    }

    const value = draft[key];

    if (
      value === undefined ||
      typeof value === 'function' ||
      typeof value === 'symbol'
    ) {
      return acc;
    }

    acc[key] = value;
    return acc;
  }, {});
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Tạo payload recovery chuẩn.
 * Mục đích: thống nhất cấu trúc dữ liệu recovery giữa các form.
 */
export function createRecoveryPayload({
  flowKey = 'global',
  currentStep = '',
  currentStepIndex = null,
  activeField = '',
  lastAttentionMessage = '',
  draft = {},
  meta = {},
  ttlMs = DEFAULT_TTL_MS,
} = {}) {
  const now = Date.now();

  return {
    version: '24.0.0',
    flowKey,
    currentStep,
    currentStepIndex,
    activeField,
    lastAttentionMessage,
    draft: sanitizeRecoveryDraft(draft),
    meta,
    createdAt: now,
    updatedAt: now,
    expiresAt: ttlMs > 0 ? now + ttlMs : null,
  };
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Lưu recovery state.
 * Mục đích: cho phép người dùng quay lại đúng vùng đang thao tác.
 */
export function saveRecoveryState(flowKey, state = {}, options = {}) {
  if (!canUseRecoveryStorage()) return false;

  const storageKey = buildRecoveryStorageKey(flowKey);
  const ttlMs = Number(options.ttlMs || state.ttlMs || DEFAULT_TTL_MS);

  try {
    const existing = loadRecoveryState(flowKey, {
      ignoreExpiry: true,
    });

    const payload = {
      ...createRecoveryPayload({
        flowKey,
        ttlMs,
      }),
      ...(existing || {}),
      ...state,
      flowKey,
      draft: sanitizeRecoveryDraft(state.draft || existing?.draft || {}),
      meta:
        state.meta && typeof state.meta === 'object'
          ? state.meta
          : existing?.meta || {},
      updatedAt: Date.now(),
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : null,
    };

    window.localStorage.setItem(storageKey, JSON.stringify(payload));

    return true;
  } catch (err) {
    return false;
  }
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Đọc recovery state.
 * Mục đích: phục hồi guided step/field khi người dùng quay lại flow.
 */
export function loadRecoveryState(flowKey, options = {}) {
  if (!canUseRecoveryStorage()) return null;

  const storageKey = buildRecoveryStorageKey(flowKey);
  const { ignoreExpiry = false } = options;

  try {
    const rawValue = window.localStorage.getItem(storageKey);

    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue);

    if (
      !ignoreExpiry &&
      parsed?.expiresAt &&
      Date.now() > Number(parsed.expiresAt)
    ) {
      clearRecoveryState(flowKey);
      return null;
    }

    return parsed;
  } catch (err) {
    clearRecoveryState(flowKey);
    return null;
  }
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Xóa recovery state theo flow.
 * Mục đích: dùng khi flow hoàn tất hoặc user chủ động reset.
 */
export function clearRecoveryState(flowKey) {
  if (!canUseRecoveryStorage()) return false;

  try {
    window.localStorage.removeItem(buildRecoveryStorageKey(flowKey));
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Kiểm tra recovery state còn hiệu lực không.
 * Mục đích: UI có thể quyết định hiển thị resume prompt hay không.
 */
export function hasValidRecoveryState(flowKey) {
  return !!loadRecoveryState(flowKey);
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Xóa toàn bộ recovery state của EGAL.
 * Mục đích: dùng khi logout, reset app, hoặc cần dọn dẹp recovery data.
 */
export function clearAllRecoveryStates() {
  if (!canUseRecoveryStorage()) return false;

  try {
    Object.keys(window.localStorage).forEach((key) => {
      if (key.startsWith(RECOVERY_STORAGE_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    });

    return true;
  } catch (err) {
    return false;
  }
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Merge patch vào draft hiện có.
 * Mục đích: các form có thể lưu từng phần nhỏ mà không ghi đè toàn bộ draft.
 */
export function updateRecoveryDraft(flowKey, draftPatch = {}, options = {}) {
  const existing = loadRecoveryState(flowKey, {
    ignoreExpiry: true,
  });

  const nextDraft = {
    ...(existing?.draft || {}),
    ...sanitizeRecoveryDraft(draftPatch),
  };

  return saveRecoveryState(
    flowKey,
    {
      ...(existing || {}),
      draft: nextDraft,
    },
    options
  );
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Export constants cho các bước sau.
 * Mục đích: tránh hard-code key/TTL ở nhiều nơi.
 */
export const guidedRecoveryConfig = {
  RECOVERY_STORAGE_PREFIX,
  DEFAULT_TTL_MS,
  SENSITIVE_KEYS,
};

export default {
  canUseRecoveryStorage,
  buildRecoveryStorageKey,
  isSensitiveRecoveryKey,
  sanitizeRecoveryDraft,
  createRecoveryPayload,
  saveRecoveryState,
  loadRecoveryState,
  clearRecoveryState,
  hasValidRecoveryState,
  clearAllRecoveryStates,
  updateRecoveryDraft,
  guidedRecoveryConfig,
};