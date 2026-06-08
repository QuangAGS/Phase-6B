/**
 * PATH       : src/features/auth/components/LoginForm.jsx
 * DATETIME   : 2026-05-25T00:00:00+07:00
 * VERSION    : EGAL-24.6.7.R3.3.3-LOGIN-LOCK-COUNTDOWN
 * DESCRIPTION:
 * - R3.3.3: Login lock countdown now uses secondsLeft. 
 *   Countdown updates continuously on message area and submit button.
 * - Clean LoginForm theo doctrine mới sau UAT.
 * - Bỏ nút/logic global "Đang/Tắt hỗ trợ bằng âm thanh" ở cấp Form/Page.
 * - Bỏ StepCoachBar / khu vực theo dõi thứ tự từng bước thao tác.
 * - Bỏ guided sequential flow / Focus Guardian / field lock / proactive guidance.
 * - Người dùng tự do touch/focus bất kỳ Attention Zone nào.
 * - AudioHelpButton luôn hiển thị: hướng dẫn tổng quan theo yêu cầu người dùng.
 * - ZoneVoiceButton luôn hiển thị tại AZ đang active: hướng dẫn local theo yêu cầu người dùng.
 * - Đọc lỗi submit/backend là bắt buộc, không phụ thuộc bất kỳ audio toggle nào.
 * - Validation chỉ diễn ra khi submit.
 * - Error localization:
 *   identifier invalid/missing -> identifier
 *   password missing -> password
 *   captcha invalid/missing -> captcha
 *   backend login error/rate-limit/lockout -> submit/message area
 * - Captcha missing token = NON-DESTRUCTIVE: không reset/remount Turnstile.
 * - Captcha expired/error/consumed/backend invalid = reset/remount allowed.
 * - Giữ payload/backend contract:
 *   {
 *     identifier,
 *     password,
 *     turnstileToken,
 *     hp_field
 *   }
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { z } from 'zod';
import Turnstile from 'react-turnstile';

import { emailRule, phoneRule } from '../../../utils/validationRules.js';

import AudioHelpButton from '../../a11y/tts/AudioHelpButton.jsx';
import { ttsMessages } from '../../a11y/tts/ttsMessages.js';
import { useTts } from '../../a11y/tts/useTts.js';
import ZoneVoiceButton from '../../a11y/voice/ZoneVoiceButton.jsx';

import AttentionZone from '../../a11y/attention/AttentionZone.jsx';
import GuidedFieldWrapper from '../../a11y/guided/GuidedFieldWrapper.jsx';

import {
  CAPTCHA_ZONE_STATUS,
  buildCaptchaPayloadSnapshot,
  validateCaptchaBeforeSubmit,
  shouldResetCaptcha,
} from '../../a11y/captcha/captchaZone.service.js';

const GENERIC_PAYLOAD_ERROR = 'Thông tin đưa vào chưa chính xác.';
const PASSWORD_REQUIRED_ERROR = 'Bác vui lòng nhập mật khẩu.';
const CAPTCHA_REQUIRED_ERROR =
  ttsMessages?.login?.captchaRequired ||
  'Bác vui lòng hoàn thành xác minh bảo mật trước khi đăng nhập.';

const loginIdentifierSchema = z.union([emailRule, phoneRule], {
  errorMap: () => ({
    message: GENERIC_PAYLOAD_ERROR,
  }),
});

const normalizeCaptchaErrorMessage = (message) => {
  const raw = String(message || '').trim();

  if (!raw) return CAPTCHA_REQUIRED_ERROR;

  const lower = raw.toLowerCase();

  if (
    lower.includes('captcha') ||
    lower.includes('turnstile') ||
    lower.includes('xác minh bảo mật')
  ) {
    return CAPTCHA_REQUIRED_ERROR;
  }

  return raw;
};
const formatLockText = (seconds) => {
  if (!seconds || seconds <= 0) return '';

  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;

  if (minutes <= 0) return `${remainSeconds} giây`;
  if (remainSeconds === 0) return `${minutes} phút`;

  return `${minutes} phút ${remainSeconds} giây`;
};
const LoginForm = ({
  runtimeSessionId = 0,
  onSubmitLogin,
  toggleAuthMode,
  onForgotPassword,
  onBackHome,
  loading = false,
  message = '',
  lockoutInfo = {},
  successMessage = '',
  userStatus = '',
}) => {
  const debugMode =
    import.meta.env.DEV || import.meta.env.VITE_DEBUG_MODE === 'true';

  const debugLog = (checkpoint, payload = {}) => {
    if (!debugMode) return;

    console.log(`[EGAL-LOGIN-R3.3.2][${checkpoint}]`, {
      at: new Date().toISOString(),
      runtimeSessionId,
      ...payload,
    });
  };

  const { speak } = useTts();

  /**
   * R3.3.2 mandatory error speech.
   *
   * TtsProvider.speakError() còn phụ thuộc elderMode/autoSpeakErrors/hasUserActivatedTts
   * theo doctrine cũ. Sau khi bỏ global ElderAssistButton, lỗi submit/backend
   * phải dùng speak() trực tiếp để bảo đảm luôn đọc khi có user-triggered submit.
   */
  const speakMandatoryError = (text, options = {}) => {
    if (!text) return false;

    return speak?.(text, {
      rate: 0.82,
      ...options,
    });
  };

  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    hp_field: '',
  });

  const [activeZone, setActiveZone] = useState('identifier');
  const [completedZones, setCompletedZones] = useState(() => new Set());
  const [showPassword, setShowPassword] = useState(false);
  const [localValidationError, setLocalValidationError] = useState('');
  const [suppressBackendMessage, setSuppressBackendMessage] = useState(true);

  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaInstanceKey, setCaptchaInstanceKey] = useState(0);

  const captchaTokenRef = useRef(null);
  const captchaUpdatedAtRef = useRef(0);
  const captchaStatusRef = useRef(CAPTCHA_ZONE_STATUS.UNKNOWN);
  const captchaConsumedRef = useRef(false);

  const identifierInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const lastRuntimeSessionIdRef = useRef(null);
  const lastSpokenBackendMessageRef = useRef('');
  const speechStartTimerRef = useRef(null);
  const zoneMoveTimerRef = useRef(null);

  const [localLockInfo, setLocalLockInfo] = useState({
    isLocked: false,
    minutesLeft: 0,
    secondsLeft: 0,
    isPermanent: false,
    lockType: 'NONE',
    reasonCode: '',
    lockUntilAt: null,
  });

  const isLocked = localLockInfo.isLocked;

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

  const resetCaptchaRuntime = ({ remount = true } = {}) => {
    setCaptchaToken(null);
    captchaTokenRef.current = null;
    captchaUpdatedAtRef.current = 0;
    captchaStatusRef.current = CAPTCHA_ZONE_STATUS.UNKNOWN;
    captchaConsumedRef.current = false;
    unmarkCompleted('captcha');

    if (remount) {
      setCaptchaInstanceKey((prev) => prev + 1);
    }
  };

  const announceErrorThenMove = ({
    message: errorMessage,
    targetZone,
    focusRef,
    delayMs = 520,
  }) => {
    if (!errorMessage) return;

    if (speechStartTimerRef.current) {
      window.clearTimeout(speechStartTimerRef.current);
      speechStartTimerRef.current = null;
    }

    if (zoneMoveTimerRef.current) {
      window.clearTimeout(zoneMoveTimerRef.current);
      zoneMoveTimerRef.current = null;
    }

    setLocalValidationError(errorMessage);

    speechStartTimerRef.current = window.setTimeout(() => {
      speakMandatoryError(errorMessage);
      speechStartTimerRef.current = null;
    }, 0);

    zoneMoveTimerRef.current = window.setTimeout(() => {
      goToZone(targetZone);

      if (focusRef?.current) {
        focusRef.current.focus();
      }

      zoneMoveTimerRef.current = null;
    }, delayMs);
  };
  //effect nhận lockoutInfo
  useEffect(() => {
    const isAccountLocked = lockoutInfo.code === 'ACCOUNT_LOCKED';
    const isPermanent = isAccountLocked && lockoutInfo.isPermanent === true;
    const minutesLeft = isAccountLocked ? lockoutInfo.minutesLeft || 0 : 0;
    const lockType = lockoutInfo.lockType || 'NONE';
    const reasonCode = lockoutInfo.reasonCode || '';
    const lockUntilAt = lockoutInfo.lockUntilAt || null;

    let secondsLeft = 0;

    if (isAccountLocked && !isPermanent) {
      if (lockUntilAt) {
        secondsLeft = Math.max(
          0,
          Math.ceil((Number(lockUntilAt) - Date.now()) / 1000)
        );
      } else {
        secondsLeft = Math.max(0, Number(minutesLeft || 0) * 60);
      }
    }

    if (isAccountLocked) {
      setLocalValidationError('');
    }

    setLocalLockInfo({
      isLocked: isAccountLocked,
      minutesLeft,
      secondsLeft,
      isPermanent,
      lockType,
      reasonCode,
      lockUntilAt,
    });
  }, [lockoutInfo]);

  // effect countdown
  useEffect(() => {
    if (!localLockInfo.isLocked) return undefined;
    if (localLockInfo.isPermanent) return undefined;
    if (localLockInfo.secondsLeft <= 0) return undefined;

    const timer = window.setInterval(() => {
      setLocalLockInfo((prev) => {
        const nextSeconds = Math.max(0, prev.secondsLeft - 1);
        const nextMinutes = Math.ceil(nextSeconds / 60);

        return {
          ...prev,
          secondsLeft: nextSeconds,
          minutesLeft: nextMinutes,
          isLocked: nextSeconds > 0,
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    localLockInfo.isLocked,
    localLockInfo.isPermanent,
    localLockInfo.secondsLeft,
  ]);

  useEffect(() => {
    const sessionChanged =
      runtimeSessionId !== lastRuntimeSessionIdRef.current;

    if (!sessionChanged) return;

    lastRuntimeSessionIdRef.current = runtimeSessionId;

    const resetLoginRuntime = () => {
      setFormData({
        identifier: '',
        password: '',
        hp_field: '',
      });

      setLocalValidationError('');
      setSuppressBackendMessage(true);
      setShowPassword(false);
      setCompletedZones(new Set());
      setActiveZone('identifier');
      lastSpokenBackendMessageRef.current = '';
      resetCaptchaRuntime({ remount: true });
    };

    requestAnimationFrame(resetLoginRuntime);

    const t1 = window.setTimeout(resetLoginRuntime, 80);
    const t2 = window.setTimeout(resetLoginRuntime, 250);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [runtimeSessionId]);

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

  /** Effect xử lý backend message
   * Backend/AuthPage authoritative errors must be spoken.
   * This is independent of any help-button visibility doctrine.
   */
  useEffect(() => {
    if (!message) return;
    if (successMessage) return;
    if (isLocked) return;
    if (suppressBackendMessage) return;
    if (localValidationError) return;

    const normalizedBackendMessage = normalizeCaptchaErrorMessage(message);

    if (!normalizedBackendMessage) return;
    if (lastSpokenBackendMessageRef.current === normalizedBackendMessage) return;

    lastSpokenBackendMessageRef.current = normalizedBackendMessage;
    setLocalValidationError(normalizedBackendMessage);

    speakMandatoryError(normalizedBackendMessage);

    window.setTimeout(() => {
      goToZone('submit');
    }, 520);
  }, [
    message,
    successMessage,
    localValidationError,
    isLocked,
    suppressBackendMessage,
    speak,
  ]);

  const validateSubmitPayload = () => {
    const identifier = formData.identifier.trim();
    const password = formData.password;

    if (!identifier) {
      return {
        valid: false,
        zone: 'identifier',
        message: GENERIC_PAYLOAD_ERROR,
        focusRef: identifierInputRef,
      };
    }

    const identifierCheck = loginIdentifierSchema.safeParse(identifier);

    if (!identifierCheck.success) {
      return {
        valid: false,
        zone: 'identifier',
        message: GENERIC_PAYLOAD_ERROR,
        focusRef: identifierInputRef,
      };
    }

    if (!password) {
      return {
        valid: false,
        zone: 'password',
        message: PASSWORD_REQUIRED_ERROR,
        focusRef: passwordInputRef,
      };
    }

    const captchaSnapshot = buildCaptchaPayloadSnapshot({
      captchaToken: captchaTokenRef.current || captchaToken,
      captchaUpdatedAt: captchaUpdatedAtRef.current,
      captchaStatus: captchaStatusRef.current,
      consumed: captchaConsumedRef.current,
    });

    const captchaCheck = validateCaptchaBeforeSubmit({
      snapshot: captchaSnapshot,
    });

    if (!captchaCheck.valid) {
      return {
        valid: false,
        zone: 'captcha',
        message: normalizeCaptchaErrorMessage(captchaCheck.message),
        captchaCheck,
        focusRef: null,
      };
    }

    return {
      valid: true,
      identifier,
      password,
      captchaCheck,
    };
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSuppressBackendMessage(false);

    if (localLockInfo.isLocked) {
      const lockMessage =
        message ||
        (localLockInfo.isPermanent
          ? 'Tài khoản tạm thời bị khoá. Xin vui lòng liên hệ hỗ trợ trực tiếp.'
          : `Tài khoản tạm thời bị khoá. Vui lòng thử lại sau ${formatLockText(
              localLockInfo.secondsLeft
            )}.`);

      announceErrorThenMove({
        message: lockMessage,
        targetZone: 'submit',
      });
      return;
    }

    if (formData.hp_field && formData.hp_field.trim().length > 0) {
      alert('Hành vi đáng ngờ. Vui lòng thử lại.');
      return;
    }

    const payloadCheck = validateSubmitPayload();

    debugLog('submit-payload-check', payloadCheck);

    if (!payloadCheck.valid) {
      if (payloadCheck.zone === 'identifier') {
        unmarkCompleted('identifier');
      }

      if (payloadCheck.zone === 'password') {
        unmarkCompleted('password');
      }

      if (payloadCheck.zone === 'captcha') {
        unmarkCompleted('captcha');

        const resetReason = payloadCheck.captchaCheck?.reason || '';

        /**
         * R3.3 doctrine:
         * Missing token is non-destructive.
         * Expired/Error/Consumed/backend invalid may remount.
         */
        if (shouldResetCaptcha(resetReason)) {
          resetCaptchaRuntime({ remount: true });
        }
      }

      announceErrorThenMove({
        message: payloadCheck.message,
        targetZone: payloadCheck.zone,
        focusRef: payloadCheck.focusRef,
      });

      return;
    }

    setLocalValidationError('');
    lastSpokenBackendMessageRef.current = '';

    const submitToken =
      payloadCheck.captchaCheck?.token ||
      captchaTokenRef.current ||
      captchaToken;

    onSubmitLogin({
      identifier: payloadCheck.identifier,
      password: payloadCheck.password,
      turnstileToken: submitToken,
      hp_field: formData.hp_field,
    });

    captchaStatusRef.current = CAPTCHA_ZONE_STATUS.CONSUMED;
    captchaConsumedRef.current = true;
    unmarkCompleted('captcha');
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (localValidationError) {
      setLocalValidationError('');
    }

    if (name === 'identifier') {
      if (value.trim()) {
        markCompleted('identifier');
      } else {
        unmarkCompleted('identifier');
      }
    }

    if (name === 'password') {
      if (value) {
        markCompleted('password');
      } else {
        unmarkCompleted('password');
      }
    }
  };

  const handleTurnstileVerify = (token) => {
    setCaptchaToken(token);
    captchaTokenRef.current = token;
    captchaUpdatedAtRef.current = Date.now();
    captchaStatusRef.current = CAPTCHA_ZONE_STATUS.VERIFIED;
    captchaConsumedRef.current = false;
    markCompleted('captcha');
  };

  const handleTurnstileExpire = () => {
    setCaptchaToken(null);
    captchaTokenRef.current = null;
    captchaUpdatedAtRef.current = 0;
    captchaStatusRef.current = CAPTCHA_ZONE_STATUS.EXPIRED;
    captchaConsumedRef.current = false;
    unmarkCompleted('captcha');
  };

  const handleTurnstileError = () => {
    setCaptchaToken(null);
    captchaTokenRef.current = null;
    captchaUpdatedAtRef.current = 0;
    captchaStatusRef.current = CAPTCHA_ZONE_STATUS.ERROR;
    captchaConsumedRef.current = false;
    unmarkCompleted('captcha');
  };

  const lockCountdownMessage = isLocked
    ? localLockInfo.isPermanent
      ? 'Tài khoản bị cấm. Xin vui lòng liên hệ trực tiếp để được hỗ trợ.'
      : `Tài khoản tạm khóa. Vui lòng thử lại sau ${formatLockText(
          localLockInfo.secondsLeft
        )}.`
    : '';

  const safeBackendMessage = suppressBackendMessage
    ? ''
    : normalizeCaptchaErrorMessage(message);

  const shouldShowSuccessMessage =
    !!successMessage || userStatus === 'CHO_DUYET';
  
  const displayMessage = shouldShowSuccessMessage
    ? ''
    : isLocked
      ? lockCountdownMessage
      : localValidationError || safeBackendMessage || '';
        
/*
  const displayMessage = isLocked
    ? lockCountdownMessage
    : localValidationError || safeBackendMessage || '';
*/


  const canSubmit = !loading && !isLocked;

  const zoneHelpText = useMemo(
    () => ({
      identifier:
        ttsMessages?.login?.identifierFocus ||
        'Bác nhập số điện thoại hoặc email đã đăng ký.',
      password:
        ttsMessages?.login?.passwordFocus ||
        'Bác nhập mật khẩu đăng nhập.',
      captcha:
        ttsMessages?.login?.captchaFocus ||
        'Bác hãy bấm vào ô xác minh bảo mật. Khi thấy dấu tích màu xanh là đã xác nhận xong.',
      submit:
        isLocked
          ? ttsMessages?.login?.locked ||
            'Tài khoản đang bị khóa tạm thời. Bác vui lòng chờ thêm trước khi đăng nhập lại.'
          : ttsMessages?.login?.submitFocus ||
            'Nếu thông tin đã đúng, bác bấm nút đăng nhập.',
    }),
    [isLocked]
  );

  return (
    <div className="space-y-6">
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
        `}
      </style>

      <div className="space-y-3 text-center">
        <h2 className="text-3xl font-black tracking-tight text-slate-800">
          Đăng nhập
        </h2>
        <p className="text-sm text-slate-500">
          Bác nhập thông tin tài khoản để tiếp tục.
        </p>

        <div className="flex justify-center">
          <AudioHelpButton
            text={
              ttsMessages?.login?.help ||
              'Bác vui lòng nhập số điện thoại hoặc email, nhập mật khẩu, hoàn thành xác minh bảo mật, rồi bấm nút đăng nhập.'
            }
            label="Nghe hướng dẫn"
            variant="soft"
          />
        </div>
      </div>

      {displayMessage && !shouldShowSuccessMessage && (
        <AttentionZone
          active={!!displayMessage}
          priority={isLocked ? 'warning' : 'high'}
          role={isLocked ? 'status' : 'alert'}
          ariaLive={isLocked ? 'polite' : 'assertive'}
          autoScroll
          autoFocus
          flash
          lock
          className={
            isLocked
              ? 'flex items-start gap-3 border-orange-100 bg-orange-50 text-orange-700'
              : 'flex items-start gap-3 border-rose-100 bg-rose-50 text-rose-700'
          }
          data-testid="login-attention-message"
        >
          {isLocked ? (
            <Clock size={20} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
          )}
          <span className="text-sm font-bold leading-relaxed">
            {displayMessage}
          </span>
        </AttentionZone>
      )}

      {successMessage && (
        <AttentionZone
          active={!!successMessage}
          priority="success"
          role="status"
          ariaLive="polite"
          autoScroll
          flash
          className="border-emerald-100 bg-emerald-50 text-emerald-700"
          data-testid="login-attention-success"
        >
          <span className="text-sm font-bold leading-relaxed">
            {successMessage}
          </span>
        </AttentionZone>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Số điện thoại hoặc Email
            </label>

            <input
              ref={identifierInputRef}
              type="text"
              name="identifier"
              value={formData.identifier}
              onChange={handleChange}
              onFocus={() => goToZone('identifier')}
              autoComplete="username"
              className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-base outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
              placeholder="Nhập số điện thoại hoặc email"
              disabled={isLocked}
              required
            />
          </div>
        </GuidedFieldWrapper>

        <GuidedFieldWrapper
          fieldKey="password"
          activeField={activeZone}
          helperText={zoneHelpText.password}
          completed={isCompleted('password')}
          disabled={isLocked}
          voiceAction={
            <ZoneVoiceButton
              visible={showAzVoiceButton('password')}
              text={zoneHelpText.password}
              label="Nghe"
              disabled={isLocked || loading}
            />
          }
        >
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Mật khẩu
            </label>

            <div className="relative">
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                onFocus={() => goToZone('password')}
                autoComplete="current-password"
                className="w-full rounded-2xl border border-slate-200 px-5 py-4 pr-14 text-base outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                placeholder="Nhập mật khẩu"
                disabled={isLocked}
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                disabled={isLocked}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
        </GuidedFieldWrapper>

        <input
          type="text"
          name="hp_field"
          value={formData.hp_field}
          onChange={handleChange}
          className="hidden"
          tabIndex="-1"
          autoComplete="off"
        />

        <GuidedFieldWrapper
          fieldKey="captcha"
          activeField={activeZone}
          helperText={zoneHelpText.captcha}
          completed={isCompleted('captcha')}
          disabled={isLocked}
          voiceAction={
            <ZoneVoiceButton
              visible={showAzVoiceButton('captcha')}
              text={zoneHelpText.captcha}
              label="Nghe"
              disabled={isLocked || loading}
            />
          }
        >
          <div
            className="flex justify-center py-2"
            onFocus={() => goToZone('captcha')}
            onClick={() => goToZone('captcha')}
          >
            <Turnstile
              key={`login-turnstile-${captchaInstanceKey}`}
              sitekey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
              onVerify={handleTurnstileVerify}
              onExpire={handleTurnstileExpire}
              onError={handleTurnstileError}
              className="mx-auto"
            />
          </div>
        </GuidedFieldWrapper>

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
            disabled={!canSubmit}
            onFocus={() => goToZone('submit')}
            onClick={() => goToZone('submit')}
            className="w-full rounded-2xl bg-blue-600 py-4 text-base font-black text-white transition-all hover:bg-blue-700 active:scale-[0.985] disabled:bg-slate-400"
          >
            {isLocked && localLockInfo.isPermanent ? (
              'Tài khoản bị cấm'
            ) : isLocked ? (
              localLockInfo.secondsLeft > 0
                ? `Tạm khóa (${formatLockText(localLockInfo.secondsLeft)})`
                : 'Tạm khóa'
            ) : loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={20} />
                Đang đăng nhập...
              </span>
            ) : (
              'Đăng nhập'
            )}
          </button>
        </GuidedFieldWrapper>
      </form>

      <div className="space-y-3 border-t border-slate-100 pt-5 text-center">
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
          <button
            type="button"
            onClick={onForgotPassword}
            className="flex min-h-[40px] items-center justify-center gap-1 rounded-xl px-3 text-sm font-bold text-blue-600 transition hover:bg-blue-50 hover:underline"
            disabled={isLocked}
          >
            <HelpCircle size={16} />
            Quên mật khẩu?
          </button>

          {onBackHome && (
            <button
              type="button"
              onClick={onBackHome}
              className="min-h-[40px] rounded-xl px-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50 hover:text-blue-600 hover:underline"
            >
              ← Quay về trang chủ
            </button>
          )}
        </div>

        <div className="text-sm text-slate-500">
          Chưa có tài khoản?{' '}
          <button
            type="button"
            onClick={toggleAuthMode}
            className="font-black text-blue-600 hover:underline"
          >
            Đăng ký ngay
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
