/**
 * ============================================================
 * PATH: src/features/a11y/voice/VoiceGuidanceContext.jsx
 * EGAL — VoiceGuidanceContext
 * Version : EGAL-24.6.7.R3.2
 * Purpose :
 *   Global default preference for
 *   User-Controlled Voice Guidance
 *
 * Doctrine:
 *   - Error auto speech = KEEP
 *   - AZ auto guidance speech = REMOVE
 *   - User-triggered guidance = STANDARD
 *
 * Notes:
 *   - This context only stores DEFAULT preference.
 *   - Each form/page may override locally.
 *   - Safe fallback included to avoid runtime crash.
 * ============================================================
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

/**
 * Context
 */
const VoiceGuidanceContext = createContext(null);

/**
 * Default value
 *
 * TRUE because elder users
 * are guidance-first by default.
 */
const DEFAULT_ENABLED = true;

/**
 * Provider
 */
export function VoiceGuidanceProvider({ children }) {
  const [voiceGuidanceEnabledDefault, setVoiceGuidanceEnabledDefault] =
    useState(DEFAULT_ENABLED);

  /**
   * Toggle helper
   */
  const toggleVoiceGuidanceEnabledDefault = useCallback(() => {
    setVoiceGuidanceEnabledDefault((prev) => !prev);
  }, []);

  /**
   * Stable memo value
   */
  const value = useMemo(
    () => ({
      voiceGuidanceEnabledDefault,
      setVoiceGuidanceEnabledDefault,
      toggleVoiceGuidanceEnabledDefault,
    }),
    [voiceGuidanceEnabledDefault]
  );

  return (
    <VoiceGuidanceContext.Provider value={value}>
      {children}
    </VoiceGuidanceContext.Provider>
  );
}

/**
 * Hook
 *
 * Safe fallback:
 * Prevent crash if provider missing.
 */
export function useVoiceGuidance() {
  const context = useContext(VoiceGuidanceContext);

  /**
   * Runtime-safe fallback
   */
  if (!context) {
    return {
      voiceGuidanceEnabledDefault: DEFAULT_ENABLED,

      setVoiceGuidanceEnabledDefault: () => {
        console.warn(
          "[EGAL][VoiceGuidance] Provider missing: set ignored."
        );
      },

      toggleVoiceGuidanceEnabledDefault: () => {
        console.warn(
          "[EGAL][VoiceGuidance] Provider missing: toggle ignored."
        );
      },
    };
  }

  return context;
}

export default VoiceGuidanceContext;