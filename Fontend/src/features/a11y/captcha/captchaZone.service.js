/**
 * PATH       : src/features/a11y/captcha/captchaZone.service.js
 * DATETIME   : 2026-05-23T00:00:00+07:00
 * VERSION    : EGAL-24.6.7.R3.3.1-CAPTCHA-DOCTRINE
 * DESCRIPTION:
 * - Shared CAPTCHA Guided Zone Lifecycle Service.
 * - Formalize CAPTCHA submit doctrine:
 *   1) Missing token = NON-DESTRUCTIVE. Do not reset/remount captcha.
 *   2) Expired/Error/Consumed/Backend invalid = DESTRUCTIVE. Reset/remount allowed.
 * - Preserve existing public API:
 *   CAPTCHA_ZONE_STATUS
 *   CAPTCHA_RESET_REASONS
 *   buildCaptchaPayloadSnapshot
 *   validateCaptchaBeforeSubmit
 *   completeCaptchaZone
 *   blockCaptchaZone
 *   runCaptchaZoneProbe
 *   markCaptchaConsumed
 * - Add helper APIs for later hook/component extraction.
 * - No React dependency.
 * - No backend/business logic.
 * - Q1/Q2 safe.
 */

export const CAPTCHA_ZONE_STATUS = {
  UNKNOWN: 'UNKNOWN',
  VERIFIED: 'VERIFIED',
  MISSING: 'MISSING',
  EXPIRED: 'EXPIRED',
  ERROR: 'ERROR',
  CONSUMED: 'CONSUMED',
};

export const CAPTCHA_RESET_REASONS = {
  EXPIRED: 'expired',
  TIMEOUT: 'timeout',
  ERROR: 'error',
  BACKEND_INVALID: 'backend_invalid',
  CONSUMED: 'consumed',
};

export const CAPTCHA_BLOCK_REASONS = {
  MISSING_TOKEN: 'missing_token',
};

export const CAPTCHA_PROBE_DEFAULTS = {
  DELAY_MS: 1000,
  MIN_DELAY_MS: 800,
  MAX_DELAY_MS: 1200,
};

export const CAPTCHA_DEFAULT_MAX_AGE_MS = 90 * 1000;

