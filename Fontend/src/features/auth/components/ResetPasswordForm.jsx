/**
 * PATH: src/features/auth/components/ResetPasswordForm.jsx
 * DATETIME: 2026-04-28T12:00:00+07:00
 * VERSION: 20.1.0
 * DESCRIPTION: 
 * - Phase 2: Thiết kế ResetPasswordForm theo Mobile-first, thêm honeypot + Turnstile.
 * - Hỗ trợ hai luồng nghiệp vụ: JoinClan (ưu tiên Phone) và CreateClan (Email).
 * - Bảo tồn style chung của dự án, logic cũ (Q1).
 * - Tuân thủ Q2.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, KeyRound, CheckCircle2, Loader2, AlertCircle, Phone, Mail } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import Turnstile from 'react-turnstile';
import { useTts } from '../../a11y/tts/useTts.js';
import AttentionZone from '../../a11y/attention/AttentionZone.jsx';

const ResetPasswordForm = ({ email }) => {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
    const { speakError } = useTts();

    /**
     * <2026-05-15T18:00:00+07:00>
     * EGAL-6.6.4:
     * Stable critical error speech for legacy ResetPasswordForm.
     *
     * Q1/Q2 safe:
     * - no reset-password business logic change
     * - no API/payload change
     */
    const speakCriticalError = (message) => {
      if (!message) return;

      requestAnimationFrame(() => {
        speakError(message);
      });
    };

  const [formData, setFormData] = useState({ 
    identifier: email || '',   // Hỗ trợ cả email và phone
    otp: '', 
    newPassword: '', 
    confirmPassword: '',
    hp_field: '' 
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.newPassword !== formData.confirmPassword) {
      const message = 'Mật khẩu xác nhận không khớp.';

      setError(message);
      speakCriticalError(message);

      return;
    }
    if (!captchaToken) {
      const message = 'Đảm bảo ô vuông đã được đánh dấu xanh trước khi tiếp tục.';

      setError(message);
      speakCriticalError(message);

      return;
    }
    if (formData.hp_field) {
      const message = 'Hành vi đáng ngờ. Vui lòng thử lại.';

      setError(message);
      speakCriticalError(message);

      return;
    }

    setLoading(true);
    setError('');

    try {
      await resetPassword({
        identifier: formData.identifier,
        otp: formData.otp,
        newPassword: formData.newPassword
      });
      navigate('/tree');
    } catch (err) {
        const message =
          err.response?.data?.message ||
          'Mã OTP không hợp lệ hoặc lỗi hệ thống.';

        setError(message);
        speakCriticalError(message);
      } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-800 underline decoration-green-500 decoration-4 underline-offset-8">
          Đặt mật khẩu mới
        </h2>
        <p className="mt-6 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
          Nhập mã OTP đã gửi qua {formData.identifier.includes('@') ? 'Email' : 'Số điện thoại'}
        </p>
      </div>

      {error && (
        <AttentionZone
          active={!!error}
          priority="high"
          role="alert"
          ariaLive="assertive"
          autoScroll
          autoFocus
          flash
          lock
          recoveryKey="reset-password-error"
          className="flex items-center gap-2 border-rose-100 bg-rose-50 text-rose-600"
          data-testid="reset-password-attention-error"
        >
          <AlertCircle size={16} className="shrink-0" />
          <span className="text-[11px] font-black uppercase">{error}</span>
        </AttentionZone>
      )}

      <div className="space-y-4">
        <div className="relative">
          {formData.identifier.includes('@') ? (
            <Mail className="absolute left-5 top-4 text-green-500" size={18} />
          ) : (
            <Phone className="absolute left-5 top-4 text-green-500" size={18} />
          )}
          <input
            type="text"
            name="identifier"
            placeholder="Email hoặc Số điện thoại"
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-[20px] font-bold text-slate-800 focus:ring-2 focus:ring-green-500 shadow-sm outline-none"
            value={formData.identifier}
            onChange={handleChange}
            required
          />
        </div>

        <div className="relative">
          <KeyRound className="absolute left-5 top-4 text-green-500" size={18} />
          <input
            type="text"
            name="otp"
            maxLength="6"
            placeholder="Mã OTP 6 số (*)"
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-[20px] font-black text-center text-xl tracking-[10px] text-slate-800 focus:ring-2 focus:ring-green-500 shadow-sm outline-none placeholder:tracking-normal placeholder:text-sm placeholder:font-bold"
            value={formData.otp}
            onChange={handleChange}
            required
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-5 top-4 text-slate-400" size={18} />
          <input
            type="password"
            name="newPassword"
            placeholder="Mật khẩu mới (*)"
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-[20px] font-bold text-slate-800 focus:ring-2 focus:ring-green-500 shadow-sm outline-none"
            value={formData.newPassword}
            onChange={handleChange}
            required
          />
        </div>

        <div className="relative">
          <CheckCircle2 className="absolute left-5 top-4 text-slate-400" size={18} />
          <input
            type="password"
            name="confirmPassword"
            placeholder="Xác nhận mật khẩu (*)"
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-[20px] font-bold text-slate-800 focus:ring-2 focus:ring-green-500 shadow-sm outline-none"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
          />
        </div>

        {/* Honeypot field */}
        <input
          type="text"
          name="hp_field"
          value={formData.hp_field}
          onChange={handleChange}
          tabIndex="-1"
          autoComplete="off"
          className="hidden"
        />

        <div className="flex justify-center py-2">
          <Turnstile
            sitekey={import.meta.env.VITE_TURNSTILE_SITE_KEY || "your-turnstile-sitekey"}
            onVerify={setCaptchaToken}
            className="mx-auto"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !captchaToken}
        className="w-full py-4 bg-slate-900 text-white rounded-[20px] font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="animate-spin" size={20} /> : <>Xác nhận thay đổi <CheckCircle2 size={20} /></>}
      </button>
    </form>
  );
};

export default ResetPasswordForm;