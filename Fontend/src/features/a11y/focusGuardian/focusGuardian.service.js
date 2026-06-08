/**
 * ============================================================
 * PATH:
 * src/features/a11y/focusGuardian/focusGuardian.service.js
 *
 * DATETIME:
 * 2026-05-22T11:40:00+07:00
 *
 * VERSION:
 * EGAL-24.6.7.R3.2-E1
 *
 * DESCRIPTION:
 * Focus Guardian shared service.
 *
 * Purpose:
 * - Provide reusable data-quality gate for Attention Zones.
 * - Prevent users from moving to later AZ when current field
 *   does not satisfy required validation quality.
 * - Support mobile-first touch bypass protection.
 * - Preserve anti-bot enumeration doctrine using generic error.
 *
 * Doctrine:
 * - AZ transition requires valid field data quality.
 * - Payload must be verified before submit.
 * - Error feedback = visual message + TTS + focus rollback.
 * - Do not reveal whether an account exists.
 *
 * Q1:
 * - Pure additive service.
 * - Does not change business flow by itself.
 * - Does not depend on auth API/backend.
 *
 * Q2:
 * - File includes PATH, DATETIME, VERSION, DESCRIPTION.
 * - Main functions include dated purpose comments.
 * ============================================================
 */

const DEFAULT_ERROR_MESSAGE = 'Thông tin đưa vào chưa chính xác.';

const DEFAULT_TTS_OPTIONS = {
  lang: 'vi-VN',
  rate: 0.9,
  pitch: 1,
  volume: 1,
};

const DEFAULT_FOCUS_DELAY_MS = 10;

/**
 * ============================================================
 * <2026-05-22T11:40:00+07:00>
 *
 * DESCRIPTION:
 * Native browser speech helper.
 *
 * Purpose:
 * - Provide Safari/Chrome compatible immediate speech
 *   for Focus Guardian validation errors.
 *
 * Notes:
 * - Uses Web Speech API directly by design.
 * - This mirrors the successful LoginForm Focus Guardian
 *   reference implementation.
 * - Safe no-op when speechSynthesis is unavailable.
 * ============================================================
 */
export function speakFocusGuardianMessage(
  message,
  options = {}
) {
  if (!message) return false;

  if (
    typeof window === 'undefined' ||
    !('speechSynthesis' in window) ||
    typeof window.SpeechSynthesisUtterance === 'undefined'
  ) {
    return false;
  }

  const mergedOptions = {
    ...DEFAULT_TTS_OPTIONS,
    ...options,
  };

  window.speechSynthesis.cancel();

  const utterance = new window.SpeechSynthesisUtterance(message);
  utterance.lang = mergedOptions.lang;
  utterance.rate = mergedOptions.rate;
  utterance.pitch = mergedOptions.pitch;
  utterance.volume = mergedOptions.volume;

  window.speechSynthesis.speak(utterance);

  return true;
}

/**
 * ============================================================
 * <2026-05-22T11:40:00+07:00>
 *
 * DESCRIPTION:
 * Focus rollback helper.
 *
 * Purpose:
 * - Re-focus the physical DOM input element after a short delay.
 * - Protect against mobile touch/autofill bypass behavior.
 *
 * Q1:
 * - Only acts when a valid ref is provided.
 * ============================================================
 */
export function rollbackFocusToRef(
  inputRef,
  options = {}
) {
  const delayMs =
    typeof options.delayMs === 'number'
      ? options.delayMs
      : DEFAULT_FOCUS_DELAY_MS;

  if (!inputRef?.current) return false;

  window.setTimeout(() => {
    inputRef.current?.focus?.();
  }, delayMs);

  return true;
}

/**
 * ============================================================
 * <2026-05-22T11:40:00+07:00>
 *
 * DESCRIPTION:
 * GuidedFlow rollback helper.
 *
 * Purpose:
 * - Return Attention Zone state to the guarded zone.
 * - Mark the zone as incomplete.
 *
 * Q1:
 * - Uses optional calls.
 * - Does not assume a specific guidedFlow implementation.
 * ============================================================
 */
export function rollbackGuidedZone({
  guidedFlow,
  zoneId,
}) {
  if (!guidedFlow || !zoneId) return false;

  guidedFlow.unmarkCompleted?.(zoneId);
  guidedFlow.goToField?.(zoneId);

  return true;
}

/**
 * ============================================================
 * <2026-05-22T11:40:00+07:00>
 *
 * DESCRIPTION:
 * Parse schema safely.
 *
 * Purpose:
 * - Support Zod-style schema with safeParse().
 * - Keep service generic for future schemas.
 *
 * Return:
 * {
 *   success: boolean,
 *   error?: unknown
 * }
 * ============================================================
 */
