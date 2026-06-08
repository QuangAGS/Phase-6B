/**
 * PATH:
 * backend/src/modules/notifications/adapters/BaseAdapter.js
 *
 * PURPOSE:
 * - EGAL-25 Sprint 25.0
 * - Base contract for all notification delivery adapters
 * - No real provider logic here
 *
 * DOCTRINE:
 * Adapters deliver.
 * Policy decides.
 * Orchestrator coordinates.
 */

class BaseAdapter {
  constructor(options = {}) {
    this.channel = options.channel || null;
    this.provider = options.provider || null;
    this.enabled = options.enabled !== false;
  }

  /**
   * Validate minimal delivery payload.
   */
  validateDeliveryPayload(payload = {}) {
    if (!payload.delivery) {
      throw new Error(
        `[${this.constructor.name}]: delivery is required`
      );
    }

    if (!payload.notification) {
      throw new Error(
        `[${this.constructor.name}]: notification is required`
      );
    }

    return true;
  }

  /**
   * Validate whether adapter can send.
   *
   * Child adapters may override this.
   */
  canSend(payload = {}) {
    if (!this.enabled) {
      return {
        ok: false,
        reason: 'ADAPTER_DISABLED',
      };
    }

    try {
      this.validateDeliveryPayload(payload);

      return {
        ok: true,
        reason: null,
      };
    } catch (error) {
      return {
        ok: false,
        reason: error.message,
      };
    }
  }

  /**
   * Send message.
   *
   * Must be implemented by child adapter.
   */
  async send() {
    throw new Error(
      `[${this.constructor.name}]: send() must be implemented`
    );
  }

  /**
   * Health check.
   *
   * Sprint 25.0:
   * Skeleton only.
   */
  async healthCheck() {
    return {
      ok: this.enabled,
      channel: this.channel,
      provider: this.provider,
      adapter: this.constructor.name,
    };
  }

  /**
   * Normalize success response.
   */
  success(data = {}) {
    return {
      ok: true,
      adapter: this.constructor.name,
      channel: this.channel,
      provider: this.provider,
      ...data,
    };
  }

  /**
   * Normalize failure response.
   */
  failure(error, data = {}) {
    return {
      ok: false,
      adapter: this.constructor.name,
      channel: this.channel,
      provider: this.provider,
      error:
        error instanceof Error
          ? error.message
          : String(error || 'Unknown adapter error'),
      ...data,
    };
  }
}

module.exports = BaseAdapter;