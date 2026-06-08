/**
 * ============================================================
 * PATH:
 * src/features/a11y/focusGuardian/useFocusGuardian.js
 *
 * DATETIME:
 * 2026-05-22T12:05:00+07:00
 *
 * VERSION:
 * EGAL-24.6.7.R3.2-E2
 *
 * DESCRIPTION:
 * Reusable hook for Focus Guardian.
 *
 * Purpose:
 * - Centralize reusable Focus Guardian behavior.
 * - Avoid repeated validation/focus/TTS logic
 *   across auth forms and pages.
 * - Standardize Attention Zone quality gate.
 *
 * Doctrine:
 * - Payload must verify before submit.
 * - AZ transition only when data quality passes.
 * - Anti-enumeration message remains generic.
 * - UI + TTS + DOM focus rollback are synchronized.
 *
 * Q1:
 * - Pure additive hook.
 * - No auth flow modification.
 * - No backend dependency.
 *
 * Q2:
 * - Preserve existing form behavior.
 * - Forms decide where to apply guardian.
 * ============================================================
 */

import { useCallback, useState } from 'react';

import {
  validateAndGuard,
  clearFocusGuardianError,
  FOCUS_GUARDIAN_DEFAULTS,
} from './focusGuardian.service.js';

const DEFAULT_ERROR_MESSAGE =
  FOCUS_GUARDIAN_DEFAULTS.DEFAULT_ERROR_MESSAGE;

/**
 * ============================================================
 * <2026-05-22T12:05:00+07:00>
 *
 * DESCRIPTION:
 * Main Focus Guardian hook.
 *
 * Return:
 * {
 *   localValidationError,
 *   setLocalValidationError,
 *   clearValidationError,
 *   validateZone
 * }
 *
 * Example:
 *
 * const {
 *   localValidationError,
 *   clearValidationError,
 *   validateZone,
 * } = useFocusGuardian();
 *
 * ============================================================
 */
export default function useFocusGuardian(
  options = {}
) {
  const {
    defaultErrorMessage = DEFAULT_ERROR_MESSAGE,
    debugMode = false,
    debugLog,
  } = options;

  /**
   * ============================================================
   * Local visual validation state.
   *
   * Purpose:
   * - Feed AttentionZone error display.
   * - Clear automatically on re-key-in.
   * ============================================================
   */
  const [
    localValidationError,
    setLocalValidationError,
  ] = useState('');

  /**
   * ============================================================
   * <2026-05-22T12:05:00+07:00>
   *
   * DESCRIPTION:
   * Clear local validation error.
   *
   * Purpose:
   * - Remove visual warning immediately
   *   when user starts correcting input.
   * ============================================================
   */
  const clearValidationError =
    useCallback(() => {
      clearFocusGuardianError(
        setLocalValidationError
      );
    }, []);

  /**
   * ============================================================
   * <2026-05-22T12:05:00+07:00>
   *
   * DESCRIPTION:
   * Validate and guard a zone.
   *
   * Required config:
   * - value
   * - schema
   * - zoneId
   * - guidedFlow
   * - inputRef
   *
   * Optional config:
   * - errorMessage
   * - schemaValueBuilder
   * - allowEmpty
   * - speechOptions
   * - focusDelayMs
   *
   * Return:
   * - true  => pass
   * - false => blocked
   *
   * Example:
   *
   * validateZone({
   *   value: formData.identifier,
   *   schema: identifierSchema,
   *   zoneId: 'identifier',
   *   guidedFlow,
   *   inputRef: identifierInputRef,
   * });
   * ============================================================
   */
  const validateZone = useCallback(
    ({
      value,
      schema,
      zoneId,
      guidedFlow,
      inputRef,
      errorMessage = defaultErrorMessage,
      schemaValueBuilder,
      allowEmpty = false,
      speechOptions,
      focusDelayMs,
    }) => {
      if (debugMode) {
        debugLog?.(
          'focus-guardian-validate-zone',
          {
            zoneId,
            value,
          }
        );
      }

      return validateAndGuard({
        value,
        schema,
        zoneId,
        guidedFlow,
        inputRef,
        setLocalValidationError,
        errorMessage,
        schemaValueBuilder,
        allowEmpty,
        speechOptions,
        focusDelayMs,
        debugLog,
      });
    },
    [
      defaultErrorMessage,
      debugMode,
      debugLog,
    ]
  );

  /**
   * ============================================================
   * Return public API.
   * ============================================================
   */
  return {
    localValidationError,
    setLocalValidationError,
    clearValidationError,
    validateZone,
  };
}