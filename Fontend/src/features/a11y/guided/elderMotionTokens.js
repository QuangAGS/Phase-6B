/**
 * PATH       : src/features/a11y/guided/elderMotionTokens.js
 * DATETIME   : 2026-05-14T00:00:00+07:00
 * VERSION    : 24.0.0
 * DESCRIPTION:
 * - Sprint EGAL-1: Foundation Accessibility Layer.
 * - Motion/class tokens dùng chung cho Elder Guided Mode.
 * - Ưu tiên chuyển động mềm, chậm, ít gây khó chịu cho người lớn tuổi.
 * - Không chứa business logic, auth flow, validation hoặc API contract.
 * - Tuân thủ Q1/Q2.
 */

export const guidedFieldBaseClass =
  'relative rounded-3xl border border-transparent p-2 transition-all duration-500 ease-out';

export const guidedFieldActiveClass =
  'border-blue-200 bg-blue-50/40 shadow-[0_0_0_4px_rgba(59,130,246,0.10),0_12px_30px_rgba(15,23,42,0.08)]';

export const guidedHelperClass =
  'mt-2 flex items-start gap-2 rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-semibold leading-relaxed text-slate-700 shadow-sm';

export const elderButtonFocusClass =
  'focus:outline-none focus:ring-4 focus:ring-blue-200 focus:ring-offset-2';

export const elderSoftTransitionClass =
  'transition-all duration-500 ease-out';

export const elderReadableTextClass =
  'text-[15px] leading-relaxed text-slate-600';

export const elderStrongTextClass =
  'text-base font-black leading-snug text-slate-900';

export const elderDisabledClass =
  'cursor-not-allowed opacity-60';

export const elderLowMotionPulseClass =
  'motion-safe:animate-[egalSoftPulse_2.8s_ease-in-out_infinite]';

/**
 * Gợi ý thêm vào global CSS nếu muốn custom animation:
 *
 * @keyframes egalSoftPulse {
 *   0%, 100% {
 *     box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.08);
 *   }
 *   50% {
 *     box-shadow: 0 0 0 7px rgba(59, 130, 246, 0.14);
 *   }
 * }
 */
export const egalGlobalCssHint = `
@keyframes egalSoftPulse {
  0%, 100% {
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.08);
  }
  50% {
    box-shadow: 0 0 0 7px rgba(59, 130, 246, 0.14);
  }
}
`;

export default {
  guidedFieldBaseClass,
  guidedFieldActiveClass,
  guidedHelperClass,
  elderButtonFocusClass,
  elderSoftTransitionClass,
  elderReadableTextClass,
  elderStrongTextClass,
  elderDisabledClass,
  elderLowMotionPulseClass,
  egalGlobalCssHint,
};