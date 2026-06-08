/**
 * PATH       : src/features/auth/components/LoginForm.jsx
 * DATETIME   : 2026-05-08T09:22:00+07:00
 * VERSION    : 23.0.1
 * DESCRIPTION:
 * - Chuẩn hóa LoginForm để chỉ render theo lockoutInfo từ backend
 * - Loại bỏ suy luận BI_CAM / BI_KHOA đặc biệt trong frontend
 * - Bảo tồn hoàn toàn UI/UX của V21.6.12
 * - Tuân thủ Q1 & Q2
 */

import { useState, useEffect } from 'react';
import {
  Loader2, Eye, EyeOff, AlertCircle, Clock, HelpCircle
} from 'lucide-react';
import Turnstile from 'react-turnstile';

/**
 * <2026-05-11T00:00:00+07:00>
 * Sprint 4:
 * Import Frontend Accessibility TTS components.
 * - Không ảnh hưởng login logic hiện có.
 */
import AudioHelpButton from '../../a11y/tts/AudioHelpButton';
import { ttsMessages } from '../../a11y/tts/ttsMessages';

const LoginForm = ({
  onSubmitLogin,
  toggleAuthMode,
  onForgotPassword,
  loading = false,
  message = '',
  lockoutInfo = {},
  successMessage = '',
  userStatus = '',
}) => {
  const debugMode = import.meta.env.DEV || import.meta.env.VITE_DEBUG_MODE === 'true';

  const [formData, setFormData] = useState({ identifier: '', password: '', hp_field: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);

  const [localLockInfo, setLocalLockInfo] = useState({
    isLocked: false,
    minutesLeft: 0,
    isPermanent: false,
    lockType: 'NONE',
    reasonCode: '',
  });

  /**
   * <2026-05-08T09:22:00+07:00>
   * LoginForm chỉ render theo dữ liệu lockoutInfo đã được backend kết luận.
   * Không suy luận BI_CAM / BI_KHOA ở frontend nữa.
   */
  useEffect(() => {
    const isAccountLocked = lockoutInfo.code === 'ACCOUNT_LOCKED';
    const isPermanent = isAccountLocked && lockoutInfo.isPermanent === true;
    const minutesLeft = isAccountLocked ? (lockoutInfo.minutesLeft || 15) : 0;
    const lockType = lockoutInfo.lockType || 'NONE';
    const reasonCode = lockoutInfo.reasonCode || '';

    setLocalLockInfo({
      isLocked: isAccountLocked,
      minutesLeft,
      isPermanent,
      lockType,
      reasonCode,
    });
  }, [lockoutInfo]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (localLockInfo.isLocked) return;

    if (formData.hp_field && formData.hp_field.trim().length > 0) {
      alert('Hành vi đáng ngờ. Vui lòng thử lại.');
      return;
    }

    onSubmitLogin({
      identifier: formData.identifier,
      password: formData.password,
      turnstileToken: captchaToken,
      hp_field: formData.hp_field,
    });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const isLocked = localLockInfo.isLocked;
  const canSubmit = debugMode || !!captchaToken;

  /**
   * <2026-05-08T09:22:00+07:00>
   * Ưu tiên message từ AuthPage nếu có; nếu không thì fallback theo localLockInfo.
   */
  const displayMessage = message || (
    isLocked
      ? (
          localLockInfo.isPermanent
            ? 'Tài khoản bị cấm. Xin vui lòng liên hệ trực tiếp để được hỗ trợ.'
            : `Tài khoản tạm khóa. Vui lòng thử lại sau ${localLockInfo.minutesLeft} phút.`
        )
      : ''
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-black text-slate-900">Đăng nhập</h2>
        <p className="text-slate-500 mt-2">Chào mừng bạn trở lại với Gia Phả Số 2026</p>

        {/* 
          <2026-05-11T00:00:00+07:00>
          Sprint 4:
          Audio help button for elderly-friendly UX.
          - User-triggered only.
          - No auto-read.
          - No impact to existing login flow.
        */}
        <div className="mt-4 flex justify-center">
          <AudioHelpButton
            text={ttsMessages.login.help}
            label="Nghe hướng dẫn"
            variant="soft"
          />
        </div>
      </div>

      {debugMode && (
        <div className="debug-bar text-[10px] p-3 bg-amber-100 border border-amber-300 text-amber-700 rounded-2xl text-center">
          🧪 DEBUG MODE ACTIVE — Turnstile bypassed
        </div>
      )}

      {(displayMessage || isLocked) && (
        <div
          className={`p-4 rounded-2xl text-sm font-medium flex items-start gap-3 ${
            localLockInfo.isPermanent
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-rose-50 text-rose-700 border border-rose-100'
          }`}
        >
          <AlertCircle className="mt-0.5 flex-shrink-0" size={20} />
          <div>{displayMessage}</div>
        </div>
      )}

      {successMessage && userStatus === 'CHO_DUYET' && (
        <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100">
          <Clock className="inline mr-2" size={18} />
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Số điện thoại / Email
          </label>
          <input
            type="text"
            name="identifier"
            value={formData.identifier}
            onChange={handleChange}
            className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
            placeholder="Nhập số điện thoại hoặc email"
            required
            disabled={isLocked}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Mật khẩu
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
              placeholder="Nhập mật khẩu"
              required
              disabled={isLocked}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              disabled={isLocked}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        <input
          type="text"
          name="hp_field"
          value={formData.hp_field}
          onChange={handleChange}
          className="hidden"
          tabIndex="-1"
        />

        <div className="flex justify-center py-2">
          <Turnstile
            sitekey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
            onVerify={setCaptchaToken}
            className="mx-auto"
          />
        </div>

        <button
          type="submit"
          disabled={loading || isLocked || !canSubmit}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-2xl font-black text-base transition-all active:scale-[0.985]"
        >
          {isLocked && localLockInfo.isPermanent
            ? 'Tài khoản bị cấm'
            : isLocked
              ? `Tạm khóa (${localLockInfo.minutesLeft} phút)`
              : loading
                ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin" size={20} /> Đang đăng nhập...
                    </span>
                  )
                : 'Đăng nhập'}
        </button>
      </form>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onForgotPassword}
          className="flex items-center gap-1 text-blue-600 hover:underline font-medium"
          disabled={isLocked}
        >
          <HelpCircle size={16} /> Quên mật khẩu?
        </button>
      </div>

      <div className="text-center text-sm text-slate-500">
        Chưa có tài khoản?{' '}
        <span onClick={toggleAuthMode} className="cursor-pointer font-black text-blue-600 hover:underline">
          Đăng ký ngay
        </span>
      </div>
    </div>
  );
};

export default LoginForm;