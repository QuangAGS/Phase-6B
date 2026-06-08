/**
 * PATH       : src/features/a11y/guided/GuidedFieldWrapper.jsx
 * DATETIME   : 2026-05-14T00:00:00+07:00
 * VERSION    : 24.0.0
 * DESCRIPTION:
 * - Sprint EGAL-1: Foundation Accessibility Layer.
 * - Wrapper dùng chung để hướng sự chú ý của người dùng tới field hiện tại.
 * - Hỗ trợ soft glow, helper text, aria-live và auto scroll nhẹ.
 * - Không thay đổi business logic, auth flow, validation hoặc API contract.
 * - Tuân thủ Q1/Q2.
 */

import { useEffect, useRef } from 'react';
import { HelpCircle } from 'lucide-react';

import {
  guidedFieldBaseClass,
  guidedFieldActiveClass,
  guidedHelperClass,
} from './elderMotionTokens.js';

/**
 * ============================================================
 * <2026-05-21 21:35 ICT>
 * EGAL-24.6.7.R3.2
 *
 * Add optional voiceAction slot
 *
 * Purpose:
 * - Allow user-triggered AZ guidance
 * - Preserve helperText architecture
 * - Preserve backward compatibility
 *
 * Q1:
 * - Additive only
 * - No breaking prop changes
 * ============================================================
 */
const GuidedFieldWrapper = ({
  children,
  fieldKey,
  activeField,
  helperText = '',
  completed = false,
  disabled = false,
  autoScroll = true,
  className = '',
  helperClassName = '',

  /**
   * ============================================================
   * <2026-05-21 21:35 ICT>
   * Optional R3.2 voice action slot
   *
   * Example:
   * <ZoneVoiceButton />
   *
   * Safe fallback:
   * undefined = no rendering
   * ============================================================
   */
  voiceAction = null,
}) => {
  const wrapperRef = useRef(null);

  const isActive = !!fieldKey && fieldKey === activeField && !disabled;

  useEffect(() => {
    if (!isActive || !autoScroll || !wrapperRef.current) return;

    const timer = window.setTimeout(() => {
      wrapperRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [isActive, autoScroll]);

  return (
    <div
      ref={wrapperRef}
      className={[
        guidedFieldBaseClass,
        isActive ? guidedFieldActiveClass : '',
        completed ? 'border-emerald-100 bg-emerald-50/30' : '',
        disabled ? 'opacity-70' : '',
        className,
      ].join(' ')}
      data-guided-field={fieldKey || undefined}
      data-guided-active={isActive ? 'true' : 'false'}
    >
      {children}

      {isActive && helperText && (
        <div
          className={[guidedHelperClass, helperClassName].join(' ')}
          aria-live="polite"
        >
          <HelpCircle
            size={16}
            className="mt-0.5 shrink-0 text-blue-600"
          />

          <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
            <span className="flex-1">
              {helperText}
            </span>

            {voiceAction && (
              <div className="shrink-0">
                {voiceAction}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GuidedFieldWrapper;