/**
 * PATH       : src/features/auth/components/ForgotPasswordForm.jsx
 * DATETIME   : 2026-05-26T00:00:00+07:00
 * VERSION    : EGAL-24.6.7.R3.3.2.2-GOLDEN-CLEAN-LOGIN-PATTERN
 * DESCRIPTION:
 * - Clean ForgotPasswordForm theo LoginForm R3.3.2 pattern.
 * - KEEP GuidedFieldWrapper only as UI/AZ shell.
 * - REMOVE StepCoachBar / useGuidedFlow / forced sequential doctrine.
 * - User may freely touch/focus any Attention Zone.
 * - AudioHelpButton always visible.
 * - ZoneVoiceButton handled through GuidedFieldWrapper voiceAction.
 * - Error speech is mandatory.
 * - Validation only happens on submit.
 * - CAPTCHA is handled by reusable CAPTCHA package:
 *   useCaptchaZone + CaptchaAttentionField + captchaZone.service.js.
 * - Captcha doctrine:
 *   Missing token = non-destructive.
 *   Expired/Error/Consumed/Backend invalid = destructive reset allowed.
 * - Preserves backend payload contract:
 *   {
 *     identifier,
 *     turnstileToken,
 *     hp_field
 *   }
 * - Q1/Q2 safe.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Mail,
  Phone,
  ArrowRight,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { z } from 'zod';

import { useAuth } from '../../../context/AuthContext';
import { emailRule, phoneRule } from '../../../utils/validationRules.js';

import AudioHelpButton from '../../a11y/tts/AudioHelpButton.jsx';
import { ttsMessages } from '../../a11y/tts/ttsMessages.js';
import { useTts } from '../../a11y/tts/useTts.js';

import AttentionZone from '../../a11y/attention/AttentionZone.jsx';
import GuidedFieldWrapper from '../../a11y/guided/GuidedFieldWrapper.jsx';
import ZoneVoiceButton from '../../a11y/voice/ZoneVoiceButton.jsx';

import useCaptchaZone from '../../a11y/captcha/useCaptchaZone.js';
import CaptchaAttentionField from '../../a11y/captcha/CaptchaAttentionField.jsx';
import { CAPTCHA_RESET_REASONS } from '../../a11y/captcha/captchaZone.service.js';

const forgotPasswordIdentifierSchema = z.union([emailRule, phoneRule], {
  errorMap: () => ({
    message: 'Thông tin đưa vào chưa chính xác.',
  }),
});

const GENERIC_PAYLOAD_ERROR = 'Thông tin chưa chính xác.';
  /**
   * TEMPORARY SECURITY SANITIZER
   * ------------------------------------------------------------
   * PURPOSE
   * - Neutralize backend enumeration messages for ForgotPasswordForm.
   * - Prevent anti-bot / account enumeration leaks.
   *
   * WHY LOCAL?
   * - ForgotPasswordForm currently handles backend errors locally
   *   because it calls forgotPassword(payload) directly and catches errors here.
   * - It does NOT yet use AuthPage as backend-message synchronizer.
   *
   * FUTURE REMOVAL PLAN
   * - REMOVE this sanitizer after ForgotPasswordForm is migrated
   *   to centralized AuthPage backend-message orchestration.
   *
   * TARGET ARCHITECTURE
   * - AuthPage becomes single source of truth for:
   *   backend status -> normalized UI message
   *   backend code -> zone routing
   *   anti-bot message neutralization
   *
   * TECHNICAL DEBT TAG
   * - EGAL-R3.3-TD-AUTHPAGE-SYNC
   */
  function sanitizeForgotPasswordBackendMessage(
    message = '',
    status = 0,
    code = ''
  ) {
    const raw = String(message || '').trim();
    const lower = raw.toLowerCase();

    const shouldNeutralize =
      status === 404 ||
      [
        'IDENTIFIER_NOT_FOUND',
        'INVALID_IDENTIFIER',
        'USER_NOT_FOUND',
      ].includes(code) ||
      lower.includes('chưa được đăng ký') ||
      lower.includes('không tồn tại') ||
      lower.includes('not found') ||
      lower.includes('not registered');

    if (shouldNeutralize) {
      return GENERIC_PAYLOAD_ERROR;
    }

    return raw || GENERIC_PAYLOAD_ERROR;
  }

