/**
 * PATH       : src/features/a11y/tts/AudioHelpButton.jsx
 * DATETIME   : 2026-05-11T00:00:00+07:00
 * VERSION    : 1.0.0
 * DESCRIPTION:
 * - Sprint 3: Tạo component AudioHelpButton dùng chung cho Frontend Accessibility Layer.
 * - Component cho phép người dùng chủ động bấm để nghe hướng dẫn ngắn.
 * - Không tự động đọc khi render.
 * - Không thay đổi business logic, auth flow, validation hoặc UI/UX hiện có.
 * - Tuân thủ Q1/Q2.
 */

import { Volume2, Square } from 'lucide-react';
import { useTts } from './useTts';

/**
 * <2026-05-11T00:00:00+07:00>
 * AudioHelpButton:
 * - Nút đọc hướng dẫn bằng Web Speech API.
 * - Dùng lại cho LoginForm, JoinClanForm, ForgotPasswordForm, ResetPasswordForm,
 *   WaitingPage, ResultPage và các page tương lai.
 */
export default function AudioHelpButton({
  text,
  label = 'Nghe hướng dẫn',
  stopLabel = 'Dừng đọc',
  className = '',
  variant = 'soft',
  size = 'md',
}) {
  const { supported, speak, stop } = useTts();

  /**
   * <2026-05-11T00:00:00+07:00>
   * Nếu trình duyệt không hỗ trợ TTS hoặc không có text,
   * component không render để tránh ảnh hưởng UI hiện có.
   */
  if (!supported || !text) {
    return null;
  }

  const sizeClass =
    size === 'lg'
      ? 'px-5 py-4 text-base'
      : 'px-4 py-3 text-sm';

  const variantClass =
    variant === 'dark'
      ? 'bg-slate-900 text-white hover:bg-black shadow-sm'
      : 'bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => speak(text)}
        className={`inline-flex items-center justify-center gap-2 rounded-2xl font-black transition-all active:scale-[0.985] ${sizeClass} ${variantClass}`}
        aria-label={label}
        title={label}
      >
        <Volume2 size={18} />
        <span>{label}</span>
      </button>

      <button
        type="button"
        onClick={stop}
        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-500 transition-all hover:text-slate-900 active:scale-[0.985]"
        aria-label={stopLabel}
        title={stopLabel}
      >
        <Square size={14} />
      </button>
    </div>
  );
}