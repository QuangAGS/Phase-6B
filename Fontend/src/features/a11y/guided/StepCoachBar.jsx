/**
 * PATH       : src/features/a11y/guided/StepCoachBar.jsx
 * DATETIME   : 2026-05-14T00:00:00+07:00
 * VERSION    : 24.0.0
 * DESCRIPTION:
 * - Sprint EGAL-1: Foundation Accessibility Layer.
 * - Thanh hướng dẫn bước hiện tại dành cho Elder Guided Mode.
 * - Hiển thị số bước, tiêu đề bước, mô tả ngắn và tiến độ.
 * - Không thay đổi business logic, auth flow, validation hoặc API contract.
 * - Tuân thủ Q1/Q2.
 */

import { CheckCircle2, ChevronRight } from 'lucide-react';

const StepCoachBar = ({
  currentStep = 1,
  totalSteps = 1,
  title = '',
  description = '',
  nextLabel = '',
  completedSteps = [],
  className = '',
}) => {
  const safeCurrentStep = Math.max(1, Number(currentStep) || 1);
  const safeTotalSteps = Math.max(1, Number(totalSteps) || 1);
  const progressPercent = Math.min(
    100,
    Math.max(0, (safeCurrentStep / safeTotalSteps) * 100)
  );

  return (
    <div
      className={[
        'rounded-3xl border border-blue-100 bg-blue-50/80 p-4 shadow-sm',
        className,
      ].join(' ')}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm">
          <span className="text-sm font-black">
            {safeCurrentStep}/{safeTotalSteps}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-600">
            Bước {safeCurrentStep} trong {safeTotalSteps}
          </p>

          {title && (
            <h3 className="mt-1 text-base font-black leading-snug text-slate-900">
              {title}
            </h3>
          )}

          {description && (
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {description}
            </p>
          )}

          {nextLabel && (
            <div className="mt-3 flex items-center gap-1 text-sm font-bold text-blue-700">
              <ChevronRight size={16} />
              <span>{nextLabel}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-700 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {completedSteps.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {completedSteps.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-emerald-700"
            >
              <CheckCircle2 size={13} />
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default StepCoachBar;