/**
 * PATH:
 * backend/src/modules/notifications/adapters/WhatsAppAdapter.js
 *
 * PURPOSE:
 * - EGAL-25 Sprint 25.0
 * - WhatsApp delivery adapter contract
 * - Placeholder only
 * - Future-ready for Meta Business API or manual-assisted WhatsApp
 *
 * DOCTRINE:
 * WhatsApp = international convenience channel.
 * Not core dependency.
 * Adapters deliver.
 * Policy decides.
 */

const BaseAdapter = require('./BaseAdapter');

class WhatsAppAdapter extends BaseAdapter {
  constructor(options = {}) {
    super({
      ...options,
      channel: 'WHATSAPP',
      provider: options.provider || 'WHATSAPP_PLACEHOLDER',
    });

    this.mode =
      options.mode || 'PLACEHOLDER_ONLY';

    this.businessApiEnabled =
      options.businessApiEnabled === true;
  }

  /**
   * Validate WhatsApp-specific payload.
   *
   * Sprint 25.0:
   * recipient can come from:
   * - delivery.recipient
   * - payload.recipient
   * - user.whatsapp_number
   * - user.phone
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
      payload.user?.whatsapp_number ||
      payload.user?.phone ||
      payload.binding?.external_id ||
      null;

    if (!recipient) {
      return {
        ok: false,
        reason: 'WHATSAPP_RECIPIENT_REQUIRED',
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
      title,
      '',
      content,
    ].join('\n');
  }

  /**
   * Sprint 25.0:
   * No real WhatsApp API call.
   *
   * Future options:
   * - Meta WhatsApp Business API
   * - manual-assisted WhatsApp
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
      payload.user?.whatsapp_number ||
      payload.user?.phone ||
      payload.binding?.external_id;

    const message =
      this.buildMessage(payload);

    return this.success({
      status: 'SENT',
      externalId: null,
      recipient,
      message:
        'WhatsApp placeholder delivery accepted.',
      rawResponse: {
        source: 'WHATSAPP_ADAPTER',
        mode: this.mode,
        businessApiEnabled: this.businessApiEnabled,
        recipient,
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
      mode: this.mode,
      businessApiEnabled: this.businessApiEnabled,
      automation: this.businessApiEnabled,
    };
  }
}

module.exports = WhatsAppAdapter;