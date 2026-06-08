/**
 * PATH:
 * backend/src/modules/notifications/adapters/EmailAdapter.js
 *
 * PURPOSE:
 * - EGAL-25 Sprint 25.0
 * - Email delivery adapter contract
 * - Placeholder only, no real SMTP/API sending yet
 *
 * DOCTRINE:
 * Email is official communication.
 * Adapters deliver.
 * Policy decides.
 */

const BaseAdapter = require('./BaseAdapter');

class EmailAdapter extends BaseAdapter {
  constructor(options = {}) {
    super({
      ...options,
      channel: 'EMAIL',
      provider: options.provider || 'EMAIL_PLACEHOLDER',
    });
  }

  /**
   * Validate email-specific payload.
   */
  canSend(payload = {}) {
    const baseResult = super.canSend(payload);

    if (!baseResult.ok) {
      return baseResult;
    }

    const recipient =
      payload.delivery?.recipient ||
      payload.recipient ||
      payload.user?.email ||
      null;

    if (!recipient) {
      return {
        ok: false,
        reason: 'EMAIL_RECIPIENT_REQUIRED',
      };
    }

    return {
      ok: true,
      reason: null,
    };
  }

  /**
   * Sprint 25.0:
   * No real email sending.
   * Return placeholder success so worker can mark it later if desired.
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
      payload.user?.email;

    return this.success({
      status: 'SENT',
      externalId: null,
      recipient,
      message:
        'Email placeholder delivery accepted.',
      rawResponse: {
        source: 'EMAIL_ADAPTER',
        mode: 'PLACEHOLDER_ONLY',
        provider: this.provider,
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
    };
  }
}

module.exports = EmailAdapter;