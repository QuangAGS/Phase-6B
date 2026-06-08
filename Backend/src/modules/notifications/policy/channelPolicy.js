/**
 * PATH:
 * backend/src/modules/notifications/policy/channelPolicy.js
 *
 * PURPOSE:
 * - EGAL-25.x R2
 * - Resolve candidate channels by event type + reliability
 * - No DB access
 * - No delivery logic
 * - No business workflow logic
 *
 * DOCTRINE:
 * Canonical communication:
    WEB_PUSH
    EMAIL
    IN_APP
 * Social channels are community spaces,
    not official communication transport.
 * Preference influences.
 * Reliability decides.
 */

const WEB_PUSH_CHANNEL = 'WEB_PUSH';
const OFFICIAL_CHANNEL = 'EMAIL';
const IN_APP_CHANNEL = 'IN_APP';

const DEFAULT_CHANNELS = [
  WEB_PUSH_CHANNEL,
  OFFICIAL_CHANNEL,
  IN_APP_CHANNEL,
];

/**
 * Channel policy table.
 *
 * mandatory:
 * - must be included when event requires official/reliable delivery
 *
 * preferredAllowed:
 * - user preferred channel may be added if available
 *
 * opportunistic:
 * - convenience channels to create placeholders for
 *
 * manualChannels:
 * - channels that should be MANUAL_REQUIRED, not automated
 */
const EVENT_CHANNEL_POLICY = {
  // =========================================================
  // ONBOARDING EVENTS
  // =========================================================

  USER_REGISTERED: {
    mandatory: [],
    preferredAllowed: true,
    opportunistic: [
      WEB_PUSH_CHANNEL,
      IN_APP_CHANNEL,
    ],
  },

  USER_APPROVAL_PENDING: {
    mandatory: [],
    preferredAllowed: true,
    opportunistic: [
      WEB_PUSH_CHANNEL,
      IN_APP_CHANNEL,
    ],
  },

  USER_APPROVED: {
    mandatory: [OFFICIAL_CHANNEL],
    preferredAllowed: true,
    opportunistic: [
      WEB_PUSH_CHANNEL,
      IN_APP_CHANNEL,
  ],
  },

  USER_REJECTED: {
    mandatory: [OFFICIAL_CHANNEL],
    preferredAllowed: true,
    opportunistic: [
      WEB_PUSH_CHANNEL,
      IN_APP_CHANNEL,
  ],
    
  },

  // =========================================================
  // AUTHENTICATION EVENTS
  // =========================================================

  PASSWORD_RESET_REQUESTED: {
    mandatory: [OFFICIAL_CHANNEL],
    preferredAllowed: false,
    opportunistic: [
  WEB_PUSH_CHANNEL,
  IN_APP_CHANNEL,
],
    
  },

  PASSWORD_CHANGED: {
    mandatory: [OFFICIAL_CHANNEL],
    preferredAllowed: false,
    opportunistic: [
  WEB_PUSH_CHANNEL,
  IN_APP_CHANNEL,
],
    
  },

  LOGIN_SUCCESS: {
    mandatory: [],
    preferredAllowed: false,
    opportunistic: [],
    
  },

  SUSPICIOUS_LOGIN: {
    mandatory: [OFFICIAL_CHANNEL],
    preferredAllowed: true,
    opportunistic: [
  WEB_PUSH_CHANNEL,
  IN_APP_CHANNEL,
],
    
  },

  ACCOUNT_LOCKED: {
    mandatory: [OFFICIAL_CHANNEL],
    preferredAllowed: false,
    opportunistic: [
  WEB_PUSH_CHANNEL,
  IN_APP_CHANNEL,
],
    
  },

  RECOVERY_EMAIL_CHANGED: {
    mandatory: [OFFICIAL_CHANNEL],
    preferredAllowed: false,
    opportunistic: [
  WEB_PUSH_CHANNEL,
  IN_APP_CHANNEL,
],
    
  },

  // =========================================================
  // CLAN WORKFLOW EVENTS
  // =========================================================

  CLAN_INVITATION: {
    mandatory: [],
    preferredAllowed: true,
    opportunistic: [
  WEB_PUSH_CHANNEL,
  IN_APP_CHANNEL,
],
    
  },

  CLAN_JOIN_REQUEST: {
    mandatory: [OFFICIAL_CHANNEL],
    preferredAllowed: true,
    opportunistic: [
  WEB_PUSH_CHANNEL,
  IN_APP_CHANNEL,
],
    
  },

  MEMBERSHIP_APPROVED: {
    mandatory: [OFFICIAL_CHANNEL],
    preferredAllowed: true,
    opportunistic: [
  WEB_PUSH_CHANNEL,
  IN_APP_CHANNEL,
],
    
  },

  MEMBERSHIP_REJECTED: {
    mandatory: [OFFICIAL_CHANNEL],
    preferredAllowed: true,
    opportunistic: [
  WEB_PUSH_CHANNEL,
  IN_APP_CHANNEL,
],
    
  },

  // =========================================================
  // ADMIN EVENTS
  // =========================================================

  ROLE_CHANGED: {
    mandatory: [OFFICIAL_CHANNEL],
    preferredAllowed: true,
    opportunistic: [
  WEB_PUSH_CHANNEL,
  IN_APP_CHANNEL,
],
    
  },

  ADMIN_APPROVAL_REQUIRED: {
    mandatory: [OFFICIAL_CHANNEL],
    preferredAllowed: true,
    opportunistic: [
  WEB_PUSH_CHANNEL,
  IN_APP_CHANNEL,
],
    
  },

  ADMIN_ACTION_REQUIRED: {
    mandatory: [OFFICIAL_CHANNEL],
    preferredAllowed: true,
    opportunistic: [
  WEB_PUSH_CHANNEL,
  IN_APP_CHANNEL,
],
    
  },

  // =========================================================
  // SECURITY EVENTS
  // =========================================================

  SECURITY_ALERT: {
    mandatory: [OFFICIAL_CHANNEL],
    preferredAllowed: true,
    opportunistic: [
  WEB_PUSH_CHANNEL,
  IN_APP_CHANNEL,
],
    
  },

  // =========================================================
  // ENGAGEMENT EVENTS
  // =========================================================

  ONBOARDING_REMINDER: {
    mandatory: [],
    preferredAllowed: true,
    opportunistic: [
  WEB_PUSH_CHANNEL,
  IN_APP_CHANNEL,
],
    
  },

  PROFILE_INCOMPLETE: {
    mandatory: [],
    preferredAllowed: true,
    opportunistic: [
  WEB_PUSH_CHANNEL,
  IN_APP_CHANNEL,
],
    
  },

  COMMUNICATION_BINDING_REMINDER: {
    mandatory: [],
    preferredAllowed: false,
    opportunistic: [
  WEB_PUSH_CHANNEL,
  IN_APP_CHANNEL,
],
    
  },
};

