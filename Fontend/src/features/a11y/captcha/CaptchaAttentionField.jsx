/**
 * PATH       : src/features/a11y/captcha/CaptchaAttentionField.jsx
 * DATETIME   : 2026-05-23T00:00:00+07:00
 * VERSION    : EGAL-24.6.7.R3.3.1-CAPTCHA-FIELD
 * DESCRIPTION:
 * - Reusable CAPTCHA Attention Zone field component.
 * - Wraps Turnstile with GuidedFieldWrapper + ZoneVoiceButton.
 * - Does not own submit validation.
 * - Does not own backend/business logic.
 * - Uses captchaZone hook object as lifecycle authority.
 * - Implements EGAL doctrine:
 *   CAPTCHA is not a normal field; CAPTCHA is a lifecycle zone.
 * - Q1/Q2 safe.
 */

import Turnstile from 'react-turnstile';

import GuidedFieldWrapper from '../guided/GuidedFieldWrapper.jsx';
import ZoneVoiceButton from '../voice/ZoneVoiceButton.jsx';
import { ttsMessages } from '../tts/ttsMessages.js';

export default function CaptchaAttentionField({
  captchaZone,
  guidedFlow,

  fieldKey = 'captcha',
  nextZone = 'submit',

  siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY,

  disabled = false,
  loading = false,
  elderAssistMode = false,

  helperText,
  voiceText,
  voiceLabel = 'Nghe',

  className = '',
  wrapperClassName = '',
  turnstileClassName = 'mx-auto',

  onVerified,
  onExpired,
  onError,
  onFocus,
}) {
  const finalHelperText =
    helperText ||
    ttsMessages?.forgotPassword?.captchaFocus ||
    ttsMessages?.common?.captcha?.instruction ||
    'Bác hãy bấm vào ô vuông. Khi thấy dấu tích màu xanh là đã xác nhận xong.';

  const finalVoiceText = voiceText || finalHelperText;

  const isActive = guidedFlow?.activeField === fieldKey;

  const showVoiceButton =
    elderAssistMode &&
    isActive &&
    !loading &&
    !disabled;

  const completed =
    typeof guidedFlow?.isCompleted === 'function'
      ? guidedFlow.isCompleted(fieldKey)
      : false;

  const handleVerify = (token) => {
    const result = captchaZone?.handleVerify?.(token, {
      guidedFlow,
      fieldKey,
      nextZone,
    });

    if (typeof onVerified === 'function') {
      onVerified(token, result);
    }
  };

  const handleExpire = () => {
    const result = captchaZone?.handleExpire?.();

    if (typeof guidedFlow?.unmarkCompleted === 'function') {
      guidedFlow.unmarkCompleted(fieldKey);
    }

    if (typeof onExpired === 'function') {
      onExpired(result);
    }
  };

  const handleError = () => {
    const result = captchaZone?.handleError?.();

    if (typeof guidedFlow?.unmarkCompleted === 'function') {
      guidedFlow.unmarkCompleted(fieldKey);
    }

    if (typeof onError === 'function') {
      onError(result);
    }
  };

  const handleFocus = () => {
    if (typeof guidedFlow?.goToField === 'function') {
      guidedFlow.goToField(fieldKey);
    }

    if (typeof onFocus === 'function') {
      onFocus(fieldKey);
    }
  };

  return (
    <GuidedFieldWrapper
      fieldKey={fieldKey}
      activeField={guidedFlow?.activeField}
      helperText={finalHelperText}
      completed={completed}
      disabled={disabled}
      className={wrapperClassName}
      voiceAction={
        <ZoneVoiceButton
          visible={showVoiceButton}
          text={finalVoiceText}
          label={voiceLabel}
          disabled={disabled || loading}
        />
      }
    >
      <div
        className={`flex justify-center py-2 ${className}`}
        onFocus={handleFocus}
      >
        <Turnstile
          key={`${fieldKey}-turnstile-${captchaZone?.captchaInstanceKey || 0}`}
          sitekey={siteKey}
          onVerify={handleVerify}
          onExpire={handleExpire}
          onError={handleError}
          className={turnstileClassName}
        />
      </div>
    </GuidedFieldWrapper>
  );
}