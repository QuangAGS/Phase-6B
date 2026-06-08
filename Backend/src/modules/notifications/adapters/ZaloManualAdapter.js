/**
 * PATH:
 * backend/src/modules/notifications/adapters/ZaloManualAdapter.js
 *
 * PURPOSE:
 * - EGAL-25 Sprint 25.0
 * - Personal Zalo manual-assisted adapter
 * - No unofficial Zalo API
 * - No automation
 *
 * DOCTRINE:
 * Zalo Personal = manual-assisted.
 * Humans communicate.
 * System assists.
 */

const BaseAdapter = require('./BaseAdapter');

class ZaloManualAdapter extends BaseAdapter {
  constructor(options = {}) {
    super({
      ...options,
      channel: 'ZALO',
      provider: options.provider || 'ZALO_PZ_MANUAL',
    });

    this.adminPhone =
      options.adminPhone || null;

    this.zaloBaseUrl =
      options.zaloBaseUrl || 'https://zalo.me';
  }

  /**
   * Zalo manual adapter does not require automated externalId.
   * It requires enough context to prepare an operator action.
   */
  canSend(payload = {}) {
    const baseResult = super.canSend(payload);

    if (!baseResult.ok) {
      return baseResult;
    }

    return {
      ok: true,
      reason: null,
    };
  }

  /**
   * Create a copy-ready message for manual Zalo communication.
   */
  buildManualMessage(payload = {}) {
    const notification = payload.notification || {};
    const user = payload.user || {};

    const userName =
      user.name ||
      user.full_name ||
      user.email ||
      user.phone ||
      'người dùng myClan';

    const title =
      notification.title ||
      'Thông báo từ myClan';

    const content =
      notification.content ||
      'Hệ thống có thông báo mới.';

    return [
      'Xin chào,',
      '',
      `myClan có thông báo cho ${userName}:`,
      '',
      `Tiêu đề: ${title}`,
      `Nội dung: ${content}`,
      '',
      'Tin nhắn này được chuẩn bị tự động để Ban Quản trị gửi qua Zalo.'
    ].join('\n');
  }

  /**
   * Build optional Zalo deep link for admin/user.
   *
   * Note:
   * Zalo deep-link behavior may depend on device/app.
   * This is assistance only, not guaranteed delivery.
   */
  buildZaloLink(phone = null) {
    const targetPhone =
      phone || this.adminPhone;

    if (!targetPhone) return null;

    return `${this.zaloBaseUrl}/${targetPhone}`;
  }

  /**
   * Sprint 25.0:
   * No real sending.
   * Return MANUAL_REQUIRED with assistant payload.
   */
  async send(payload = {}) {
    const canSendResult = this.canSend(payload);

    if (!canSendResult.ok) {
      return this.failure(
        canSendResult.reason,
        {
          status: 'FAILED',
        }
      );
    }

    const user = payload.user || {};

    const manualMessage =
      this.buildManualMessage(payload);

    const zaloLink =
      this.buildZaloLink(
        user.phone || null
      );

    return this.success({
      status: 'MANUAL_REQUIRED',
      externalId: null,
      recipient:
        user.phone || payload.delivery?.recipient || null,
      message:
        'Zalo Personal requires manual-assisted delivery.',
      manualNote:
        'Admin must copy/send this message via Personal Zalo.',
      rawResponse: {
        source: 'ZALO_MANUAL_ADAPTER',
        mode: 'MANUAL_ASSISTED',
        zaloLink,
        manualMessage,
      },
    });
  }

  async healthCheck() {
    return {
      ok: this.enabled,
      channel: this.channel,
      provider: this.provider,
      adapter: this.constructor.name,
      mode: 'MANUAL_ASSISTED',
      automation: false,
    };
  }
}

module.exports = ZaloManualAdapter;