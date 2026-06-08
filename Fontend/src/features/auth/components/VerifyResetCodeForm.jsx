/**
 * PATH       : src/features/auth/components/VerifyResetCodeForm.jsx
 * DATETIME   : 2026-05-14T00:00:00+07:00
 * VERSION    : 24.0.0
 * DESCRIPTION:
 * - Sprint EGAL-3: Forgot Password Guided Flow.
 * - Tích hợp Elder Guided Accessibility Layer cho bước xác minh mã reset password.
 * - Bổ sung StepCoachBar, GuidedFieldWrapper và guided focus sequence.
 * - Bảo tồn onVerifyCode, onResendCode, Turnstile, Honeypot và API contract hiện có.
 * - Không đổi mật khẩu trong form này.
 * - Không thay đổi business logic, auth flow hoặc backend contract.
 * - Tuân thủ Q1/Q2.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyRound,
  ArrowRight,
  Loader2,
  AlertCircle,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
//Xoá để sử dụng dịch vụ captcha zone dùng chung
// import Turnstile from 'react-turnstile';

import useCaptchaZone from '../../a11y/captcha/useCaptchaZone.js';
import CaptchaAttentionField from '../../a11y/captcha/CaptchaAttentionField.jsx';

import AudioHelpButton from '../../a11y/tts/AudioHelpButton.jsx';
import { ttsMessages } from '../../a11y/tts/ttsMessages.js';
import { useTts } from '../../a11y/tts/useTts.js';
import ZoneVoiceButton from '../../a11y/voice/ZoneVoiceButton.jsx';

import GuidedFieldWrapper from '../../a11y/guided/GuidedFieldWrapper.jsx';
//import AttentionZone from '../../a11y/attention/AttentionZone.jsx';

const VerifyResetCodeForm = ({
  runtimeSessionId = 0,
  identifier = '',
  onVerifyCode,
  onBackToForgot,
  loading = false,
}) => {
  const [formData, setFormData] = useState({
    otp: '',
    hp_field: '',
  });
  // Các States:
  const [error, setError] = useState('');
  const [lockInfo, setLockInfo] = useState({
    isLocked: false,
    secondsLeft: 0,
  });
  const [activeZone, setActiveZone] = useState('otp');
  const [completedZones, setCompletedZones] = useState(() => new Set());
  // Không dùng local captcha nữa. Dùng captcha zone chung với các form khác.
  //const [captchaToken, setCaptchaToken] = useState(null);

  const { speak, speakError } = useTts();
  const debugMode =
    import.meta.env.DEV || import.meta.env.VITE_DEBUG_MODE === 'true';
  // Không dùng local captcha nữa. Dùng captcha zone chung với các form khác.
  // const [captchaInstanceKey, setCaptchaInstanceKey] = useState(0);

  const lastRuntimeSessionIdRef = useRef(null);
  const otpInputRef = useRef(null);
  // Khởi tạo captchaZone
  const captchaZone = useCaptchaZone({
    zoneId: 'captcha',
    nextZone: 'submit',
    debugName: 'VERIFY_RESET_CODE',
    debug: debugMode,
  });

  // Các Helpers:
  const formatLockText = (seconds) => {
    if (!seconds || seconds <= 0) return '';

    const minutes = Math.floor(seconds / 60);
    const remainSeconds = seconds % 60;

    if (minutes <= 0) return `${remainSeconds} giây`;
    if (remainSeconds === 0) return `${minutes} phút`;

    return `${minutes} phút ${remainSeconds} giây`;
  };

  const extractLockSecondsFromError = (err) => {
    const directMinutes = Number(
      err?.retryAfterMinutes ||
        err?.minutesLeft ||
        err?.response?.data?.retryAfterMinutes ||
        err?.response?.data?.minutesLeft ||
        0
    );

    if (directMinutes > 0) return directMinutes * 60;

    const directSeconds = Number(
      err?.waitSeconds ||
        err?.response?.data?.waitSeconds ||
        err?.retryAfterSeconds ||
        err?.response?.data?.retryAfterSeconds ||
        0
    );

    if (directSeconds > 0) return directSeconds;

    const rawMessage =
      err?.message ||
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      '';

    const minutesMatch = rawMessage.match(/sau\s+(\d+)\s+phút/i);
    if (minutesMatch?.[1]) return Number(minutesMatch[1]) * 60;

    const secondsMatch = rawMessage.match(/sau\s+(\d+)\s+giây/i);
    if (secondsMatch?.[1]) return Number(secondsMatch[1]);

    return 0;
  };

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

  const zoneHelpText = useMemo(
    () => ({
      otp:
        ttsMessages?.verifyResetCode?.otpFocus ||
        'Bác nhập sáu số xác nhận vừa nhận được.',
      captcha:
        ttsMessages?.verifyResetCode?.captchaFocus ||
        'Bác hãy bấm vào ô vuông. Khi thấy dấu tích màu xanh là đã xác nhận xong.',
      submit:
        ttsMessages?.verifyResetCode?.submitFocus ||
        'Sau khi nhập đủ mã xác nhận, bác bấm nút xác minh.',
    }),
    []
  );
// Tạo guidedFlowBridge cho CaptchaAttentionField
  const guidedFlowBridge = useMemo(
    () => ({
      get activeField() {
        return activeZone;
      },
      goToField: goToZone,
      markCompleted,
      unmarkCompleted,
      isCompleted,
    }),
    [activeZone, completedZones]
  );

  /**
   * <2026-05-15T18:00:00+07:00>
   * EGAL-6.6.4:
   * Stable critical error speech for reset-code verification.
   *
   * Q1/Q2 safe:
   * - no auth logic change
   * - no API/payload change
   */
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
  /**
   * <2026-05-18T00:00:00+07:00>
   * VERSION: 24.6.7.R2.2.1
   * PURPOSE:
   * - Fresh runtime session cho VerifyResetCodeForm.
   * - Reset OTP, CAPTCHA, error, guided flow khi runtimeSessionId đổi.
   */
  useEffect(() => {
    const sessionChanged =
      runtimeSessionId !== lastRuntimeSessionIdRef.current;

    if (!sessionChanged) return;

    lastRuntimeSessionIdRef.current = runtimeSessionId;

    const resetRuntime = () => {
      setFormData({
        otp: '',
        hp_field: '',
      });

      setError('');
      captchaZone.reset({
        reason: 'runtime-reset',
        remount: true,
      });

      setLockInfo({
        isLocked: false,
        secondsLeft: 0,
      });

      setCompletedZones(new Set());
      setActiveZone('otp');
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

  useEffect(() => {
    if (!lockInfo.isLocked || lockInfo.secondsLeft <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setLockInfo((prev) => {
        const nextSeconds = Math.max(0, prev.secondsLeft - 1);

        return {
          isLocked: nextSeconds > 0,
          secondsLeft: nextSeconds,
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [lockInfo.isLocked, lockInfo.secondsLeft]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'otp') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
      setFormData((prev) => ({ ...prev, otp: digitsOnly }));

      if (digitsOnly.length === 6) {
        markCompleted('otp');
        setCaptchaToken(null);

        captchaZone.reset({
          reason: 'otp-changed',
          remount: true,
        });

        goToZone('captcha');
      } else {
        unmarkCompleted('otp');
        unmarkCompleted('captcha');
        captchaZone.reset({
          reason: 'otp-incomplete',
          remount: true,
        });
      }

      if (error) setError('');
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /** Không sử dụng local captcha nữa
   * <2026-05-18T00:00:00+07:00>
   * VERSION: 24.6.7.R2.2.1
   * PURPOSE:
   * - Không cho Turnstile auto verify kéo submit sớm.
   * - Chỉ move submit khi OTP đủ 6 số.
  
  const handleTurnstileVerify = (token) => {
    setCaptchaToken(token);

    if (!formData.otp || formData.otp.length !== 6) {
      return;
    }

    markCompleted('captcha');
    goToZone('submit');
  };
  ------------------------------------------------ */

  const handleSubmit = async (e) => {
    e.preventDefault();

    const captchaCheck = captchaZone.validateBeforeSubmit();

    if (!captchaCheck.valid) {
      const message =
        captchaCheck.message ||
        'Bác hãy bấm vào ô vuông để xác minh trước khi tiếp tục.';

      setError(message);
      speakCriticalError(message);

      captchaZone.applyValidationFailure({
        validationResult: captchaCheck,
        guidedFlow: guidedFlowBridge,
        speak: speakCriticalError,
        focus: () => goToZone('captcha'),
        focusDelayMs: 520,
      });

      goToZone('captcha');
      return;
    }

    if (formData.hp_field && formData.hp_field.trim().length > 0) {
      const message = 'Hành vi đáng ngờ. Vui lòng thử lại.';

      setError(message);
      speakCriticalError(message);

      return;
    }

    if (!formData.otp || formData.otp.length !== 6) {
      const message = 'Vui lòng nhập mã xác nhận gồm 6 số.';

      setError(message);
      speakCriticalError(message);

      goToZone('otp');
      otpInputRef.current?.focus?.();
      return;
    }

    setError('');

    try {
      await onVerifyCode?.({
        identifier,
        otp: formData.otp,
        turnstileToken: captchaCheck.token || captchaZone.getToken(),
        hp_field: formData.hp_field,
      });

      captchaZone.consume({
        guidedFlow: guidedFlowBridge,
      });
    } catch (err) {
      const lockSeconds = extractLockSecondsFromError(err);

      if (lockSeconds > 0) {
        setLockInfo({
          isLocked: true,
          secondsLeft: lockSeconds,
        });

        setError('');
        goToZone('submit');
        return;
      }

      const message =
        err?.message ||
        'Mã xác nhận không đúng. Vui lòng kiểm tra lại.';

      setError(message);
      speakCriticalError(message);
      goToZone('otp');

      requestAnimationFrame(() => {
        otpInputRef.current?.focus?.();
      });
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
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
          <KeyRound size={34} />
        </div>
        */}

        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">
          XÁC MINH TÀI KHOẢN
        </p>

        <h2 className="mt-2 text-2xl font-black leading-tight text-slate-900 md:text-3xl">
          Nhập mã xác nhận
        </h2>

        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-slate-500">
          Nhập mã 6 số mà hệ thống đã gửi qua kênh liên lạc đã đăng ký.
        </p>

        <div className="mt-4 flex justify-center">
          <AudioHelpButton
            text={
              ttsMessages?.verifyResetCode?.help ||
              'Bác nhập mã xác nhận gồm 6 số mà hệ thống đã gửi. Sau đó bấm nút Xác minh mã.'
            }
            label="Nghe hướng dẫn"
            variant="soft"
          />
        </div>
      </div>

      <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-800">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0" size={20} />
          <div className="space-y-1">
            <p className="text-sm font-black">Mã xác nhận</p>
            <p className="text-sm leading-relaxed">
              Vì lý do bảo mật, bác không nên chia sẻ mã này cho người khác.
              Nếu chưa nhận được mã, bác có thể yêu cầu gửi lại.
            </p>
          </div>
        </div>
      </div>
      {/* Render lock message ưu tiên hơn error} */}
      {lockInfo.isLocked && lockInfo.secondsLeft > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 rounded-2xl border border-orange-100 bg-orange-50 p-4 text-orange-700"
          data-testid="verify-reset-code-attention-lock"
        >
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <span className="text-sm font-bold leading-relaxed">
            Bác vui lòng chờ {formatLockText(lockInfo.secondsLeft)} trước khi thử lại.
          </span>
        </div>
      )}
      {/* Render error} */}
      {!lockInfo.isLocked && error && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-rose-700"
          data-testid="verify-reset-code-attention-error"
        >
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <span className="text-sm font-bold leading-relaxed">{error}</span>
        </div>
      )}

      <div className="space-y-4">
        <GuidedFieldWrapper
          fieldKey="otp"
          activeField={activeZone}
          helperText={zoneHelpText.otp}
          completed={isCompleted('otp')}
          voiceAction={
            <ZoneVoiceButton
              visible={showAzVoiceButton('otp')}
              text={zoneHelpText.otp}
              label="Nghe"
              disabled={loading || lockInfo.isLocked}
            />
          }
        >
          <div className="space-y-2">
            <label className="mb-2 flex items-center gap-2 px-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
              Mã xác nhận <span className="text-rose-500">*</span>
            </label>

            <div className="relative">
              <KeyRound
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500"
                size={20}
              />

              <input
                type="text"
                inputMode="numeric"
                name="otp"
                maxLength="6"
                placeholder="••••••"
                className="w-full rounded-[20px] border border-slate-200 bg-white py-4 pl-12 pr-4 text-center text-2xl font-black tracking-[0.35em] text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={formData.otp}
                onChange={handleChange}
                ref={otpInputRef}
                onFocus={() => goToZone('otp')}
                autoComplete="one-time-code"
              />
            </div>

            <p className="px-1 text-xs leading-relaxed text-slate-500">
              Bác nhập đúng 6 số trong tin nhắn hoặc email đã nhận.
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

        <CaptchaAttentionField
          captchaZone={captchaZone}
          guidedFlow={guidedFlowBridge}
          fieldKey="captcha"
          nextZone="submit"
          disabled={loading || lockInfo.isLocked}
          loading={loading}
          elderAssistMode
          helperText={zoneHelpText.captcha}
          voiceText={zoneHelpText.captcha}
          voiceLabel="Nghe"
          onVerified={() => {
            markCompleted('captcha');
            goToZone('submit');
          }}
          onExpired={() => {
            unmarkCompleted('captcha');
          }}
          onError={() => {
            unmarkCompleted('captcha');
          }}
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
            disabled={loading || lockInfo.isLocked}
            // onFocus={() => guidedFlow.goToField('submit')}
            onFocus={() => goToZone('submit')}
            onClick={() => goToZone('submit')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-base font-black text-white shadow-xl shadow-emerald-100 transition-all hover:bg-emerald-700 active:scale-[0.985] disabled:bg-slate-300 disabled:shadow-none"
          >
            {lockInfo.isLocked ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Chờ {formatLockText(lockInfo.secondsLeft)}
              </>
            ) : loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Đang xác minh...
              </>
            ) : (
              <>
                Xác minh mã
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </GuidedFieldWrapper>

        <button
          type="button"
          onClick={onBackToForgot}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 py-4 text-sm font-black text-emerald-700 transition-all hover:bg-emerald-100 active:scale-[0.985]"
        >
          <RotateCcw size={18} />
          Gửi lại mã xác nhận
        </button>
      </div>
    </form>
  );
};

export default VerifyResetCodeForm;