const ForgotPasswordForm = ({
  runtimeSessionId = 0,
  onBackToLogin,
  onSuccess,
}) => {
  const debugMode =
    import.meta.env.DEV || import.meta.env.VITE_DEBUG_MODE === 'true';

  const debugLog = (checkpoint, payload = {}) => {
    if (!debugMode) return;

    console.log(`[EGAL-FORGOT-R3.3.2.2][${checkpoint}]`, {
      at: new Date().toISOString(),
      runtimeSessionId,
      ...payload,
    });
  };

  const { forgotPassword } = useAuth();
  const { speak, speakError } = useTts();

  const speakMandatoryError = (text, options = {}) => {
    if (!text) return false;

    if (typeof speak === 'function') {
      return speak(text, {
        rate: 0.82,
        ...options,
      });
    }

    return speakError?.(text);
  };

  const [formData, setFormData] = useState({
    emailOrPhone: '',
    hp_field: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [activeZone, setActiveZone] = useState('identifier');
  const [completedZones, setCompletedZones] = useState(() => new Set());

  const [lockInfo, setLockInfo] = useState({
    isLocked: false,
    secondsLeft: 0,
  });

  const identifierInputRef = useRef(null);
  const lastRuntimeSessionIdRef = useRef(null);
  const speechStartTimerRef = useRef(null);
  const zoneMoveTimerRef = useRef(null);

  const captchaZone = useCaptchaZone({
    zoneId: 'captcha',
    nextZone: 'submit',
    debugName: 'FORGOT_PASSWORD',
    debug: debugMode,
  });

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

  const identifierType = useMemo(() => {
    if (!formData.emailOrPhone) return 'unknown';
    return formData.emailOrPhone.includes('@') ? 'email' : 'phone';
  }, [formData.emailOrPhone]);

  const isLocked = lockInfo.isLocked && lockInfo.secondsLeft > 0;
  const isSubmitDisabled = loading || isLocked;

  const zoneHelpText = useMemo(
    () => ({
      identifier:
        ttsMessages?.forgotPassword?.identifierFocus ||
        'Bác nhập email hoặc số điện thoại đã đăng ký.',
      captcha:
        ttsMessages?.forgotPassword?.captchaFocus ||
        'Bác hãy bấm vào ô vuông. Khi thấy dấu tích màu xanh là đã xác nhận xong.',
      submit: isLocked
        ? ttsMessages?.forgotPassword?.cooldown ||
          'Hệ thống đang tạm khóa yêu cầu gửi mã. Bác vui lòng chờ thêm trước khi thử lại.'
        : ttsMessages?.forgotPassword?.submitFocus ||
          'Nếu thông tin đã đúng, bác bấm nút gửi mã xác nhận.',
    }),
    [isLocked]
  );

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

  const formatLockText = (seconds) => {
    if (!seconds || seconds <= 0) return '';

    const minutes = Math.floor(seconds / 60);
    const remainSeconds = seconds % 60;

    if (minutes <= 0) return `${remainSeconds} giây`;
    if (remainSeconds === 0) return `${minutes} phút`;

    return `${minutes} phút ${remainSeconds} giây`;
  };

  const getSpeechDebugState = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return null;
    }

    return {
      speaking: window.speechSynthesis.speaking,
      pending: window.speechSynthesis.pending,
      paused: window.speechSynthesis.paused,
      voices: window.speechSynthesis.getVoices?.()?.length,
    };
  };

  const announceErrorThenMove = ({
    message,
    targetZone = 'identifier',
    focusRef = null,
    delayMs = 520,
  }) => {
    if (!message) return;

    if (speechStartTimerRef.current) {
      window.clearTimeout(speechStartTimerRef.current);
      speechStartTimerRef.current = null;
    }

    if (zoneMoveTimerRef.current) {
      window.clearTimeout(zoneMoveTimerRef.current);
      zoneMoveTimerRef.current = null;
    }

    debugLog('ANNOUNCE_ERROR_THEN_MOVE', {
      message,
      targetZone,
      speechState: getSpeechDebugState(),
    });

    setError(message);

    speechStartTimerRef.current = window.setTimeout(() => {
      speakMandatoryError(message);
      speechStartTimerRef.current = null;
    }, 0);

    zoneMoveTimerRef.current = window.setTimeout(() => {
      goToZone(targetZone);

      if (focusRef?.current) {
        focusRef.current.focus();
      }

      zoneMoveTimerRef.current = null;

      debugLog('ZONE_MOVE_AFTER_ERROR', {
        message,
        targetZone,
      });
    }, delayMs);
  };

  const focusField = (fieldKey) => {
    if (fieldKey === 'identifier') {
      identifierInputRef.current?.focus?.();
    }
  };

  const validateIdentifierPayload = () => {
    const identifier = String(formData.emailOrPhone || '').trim();

    const result = forgotPasswordIdentifierSchema.safeParse(identifier);

    debugLog('VALIDATE_IDENTIFIER_PAYLOAD', {
      hasIdentifier: !!identifier,
      identifierType: identifier.includes('@') ? 'email' : 'phone-or-invalid',
      valid: result.success,
    });

    if (!result.success) {
      return {
        valid: false,
        message: GENERIC_PAYLOAD_ERROR,
        targetZone: 'identifier',
        focusRef: identifierInputRef,
      };
    }

    return {
      valid: true,
      identifier,
    };
  };

  const extractLockSecondsFromError = (err) => {
    const responseData = err?.response?.data || {};

    const directMinutes = Number(
      err?.retryAfterMinutes ||
        err?.minutesLeft ||
        responseData?.retryAfterMinutes ||
        responseData?.minutesLeft ||
        0
    );

    if (directMinutes > 0) return directMinutes * 60;

    const directSeconds = Number(
      err?.waitSeconds ||
        responseData?.waitSeconds ||
        err?.retryAfterSeconds ||
        responseData?.retryAfterSeconds ||
        0
    );

    if (directSeconds > 0) return directSeconds;

    const rawMessage =
      err?.message || responseData?.message || responseData?.error || '';

    const minutesMatch = rawMessage.match(/sau\s+(\d+)\s+phút/i);
    if (minutesMatch?.[1]) return Number(minutesMatch[1]) * 60;

    const secondsMatch = rawMessage.match(/sau\s+(\d+)\s+giây/i);
    if (secondsMatch?.[1]) return Number(secondsMatch[1]);

    return 0;
  };

  const getErrorTargetZone = (code, lockSeconds = 0, status = 0) => {
    const captchaCodes = [
      'TURNSTILE_INVALID',
      'CAPTCHA_INVALID',
      'INVALID_TURNSTILE_TOKEN',
      'TURNSTILE_TOKEN_INVALID',
      'TURNSTILE_TOKEN_EXPIRED',
    ];

    const cooldownCodes = [
      'RESET_OTP_COOLDOWN',
      'RESET_OTP_REQUEST_LIMITED',
      'RESET_RATE_LIMITED',
      'IP_TEMPORARILY_BLOCKED',
    ];

    if (captchaCodes.includes(code)) return 'captcha';
    if (cooldownCodes.includes(code)) return 'submit';
    if (lockSeconds > 0) return 'submit';
    if (status === 404) return 'identifier';

    return 'identifier';
  };

  useEffect(() => {
    const sessionChanged =
      runtimeSessionId !== lastRuntimeSessionIdRef.current;

    if (!sessionChanged) return;

    lastRuntimeSessionIdRef.current = runtimeSessionId;

    const resetRuntime = () => {
      debugLog('RUNTIME_RESET', {
        reason: 'runtimeSessionId changed',
      });

      setFormData({
        emailOrPhone: '',
        hp_field: '',
      });

      setError('');
      setActiveZone('identifier');
      setCompletedZones(new Set());
      setLockInfo({
        isLocked: false,
        secondsLeft: 0,
      });

      captchaZone.reset({
        reason: 'runtime-reset',
        remount: true,
      });
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

    const timer = setInterval(() => {
      setLockInfo((prev) => {
        const nextSeconds = Math.max(0, prev.secondsLeft - 1);

        return {
          isLocked: nextSeconds > 0,
          secondsLeft: nextSeconds,
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockInfo.isLocked, lockInfo.secondsLeft]);

  useEffect(() => {
    return () => {
      if (speechStartTimerRef.current) {
        window.clearTimeout(speechStartTimerRef.current);
      }

      if (zoneMoveTimerRef.current) {
        window.clearTimeout(zoneMoveTimerRef.current);
      }
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (error) {
      setError('');
    }

    if (name === 'emailOrPhone') {
      if (value.trim()) {
        markCompleted('identifier');
      } else {
        unmarkCompleted('identifier');
      }
    }
  };

  const handleCaptchaVerified = (token, result) => {
    debugLog('CAPTCHA_VERIFIED', {
      hasToken: !!token,
      tokenLength: token?.length || 0,
      result,
    });
  };

  const handleCaptchaExpired = (result) => {
    debugLog('CAPTCHA_EXPIRED', result);
  };

  const handleCaptchaError = (result) => {
    debugLog('CAPTCHA_ERROR', result);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    debugLog('SUBMIT_START', {
      activeZone,
      loading,
      isLocked,
      hasIdentifier: !!formData.emailOrPhone.trim(),
      hasCaptchaToken: captchaZone.hasToken,
      captchaStatus: captchaZone.captchaStatus,
    });

    if (isLocked) {
      const lockMessage = `Bác vui lòng chờ ${formatLockText(
        lockInfo.secondsLeft
      )} trước khi gửi lại yêu cầu.`;

      announceErrorThenMove({
        message: lockMessage,
        targetZone: 'submit',
      });

      return;
    }

    const identifierCheck = validateIdentifierPayload();

    if (!identifierCheck.valid) {
      unmarkCompleted('identifier');

      announceErrorThenMove({
        message: identifierCheck.message || GENERIC_PAYLOAD_ERROR,
        targetZone: identifierCheck.targetZone || 'identifier',
        focusRef: identifierCheck.focusRef,
      });

      return;
    }

    if (formData.hp_field && formData.hp_field.trim().length > 0) {
      announceErrorThenMove({
        message: 'Hành vi đáng ngờ. Vui lòng thử lại.',
        targetZone: 'identifier',
        focusRef: identifierInputRef,
      });

      return;
    }

    const captchaCheck = captchaZone.validateBeforeSubmit();

    debugLog('CAPTCHA_VALIDATE_RESULT', {
      valid: captchaCheck.valid,
      reason: captchaCheck.reason,
      blockReason: captchaCheck.blockReason,
      shouldReset: captchaCheck.shouldReset,
      destructiveReset: captchaCheck.destructiveReset,
      message: captchaCheck.message,
      hasToken: !!captchaCheck.token,
    });

    if (!captchaCheck.valid) {
      const captchaMessage =
        captchaCheck.message ||
        'Bác vui lòng hoàn tất phần xác minh trước khi tiếp tục.';

      setError(captchaMessage);

      captchaZone.applyValidationFailure({
        validationResult: captchaCheck,
        guidedFlow: guidedFlowBridge,
        speak: speakMandatoryError,
        focus: focusField,
        focusDelayMs: 520,
      });

      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        identifier: identifierCheck.identifier,
        turnstileToken: captchaCheck.token || captchaZone.getToken(),
        hp_field: formData.hp_field,
      };

      debugLog('BACKEND_CALL_START', {
        payloadShape: Object.keys(payload),
        hasIdentifier: !!payload.identifier,
        hasTurnstileToken: !!payload.turnstileToken,
        hpFieldLength: payload.hp_field?.length || 0,
      });

      await forgotPassword(payload);

      captchaZone.consume({
        guidedFlow: guidedFlowBridge,
      });

      debugLog('BACKEND_CALL_SUCCESS', {
        identifier: identifierCheck.identifier,
      });

      onSuccess(identifierCheck.identifier);
    } catch (err) {
      console.error('[ForgotPasswordForm ERROR]', err);

      const responseData = err?.response?.data || {};
      const status = err?.response?.status || 0;
      const code = err?.code || responseData?.code;

      const fallbackMessage =
        err?.message ||
        responseData?.message ||
        responseData?.error ||
        'Không thể gửi yêu cầu. Vui lòng kiểm tra lại thông tin hoặc thử lại sau.';

      const lockSeconds = extractLockSecondsFromError(err);

      if (lockSeconds > 0) {
        setLockInfo({
          isLocked: true,
          secondsLeft: lockSeconds,
        });
      }

      const messageMap = {
        IDENTIFIER_NOT_FOUND: GENERIC_PAYLOAD_ERROR,
        INVALID_IDENTIFIER: GENERIC_PAYLOAD_ERROR,
        USER_NOT_FOUND: GENERIC_PAYLOAD_ERROR,

        NO_EMAIL_CHANNEL:
          'Không thể gửi mã xác nhận. Vui lòng liên hệ Ban quản trị để được hỗ trợ.',

        RESET_OTP_COOLDOWN: fallbackMessage,
        RESET_OTP_REQUEST_LIMITED: fallbackMessage,
        RESET_RATE_LIMITED: fallbackMessage,
        IP_TEMPORARILY_BLOCKED: fallbackMessage,
      };

      const finalMessage =
        messageMap[code] ||
        sanitizeForgotPasswordBackendMessage(fallbackMessage, status, code);

      const normalizedMessage = finalMessage.replace(
        /reset mật khẩu/gi,
        'đổi mật khẩu'
      );

      const targetZone = getErrorTargetZone(code, lockSeconds, status);

      debugLog('BACKEND_ERROR_ROUTED', {
        status,
        code,
        normalizedMessage,
        targetZone,
        lockSeconds,
      });

      if (targetZone === 'identifier') {
        unmarkCompleted('identifier');

        announceErrorThenMove({
          message: normalizedMessage,
          targetZone: 'identifier',
          focusRef: identifierInputRef,
        });

        return;
      }

      if (targetZone === 'captcha') {
        const backendCaptchaResult = {
          valid: false,
          reason: CAPTCHA_RESET_REASONS.BACKEND_INVALID,
          blockReason: '',
          message: normalizedMessage,
          shouldReset: true,
          destructiveReset: true,
        };

        setError(normalizedMessage);

        captchaZone.applyValidationFailure({
          validationResult: backendCaptchaResult,
          guidedFlow: guidedFlowBridge,
          speak: speakMandatoryError,
          focus: focusField,
          focusDelayMs: 520,
        });

        return;
      }

      announceErrorThenMove({
        message: normalizedMessage,
        targetZone,
      });
    } finally {
      setLoading(false);

      debugLog('SUBMIT_FINALLY', {
        loadingWillBecomeFalse: true,
      });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300"
      autoComplete="off"
      noValidate
    >
      <style>
        {`
          @keyframes egalAttentionSoftFlash {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
              transform: translateY(0);
            }
            35% {
              box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.14);
              transform: translateY(-1px);
            }
            70% {
              box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.08);
              transform: translateY(0);
            }
          }

          .egal-attention-flash {
            animation: egalAttentionSoftFlash 2.4s ease-out 1;
          }

          .egal-attention-locked {
            position: relative;
            z-index: 1;
          }

          @media (prefers-reduced-motion: reduce) {
            .egal-attention-flash {
              animation: none;
              box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.10);
            }
          }
        `}
      </style>

      <div className="text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-600">
          HỖ TRỢ TÀI KHOẢN
        </p>

        <h2 className="mt-2 text-2xl font-black leading-tight text-slate-900 md:text-3xl">
          Quên mật khẩu
        </h2>

        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-slate-500">
          Nhập số điện thoại hoặc email đã đăng ký. Hệ thống sẽ gửi mã xác nhận
          qua kênh liên lạc phù hợp.
        </p>

        <div className="mt-4 flex justify-center">
          <AudioHelpButton
            text={
              ttsMessages?.forgotPassword?.help ||
              'Bác nhập email hoặc số điện thoại đã đăng ký. Hệ thống sẽ gửi mã xác nhận để đổi mật khẩu.'
            }
            label="Nghe hướng dẫn"
            variant="soft"
          />
        </div>
      </div>

      <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4 text-amber-800">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0" size={20} />
          <div className="space-y-1">
            <p className="text-sm font-black">Bảo mật tài khoản</p>
            <p className="text-sm leading-relaxed">
              Mã xác nhận chỉ dùng để đổi mật khẩu. Bác không nên chia sẻ mã
              này cho người khác.
            </p>
          </div>
        </div>
      </div>

      {isLocked && (
        <AttentionZone
          active={isLocked}
          priority="warning"
          role="status"
          ariaLive="polite"
          autoScroll
          autoFocus
          flash
          lock
          className="flex items-start gap-3 border-orange-100 bg-orange-50 text-orange-700"
          data-testid="forgot-password-attention-lock"
        >
          <Clock size={20} className="mt-0.5 shrink-0" />
          <span className="text-sm font-bold leading-relaxed">
            Bác vui lòng chờ {formatLockText(lockInfo.secondsLeft)} trước khi
            gửi lại yêu cầu.
          </span>
        </AttentionZone>
      )}

      {!isLocked && error && (
        <AttentionZone
          active={!!error}
          priority="high"
          role="alert"
          ariaLive="assertive"
          autoScroll
          autoFocus
          flash
          lock
          className="flex items-start gap-3 border-rose-100 bg-rose-50 text-rose-700"
          data-testid="forgot-password-attention-error"
        >
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <span className="text-sm font-bold leading-relaxed">{error}</span>
        </AttentionZone>
      )}

      <div className="space-y-4">
        <GuidedFieldWrapper
          fieldKey="identifier"
          activeField={activeZone}
          helperText={zoneHelpText.identifier}
          completed={isCompleted('identifier')}
          disabled={isLocked}
          voiceAction={
            <ZoneVoiceButton
              visible={showAzVoiceButton('identifier')}
              text={zoneHelpText.identifier}
              label="Nghe"
              disabled={isLocked || loading}
            />
          }
        >
          <div className="space-y-2">
            <label className="mb-2 flex items-center gap-2 px-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
              Email hoặc số điện thoại <span className="text-rose-500">*</span>
            </label>

            <div className="relative">
              {identifierType === 'email' ? (
                <Mail
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-amber-500"
                  size={20}
                />
              ) : (
                <Phone
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-amber-500"
                  size={20}
                />
              )}

              <input
                ref={identifierInputRef}
                type="text"
                name="emailOrPhone"
                placeholder="Nhập email hoặc số điện thoại"
                className="w-full rounded-[20px] border border-slate-200 bg-white py-4 pl-12 pr-4 text-base font-bold text-slate-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                value={formData.emailOrPhone}
                onChange={handleChange}
                onFocus={() => goToZone('identifier')}
                autoComplete="off"
                disabled={isLocked}
                required
              />
            </div>
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
          disabled={isLocked}
          loading={loading}
          elderAssistMode
          helperText={zoneHelpText.captcha}
          voiceText={zoneHelpText.captcha}
          voiceLabel="Nghe"
          onVerified={handleCaptchaVerified}
          onExpired={handleCaptchaExpired}
          onError={handleCaptchaError}
          onFocus={() => goToZone('captcha')}
        />
      </div>

      <div className="space-y-3 pt-2">
        <GuidedFieldWrapper
          fieldKey="submit"
          activeField={activeZone}
          helperText={zoneHelpText.submit}
          completed={false}
          disabled={isLocked}
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
            disabled={isSubmitDisabled}
            onFocus={() => goToZone('submit')}
            onClick={() => goToZone('submit')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 py-4 text-base font-black text-white shadow-xl shadow-amber-100 transition-all hover:bg-amber-700 active:scale-[0.985] disabled:bg-slate-300 disabled:shadow-none"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Đang gửi mã...
              </>
            ) : isLocked ? (
              <>
                <Clock size={20} />
                Chờ {formatLockText(lockInfo.secondsLeft)}
              </>
            ) : (
              <>
                Gửi mã xác nhận
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </GuidedFieldWrapper>

        <button
          type="button"
          onClick={onBackToLogin}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-4 text-sm font-black text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.985]"
        >
          <ChevronLeft size={18} />
          Quay lại đăng nhập
        </button>
      </div>
    </form>
  );
};

export default ForgotPasswordForm;