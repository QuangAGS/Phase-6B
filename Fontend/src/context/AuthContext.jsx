/**
 * PATH: src/context/AuthContext.jsx
 * DATETIME: 2026-05-01T18:00:00+07:00
 * VERSION: 20.2.0
 * DESCRIPTION: 
 * - Phase 20.2.0: Normalize lỗi 423 với isPermanent.
 * - Bảo tồn toàn bộ logic cũ (Q1).
 * - Tuân thủ Q2 (comment <dateTime>).
 */

import { createContext, useContext, useEffect, useState } from 'react';
import apiClient from '../lib/axios.js';

const AuthContext = createContext();

/**
 * <2026-05-01> NORMALIZE ERROR TỪ BACKEND (hỗ trợ 423 isPermanent)
 */
const normalizeAuthError = (err) => {
  const responseStatus = err?.response?.status;
  const serverError = err?.response?.data || {};

  let normalizedCode = serverError?.code || '';

  if (responseStatus === 423) normalizedCode = 'ACCOUNT_LOCKED';
  else if (responseStatus === 401) normalizedCode = 'INVALID_AUTH';
  else if (responseStatus === 429) normalizedCode = 'RATE_LIMITED';
  else if (responseStatus === 403) normalizedCode = 'FORBIDDEN';
  else normalizedCode = 'UNKNOWN_ERROR';

  const customError = new Error(serverError?.error || serverError?.message || 'Không thể kết nối tới máy chủ.');
  customError.code = normalizedCode;
  customError.status = responseStatus;
  customError.remainingAttempts = serverError.remainingAttempts || 0;
  customError.minutesLeft = serverError.minutesLeft || 0;
  customError.isPermanent = serverError.isPermanent || false;

  return customError;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * <2026-04-28> VERIFY TOKEN KHI MỞ APP
   */
  useEffect(() => {
    const verify = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await apiClient.get('/auth/me');
        setUser(res.data?.user || null);
      } catch (err) {
        logout();
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, []);

  /**
   * <2026-05-01> LOGIN
   */
  const login = async (loginData) => {
    console.log('[AuthContext] Login payload:', loginData);
    try {
      const res = await apiClient.post('/auth/login', loginData);
      console.log('[AuthContext] Login success');
      const data = res.data?.data || res.data;
      localStorage.setItem('token', data.token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      console.error('[AuthContext] Login failed:', err?.response?.data);
      throw normalizeAuthError(err);
    }
  };

  /**
   * <2026-04-28> REGISTER
   */
  const register = async (payload) => {
    console.log('[AuthContext] Register payload received:', payload);
    console.log('[AuthContext] turnstileToken length:', payload.turnstileToken?.length || 0);

    try {
      const res = await apiClient.post('/auth/register', payload);
      console.log('[AuthContext] Register success');
      return res.data;
    } catch (err) {
      console.error('[AuthContext] Register failed:', err?.response?.data || err);
      throw normalizeAuthError(err);
    }
  };

    /**
   * <2026-05-12T00:00:00+07:00>
   * Sprint 6e - Forgot Password Flow v2: REQUEST RESET CODE
   * - Endpoint mới: POST /auth/forgot-password
   * - Payload mới: { identifier, turnstileToken, hp_field }
   * - Bảo tồn Q1: Không thay đổi login/register/logout/verify token hiện có.
   * - Backend trả generic message để tránh lộ thông tin tài khoản.
   */
  const forgotPassword = async (payload) => {
    console.log('[AuthContext] ForgotPassword payload received:', {
      identifier: payload?.identifier,
      hasTurnstileToken: !!payload?.turnstileToken,
      hasHpField: !!payload?.hp_field,
    });

    try {
      const res = await apiClient.post('/auth/forgot-password', payload);
      console.log('[AuthContext] ForgotPassword request success');
      return res.data;
    } catch (err) {
      console.error('[AuthContext] ForgotPassword request failed:', err?.response?.data || err);
      throw normalizeAuthError(err);
    }
  };

  /**
   * <2026-05-12T00:00:00+07:00>
   * Sprint 6e - Forgot Password Flow v2: VERIFY RESET CODE
   * - Endpoint mới: POST /auth/verify-reset-code
   * - Payload: { identifier, otp, turnstileToken, hp_field }
   * - Trả về resetToken/resetSessionId tùy backend.
   * - Bảo tồn Q1: Chỉ thêm API wrapper, không đổi flow stable khác.
   */
  const verifyResetCode = async (payload) => {
    console.log('[AuthContext] VerifyResetCode payload received:', {
      identifier: payload?.identifier,
      hasOtp: !!payload?.otp,
      hasTurnstileToken: !!payload?.turnstileToken,
      hasHpField: !!payload?.hp_field,
    });

    try {
      const res = await apiClient.post('/auth/verify-reset-code', payload);
      console.log('[AuthContext] VerifyResetCode success');
      return res.data?.data || res.data;
    } catch (err) {
      console.error('[AuthContext] VerifyResetCode failed:', err?.response?.data || err);
      throw normalizeAuthError(err);
    }
  };

  /**
   * <2026-05-12T00:00:00+07:00>
   * Sprint 6e - Forgot Password Flow v2: CHANGE PASSWORD AFTER RESET
   * - Endpoint mới: POST /auth/change-password-after-reset
   * - Payload: { identifier, resetToken, newPassword, hp_field }
   * - Không thay đổi API /auth/reset-password cũ ở bước này.
   * - Bảo tồn Q1: Chỉ bổ sung function mới cho flow mới.
   */
  const changePasswordAfterReset = async (payload) => {
    console.log('[AuthContext] ChangePasswordAfterReset payload received:', {
      identifier: payload?.identifier,
      hasResetToken: !!payload?.resetToken,
      hasNewPassword: !!payload?.newPassword,
      hasHpField: !!payload?.hp_field,
    });

    try {
      const res = await apiClient.post('/auth/change-password-after-reset', payload);
      console.log('[AuthContext] ChangePasswordAfterReset success');
      return res.data;
    } catch (err) {
      console.error('[AuthContext] ChangePasswordAfterReset failed:', err?.response?.data || err);
      throw normalizeAuthError(err);
    }
  };

  /**
   * <2026-04-28> LOGOUT
   */
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('tenantId');
    setUser(null);
  };

    return (
      <AuthContext.Provider
        value={{
          user,
          loading,
          login,
          register,
          logout,

          /**
           * <2026-05-12T00:00:00+07:00>
           * Sprint 6e:
           * Export forgot password flow v2 handlers.
           * - Không thay thế login/register/logout hiện có.
           */
          forgotPassword,
          verifyResetCode,
          changePasswordAfterReset,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};