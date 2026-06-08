// ============================================================
// PATH: src/modules/notifications/services/communicationPropagation.service.js
// DATETIME: 2026-06-04T14:55:00+07:00
// VERSION: EGAL-25.1-PHASE-6.2 Doctrine Pivot
// DESCRIPTION:
// - Propagate Register business capture data into canonical communication tables.
// - Source:
//   users.email
//   users.phone
// - Target:
//   user_contact_preferences
//   communication_bindings
// - Doctrine:
//   Q19 — Propagation is canonical only.
//   Q22 — Silent emit is canonical only.
//   Social channels are community spaces, not official notification transport.
// ============================================================

/**
 * <2026-06-04T14:55:00+07:00>
 * Purpose:
 * - Normalize user selected communication channel from Register capture layer.
 *
 * Notes:
 * - Register may send lowercase values such as "email"/ "web push".
 * - Canonical channel enum uses uppercase values.
 */
function normalizeChannel(value) {
  if (!value || typeof value !== 'string') return null;

  const normalized = value.trim().toUpperCase();

  const allowedChannels = [
    'IN_APP',
    'EMAIL',
    'WEB_PUSH',
  ];

  return allowedChannels.includes(normalized) ? normalized : null;
}

/**
 * <2026-06-06T00:00:00+07:00>
 * Purpose:
 * - Legacy compatibility helper.
 *
 * Notes:
 * - Post-Architecture-Pivot doctrine removed preferred social channel
 *   from Register.
 * - Social platforms are community spaces, not canonical communication.
 * - This function only accepts canonical values if old payloads still send them.
 */
function resolvePreferredChannel(rawUserData = {}) {
  const socialProfiles = rawUserData.temp_social_profiles || {};

  return normalizeChannel(
    rawUserData.preferred_channel ||
      rawUserData.preferredChannel ||
      socialProfiles.preferred_channel ||
      socialProfiles.preferredChannel
  );
}

/**
 * <2026-06-04T14:55:00+07:00>
 * Purpose:
 * - Build shared metadata for propagated communication records.
 *
 * Notes:
 * - user.status is business context only.
 * - It must not decide routing/delivery here.
 */
function buildPropagationMetadata({
  user,
  isNewClan,
}) {
  return {
    source: 'register',
    phase: 'EGAL-25.1',
    registration_type: isNewClan ? 'CREATE_CLAN' : 'JOIN_CLAN',
    user_status: user?.status || null,
    user_role: user?.role || null,
    tenant_id: user?.tenant_id || null,
  };
}

/**
 * <2026-06-04T14:55:00+07:00>
 * Purpose:
 * - Create one user_contact_preferences record.
 *
 * Notes:
 * - Used only inside register transaction.
 * - No upsert in v1 because registration creates a new user.
 */
async function createContactPreference({
  tx,
  user,
  channel,
  value = null,
  preferred = false,
  enabled = true,
  verified = false,
  metadata = {},
}) {
  return await tx.user_contact_preferences.create({
    data: {
      user_id: user.id,
      channel,
      value,
      preferred,
      enabled,
      verified,
      metadata,
      changed_by: user.id,
    },
  });
}

/**
 * <2026-06-04T14:55:00+07:00>
 * Purpose:
 * - Create one communication_bindings record.
 *
 * Notes:
 * - external_id is canonical delivery identity:
 *   EMAIL => email address
 *
 * Notes:
 * - IN_APP does not need binding.
 * - WEB_PUSH is enrollment-based and should be handled by
 *   web_push_subscriptions / subscribe endpoint, not Register propagation.
 */
async function createCommunicationBinding({
  tx,
  user,
  channel,
  externalId,
  displayName = null,
  bindingState = 'DECLARED',
  metadata = {},
}) {
  if (!externalId) return null;

  return await tx.communication_bindings.create({
    data: {
      user_id: user.id,
      channel,
      external_id: externalId,
      display_name: displayName,
      binding_state: bindingState,
      metadata,
      changed_by: user.id,
    },
  });
}

/**
 * <2026-06-04T14:55:00+07:00>
 * Purpose:
 * - Propagate Register data into canonical communication tables.
 *
 * Notes:
 * - Must be called inside the same transaction that creates user.
 * - This is data propagation, not notification delivery.
 * - If this fails, register should rollback.
 */
async function propagateFromRegistration({
  tx,
  user,
  rawUserData = {},
  isNewClan = false,
}) 
 {
  if (!tx) {
    throw new Error('COMMUNICATION_PROPAGATION_TX_REQUIRED');
  }

  if (!user?.id) {
    throw new Error('COMMUNICATION_PROPAGATION_USER_REQUIRED');
  }

  const preferredChannel = resolvePreferredChannel(rawUserData);

  const metadata = buildPropagationMetadata({
    user,
    isNewClan,
  });

  /**
   * <2026-06-04T14:55:00+07:00>
   * IN_APP:
   * - Always enabled as default communication preference.
   * - No binding required.
   */
  await createContactPreference({
    tx,
    user,
    channel: 'IN_APP',
    value: null,
    preferred: preferredChannel === 'IN_APP',
    enabled: true,
    verified: true,
    metadata: {
      ...metadata,
      reason: 'default_in_app_channel',
    },
  });

    /**
     * <2026-06-04T14:55:00+07:00>
     * EMAIL:
     * - If user.email exists, create preference + CONNECTED binding.
     */
    if (user.email) {
      await createContactPreference({
        tx,
        user,
        channel: 'EMAIL',
        value: user.email,
        preferred: preferredChannel === 'EMAIL',
        enabled: true,
        verified: false,
        metadata: {
          ...metadata,
          reason: 'email_captured_from_registration',
        },
      });

      await createCommunicationBinding({
        tx,
        user,
        channel: 'EMAIL',
        externalId: user.email,
        displayName: user.email,
        bindingState: 'CONNECTED',
        metadata: {
          ...metadata,
          reason: 'email_binding_from_registration',
        },
      });
    }

    /**
     * <2026-06-06T00:00:00+07:00>
     * WEB_PUSH:
     * - Canonical communication channel.
     * - Not propagated from Register because it requires browser permission
     *   and a push subscription endpoint.
     * - Future owner:
     *   POST /communication/web-push/subscribe
     */
    
      return {
        propagated: true,
        canonicalChannels: [
          'IN_APP',
          ...(user.email ? ['EMAIL'] : []),
        ],
        webPush: {
          propagated: false,
          reason: 'requires_browser_subscription_enrollment',
        },
        legacyPreferredChannelIgnored: Boolean(preferredChannel),
      };
  }

/**
 * <2026-06-04T14:55:00+07:00>
 * Purpose:
 * - Export communication propagation helpers.
 */
module.exports = {
  propagateFromRegistration,

  normalizeChannel,
  resolvePreferredChannel,
};
