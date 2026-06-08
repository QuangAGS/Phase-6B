/**
 * ============================================================
 * PATH:
 * src/features/a11y/voice/ZoneVoiceButton.jsx
 *
 * DATETIME:
 * 2026-05-21 21:20 ICT
 *
 * VERSION:
 * EGAL-24.6.7.R3.2
 *
 * DESCRIPTION:
 * User-Controlled AZ Voice Button
 *
 * Purpose:
 * - Render optional "🔊 Nghe" button for active Attention Zone
 * - Speak helperText only when user explicitly clicks
 * - Remove dependency on automatic AZ guidance speech
 *
 * Doctrine:
 * - Error auto speech = KEEP
 * - AZ auto speech = REMOVE
 * - User-triggered AZ guidance = STANDARD
 *
 * Q1:
 * - This component is additive only.
 * - It does not change existing form behavior.
 *
 * Q2:
 * - File header and function blocks include metadata.
 * ============================================================
 */

import React, { useCallback } from "react";
import { useTts } from "../tts/useTts";

/**
 * ============================================================
 * ZoneVoiceButton()
 *
 * DATETIME:
 * 2026-05-21 21:20 ICT
 *
 * DESCRIPTION:
 * Render a user-triggered voice guidance button
 * for the currently active AZ.
 *
 * Props:
 * - visible   : controls rendering
 * - text      : helper text to speak
 * - label     : button label, default "Nghe"
 * - disabled  : disables user action
 * - className : optional styling hook
 *
 * Notes:
 * - Does not speak automatically.
 * - Does not own AZ state.
 * - Does not own validation state.
 * - Does not own captcha lifecycle.
 * ============================================================
 */
export default function ZoneVoiceButton({
  visible = false,
  text = "",
  label = "Nghe",
  disabled = false,
  className = "",
}) {
  /**
   * ============================================================
   * <2026-05-21 21:20 ICT>
   * Access existing TTS runtime
   *
   * Q1:
   * - Reuse existing useTts contract.
   * - Do not rename or modify TTS provider.
   * ============================================================
   */
  const { speak, stop } = useTts();

  /**
   * ============================================================
   * <2026-05-21 21:20 ICT>
   * Click handler
   *
   * Purpose:
   * - Only speak after explicit user action
   * - Stop previous speech if available
   * - Use safe optional calls to avoid runtime breakage
   * ============================================================
   */
  const handleClick = useCallback(() => {
    if (disabled || !text) return;

    stop?.();

    speak?.(text, {
      source: "az-user-controlled-guidance",
      interrupt: true,
    });
  }, [disabled, text, speak, stop]);

  /**
   * ============================================================
   * <2026-05-21 21:20 ICT>
   * Render guard
   *
   * Purpose:
   * - Do not render button outside active AZ context
   * ============================================================
   */
  if (!visible) return null;

  /**
   * ============================================================
   * <2026-05-21 21:50 ICT>
   * Elder-friendly voice trigger UI
   *
   * Purpose:
   * - High visibility
   * - Touch friendly
   * - Compact
   * - Non-intrusive
   * - Consistent across forms
   *
   * Q1:
   * UI additive only
   * ============================================================
   */
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || !text}
      aria-label={label}
      title={label}
      className={[
        'egal-zone-voice-button',
        'inline-flex items-center gap-1.5',
        'rounded-full border',
        'border-blue-200 bg-blue-50',
        'px-3 py-1.5',
        'text-sm font-medium text-blue-700',
        'transition-all duration-200',
        'hover:bg-blue-100',
        'active:scale-[0.98]',
        'focus:outline-none',
        'focus:ring-2 focus:ring-blue-300',
        'disabled:cursor-not-allowed',
        'disabled:opacity-50',
        'shrink-0',
        className,
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className="text-base leading-none"
      >
        🔊
      </span>

      <span className="whitespace-nowrap">
        {label}
      </span>
    </button>
  );
}