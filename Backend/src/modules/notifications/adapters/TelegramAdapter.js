/**
 * PATH:
 * backend/src/modules/notifications/adapters/TelegramAdapter.js
 *
 * PURPOSE:
 * - EGAL-25 Sprint 25.0
 * - Telegram delivery adapter contract
 * - Placeholder only, no real Telegram Bot API call yet
 *
 * DOCTRINE:
 * Telegram = automation-friendly.
 * Adapters deliver.
 * Policy decides.
 */

const BaseAdapter = require('./BaseAdapter');

class TelegramAdapter extends BaseAdapter {
  constructor(options = {}) {
    super({
      ...options,
      channel: 'TELEGRAM',
      provider: options.provider || 'TELEGRAM_PLACEHOLDER',
    });

    this.botName =
      options.botName || '@myClan_bot';
  }

  /**
   * Validate Telegram-specific payload.
   *
   * Sprint 25.0:
   * recipient/chatId can come from:
   * - delivery.recipient
   * - payload.recipient
   * - user.telegram_chat_id
   * - binding.external_id
   */
  canSend(payload = {}) {
    const baseResult = super.canSend(payload);

    if (!baseResult.ok) {
      return baseResult;
    }

    const recipient =
      payload.delivery?.recipient ||
      payload.recipient ||
      payload.user?.telegram_chat_id ||
      payload.binding?.external_id ||
      null;

    if (!recipient) {
      return {
        ok: false,
        reason: 'TELEGRAM_CHAT_ID_REQUIRED',
      };
    }

    return {
      ok: true,
      reason: null,
    };
  }

  buildMessage(payload = {}) {
    const notification = payload.notification || {};

    const title =
      notification.title ||
      'Thông báo từ myClan';

    const content =
      notification.content ||
      'Hệ thống có thông báo mới.';

    return [
      `📌 ${title}`,
      '',
      content,
    ].join('\n');
  }

  /**
   * Sprint 25.0:
   * No real Telegram API call.
   * Return placeholder success.
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

    const recipient =
      payload.delivery?.recipient ||
      payload.recipient ||
      payload.user?.telegram_chat_id ||
      payload.binding?.external_id;

    const message =
      this.buildMessage(payload);

    return this.success({
      status: 'SENT',
      externalId: null,
      recipient,
      message:
        'Telegram placeholder delivery accepted.',
      rawResponse: {
        source: 'TELEGRAM_ADAPTER',
        mode: 'PLACEHOLDER_ONLY',
        botName: this.botName,
        chatId: recipient,
        message,
      },
    });
  }

  async healthCheck() {
    return {
      ok: this.enabled,
      channel: this.channel,
      provider: this.provider,
      adapter: this.constructor.name,
      mode: 'PLACEHOLDER_ONLY',
      botName: this.botName,
      automation: true,
    };
  }
}

module.exports = TelegramAdapter;