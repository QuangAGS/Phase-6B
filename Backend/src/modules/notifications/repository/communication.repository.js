/**
 * PATH: backend/src/modules/notifications/repository/communication.repository.js
 * PURPOSE:
 * - EGAL-25 Sprint 25.0
 * - Repository layer for communication preferences, bindings, providers, web push subscriptions
 * - Soft-delete aware
 * - No routing logic
 * - No delivery logic
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

const communicationRepository = {
  // =========================================================
  // USER CONTACT PREFERENCES
  // =========================================================

  /**
   * Get all active communication preferences for a user.
   */
  getUserPreferences: async (userId) => {
    if (!userId) {
      throw new Error('[communicationRepository.getUserPreferences]: userId is required');
    }

    return prisma.user_contact_preferences.findMany({
      where: activeWhere({ user_id: userId }),
      orderBy: [
        { preferred: 'desc' },
        { created_at: 'asc' },
      ],
    });
  },

  /**
   * Get preferred active communication preference for a user.
   */
  getPreferredPreference: async (userId) => {
    if (!userId) {
      throw new Error('[communicationRepository.getPreferredPreference]: userId is required');
    }

    return prisma.user_contact_preferences.findFirst({
      where: activeWhere({
        user_id: userId,
        enabled: true,
        preferred: true,
      }),
      orderBy: { created_at: 'desc' },
    });
  },

  /**
   * Get a specific active preference by user + channel.
   */
  getPreferenceByChannel: async ({ userId, channel }) => {
    if (!userId || !channel) {
      throw new Error('[communicationRepository.getPreferenceByChannel]: userId and channel are required');
    }

    return prisma.user_contact_preferences.findFirst({
      where: activeWhere({
        user_id: userId,
        channel,
      }),
    });
  },

  /**
   * Create a communication preference.
   *
   * NOTE:
   * Preference is NOT binding.
   * Binding is stored in communication_bindings.
   */
  createPreference: async ({
    userId,
    channel,
    value = null,
    preferred = false,
    enabled = true,
    verified = false,
    metadata = {},
    currentUser = null,
  }) => {
    if (!userId || !channel) {
      throw new Error('[communicationRepository.createPreference]: userId and channel are required');
    }

    return prisma.user_contact_preferences.create({
      data: {
        user_id: userId,
        channel,
        value,
        preferred,
        enabled,
        verified,
        metadata,
        changed_by: getActorId(currentUser),
      },
    });
  },

  /**
   * Update an active preference by id.
   */
  updatePreference: async ({
    id,
    data,
    currentUser = null,
  }) => {
    if (!id) {
      throw new Error('[communicationRepository.updatePreference]: id is required');
    }

    const now = new Date();

    return prisma.user_contact_preferences.update({
      where: { id },
      data: {
        ...data,
        updated_at: now,
        changed_by: getActorId(currentUser),
      },
    });
  },

  /**
   * Soft delete preference by id.
   */
  softDeletePreference: async ({
    id,
    currentUser = null,
  }) => {
    if (!id) {
      throw new Error('[communicationRepository.softDeletePreference]: id is required');
    }

    const now = new Date();

    return prisma.user_contact_preferences.update({
      where: { id },
      data: {
        deleted_at: now,
        updated_at: now,
        changed_by: getActorId(currentUser),
      },
    });
  },

  /**
   * Mark one channel as preferred.
   * Transaction:
   * - unset preferred for other active preferences
   * - set target as preferred
   */
  setPreferredChannel: async ({
    userId,
    channel,
    currentUser = null,
  }) => {
    if (!userId || !channel) {
      throw new Error('[communicationRepository.setPreferredChannel]: userId and channel are required');
    }

    const now = new Date();
    const actorId = getActorId(currentUser);

    return prisma.$transaction(async (tx) => {
      await tx.user_contact_preferences.updateMany({
        where: activeWhere({ user_id: userId }),
        data: {
          preferred: false,
          updated_at: now,
          changed_by: actorId,
        },
      });

      const existing = await tx.user_contact_preferences.findFirst({
        where: activeWhere({
          user_id: userId,
          channel,
        }),
      });

      if (existing) {
        return tx.user_contact_preferences.update({
          where: { id: existing.id },
          data: {
            preferred: true,
            enabled: true,
            updated_at: now,
            changed_by: actorId,
          },
        });
      }

      return tx.user_contact_preferences.create({
        data: {
          user_id: userId,
          channel,
          preferred: true,
          enabled: true,
          verified: false,
          metadata: {},
          changed_by: actorId,
        },
      });
    });
  },

  // =========================================================
  // COMMUNICATION BINDINGS
  // =========================================================

  /**
   * Get active bindings for a user.
   */
  getBindings: async (userId) => {
    if (!userId) {
      throw new Error('[communicationRepository.getBindings]: userId is required');
    }

    return prisma.communication_bindings.findMany({
      where: activeWhere({ user_id: userId }),
      orderBy: { created_at: 'desc' },
    });
  },

  getUserBasicProfile: async (userId) => {
    if (!userId) {
      throw new Error(
        '[communicationRepository.getUserBasicProfile]: userId is required'
      );
    }

    const user =
      await prisma.users.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          email: true,
          phone: true,
          name: true,
          temp_social_profiles: true,
        },
      });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,

      preferred_channel:
        user.temp_social_profiles?.channel ||
        null,
    };
  },

  /**
   * Get active binding by user + channel.
   */
  getBindingByChannel: async ({ userId, channel }) => {
    if (!userId || !channel) {
      throw new Error('[communicationRepository.getBindingByChannel]: userId and channel are required');
    }

    return prisma.communication_bindings.findFirst({
      where: activeWhere({
        user_id: userId,
        channel,
      }),
    });
  },

  /**
   * Create communication binding.
   */
  createBinding: async ({
    userId,
    channel,
    bindingState = 'DECLARED',
    externalId = null,
    displayName = null,
    connectedAt = null,
    disabledAt = null,
    metadata = {},
    currentUser = null,
  }) => {
    if (!userId || !channel) {
      throw new Error('[communicationRepository.createBinding]: userId and channel are required');
    }

    return prisma.communication_bindings.create({
      data: {
        user_id: userId,
        channel,
        binding_state: bindingState,
        external_id: externalId,
        display_name: displayName,
        connected_at: connectedAt,
        disabled_at: disabledAt,
        metadata,
        changed_by: getActorId(currentUser),
      },
    });
  },

  /**
   * Update active binding by id.
   */
  updateBinding: async ({
    id,
    data,
    currentUser = null,
  }) => {
    if (!id) {
      throw new Error('[communicationRepository.updateBinding]: id is required');
    }

    const now = new Date();

    return prisma.communication_bindings.update({
      where: { id },
      data: {
        ...data,
        updated_at: now,
        changed_by: getActorId(currentUser),
      },
    });
  },

  /**
   * Upsert binding by user + channel.
   * Works with partial unique index because Prisma cannot use it directly,
   * so we perform findFirst + create/update.
   */
  upsertBindingByChannel: async ({
    userId,
    channel,
    bindingState = 'DECLARED',
    externalId = null,
    displayName = null,
    connectedAt = null,
    disabledAt = null,
    metadata = {},
    currentUser = null,
  }) => {
    if (!userId || !channel) {
      throw new Error('[communicationRepository.upsertBindingByChannel]: userId and channel are required');
    }

    const now = new Date();
    const actorId = getActorId(currentUser);

    return prisma.$transaction(async (tx) => {
      const existing = await tx.communication_bindings.findFirst({
        where: activeWhere({
          user_id: userId,
          channel,
        }),
      });

      if (existing) {
        return tx.communication_bindings.update({
          where: { id: existing.id },
          data: {
            binding_state: bindingState,
            external_id: externalId,
            display_name: displayName,
            connected_at: connectedAt,
            disabled_at: disabledAt,
            metadata,
            updated_at: now,
            changed_by: actorId,
          },
        });
      }

      return tx.communication_bindings.create({
        data: {
          user_id: userId,
          channel,
          binding_state: bindingState,
          external_id: externalId,
          display_name: displayName,
          connected_at: connectedAt,
          disabled_at: disabledAt,
          metadata,
          changed_by: actorId,
        },
      });
    });
  },

  /**
   * Mark channel as suggested.
   */
  markBindingSuggested: async ({
    userId,
    channel,
    currentUser = null,
  }) => {
    return communicationRepository.upsertBindingByChannel({
      userId,
      channel,
      bindingState: 'SUGGESTED',
      currentUser,
    });
  },

  /**
   * Mark channel as connected.
   */
  markBindingConnected: async ({
    userId,
    channel,
    externalId = null,
    displayName = null,
    metadata = {},
    currentUser = null,
  }) => {
    return communicationRepository.upsertBindingByChannel({
      userId,
      channel,
      bindingState: 'CONNECTED',
      externalId,
      displayName,
      connectedAt: new Date(),
      disabledAt: null,
      metadata,
      currentUser,
    });
  },

  /**
   * Mark channel as disabled.
   */
  markBindingDisabled: async ({
    userId,
    channel,
    currentUser = null,
  }) => {
    return communicationRepository.upsertBindingByChannel({
      userId,
      channel,
      bindingState: 'DISABLED',
      disabledAt: new Date(),
      currentUser,
    });
  },

  /**
   * Soft delete binding by id.
   */
  softDeleteBinding: async ({
    id,
    currentUser = null,
  }) => {
    if (!id) {
      throw new Error('[communicationRepository.softDeleteBinding]: id is required');
    }

    const now = new Date();

    return prisma.communication_bindings.update({
      where: { id },
      data: {
        deleted_at: now,
        updated_at: now,
        changed_by: getActorId(currentUser),
      },
    });
  },

  // =========================================================
  // TENANT COMMUNICATION PROVIDERS
  // =========================================================

  /**
   * Get active providers for a tenant.
   */
  getTenantProviders: async ({
    tenantId,
    channel = null,
    enabledOnly = true,
  }) => {
    if (!tenantId) {
      throw new Error('[communicationRepository.getTenantProviders]: tenantId is required');
    }

    return prisma.tenant_communication_providers.findMany({
      where: activeWhere({
        tenant_id: tenantId,
        ...(channel ? { channel } : {}),
        ...(enabledOnly ? { enabled: true } : {}),
      }),
      orderBy: [
        { is_default: 'desc' },
        { priority: 'asc' },
        { created_at: 'asc' },
      ],
    });
  },

  /**
   * Get default active provider for tenant + provider or channel.
   */
  getDefaultProvider: async ({
    tenantId,
    provider = null,
    channel = null,
  }) => {
    if (!tenantId) {
      throw new Error('[communicationRepository.getDefaultProvider]: tenantId is required');
    }

    return prisma.tenant_communication_providers.findFirst({
      where: activeWhere({
        tenant_id: tenantId,
        enabled: true,
        is_default: true,
        ...(provider ? { provider } : {}),
        ...(channel ? { channel } : {}),
      }),
      orderBy: [
        { priority: 'asc' },
        { created_at: 'asc' },
      ],
    });
  },

  // =========================================================
  // WEB PUSH SUBSCRIPTIONS
  // =========================================================

  /**
   * Get active web push subscriptions for user.
   */
  getWebPushSubscriptions: async (userId) => {
    if (!userId) {
      throw new Error('[communicationRepository.getWebPushSubscriptions]: userId is required');
    }

    return prisma.web_push_subscriptions.findMany({
      where: activeWhere({
        user_id: userId,
        enabled: true,
      }),
      orderBy: { created_at: 'desc' },
    });
  },

  /**
   * Create web push subscription.
   */
  createWebPushSubscription: async ({
    userId,
    endpoint,
    p256dh,
    auth,
    userAgent = null,
    currentUser = null,
  }) => {
    if (!userId || !endpoint || !p256dh || !auth) {
      throw new Error('[communicationRepository.createWebPushSubscription]: userId, endpoint, p256dh, auth are required');
    }

    return prisma.web_push_subscriptions.create({
      data: {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent,
        enabled: true,
        last_seen_at: new Date(),
        changed_by: getActorId(currentUser),
      },
    });
  },

  /**
   * Mark push subscription as seen.
   */
  touchWebPushSubscription: async ({
    id,
    currentUser = null,
  }) => {
    if (!id) {
      throw new Error('[communicationRepository.touchWebPushSubscription]: id is required');
    }

    const now = new Date();

    return prisma.web_push_subscriptions.update({
      where: { id },
      data: {
        last_seen_at: now,
        updated_at: now,
        changed_by: getActorId(currentUser),
      },
    });
  },

  /**
   * Mark push subscription failure.
   */
  markWebPushFailure: async ({
    id,
    currentUser = null,
  }) => {
    if (!id) {
      throw new Error('[communicationRepository.markWebPushFailure]: id is required');
    }

    const now = new Date();

    const existing = await prisma.web_push_subscriptions.findUnique({
      where: { id },
    });

    return prisma.web_push_subscriptions.update({
      where: { id },
      data: {
        failed_at: now,
        failure_count: (existing?.failure_count || 0) + 1,
        updated_at: now,
        changed_by: getActorId(currentUser),
      },
    });
  },

  /**
   * Soft delete web push subscription.
   */
  softDeleteWebPushSubscription: async ({
    id,
    currentUser = null,
  }) => {
    if (!id) {
      throw new Error('[communicationRepository.softDeleteWebPushSubscription]: id is required');
    }

    const now = new Date();

    return prisma.web_push_subscriptions.update({
      where: { id },
      data: {
        enabled: false,
        deleted_at: now,
        updated_at: now,
        changed_by: getActorId(currentUser),
      },
    });
  },
};

module.exports = communicationRepository;