function uniqueChannels(channels = []) {
  return [...new Set(channels.filter(Boolean))];
}

function getEventChannelPolicy(eventType) {
  const policy = EVENT_CHANNEL_POLICY[eventType];

  if (!policy) {
    return {
      mandatory: [],
      preferredAllowed: true,
      opportunistic: DEFAULT_CHANNELS,
      
      knownEvent: false,
    };
  }

  return {
    ...policy,
    knownEvent: true,
  };
}

/**
 * Resolve base channel candidates without DB.
 *
 * preferredChannel can be:
 * EMAIL / WEB_PUSH / IN_APP
 */
function resolveCandidateChannels({
  eventType,
  preferredChannel = null,
  includeOpportunistic = true,
}) {
  const policy = getEventChannelPolicy(eventType);

  const channels = [];

  // Mandatory first
  channels.push(...(policy.mandatory || []));

  // Preferred second
  if (
    preferredChannel &&
    policy.preferredAllowed
  ) {
    channels.push(preferredChannel);
  }

  // Opportunistic last
  if (includeOpportunistic) {
    channels.push(...(policy.opportunistic || []));
  }

  return uniqueChannels(channels);
}

/** -- EGAL - 25.x R2 --
 * Check if channel should be manual-assisted.

  function isManualChannel({
    eventType,
    channel,
  }) {
    if (!channel) return false;

    const policy = getEventChannelPolicy(eventType);

    return (policy.manualChannels || []).includes(channel);
  }
------------------------- */

function isManualChannel() {
  return false;
}

/**
 * Resolve delivery status placeholder.
 *
 * Sprint 25.x:
    Canonical channels
    = PENDING
  function resolveInitialDeliveryStatus({
    eventType,
    channel,
  }) {
    if (
      isManualChannel({
        eventType,
        channel,
      })
    ) {
      return 'MANUAL_REQUIRED';
    }

    return 'PENDING';
  }
 ---------------------- */

function resolveInitialDeliveryStatus() {
  return 'PENDING';
}

/**
 * Whether preferred channel may be used for event.
 */
function allowsPreferredChannel(eventType) {
  return Boolean(
    getEventChannelPolicy(eventType).preferredAllowed
  );
}

/**
 * Whether event has mandatory official email.
 */
function requiresEmail(eventType) {
  const policy = getEventChannelPolicy(eventType);

  return (policy.mandatory || []).includes(
    OFFICIAL_CHANNEL
  );
}

module.exports = {
  OFFICIAL_CHANNEL,
  IN_APP_CHANNEL,
  WEB_PUSH_CHANNEL,
  DEFAULT_CHANNELS,
  EVENT_CHANNEL_POLICY,

  getEventChannelPolicy,
  resolveCandidateChannels,
  resolveInitialDeliveryStatus,
  isManualChannel,
  allowsPreferredChannel,
  requiresEmail,
};