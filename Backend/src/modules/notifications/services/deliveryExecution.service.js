/**
 * PATH:
 * backend/src/modules/notifications/services/deliveryExecution.service.js
 *
 * PURPOSE:
 * - EGAL-25 Sprint 25.0
 * - Execute delivery through adapter registry
 * - Update notification_deliveries status
 *
 * DOCTRINE:
 * Orchestrator coordinates.
 * Service executes.
 * Adapter delivers.
 * Repository persists.
 */

const adapterRegistry = require('../adapters');
const deliveryRepository = require(
  '../repository/delivery.repository'
);

class DeliveryExecutionService {
  /**
   * Execute one delivery record.
   *
   * Required payload:
   * {
   *   delivery,
   *   notification,
   *   user?,
   *   binding?
   * }
   */
  async executeOne({
    delivery,
    notification,
    user = null,
    binding = null,
    currentUser = null,
  }) {
    if (!delivery) {
      throw new Error(
        '[deliveryExecutionService.executeOne]: delivery is required'
      );
    }

    if (!notification) {
      throw new Error(
        '[deliveryExecutionService.executeOne]: notification is required'
      );
    }

    if (!delivery.channel) {
      throw new Error(
        '[deliveryExecutionService.executeOne]: delivery.channel is required'
      );
    }

    const adapter =
      adapterRegistry.createAdapter(
        delivery.channel
      );

    const result =
      await adapter.send({
        delivery,
        notification,
        user,
        binding,
      });

    if (result.ok) {
      return deliveryRepository.updateDeliveryStatus({
        id: delivery.id,
        status: result.status || 'SENT',
        externalId: result.externalId || null,
        rawResponse: result.rawResponse || {},
        manualNote: result.manualNote,
        currentUser,
      });
    }

    return deliveryRepository.updateDeliveryStatus({
      id: delivery.id,
      status: 'FAILED',
      error: result.error || 'Delivery failed',
      rawResponse: result.rawResponse || {},
      currentUser,
    });
  }

  /**
   * Execute multiple delivery records.
   *
   * Sprint 25.0:
   * sequential execution for safety and easier debug.
   */
  async executeMany({
    deliveries = [],
    notification,
    user = null,
    bindings = [],
    currentUser = null,
  }) {
    const results = [];

    for (const delivery of deliveries) {
      const binding =
        bindings.find(
          (item) =>
            item.channel === delivery.channel
        ) || null;

      const result =
        await this.executeOne({
          delivery,
          notification,
          user,
          binding,
          currentUser,
        });

      results.push(result);
    }

    return results;
  }

  /**
   * Execute all pending deliveries for one notification.
   *
   * Future:
   * queue/worker can call this.
   */
  async executeForNotification({
    notification,
    deliveries = [],
    user = null,
    bindings = [],
    currentUser = null,
  }) {
    if (!notification) {
      throw new Error(
        '[deliveryExecutionService.executeForNotification]: notification is required'
      );
    }

    return this.executeMany({
      deliveries,
      notification,
      user,
      bindings,
      currentUser,
    });
  }
}

module.exports =
  new DeliveryExecutionService();