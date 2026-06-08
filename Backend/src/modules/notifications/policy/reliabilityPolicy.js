/**
 * PATH:
 * backend/src/modules/notifications/policy/reliabilityPolicy.js
 *
 * PURPOSE:
 * - EGAL-25 Sprint 25.0
 * - Resolve notification severity + reliability by event type
 * - No DB access
 * - No delivery logic
 * - No business workflow logic
 *
 * DOCTRINE:
 * Severity determines reliability.
 * Preference influences.
 * Reliability decides.
 */

const DEFAULT_SEVERITY = 'INFO';
const DEFAULT_RELIABILITY = 'LOW';

/**
 * Canonical event policy table.
 *
 * NOTE:
 * This is skeleton policy for Sprint 25.0.
 * Future versions may load this from config/database.
 */
const EVENT_RELIABILITY_POLICY = {
  // =========================================================
  // ONBOARDING EVENTS
  // =========================================================

  USER_REGISTERED: {
    severity: 'INFO',
    reliability: 'LOW',
  },

  USER_APPROVAL_PENDING: {
    severity: 'WARNING',
    reliability: 'MEDIUM',
  },

  USER_APPROVED: {
    severity: 'IMPORTANT',
    reliability: 'HIGH',
  },

  USER_REJECTED: {
    severity: 'IMPORTANT',
    reliability: 'HIGH',
  },

  // =========================================================
  // AUTHENTICATION EVENTS
  // =========================================================

  PASSWORD_RESET_REQUESTED: {
    severity: 'IMPORTANT',
    reliability: 'HIGH',
  },

  PASSWORD_CHANGED: {
    severity: 'IMPORTANT',
    reliability: 'HIGH',
  },

  LOGIN_SUCCESS: {
    severity: 'INFO',
    reliability: 'LOW',
  },

  SUSPICIOUS_LOGIN: {
    severity: 'CRITICAL',
    reliability: 'VERY_HIGH',
  },

  ACCOUNT_LOCKED: {
    severity: 'CRITICAL',
    reliability: 'VERY_HIGH',
  },

  RECOVERY_EMAIL_CHANGED: {
    severity: 'CRITICAL',
    reliability: 'VERY_HIGH',
  },

  // =========================================================
  // CLAN WORKFLOW EVENTS
  // =========================================================

  CLAN_INVITATION: {
    severity: 'WARNING',
    reliability: 'MEDIUM',
  },

  CLAN_JOIN_REQUEST: {
    severity: 'WARNING',
    reliability: 'MEDIUM',
  },

  MEMBERSHIP_APPROVED: {
    severity: 'IMPORTANT',
    reliability: 'HIGH',
  },

  MEMBERSHIP_REJECTED: {
    severity: 'IMPORTANT',
    reliability: 'HIGH',
  },

  // =========================================================
  // ADMIN EVENTS
  // =========================================================

  ROLE_CHANGED: {
    severity: 'IMPORTANT',
    reliability: 'HIGH',
  },

  ADMIN_APPROVAL_REQUIRED: {
    severity: 'WARNING',
    reliability: 'HIGH',
  },

  ADMIN_ACTION_REQUIRED: {
    severity: 'IMPORTANT',
    reliability: 'HIGH',
  },

  // =========================================================
  // SECURITY EVENTS
  // =========================================================

  SECURITY_ALERT: {
    severity: 'CRITICAL',
    reliability: 'VERY_HIGH',
  },

  // =========================================================
  // ENGAGEMENT EVENTS
  // =========================================================

  ONBOARDING_REMINDER: {
    severity: 'INFO',
    reliability: 'LOW',
  },

  PROFILE_INCOMPLETE: {
    severity: 'WARNING',
    reliability: 'MEDIUM',
  },

  COMMUNICATION_BINDING_REMINDER: {
    severity: 'INFO',
    reliability: 'LOW',
  },
};

function getEventReliabilityPolicy(eventType) {
  if (!eventType) {
    return {
      severity: DEFAULT_SEVERITY,
      reliability: DEFAULT_RELIABILITY,
      knownEvent: false,
    };
  }

  const policy = EVENT_RELIABILITY_POLICY[eventType];

  if (!policy) {
    return {
      severity: DEFAULT_SEVERITY,
      reliability: DEFAULT_RELIABILITY,
      knownEvent: false,
    };
  }

  return {
    ...policy,
    knownEvent: true,
  };
}

function resolveSeverity(eventType, overrideSeverity = null) {
  if (overrideSeverity) return overrideSeverity;

  return getEventReliabilityPolicy(eventType).severity;
}

function resolveReliability(eventType, overrideReliability = null) {
  if (overrideReliability) return overrideReliability;

  return getEventReliabilityPolicy(eventType).reliability;
}

function isHighReliability(eventType) {
  const reliability = resolveReliability(eventType);

  return reliability === 'HIGH' || reliability === 'VERY_HIGH';
}

function isCriticalReliability(eventType) {
  return resolveReliability(eventType) === 'VERY_HIGH';
}

module.exports = {
  DEFAULT_SEVERITY,
  DEFAULT_RELIABILITY,
  EVENT_RELIABILITY_POLICY,

  getEventReliabilityPolicy,
  resolveSeverity,
  resolveReliability,
  isHighReliability,
  isCriticalReliability,
};