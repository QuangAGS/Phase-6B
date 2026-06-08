/**
 * ============================================================
 * PATH:
 * src/features/a11y/voice/useLocalVoiceGuidance.js
 *
 * DATETIME:
 * 2026-05-21 21:15 ICT
 *
 * VERSION:
 * EGAL-24.6.7.R3.2
 *
 * DESCRIPTION:
 * Local Voice Guidance State
 *
 * Purpose:
 * - Manage form/page-level override
 * - Inherit default setting from
 *   VoiceGuidanceContext
 * - Allow local enable/disable
 * - Preserve Q1/Q2 non-breaking doctrine
 *
 * Doctrine:
 * - Global = default preference
 * - Local = form/page override
 * - Error auto speech = KEEP
 * - AZ auto speech = REMOVE
 * - User-triggered voice = STANDARD
 *
 * Notes:
 * - This hook DOES NOT affect
 *   proactive speech yet.
 * - Safe for R3.1B coexistence.
 * - No business flow change.
 * ============================================================
 */

import { useCallback, useState } from "react";
import { useVoiceGuidance } from "./VoiceGuidanceContext";

/**
 * ============================================================
 * useLocalVoiceGuidance()
 *
 * DATETIME:
 * 2026-05-21 21:15 ICT
 *
 * DESCRIPTION:
 * Local override for voice guidance.
 *
 * Behavior:
 * - If initialValue exists:
 *     use initialValue
 *
 * - Otherwise:
 *     inherit from global context
 *
 * Return:
 * {
 *   localVoiceGuidanceEnabled,
 *   setLocalVoiceGuidanceEnabled,
 *   toggleLocalVoiceGuidance
 * }
 *
 * Notes:
 * - Local state is isolated.
 * - Does not mutate global default.
 * - Compile-safe fallback.
 * ============================================================
 */
export function useLocalVoiceGuidance(initialValue = null) {
  /**
   * ============================================================
   * <2026-05-21 21:15 ICT>
   * Read default preference from context
   * ============================================================
   */
  const { voiceGuidanceEnabledDefault } =
    useVoiceGuidance();

  /**
   * ============================================================
   * <2026-05-21 21:15 ICT>
   * Determine initial local value
   *
   * Priority:
   * 1. explicit initialValue
   * 2. global default preference
   * ============================================================
   */
  const resolvedInitialValue =
    typeof initialValue === "boolean"
      ? initialValue
      : voiceGuidanceEnabledDefault;

  /**
   * ============================================================
   * <2026-05-21 21:15 ICT>
   * Local state
   * ============================================================
   */
  const [
    localVoiceGuidanceEnabled,
    setLocalVoiceGuidanceEnabled,
  ] = useState(resolvedInitialValue);

  /**
   * ============================================================
   * <2026-05-21 21:15 ICT>
   * Toggle helper
   *
   * Purpose:
   * Allow form/page quick switch
   * without mutating global preference
   * ============================================================
   */
  const toggleLocalVoiceGuidance =
    useCallback(() => {
      setLocalVoiceGuidanceEnabled(
        (prev) => !prev
      );
    }, []);

  /**
   * ============================================================
   * <2026-05-21 21:15 ICT>
   * Return API
   * ============================================================
   */
  return {
    localVoiceGuidanceEnabled,
    setLocalVoiceGuidanceEnabled,
    toggleLocalVoiceGuidance,
  };
}

export default useLocalVoiceGuidance;