function safeString(value = '') {
  return String(value || '').trim();
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeFunction(fn) {
  return typeof fn === 'function' ? fn : null;
}

function clampDelay(delay) {
  const n = safeNumber(delay, CAPTCHA_PROBE_DEFAULTS.DELAY_MS);

  return Math.min(
    CAPTCHA_PROBE_DEFAULTS.MAX_DELAY_MS,
    Math.max(CAPTCHA_PROBE_DEFAULTS.MIN_DELAY_MS, n)
  );
}

function now() {
  return Date.now();
}

export function hasCaptchaToken(token) {
  return safeString(token).length > 0;
}

/**
 * Missing token is intentionally NOT a reset reason.
 */
export function shouldResetCaptcha(reason = '') {
  const normalizedReason = safeString(reason);

  return Object.values(CAPTCHA_RESET_REASONS).includes(normalizedReason);
}

export function isCaptchaResetDestructive(reason = '') {
  return shouldResetCaptcha(reason);
}

export function buildCaptchaPayloadSnapshot({
  captchaToken = '',
  captchaUpdatedAt = 0,
  captchaStatus = CAPTCHA_ZONE_STATUS.UNKNOWN,
  consumed = false,
} = {}) {
  const token = safeString(captchaToken);
  const updatedAt = safeNumber(captchaUpdatedAt, 0);

  return {
    token,
    hasToken: hasCaptchaToken(token),
    updatedAt,
    ageMs: updatedAt > 0 ? now() - updatedAt : Number.POSITIVE_INFINITY,
    status: captchaStatus || CAPTCHA_ZONE_STATUS.UNKNOWN,
    consumed: consumed === true,
    createdAt: now(),
  };
}

function createCaptchaValidationResult({
  valid = false,
  reason = '',
  blockReason = '',
  message = '',
  token = '',
} = {}) {
  const normalizedReason = safeString(reason);
  const normalizedBlockReason = safeString(blockReason);

  return {
    valid,
    reason: normalizedReason,
    blockReason: normalizedBlockReason,
    message,
    token,
    destructiveReset: shouldResetCaptcha(normalizedReason),
    shouldReset: shouldResetCaptcha(normalizedReason),
  };
}

export function validateCaptchaBeforeSubmit({
  snapshot = {},
  maxAgeMs = CAPTCHA_DEFAULT_MAX_AGE_MS,
} = {}) {
  const token = safeString(snapshot.token);
  const status = snapshot.status || CAPTCHA_ZONE_STATUS.UNKNOWN;
  const ageMs = safeNumber(snapshot.ageMs, Number.POSITIVE_INFINITY);
  const allowedAge = safeNumber(maxAgeMs, CAPTCHA_DEFAULT_MAX_AGE_MS);

  if (snapshot.consumed === true || status === CAPTCHA_ZONE_STATUS.CONSUMED) {
    return createCaptchaValidationResult({
      valid: false,
      reason: CAPTCHA_RESET_REASONS.CONSUMED,
      message:
        'Phần xác minh đã được sử dụng. Bác vui lòng xác minh lại một lần nữa.',
    });
  }

  if (status === CAPTCHA_ZONE_STATUS.EXPIRED) {
    return createCaptchaValidationResult({
      valid: false,
      reason: CAPTCHA_RESET_REASONS.EXPIRED,
      message:
        'Phần xác minh đã hết hạn. Bác vui lòng xác minh lại một lần nữa.',
    });
  }

  if (status === CAPTCHA_ZONE_STATUS.ERROR) {
    return createCaptchaValidationResult({
      valid: false,
      reason: CAPTCHA_RESET_REASONS.ERROR,
      message:
        'Phần xác minh đang gặp lỗi. Bác vui lòng thử lại một lần nữa.',
    });
  }

  if (!hasCaptchaToken(token)) {
    return createCaptchaValidationResult({
      valid: false,
      reason: '',
      blockReason: CAPTCHA_BLOCK_REASONS.MISSING_TOKEN,
      message:
        'Bác vui lòng hoàn tất phần xác minh trước khi tiếp tục.',
    });
  }

  if (ageMs > allowedAge) {
    return createCaptchaValidationResult({
      valid: false,
      reason: CAPTCHA_RESET_REASONS.EXPIRED,
      message:
        'Phần xác minh đã quá lâu. Bác vui lòng xác minh lại một lần nữa.',
    });
  }

  return createCaptchaValidationResult({
    valid: true,
    reason: '',
    blockReason: '',
    message: '',
    token,
  });
}

export function resolveNextZone({
  currentZoneId = 'captcha',
  orderedZones = [],
  explicitNextZone = '',
} = {}) {
  if (safeString(explicitNextZone)) {
    return safeString(explicitNextZone);
  }

  if (!Array.isArray(orderedZones)) return '';

  const index = orderedZones.indexOf(currentZoneId);

  if (index < 0) return '';

  return orderedZones[index + 1] || '';
}

export function completeCaptchaZone({
  guidedFlow,
  zoneId = 'captcha',
  nextZone = '',
} = {}) {
  const currentZone = safeString(zoneId) || 'captcha';
  const targetZone = safeString(nextZone);

  guidedFlow?.markCompleted?.(currentZone);

  if (targetZone) {
    guidedFlow?.goToField?.(targetZone);
  }

  return {
    completed: true,
    zoneId: currentZone,
    nextZone: targetZone,
  };
}

/**
 * Legacy-safe block helper.
 * Kept for compatibility.
 */
export function blockCaptchaZone({
  guidedFlow,
  zoneId = 'captcha',
  speak,
  message = '',
} = {}) {
  const currentZone = safeString(zoneId) || 'captcha';

  guidedFlow?.unmarkCompleted?.(currentZone);
  guidedFlow?.goToField?.(currentZone);

  const finalMessage =
    safeString(message) ||
    'Bác vui lòng hoàn tất phần xác minh trước khi tiếp tục.';

  if (typeof speak === 'function') {
    speak(finalMessage);
  }

  return {
    blocked: true,
    zoneId: currentZone,
    message: finalMessage,
  };
}

/**
 * New submit helper for R3.3.1+.
 * It does not reset/remount captcha.
 * Reset decision remains based on validationResult.reason.
 */
export function blockCaptchaSubmit({
  guidedFlow,
  zoneId = 'captcha',
  validationResult = {},
  speak,
  focus,
  focusDelayMs = 2200,
  message = '',
} = {}) {
  const currentZone = safeString(zoneId) || 'captcha';

  const finalMessage =
    safeString(message) ||
    safeString(validationResult.message) ||
    'Bác vui lòng hoàn tất phần xác minh trước khi tiếp tục.';

  guidedFlow?.unmarkCompleted?.(currentZone);

  if (typeof speak === 'function') {
    speak(finalMessage);
  }

  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      guidedFlow?.goToField?.(currentZone);

      if (typeof focus === 'function') {
        focus(currentZone);
      }
    }, safeNumber(focusDelayMs, 2200));
  } else {
    guidedFlow?.goToField?.(currentZone);
  }

  return {
    blocked: true,
    zoneId: currentZone,
    message: finalMessage,
    reason: validationResult.reason || '',
    blockReason: validationResult.blockReason || '',
    shouldReset: shouldResetCaptcha(validationResult.reason),
    destructiveReset: shouldResetCaptcha(validationResult.reason),
  };
}