export function safeParseGuardianSchema(
  schema,
  value
) {
  if (!schema || typeof schema.safeParse !== 'function') {
    return {
      success: true,
    };
  }

  return schema.safeParse(value);
}

/**
 * ============================================================
 * <2026-05-22T11:40:00+07:00>
 *
 * DESCRIPTION:
 * Main Focus Guardian gate.
 *
 * Purpose:
 * - Validate field/zone data.
 * - If invalid:
 *   1. show generic local validation error
 *   2. speak generic error
 *   3. rollback guided zone
 *   4. rollback physical DOM focus
 *
 * Parameters:
 * - value                   : raw field value
 * - schema                  : validation schema, usually Zod
 * - zoneId                  : current guarded AZ id
 * - guidedFlow              : useGuidedFlow instance
 * - inputRef                : DOM ref of guarded input
 * - setLocalValidationError : React state setter
 * - errorMessage            : generic anti-enumeration message
 * - debugLog                : optional debug logger
 * - schemaValueBuilder      : optional value mapper for schema
 *                             WARNING:
 *                             Mapping only.
 *                             Do NOT call API/backend here.
 *                             Do NOT check account existence here.
 *                             Do NOT perform business logic here.
 * - allowEmpty              : if true, empty value does not trigger error
 *
 * Return:
 * - true  = valid/pass
 * - false = blocked
 *
 * Q1:
 * - No backend call.
 * - No auth contract change.
 * - No captcha lifecycle change.
 * ============================================================
 */
export function validateAndGuard({
  value,
  schema,
  zoneId,
  guidedFlow,
  inputRef,
  setLocalValidationError,
  errorMessage = DEFAULT_ERROR_MESSAGE,
  debugLog,
  schemaValueBuilder,
  allowEmpty = false,
  speechOptions,
  focusDelayMs = DEFAULT_FOCUS_DELAY_MS,
}) {
  const rawValue =
    typeof value === 'string'
      ? value.trim()
      : value;

  if (
    rawValue === '' ||
    rawValue === null ||
    typeof rawValue === 'undefined'
  ) {
    if (allowEmpty) {
      setLocalValidationError?.('');

      debugLog?.('focus-guardian-empty-allowed', {
        zoneId,
      });

      return true;
    }

    /**
     * ============================================================
     * <2026-05-22T12:35:00+07:00>
     * VERSION: EGAL-24.6.7.R3.2-E1.1
     *
     * PURPOSE:
     * Empty required field is also a data-quality error.
     *
     * Doctrine:
     * UI Error + TTS + AZ rollback + DOM focus rollback
     * must be synchronized.
     *
     * Q1:
     * Does not change backend/auth/captcha flow.
     * ============================================================
     */
    setLocalValidationError?.(errorMessage);

    speakFocusGuardianMessage(
      errorMessage,
      speechOptions
    );

    rollbackGuidedZone({
      guidedFlow,
      zoneId,
    });

    rollbackFocusToRef(inputRef, {
      delayMs: focusDelayMs,
    });

    debugLog?.('focus-guardian-empty-blocked', {
      zoneId,
    });

    return false;
  }

  const schemaValue =
    typeof schemaValueBuilder === 'function'
      ? schemaValueBuilder(rawValue)
      : rawValue;

  const result = safeParseGuardianSchema(
    schema,
    schemaValue
  );

  if (!result.success) {
    setLocalValidationError?.(errorMessage);

    speakFocusGuardianMessage(
      errorMessage,
      speechOptions
    );

    rollbackGuidedZone({
      guidedFlow,
      zoneId,
    });

    rollbackFocusToRef(inputRef, {
      delayMs: focusDelayMs,
    });

    debugLog?.('focus-guardian-validation-blocked', {
      zoneId,
      error: result.error,
    });

    return false;
  }

  setLocalValidationError?.('');
  guidedFlow?.markCompleted?.(zoneId);

  debugLog?.('focus-guardian-validation-passed', {
    zoneId,
  });

  return true;
}

/**
 * ============================================================
 * <2026-05-22T11:40:00+07:00>
 *
 * DESCRIPTION:
 * Clear local validation error helper.
 *
 * Purpose:
 * - Let forms clear visual validation error when user re-keys data.
 * ============================================================
 */
export function clearFocusGuardianError(
  setLocalValidationError
) {
  setLocalValidationError?.('');
}

export const FOCUS_GUARDIAN_DEFAULTS = {
  DEFAULT_ERROR_MESSAGE,
  DEFAULT_TTS_OPTIONS,
  DEFAULT_FOCUS_DELAY_MS,
};