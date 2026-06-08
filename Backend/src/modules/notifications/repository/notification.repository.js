/**
 * PATH: backend/src/modules/notifications/repository/notification.repository.js
 * PURPOSE:
 * - EGAL-25 Sprint 25.0
 * - Repository layer for notifications + notification_recipients
 * - Soft-delete aware
 * - No business logic
 * - No delivery logic
 */

const { prisma } = require('../../../lib/prisma');
const crypto = require('crypto');

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

const notificationRepository = {
  /**
   * Create canonical notification.
   *
   * NOTE:
   * notifications.user_id is still kept for legacy/MVP compatibility.
   * EGAL-25 canonical recipient model is notification_recipients.
   */
  createNotification: async ({
    userId,
    eventType = null,
    title,
    content,
    level = 'INFO',
    reliability = 'LOW',
    type = 'HE_THONG',
    metadata = {},
    currentUser = null,
  }) => {
    if (!userId) {
      throw new Error('[notificationRepository.createNotification]: userId is required');
    }

    if (!title || !content) {
      throw new Error('[notificationRepository.createNotification]: title and content are required');
    }

    return prisma.notifications.create({
      data: {
        id: crypto.randomUUID(),
        user_id: userId,
        event_type: eventType,
        title,
        content,
        level,
        reliability,
        type,
        metadata,
        changed_by: getActorId(currentUser),
      },
    });
  },

  /**
   * Add one recipient to an existing notification.
   */
  addRecipient: async ({
    notificationId,
    userId,
    currentUser = null,
  }) => {
    if (!notificationId || !userId) {
      throw new Error('[notificationRepository.addRecipient]: notificationId and userId are required');
    }

    return prisma.notification_recipients.create({
      data: {
        id: crypto.randomUUID(),
        notification_id: notificationId,
        user_id: userId,
        changed_by: getActorId(currentUser),
      },
    });
  },

  /**
   * Create notification and recipient together.
   * Useful for Sprint 25.0 silent persistence.
   */
  createNotificationForUser: async ({
    userId,
    eventType = null,
    title,
    content,
    level = 'INFO',
    reliability = 'LOW',
    type = 'HE_THONG',
    metadata = {},
    currentUser = null,
  }) => {
    return prisma.$transaction(async (tx) => {
      const notificationId =
        crypto.randomUUID();

      const notification =
        await tx.notifications.create({
          data: {
            id: notificationId,
          user_id: userId,
          event_type: eventType,
          title,
          content,
          level,
          reliability,
          type,
          metadata,
          changed_by: getActorId(currentUser),
        },
      });

      const recipient =
        await tx.notification_recipients.create({
          data: {
            id: crypto.randomUUID(),
            notification_id: notification.id,
            user_id: userId,
            changed_by: getActorId(currentUser),
          },
        });

      return {
        notification,
        recipient,
      };
    });
  },

  /**
   * Get active notification by id.
   */
  getNotificationById: async (id) => {
    if (!id) {
      throw new Error('[notificationRepository.getNotificationById]: id is required');
    }

    return prisma.notifications.findFirst({
      where: activeWhere({ id }),
      include: {
        notification_recipients: {
          where: { deleted_at: null },
        },
      },
    });
  },

  /**
   * Get active notifications for a user.
   * Uses legacy notifications.user_id for compatibility.
   */
  getUserNotifications: async ({
    userId,
    take = 50,
    skip = 0,
    unreadOnly = false,
  }) => {
    if (!userId) {
      throw new Error('[notificationRepository.getUserNotifications]: userId is required');
    }

    return prisma.notifications.findMany({
      where: activeWhere({
        user_id: userId,
        ...(unreadOnly ? { read_at: null } : {}),
      }),
      orderBy: {
        created_at: 'desc',
      },
      take,
      skip,
    });
  },

  /**
   * Get recipient-based notifications for EGAL-25 canonical flow.
   */
  getRecipientNotifications: async ({
    userId,
    take = 50,
    skip = 0,
    unreadOnly = false,
  }) => {
    if (!userId) {
      throw new Error('[notificationRepository.getRecipientNotifications]: userId is required');
    }

    return prisma.notification_recipients.findMany({
      where: activeWhere({
        user_id: userId,
        ...(unreadOnly ? { read_at: null } : {}),
      }),
      include: {
        notifications: true,
        notification_deliveries: {
          where: { deleted_at: null },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take,
      skip,
    });
  },

  /**
   * Mark notification as read.
   * Updates both legacy notification.read_at and recipient.read_at when possible.
   */
  markRead: async ({
    notificationId,
    userId,
    currentUser = null,
  }) => {
    if (!notificationId || !userId) {
      throw new Error('[notificationRepository.markRead]: notificationId and userId are required');
    }

    const now = new Date();
    const actorId = getActorId(currentUser);

    return prisma.$transaction(async (tx) => {
      const notification = await tx.notifications.updateMany({
        where: activeWhere({
          id: notificationId,
          user_id: userId,
        }),
        data: {
          read_at: now,
          updated_at: now,
          changed_by: actorId,
        },
      });

      const recipient = await tx.notification_recipients.updateMany({
        where: activeWhere({
          notification_id: notificationId,
          user_id: userId,
        }),
        data: {
          read_at: now,
          updated_at: now,
          changed_by: actorId,
        },
      });

      return {
        notification,
        recipient,
      };
    });
  },

  /**
   * Soft delete notification.
   * Does NOT hard delete.
   */
  softDeleteNotification: async ({
    notificationId,
    currentUser = null,
  }) => {
    if (!notificationId) {
      throw new Error('[notificationRepository.softDeleteNotification]: notificationId is required');
    }

    const now = new Date();
    const actorId = getActorId(currentUser);

    return prisma.notifications.update({
      where: { id: notificationId },
      data: {
        deleted_at: now,
        updated_at: now,
        changed_by: actorId,
      },
    });
  },

  /**
   * Soft delete recipient row.
   */
  softDeleteRecipient: async ({
    recipientId,
    currentUser = null,
  }) => {
    if (!recipientId) {
      throw new Error('[notificationRepository.softDeleteRecipient]: recipientId is required');
    }

    const now = new Date();
    const actorId = getActorId(currentUser);

    return prisma.notification_recipients.update({
      where: { id: recipientId },
      data: {
        deleted_at: now,
        updated_at: now,
        changed_by: actorId,
      },
    });
  },
};

module.exports = notificationRepository;