export function runCaptchaZoneProbe({
  getCaptchaToken,
  guidedFlow,
  zoneId = 'captcha',
  orderedZones = [],
  nextZone = '',
  delayMs = CAPTCHA_PROBE_DEFAULTS.DELAY_MS,
  onCompleted,
  onNeedsGuidance,
  onProbeStart,
  onProbeEnd,
} = {}) {
  const readToken = safeFunction(getCaptchaToken);
  const completedCallback = safeFunction(onCompleted);
  const guidanceCallback = safeFunction(onNeedsGuidance);
  const probeStartCallback = safeFunction(onProbeStart);
  const probeEndCallback = safeFunction(onProbeEnd);

  const delay = clampDelay(delayMs);
  const currentZone = safeString(zoneId) || 'captcha';

  probeStartCallback?.({
    zoneId: currentZone,
    delayMs: delay,
  });

  const timerId = window.setTimeout(() => {
    const token = readToken ? readToken() : '';

    const targetNextZone =
      safeString(nextZone) ||
      resolveNextZone({
        currentZoneId: currentZone,
        orderedZones,
      });

    if (hasCaptchaToken(token)) {
      const result = completeCaptchaZone({
        guidedFlow,
        zoneId: currentZone,
        nextZone: targetNextZone,
      });

      completedCallback?.({
        ...result,
        token,
        reason: 'auto_verified',
      });

      probeEndCallback?.({
        zoneId: currentZone,
        completed: true,
        tokenExists: true,
      });

      return;
    }

    guidanceCallback?.({
      zoneId: currentZone,
      reason: CAPTCHA_BLOCK_REASONS.MISSING_TOKEN,
    });

    probeEndCallback?.({
      zoneId: currentZone,
      completed: false,
      tokenExists: false,
    });
  }, delay);

  return {
    cancel: () => {
      window.clearTimeout(timerId);
    },
    delayMs: delay,
    zoneId: currentZone,
  };
}

export function markCaptchaConsumed({
  guidedFlow,
  zoneId = 'captcha',
} = {}) {
  const currentZone = safeString(zoneId) || 'captcha';

  guidedFlow?.unmarkCompleted?.(currentZone);

  return {
    consumed: true,
    zoneId: currentZone,
    status: CAPTCHA_ZONE_STATUS.CONSUMED,
    reason: CAPTCHA_RESET_REASONS.CONSUMED,
    shouldReset: true,
    destructiveReset: true,
  };
}

const captchaZoneService = {
  CAPTCHA_ZONE_STATUS,
  CAPTCHA_RESET_REASONS,
  CAPTCHA_BLOCK_REASONS,
  CAPTCHA_PROBE_DEFAULTS,
  CAPTCHA_DEFAULT_MAX_AGE_MS,

  hasCaptchaToken,
  shouldResetCaptcha,
  isCaptchaResetDestructive,

  buildCaptchaPayloadSnapshot,
  validateCaptchaBeforeSubmit,

  resolveNextZone,
  completeCaptchaZone,
  blockCaptchaZone,
  blockCaptchaSubmit,

  runCaptchaZoneProbe,
  markCaptchaConsumed,
};

export default captchaZoneService;