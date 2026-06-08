/**
 * PATH       : src/features/a11y/captcha/useCaptchaZone.js
 * DATETIME   : 2026-05-23T00:00:00+07:00
 * VERSION    : EGAL-24.6.7.R3.3.1-CAPTCHA-HOOK
 * DESCRIPTION:
 * - Shared React hook for CAPTCHA Attention Zone lifecycle.
 * - Extracts captcha token/status/timestamp/instance-key state from forms.
 * - Implements R3.3.1 doctrine:
 *   1) Missing token = non-destructive; do not reset/remount captcha.
 *   2) Expired/Error/Consumed/Backend invalid = destructive; reset/remount allowed.
 * - Uses captchaZone.service.js as lifecycle authority.
 * - No backend/business logic.
 * - Q1/Q2 safe.
 */

import { useCallback, useRef, useState } from 'react';

import {
  CAPTCHA_ZONE_STATUS,
  buildCaptchaPayloadSnapshot,
  validateCaptchaBeforeSubmit,
  shouldResetCaptcha,
  completeCaptchaZone,
  markCaptchaConsumed,
  blockCaptchaSubmit,
} from './captchaZone.service.js';

export default function useCaptchaZone({
  zoneId = 'captcha',
  nextZone = 'submit',
  maxAgeMs,
  debugName = 'CAPTCHA_ZONE',
  debug = false,
} = {}) {
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaStatus, setCaptchaStatus] = useState(
    CAPTCHA_ZONE_STATUS.UNKNOWN
  );
  const [captchaInstanceKey, setCaptchaInstanceKey] = useState(0);

  const captchaTokenRef = useRef(null);
  const captchaUpdatedAtRef = useRef(0);
  const captchaStatusRef = useRef(CAPTCHA_ZONE_STATUS.UNKNOWN);

  const log = useCallback(
    (checkpoint, payload = {}) => {
      if (!debug) return;

      console.log(`[EGAL-CAPTCHA-HOOK][${debugName}][${checkpoint}]`, {
        at: new Date().toISOString(),
        zoneId,
        nextZone,
        ...payload,
      });
    },
    [debug, debugName, zoneId, nextZone]
  );

  const setTokenInternal = useCallback(
    (token) => {
      setCaptchaToken(token);
      captchaTokenRef.current = token;
      captchaUpdatedAtRef.current = Date.now();
      setCaptchaStatus(CAPTCHA_ZONE_STATUS.VERIFIED);
      captchaStatusRef.current = CAPTCHA_ZONE_STATUS.VERIFIED;

      log('SET_TOKEN', {
        hasToken: !!token,
        tokenLength: token?.length || 0,
      });
    },
    [log]
  );

  const clearTokenInternal = useCallback(
    ({
      status = CAPTCHA_ZONE_STATUS.UNKNOWN,
      remount = false,
      reason = '',
    } = {}) => {
      setCaptchaToken(null);
      captchaTokenRef.current = null;
      captchaUpdatedAtRef.current = 0;
      setCaptchaStatus(status);
      captchaStatusRef.current = status;

      if (remount) {
        setCaptchaInstanceKey((prev) => prev + 1);
      }

      log('CLEAR_TOKEN', {
        status,
        remount,
        reason,
      });
    },
    [log]
  );

  const handleVerify = useCallback(
    (token, { guidedFlow } = {}) => {
      setTokenInternal(token);

      completeCaptchaZone({
        guidedFlow,
        zoneId,
        nextZone,
      });

      log('VERIFY', {
        hasToken: !!token,
        tokenLength: token?.length || 0,
      });

      return {
        verified: true,
        token,
        zoneId,
        nextZone,
      };
    },
    [setTokenInternal, zoneId, nextZone, log]
  );

  const handleExpire = useCallback(() => {
    clearTokenInternal({
      status: CAPTCHA_ZONE_STATUS.EXPIRED,
      remount: false,
      reason: 'expired',
    });

    log('EXPIRE');

    return {
      expired: true,
      zoneId,
      status: CAPTCHA_ZONE_STATUS.EXPIRED,
    };
  }, [clearTokenInternal, zoneId, log]);

  const handleError = useCallback(() => {
    clearTokenInternal({
      status: CAPTCHA_ZONE_STATUS.ERROR,
      remount: false,
      reason: 'error',
    });

    log('ERROR');

    return {
      error: true,
      zoneId,
      status: CAPTCHA_ZONE_STATUS.ERROR,
    };
  }, [clearTokenInternal, zoneId, log]);

  const buildSnapshot = useCallback(() => {
    const snapshot = buildCaptchaPayloadSnapshot({
      captchaToken: captchaTokenRef.current || captchaToken,
      captchaUpdatedAt: captchaUpdatedAtRef.current,
      captchaStatus: captchaStatusRef.current || captchaStatus,
    });

    log('BUILD_SNAPSHOT', {
      hasToken: snapshot.hasToken,
      status: snapshot.status,
      ageMs: snapshot.ageMs,
    });

    return snapshot;
  }, [captchaToken, captchaStatus, log]);

  const validateBeforeSubmit = useCallback(
    (options = {}) => {
      const snapshot = options.snapshot || buildSnapshot();

      const result = validateCaptchaBeforeSubmit({
        snapshot,
        maxAgeMs: options.maxAgeMs || maxAgeMs,
      });

      log('VALIDATE_BEFORE_SUBMIT', {
        valid: result.valid,
        reason: result.reason,
        blockReason: result.blockReason,
        shouldReset: result.shouldReset,
        destructiveReset: result.destructiveReset,
        message: result.message,
      });

      return result;
    },
    [buildSnapshot, maxAgeMs, log]
  );

  const reset = useCallback(
    ({ reason = '', remount = true } = {}) => {
      clearTokenInternal({
        status: CAPTCHA_ZONE_STATUS.UNKNOWN,
        remount,
        reason,
      });

      log('RESET', {
        reason,
        remount,
      });

      return {
        reset: true,
        reason,
        remount,
        zoneId,
      };
    },
    [clearTokenInternal, log, zoneId]
  );

  const resetIfNeeded = useCallback(
    (reason = '') => {
      const shouldReset = shouldResetCaptcha(reason);

      log('RESET_IF_NEEDED', {
        reason,
        shouldReset,
      });

      if (!shouldReset) {
        return {
          reset: false,
          reason,
          zoneId,
        };
      }

      return reset({
        reason,
        remount: true,
      });
    },
    [reset, log, zoneId]
  );

  const applyValidationFailure = useCallback(
    ({
      validationResult,
      guidedFlow,
      speak,
      focus,
      focusDelayMs = 2200,
    } = {}) => {
      const result = validationResult || validateBeforeSubmit();

      const blockResult = blockCaptchaSubmit({
        guidedFlow,
        zoneId,
        validationResult: result,
        speak,
        focus,
        focusDelayMs,
        message: result.message,
      });

      resetIfNeeded(result.reason);

      log('APPLY_VALIDATION_FAILURE', {
        valid: result.valid,
        reason: result.reason,
        blockReason: result.blockReason,
        reset: blockResult.shouldReset,
      });

      return {
        ...blockResult,
        validationResult: result,
      };
    },
    [validateBeforeSubmit, resetIfNeeded, zoneId, log]
  );

  const consume = useCallback(
    ({ guidedFlow } = {}) => {
      const result = markCaptchaConsumed({
        guidedFlow,
        zoneId,
      });

      clearTokenInternal({
        status: CAPTCHA_ZONE_STATUS.CONSUMED,
        remount: false,
        reason: result.reason,
      });

      log('CONSUME', result);

      return result;
    },
    [clearTokenInternal, zoneId, log]
  );

  const getToken = useCallback(() => {
    return captchaTokenRef.current || captchaToken || '';
  }, [captchaToken]);

  return {
    zoneId,
    nextZone,

    captchaToken,
    captchaStatus,
    captchaInstanceKey,

    captchaTokenRef,
    captchaUpdatedAtRef,
    captchaStatusRef,

    hasToken: !!(captchaTokenRef.current || captchaToken),

    getToken,
    buildSnapshot,
    validateBeforeSubmit,

    handleVerify,
    handleExpire,
    handleError,

    reset,
    resetIfNeeded,
    applyValidationFailure,
    consume,
  };
}