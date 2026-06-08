/**
 * PATH:
 * backend/src/modules/notifications/adapters/InAppAdapter.js
 *
 * PURPOSE:
 * - EGAL-25 Sprint 25.0
 * - In-app notification adapter
 * - No external provider
 * - No network call
 *
 * DOCTRINE:
 * In-app notification is canonical.
 * External channels deliver.
 * myClan remembers.
 */

const BaseAdapter = require('./BaseAdapter');

class InAppAdapter extends BaseAdapter {
  constructor(options = {}) {
    super({
      ...options,
      channel: 'IN_APP',
      provider: options.provider || 'IN_APP',
    });
  }

  /**
   * In-app delivery means:
   * notification already exists in DB
   * and is available to the user in Notification Center.
   *
   * Sprint 25.0:
   * return success response only.
   * Delivery status update will be handled by worker/service later.
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

    return this.success({
      status: 'SENT',
      externalId: null,
      message:
        'Notification is available in-app.',
      rawResponse: {
        source: 'IN_APP_ADAPTER',
        deliveredBy: 'DATABASE',
      },
    });
  }

  /**
   * In-app adapter is healthy if enabled.
   */
  async healthCheck() {
    return {
      ok: this.enabled,
      channel: this.channel,
      provider: this.provider,
      adapter: this.constructor.name,
      mode: 'DATABASE_ONLY',
    };
  }
}

module.exports = InAppAdapter;