/**
 * PATH       : src/features/auth/components/ChangePasswordForm.jsx
 * DATETIME   : 2026-05-14T00:00:00+07:00
 * VERSION    : 24.6.7
 * DESCRIPTION:
 * - Sprint EGAL-3: Forgot Password Guided Flow.
 * - Tích hợp Elder Guided Accessibility Layer cho bước đặt mật khẩu mới.
 * - Bổ sung StepCoachBar, GuidedFieldWrapper và guided focus sequence.
 * - Bảo tồn validateForm, onChangePassword, Honeypot và API contract hiện có.
 * - Không gửi mã xác nhận trong form này.
 * - Không xác minh mã trong form này.
 * - Không thay đổi business logic, auth flow hoặc backend contract.
 * - Tuân thủ Q1/Q2.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LockKeyhole,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ShieldCheck,
} from 'lucide-react';

import AudioHelpButton from '../../a11y/tts/AudioHelpButton.jsx';
import { ttsMessages } from '../../a11y/tts/ttsMessages.js';
import { useTts } from '../../a11y/tts/useTts.js';
import ZoneVoiceButton from '../../a11y/voice/ZoneVoiceButton.jsx';
import GuidedFieldWrapper from '../../a11y/guided/GuidedFieldWrapper.jsx';
/* Không con dùng nữa --------------------------------------------------------------
import StepCoachBar from '../../a11y/guided/StepCoachBar.jsx';
import useGuidedFlow from '../../a11y/guided/useGuidedFlow.js';
import AttentionZone from '../../a11y/attention/AttentionZone.jsx';
import useProactiveVoiceGuidance from '../../a11y/guided/useProactiveVoiceGuidance.js';
------------------------------------------------------------------------------------ */
const ChangePasswordForm = ({
  runtimeSessionId = 0,
  identifier = '',
  resetToken = '',
  onChangePassword,
  onBackToVerify,
  loading = false,
}) => {
  const debugMode =
    import.meta.env.DEV || import.meta.env.VITE_DEBUG_MODE === 'true';

  const lastRuntimeSessionIdRef = useRef(null);
  // add more Refs cho input
  const newPasswordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
    hp_field: '',
  });
  // Các States:
  const [error, setError] = useState('');
  const [activeZone, setActiveZone] = useState('newPassword');
  const [completedZones, setCompletedZones] = useState(() => new Set());
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { speak, speakError } = useTts();

  const speakCriticalError = (message) => {
    if (!message) return false;

    requestAnimationFrame(() => {
      if (typeof speak === 'function') {
        speak(message, {
          rate: 0.82,
        });
        return;
      }

      speakError?.(message);
    });

    return true;
  };
//Các helpers thay thế guidedFlow
  const markCompleted = (zoneId) => {
    setCompletedZones((prev) => {
      const next = new Set(prev);
      next.add(zoneId);
      return next;
    });
  };
  const unmarkCompleted = (zoneId) => {
    setCompletedZones((prev) => {
      const next = new Set(prev);
      next.delete(zoneId);
      return next;
    });
  };
  const isCompleted = (zoneId) => completedZones.has(zoneId);
  const goToZone = (zoneId) => {
    if (!zoneId) return;
    setActiveZone(zoneId);
  };
  const showAzVoiceButton = (zoneId) => activeZone === zoneId;
// ------------------------------------------------

  // Zone helpers
  const zoneHelpText = useMemo(
    () => ({
      newPassword:
        ttsMessages?.changePassword?.newPasswordFocus ||
        'Bác nhập mật khẩu mới.',
      confirmPassword:
        ttsMessages?.changePassword?.confirmPasswordFocus ||
        'Bác nhập lại mật khẩu mới để xác nhận.',
      submit:
        ttsMessages?.changePassword?.submitFocus ||
        'Nếu mật khẩu đã đúng, bác bấm nút đổi mật khẩu.',
    }),
    []
  );
  /**
   * <2026-05-18T00:00:00+07:00>
   * VERSION: 24.6.7.R2.2.2
   * PURPOSE:
   * - Fresh runtime session cho ChangePasswordForm.
   * - Reset password fields khi:
   *   - refresh
   *   - back/forward flow
   *   - runtimeSessionId đổi
   *
   * KEEP:
   * - identifier
   * - resetToken
   */
  useEffect(() => {
    const sessionChanged =
      runtimeSessionId !== lastRuntimeSessionIdRef.current;

    if (!sessionChanged) return;

    lastRuntimeSessionIdRef.current = runtimeSessionId;

    const resetRuntime = () => {
      setFormData({
        newPassword: '',
        confirmPassword: '',
        hp_field: '',
      });

      setError('');

      setShowNewPassword(false);
      setShowConfirmPassword(false);

      setCompletedZones(new Set());
      setActiveZone('newPassword');
    };

    requestAnimationFrame(resetRuntime);

    const t1 = window.setTimeout(resetRuntime, 80);
    const t2 = window.setTimeout(resetRuntime, 250);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimeSessionId]);

  const handleChange = (e) => {
    const nextFormData = {
      ...formData,
      [e.target.name]: e.target.value,
    };

    setFormData(nextFormData);

    if (e.target.name === 'newPassword') {
      if (e.target.value && e.target.value.length >= 6) {
        markCompleted('newPassword');
      } else {
        unmarkCompleted('newPassword');
      }
    }

    if (e.target.name === 'confirmPassword') {
      if (
        e.target.value &&
        nextFormData.newPassword &&
        e.target.value === nextFormData.newPassword
      ) {
        markCompleted('confirmPassword');
      } else {
        unmarkCompleted('confirmPassword');
      }
    }

    if (error) setError('');
  };
