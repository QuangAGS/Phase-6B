/**
 * PATH       : src/features/a11y/elder/ElderAssistButton.jsx
 * DATETIME   : 2026-05-14T00:00:00+07:00
 * VERSION    : 24.0.0
 * DESCRIPTION:
 * - Sprint EGAL-6.2: Single Elder Assistance Mode.
 * - Nút hỗ trợ duy nhất cho người lớn tuổi.
 * - Khi bật: elderMode + guidedMode + autoSpeakErrors cùng bật.
 * - Khi tắt: các chế độ hỗ trợ EGAL cùng tắt.
 * - Không thay đổi business logic, auth flow, validation hoặc API contract.
 * - Tuân thủ Q1/Q2.
 */

import { Accessibility, Volume2, CheckCircle2 } from 'lucide-react';

import { useTts } from '../tts/useTts.js';

const ElderAssistButton = ({
  className = '',
  size = 'md',
  fullWidth = true,
  variant = 'soft',
  showStatus = true,
}) => {
  const {
    supported,
    elderAssistMode,
    enableFullElderAssist,
    disableFullElderAssist,
    speak,
  } = useTts();

  /**
   * <2026-05-14T00:00:00+07:00>
   * EGAL-6.2:
   * Toggle một chế độ hỗ trợ duy nhất.
   * Không để người lớn tuổi phải hiểu nhiều setting kỹ thuật.
   */
  const handleToggle = () => {
    if (elderAssistMode) {
      disableFullElderAssist();

      if (supported) {
        speak('Đã tắt hỗ trợ thao tác bằng âm thanh.');
      }

      return;
    }

    enableFullElderAssist();

    if (supported) {
      speak(
        'Đã bật hỗ trợ thao tác bằng âm thanh. Hệ thống sẽ hướng dẫn từng bước và đọc các thông báo quan trọng.'
      );
    }
  };

  const sizeClass =
    size === 'lg'
      ? 'px-5 py-4 text-base'
      : 'px-4 py-3 text-sm';

  const widthClass = fullWidth ? 'w-full' : 'w-auto';

  const activeClass =
    'bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-700';

  const inactiveClass =
    variant === 'plain'
      ? 'border border-blue-100 bg-white text-blue-700 hover:bg-blue-50'
      : 'border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100';

  return (
    <div className={[fullWidth ? 'w-full' : 'inline-flex', className].join(' ')}>
      <button
        type="button"
        onClick={handleToggle}
        className={[
          widthClass,
          'inline-flex items-center justify-center gap-2 rounded-2xl font-black transition-all active:scale-[0.985]',
          sizeClass,
          elderAssistMode ? activeClass : inactiveClass,
        ].join(' ')}
        aria-pressed={elderAssistMode}
        aria-label={
          elderAssistMode
            ? 'Tắt hỗ trợ thao tác bằng âm thanh'
            : 'Bật hỗ trợ thao tác bằng âm thanh'
        }
        title={
          elderAssistMode
            ? 'Đang bật hỗ trợ thao tác bằng âm thanh'
            : 'Nếu bác cần hỗ trợ thao tác bằng âm thanh, hãy bấm vào đây'
        }
      >
        {elderAssistMode ? <CheckCircle2 size={18} /> : <Accessibility size={18} />}

        <span>
          {elderAssistMode
            ? 'Đang hỗ trợ thao tác'
            : 'Cần hỗ trợ bằng âm thanh'}
        </span>

        <Volume2 size={17} />
      </button>

      {showStatus && (
        <p className="mt-2 text-center text-xs font-bold leading-relaxed text-slate-500">
          {elderAssistMode
            ? 'Hệ thống đang hướng dẫn từng bước và đọc thông báo quan trọng.'
            : 'Nếu bác cần hỗ trợ, hãy bấm nút trên.'}
        </p>
      )}
    </div>
  );
};

export default ElderAssistButton;