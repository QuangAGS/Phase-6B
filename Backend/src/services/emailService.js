/**
 * PATH       : backend/src/services/emailService.js
 * DATETIME   : 2026-05-12T00:00:00+07:00
 * VERSION    : 2.0.0
 * DESCRIPTION:
 * - Chuyển email service từ Nodemailer SMTP sang Brevo Transactional Email API.
 * - Giữ nguyên API public sendOTP(toEmail, otp) để bảo toàn authService hiện có.
 * - Sử dụng ENV:
 *   BREVO_API_KEY
 *   BREVO_FROM_EMAIL
 *   BREVO_FROM_NAME
 * - Không phụ thuộc SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS.
 * - Tuân thủ Q1/Q2.
 */


const securityConfig = require('../config/securityConfig');
const BREVO_SEND_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * <2026-05-12T00:00:00+07:00>
 * getBrevoConfig:
 * - Đọc cấu hình Brevo từ ENV.
 * - Không log API key.
 */
function getBrevoConfig() {
  return {
    apiKey: securityConfig.BREVO_API_KEY,
    fromEmail: securityConfig.BREVO_FROM_EMAIL || 'noreply@myclan.com.vn',
    fromName: securityConfig.BREVO_FROM_NAME || 'Thông báo từ MyClan',
  };
}

/**
 * <2026-05-12T00:00:00+07:00>
 * assertBrevoConfig:
 * - Kiểm tra cấu hình bắt buộc.
 * - Báo lỗi rõ ràng nếu thiếu ENV.
 */
function assertBrevoConfig(config) {
  if (!config.apiKey) {
    const err = new Error('BREVO_API_KEY is not configured');
    err.code = 'BREVO_API_KEY_MISSING';
    throw err;
  }

  if (!config.fromEmail) {
    const err = new Error('BREVO_FROM_EMAIL is not configured');
    err.code = 'BREVO_FROM_EMAIL_MISSING';
    throw err;
  }
}

/**
 * <2026-05-12T00:00:00+07:00>
 * buildOtpEmailHtml:
 * - Tạo HTML email OTP.
 * - Không chứa logic gửi email.
 */
function buildOtpEmailHtml(otp) {
  return `
    <div style="
      font-family: Arial, Helvetica, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      padding: 24px;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      background: #ffffff;
    ">
      <div style="text-align:center; margin-bottom: 24px;">
        <h1 style="
          margin: 0;
          font-size: 28px;
          color: #2563eb;
        ">
          MyClan
        </h1>

        <p style="
          margin-top: 8px;
          color: #64748b;
          font-size: 14px;
        ">
          Hệ thống Quản lý Gia phả
        </p>
      </div>

      <h2 style="
        color: #0f172a;
        margin-bottom: 16px;
      ">
        Xác thực đổi mật khẩu
      </h2>

      <p style="
        color: #334155;
        line-height: 1.7;
      ">
        Bạn vừa yêu cầu đổi mật khẩu cho tài khoản MyClan.
      </p>

      <p style="
        color: #334155;
        line-height: 1.7;
      ">
        Mã xác thực của bạn là:
      </p>

      <div style="
        background: #f1f5f9;
        border-radius: 12px;
        padding: 20px;
        text-align: center;
        margin: 24px 0;
      ">
        <span style="
          font-size: 36px;
          font-weight: bold;
          letter-spacing: 8px;
          color: #1e293b;
        ">
          ${otp}
        </span>
      </div>

      <p style="
        color: #475569;
        line-height: 1.7;
      ">
        Mã này sẽ hết hạn sau <strong>10 phút</strong>.
      </p>

      <p style="
        color: #475569;
        line-height: 1.7;
      ">
        Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.
      </p>

      <hr style="
        border: none;
        border-top: 1px solid #e2e8f0;
        margin: 32px 0;
      ">

      <p style="
        color: #94a3b8;
        font-size: 12px;
        text-align: center;
        line-height: 1.6;
      ">
        Email tự động từ hệ thống MyClan.<br/>
        Vui lòng không trả lời email này.
      </p>
    </div>
  `;
}

/**
 * <2026-05-12T00:00:00+07:00>
 * sendBrevoTransactionalEmail:
 * - Gửi email qua Brevo API.
 * - Dùng fetch native của Node 18+.
 */
async function sendBrevoTransactionalEmail(payload) {
  const config = getBrevoConfig();
  assertBrevoConfig(config);

  const response = await fetch(BREVO_SEND_EMAIL_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': config.apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();

  let responseBody = null;
  try {
    responseBody = responseText ? JSON.parse(responseText) : null;
  } catch (err) {
    responseBody = { raw: responseText };
  }

  if (!response.ok) {
    const error = new Error(
      responseBody?.message ||
        responseBody?.error ||
        `Brevo API failed with status ${response.status}`
    );

    error.code = 'BREVO_API_SEND_FAILED';
    error.status = response.status;
    error.response = responseBody;

    throw error;
  }

  return responseBody;
}

const emailService = {
  /**
   * <2026-05-12T00:00:00+07:00>
   * sendOTP:
   * - Public API giữ nguyên để bảo toàn authService.
   * - Gửi mã OTP qua Brevo Transactional Email API.
   */
  sendOTP: async (toEmail, otp) => {
    const config = getBrevoConfig();
    assertBrevoConfig(config);

    const payload = {
      sender: {
        name: config.fromName,
        email: config.fromEmail,
      },
      to: [
        {
          email: toEmail,
        },
      ],
      subject: 'Mã xác thực đổi mật khẩu',
      htmlContent: buildOtpEmailHtml(otp),
    };

    const result = await sendBrevoTransactionalEmail(payload);

    console.log('[EmailService] Brevo OTP email sent:', {
      toEmail,
      messageId: result?.messageId || result?.messageIds || null,
    });

    return result;
  },
};

module.exports = emailService;