/* blur for auto-navigation (old fashion guidedFlow style)
  const handleNewPasswordBlur = () => {
    if (formData.newPassword && formData.newPassword.length >= 6) {
      guidedFlow.goToField('confirmPassword');
    }
  };
  const handleConfirmPasswordBlur = () => {
    if (
      formData.confirmPassword &&
      formData.newPassword &&
      formData.confirmPassword === formData.newPassword
    ) {
      guidedFlow.goToField('submit');
    }
  };
---------------------------------------------------------------- */
  const validateForm = () => {
    if (formData.hp_field && formData.hp_field.trim().length > 0) {
      return {
        valid: false,
        zone: 'newPassword',
        message: 'Hành vi đáng ngờ. Vui lòng thử lại.',
        focusRef: newPasswordInputRef,
      };
    }

    if (!formData.newPassword) {
      return {
        valid: false,
        zone: 'newPassword',
        message: 'Vui lòng nhập mật khẩu mới.',
        focusRef: newPasswordInputRef,
      };
    }

    if (formData.newPassword.length < 6) {
      return {
        valid: false,
        zone: 'newPassword',
        message: 'Mật khẩu mới cần có ít nhất 6 ký tự.',
        focusRef: newPasswordInputRef,
      };
    }

    if (!formData.confirmPassword) {
      return {
        valid: false,
        zone: 'confirmPassword',
        message: 'Vui lòng nhập lại mật khẩu mới để xác nhận.',
        focusRef: confirmPasswordInputRef,
      };
    }

    if (formData.newPassword !== formData.confirmPassword) {
      return {
        valid: false,
        zone: 'confirmPassword',
        message: 'Mật khẩu xác nhận chưa khớp.',
        focusRef: confirmPasswordInputRef,
      };
    }

    return {
      valid: true,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationResult = validateForm();

    if (!validationResult.valid) {
      setError(validationResult.message);
      speakCriticalError(validationResult.message);
      goToZone(validationResult.zone);

      requestAnimationFrame(() => {
        validationResult.focusRef?.current?.focus?.();
      });

      return;
    }

    setError('');

    try {
      await onChangePassword?.({
        identifier,
        resetToken,
        newPassword: formData.newPassword,
        hp_field: formData.hp_field,
      });
    } catch (err) {
      const message =
        err?.message ||
        'Không thể đặt lại mật khẩu. Vui lòng thử lại.';

      setError(message);
      speakCriticalError(message);
      goToZone('submit');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300"
      noValidate
    >
      <div className="text-center">
        {/* 
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
          <LockKeyhole size={34} />
        </div>
        */}

        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
          ĐẶT MẬT KHẨU MỚI
        </p>

        <h2 className="mt-2 text-2xl font-black leading-tight text-slate-900 md:text-3xl">
          Tạo mật khẩu mới
        </h2>

        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-slate-500">
          Nhập mật khẩu mới và nhập lại một lần nữa để xác nhận.
        </p>

        <div className="mt-4 flex justify-center">
          <AudioHelpButton
            text={
              ttsMessages?.changePassword?.help ||
              'Bác nhập mật khẩu mới, sau đó nhập lại mật khẩu mới một lần nữa cho giống nhau.'
            }
            label="Nghe hướng dẫn"
            variant="soft"
          />
        </div>
      </div>

      <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4 text-blue-800">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0" size={20} />
          <div className="space-y-1">
            <p className="text-sm font-black">Lưu ý bảo mật</p>
            <p className="text-sm leading-relaxed">
              Mật khẩu nên dễ nhớ với bác nhưng khó đoán với người khác. Không
              nên dùng ngày sinh, số điện thoại hoặc tên riêng làm mật khẩu.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-rose-700"
          data-testid="change-password-attention-error"
        >
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <span className="text-sm font-bold leading-relaxed">{error}</span>
        </div>
      )}

      <div className="space-y-4">
        <GuidedFieldWrapper
          fieldKey="newPassword"
          activeField={activeZone}
          helperText={zoneHelpText.newPassword}
          completed={isCompleted('newPassword')}
          voiceAction={
            <ZoneVoiceButton
              visible={showAzVoiceButton('newPassword')}
              text={zoneHelpText.newPassword}
              label="Nghe"
              disabled={loading}
            />
          }
        >
          <div className="space-y-2">
            <label className="mb-2 flex items-center gap-2 px-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
              Mật khẩu mới <span className="text-rose-500">*</span>
            </label>

            <div className="relative">
              <LockKeyhole
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue-500"
                size={20}
              />

              <input
                type={showNewPassword ? 'text' : 'password'}
                name="newPassword"
                placeholder="Nhập mật khẩu mới"
                className="w-full rounded-[20px] border border-slate-200 bg-white py-4 pl-12 pr-12 text-base font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                value={formData.newPassword}             
                onChange={handleChange}
                ref={newPasswordInputRef}
                onFocus={() => goToZone('newPassword')}
                autoComplete="new-password"
              />

              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                aria-label={
                  showNewPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'
                }
                title={showNewPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
              >
                {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <p className="px-1 text-xs leading-relaxed text-slate-500">
              Mật khẩu mới cần có ít nhất 6 ký tự.
            </p>
          </div>
        </GuidedFieldWrapper>

        <GuidedFieldWrapper
          fieldKey="confirmPassword"
          activeField={activeZone}
          helperText={zoneHelpText.confirmPassword}
          completed={isCompleted('confirmPassword')}
          voiceAction={
            <ZoneVoiceButton
              visible={showAzVoiceButton('confirmPassword')}
              text={zoneHelpText.confirmPassword}
              label="Nghe"
              disabled={loading}
            />
          }
        >
          <div className="space-y-2">
            <label className="mb-2 flex items-center gap-2 px-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
              Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
            </label>

            <div className="relative">
              <CheckCircle2
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue-500"
                size={20}
              />

              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                placeholder="Nhập lại mật khẩu mới"
                className="w-full rounded-[20px] border border-slate-200 bg-white py-4 pl-12 pr-12 text-base font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                value={formData.confirmPassword}
                onChange={handleChange}
                ref={confirmPasswordInputRef}
                onFocus={() => goToZone('confirmPassword')}
                autoComplete="new-password"
              />

              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                aria-label={
                  showConfirmPassword
                    ? 'Ẩn xác nhận mật khẩu'
                    : 'Hiện xác nhận mật khẩu'
                }
                title={
                  showConfirmPassword
                    ? 'Ẩn xác nhận mật khẩu'
                    : 'Hiện xác nhận mật khẩu'
                }
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <p className="px-1 text-xs leading-relaxed text-slate-500">
              Hai mật khẩu cần giống nhau để hoàn tất đặt lại mật khẩu.
            </p>
          </div>
        </GuidedFieldWrapper>

        <input
          type="text"
          name="hp_field"
          value={formData.hp_field}
          onChange={handleChange}
          tabIndex="-1"
          autoComplete="off"
          className="hidden"
        />
      </div>

      <div className="space-y-3 pt-2">
        <GuidedFieldWrapper
          fieldKey="submit"
          activeField={activeZone}
          helperText={zoneHelpText.submit}
          completed={false}
          voiceAction={
            <ZoneVoiceButton
              visible={showAzVoiceButton('submit')}
              text={zoneHelpText.submit}
              label="Nghe"
              disabled={loading}
            />
          }
        >
          <button
            type="submit"
            disabled={loading}
            onFocus={() => goToZone('submit')}
            onClick={() => goToZone('submit')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-base font-black text-white shadow-xl shadow-blue-100 transition-all hover:bg-blue-700 active:scale-[0.985] disabled:bg-slate-300 disabled:shadow-none"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Đang cập nhật mật khẩu...
              </>
            ) : (
              <>
                Lưu mật khẩu mới
                <CheckCircle2 size={20} />
              </>
            )}
          </button>
        </GuidedFieldWrapper>

        <button
          type="button"
          onClick={onBackToVerify}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-4 text-sm font-black text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.985]"
        >
          <ChevronLeft size={18} />
          Quay lại nhập mã xác nhận
        </button>
      </div>
    </form>
  );
};

export default ChangePasswordForm;