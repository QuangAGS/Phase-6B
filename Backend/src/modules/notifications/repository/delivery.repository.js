/**
 * PATH: backend/src/modules/notifications/repository/delivery.repository.js
 * PURPOSE:
 * - EGAL-25 Sprint 25.0
 * - Repository layer for notification_deliveries + inbound_messages
 * - Soft-delete aware
 * - No business logic
 * - No routing logic
 * - No actual channel sending
 */

const { prisma } = require('../../../lib/prisma');

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

function getActorId(currentUser) {
  return currentUser?.userId || currentUser?.id || SYSTEM_USER_ID;
}

function activeWhere(extra = {}) {
  return {
    deleted_at: null,
    ...extra,
  };
}

const deliveryRepository = {
  // =========================================================
  // NOTIFICATION DELIVERIES
  // =========================================================

  /**
   * Create delivery record.
   *
   * NOTE:
   * notification_id is kept for backward compatibility.
   * notification_recipient_id is EGAL-25 canonical recipient-level delivery.
   */
  createDelivery: async ({
    notificationId,
    notificationRecipientId = null,
    channel,
    provider = null,
    status = 'PENDING',
    recipient = null,
    externalId = null,
    manualNote = null,
    rawResponse = {},
    //metadata = {},
    currentUser = null,
  }) => {
    if (!notificationId || !channel) {
      throw new Error('[deliveryRepository.createDelivery]: notificationId and channel are required');
    }

    return prisma.notification_deliveries.create({
      data: {
        notification_id: notificationId,
        notification_recipient_id: notificationRecipientId,
        channel,
        provider,
        status,
        recipient,
        external_id: externalId,
        manual_note: manualNote,
        raw_response: rawResponse,
        //metadata,
        changed_by: getActorId(currentUser),
      },
    });
  },

  /**
   * Get active deliveries by notification id.
   */
  getDeliveriesByNotification: async (notificationId) => {
    if (!notificationId) {
      throw new Error('[deliveryRepository.getDeliveriesByNotification]: notificationId is required');
    }

    return prisma.notification_deliveries.findMany({
      where: activeWhere({
        notification_id: notificationId,
      }),
      orderBy: {
        created_at: 'desc',
      },
    });
  },

  /**
   * Get active deliveries by notification recipient id.
   */
  getDeliveriesByRecipient: async (notificationRecipientId) => {
    if (!notificationRecipientId) {
      throw new Error('[deliveryRepository.getDeliveriesByRecipient]: notificationRecipientId is required');
    }

    return prisma.notification_deliveries.findMany({
      where: activeWhere({
        notification_recipient_id: notificationRecipientId,
      }),
      orderBy: {
        created_at: 'desc',
      },
    });
  },

  /**
   * Get pending active deliveries.
   * Useful for queue/jobs later.
   */
  getPendingDeliveries: async ({
    channel = null,
    take = 50,
    skip = 0,
  } = {}) => {
    return prisma.notification_deliveries.findMany({
      where: activeWhere({
        status: 'PENDING',
        ...(channel ? { channel } : {}),
      }),
      orderBy: {
        created_at: 'asc',
      },
      take,
      skip,
    });
  },

  /**
   * Get manual-required deliveries.
   * Used for Zalo Manual-Assisted queue.
   */
  getManualRequiredDeliveries: async ({
    channel = null,
    take = 50,
    skip = 0,
  } = {}) => {
    return prisma.notification_deliveries.findMany({
      where: activeWhere({
        status: 'MANUAL_REQUIRED',
        ...(channel ? { channel } : {}),
      }),
      orderBy: {
        created_at: 'asc',
      },
      take,
      skip,
    });
  },

  /**
   * Mark delivery as sent.
   */
  markSent: async ({
    id,
    externalId = null,
    rawResponse = {},
    currentUser = null,
  }) => {
    if (!id) {
      throw new Error('[deliveryRepository.markSent]: id is required');
    }

    const now = new Date();

    return prisma.notification_deliveries.update({
      where: { id },
      data: {
        status: 'SENT',
        sent_at: now,
        delivered_at: now,
        external_id: externalId,
        raw_response: rawResponse,
        updated_at: now,
        changed_by: getActorId(currentUser),
      },
    });
  },

  /**
   * Mark delivery as failed.
   */
  markFailed: async ({
    id,
    error,
    rawResponse = {},
    currentUser = null,
  }) => {
    if (!id) {
      throw new Error('[deliveryRepository.markFailed]: id is required');
    }

    const now = new Date();

    const existing = await prisma.notification_deliveries.findUnique({
      where: { id },
    });

    return prisma.notification_deliveries.update({
      where: { id },
      data: {
        status: 'FAILED',
        failed_at: now,
        error: error || 'Unknown delivery error',
        retry_count: (existing?.retry_count || 0) + 1,
        raw_response: rawResponse,
        updated_at: now,
        changed_by: getActorId(currentUser),
      },
    });
  },

  /**
   * Mark delivery as manual required.
   * Used especially for Zalo PZ manual-assisted workflow.
   */
  markManualRequired: async ({
    id,
    manualNote = null,
    currentUser = null,
  }) => {
    if (!id) {
      throw new Error('[deliveryRepository.markManualRequired]: id is required');
    }

    const now = new Date();

    return prisma.notification_deliveries.update({
      where: { id },
      data: {
        status: 'MANUAL_REQUIRED',
        manual_note: manualNote,
        updated_at: now,
        changed_by: getActorId(currentUser),
      },
    });
  },

  /**
   * Mark delivery as read.
   */
  markRead: async ({
    id,
    currentUser = null,
  }) => {
    if (!id) {
      throw new Error('[deliveryRepository.markRead]: id is required');
    }

    const now = new Date();

    return prisma.notification_deliveries.update({
      where: { id },
      data: {
        status: 'READ',
        read_at: now,
        updated_at: now,
        changed_by: getActorId(currentUser),
      },
    });
  },

  /**
   * Generic delivery status updater.
   *
   * Used by deliveryExecution.service.js.
   *
   * Supports:
   * - SENT
   * - FAILED
   * - MANUAL_REQUIRED
   * - READ
   * - PENDING
   */
  updateDeliveryStatus: async ({
    id,
    status,
    externalId = undefined,
    error = undefined,
    rawResponse = undefined,
    manualNote = undefined,
    currentUser = null,
  }) => {
    if (!id || !status) {
      throw new Error(
        '[deliveryRepository.updateDeliveryStatus]: id and status are required'
      );
    }

    const now = new Date();

    const data = {
      status,
      updated_at: now,
      changed_by: getActorId(currentUser),
    };

    if (externalId !== undefined) {
      data.external_id = externalId;
    }

    if (error !== undefined) {
      data.error = error;
    }

    if (rawResponse !== undefined) {
      data.raw_response = rawResponse;
    }

    if (manualNote !== undefined) {
      data.manual_note = manualNote;
    }

    if (status === 'SENT') {
      data.sent_at = now;
      data.delivered_at = now;
      data.error = null;
    }

    if (status === 'FAILED') {
      data.failed_at = now;
    }

    if (status === 'READ') {
      data.read_at = now;
    }

    if (status === 'MANUAL_REQUIRED') {
      data.manual_note =
        manualNote ||
        'Manual delivery is required.';
    }

    return prisma.notification_deliveries.update({
      where: { id },
      data,
    });
  },

  /**
   * Assign manual handler.
   */
  assignManualHandler: async ({
    id,
    handlerUserId,
    currentUser = null,
  }) => {
    if (!id || !handlerUserId) {
      throw new Error('[deliveryRepository.assignManualHandler]: id and handlerUserId are required');
    }

    const now = new Date();

    return prisma.notification_deliveries.update({
      where: { id },
      data: {
        handled_by: handlerUserId,
        updated_at: now,
        changed_by: getActorId(currentUser),
      },
    });
  },

  /**
   * Soft delete delivery.
   */
  softDeleteDelivery: async ({
    id,
    currentUser = null,
  }) => {
    if (!id) {
      throw new Error('[deliveryRepository.softDeleteDelivery]: id is required');
    }

    const now = new Date();

    return prisma.notification_deliveries.update({
      where: { id },
      data: {
        deleted_at: now,
        updated_at: now,
        changed_by: getActorId(currentUser),
      },
    });
  },

  // =========================================================
  // INBOUND MESSAGES
  // =========================================================

  /**
   * Create inbound message.
   */
  createInboundMessage: async ({
    tenantId = null,
    userId = null,
    channel,
    provider = null,
    externalUserId = null,
    externalMessageId = null,
    senderName = null,
    content = null,
    rawPayload = {},
    status = 'PENDING',
    currentUser = null,
  }) => {
    if (!channel) {
      throw new Error('[deliveryRepository.createInboundMessage]: channel is required');
    }

    return prisma.inbound_messages.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        channel,
        provider,
        external_user_id: externalUserId,
        external_message_id: externalMessageId,
        sender_name: senderName,
        content,
        raw_payload: rawPayload,
        status,
        changed_by: getActorId(currentUser),
      },
    });
  },

  /**
   * Get pending inbound messages.
   */
  getPendingInboundMessages: async ({
    channel = null,
    provider = null,
    take = 50,
    skip = 0,
  } = {}) => {
    return prisma.inbound_messages.findMany({
      where: activeWhere({
        status: 'PENDING',
        ...(channel ? { channel } : {}),
        ...(provider ? { provider } : {}),
      }),
      orderBy: {
        received_at: 'asc',
      },
      take,
      skip,
    });
  },

  /**
   * Mark inbound message as processed.
   */
  markInboundProcessed: async ({
    id,
    currentUser = null,
  }) => {
    if (!id) {
      throw new Error('[deliveryRepository.markInboundProcessed]: id is required');
    }

    const now = new Date();

    return prisma.inbound_messages.update({
      where: { id },
      data: {
        status: 'PROCESSED',
        processed_at: now,
        updated_at: now,
        changed_by: getActorId(currentUser),
      },
    });
  },

  /**
   * Mark inbound message as failed.
   */
  markInboundFailed: async ({
    id,
    error,
    currentUser = null,
  }) => {
    if (!id) {
      throw new Error('[deliveryRepository.markInboundFailed]: id is required');
    }

    const now = new Date();

    return prisma.inbound_messages.update({
      where: { id },
      data: {
        status: 'FAILED',
        error: error || 'Unknown inbound processing error',
        processed_at: now,
        updated_at: now,
        changed_by: getActorId(currentUser),
      },
    });
  },

  /**
   * Ignore inbound message.
   */
  markInboundIgnored: async ({
    id,
    reason = null,
    currentUser = null,
  }) => {
    if (!id) {
      throw new Error('[deliveryRepository.markInboundIgnored]: id is required');
    }

    const now = new Date();

    return prisma.inbound_messages.update({
      where: { id },
      data: {
        status: 'IGNORED',
        error: reason,
        processed_at: now,
        updated_at: now,
        changed_by: getActorId(currentUser),
      },
    });
  },

  /**
   * Soft delete inbound message.
   */
  softDeleteInboundMessage: async ({
    id,
    currentUser = null,
  }) => {
    if (!id) {
      throw new Error('[deliveryRepository.softDeleteInboundMessage]: id is required');
    }

    const now = new Date();

    return prisma.inbound_messages.update({
      where: { id },
      data: {
        deleted_at: now,
        updated_at: now,
        changed_by: getActorId(currentUser),
      },
    });
  },
};

module.exports = deliveryRepository;