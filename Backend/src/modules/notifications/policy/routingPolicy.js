/**
 * PATH:
 * backend/src/modules/notifications/policy/routingPolicy.js
 *
 * PURPOSE:
 * - EGAL-25 Sprint 25.x R2
 * - Final route resolver for Notification Orchestrator
 * - Combines:
 *   reliabilityPolicy
 *   channelPolicy
 *   user preference
 *   communication binding
 *
 * IMPORTANT:
 * - No DB access here.
 * - Caller must pass preference/binding data.
 * - No delivery here.
 *
 * DOCTRINE:
 * Social channels are no longer canonical communication.
    Canonical routing only:
      WEB_PUSH
      EMAIL
      IN_APP
 */

const reliabilityPolicy = require('./reliabilityPolicy');
const channelPolicy = require('./channelPolicy');

function uniqueChannels(channels = []) {
  return [...new Set(channels.filter(Boolean))];
}

function normalizeBindingMap(bindings = []) {
  const map = new Map();

  for (const binding of bindings || []) {
    if (!binding?.channel) continue;
    map.set(binding.channel, binding);
  }

  return map;
}

function getPreferredChannel(preference = null) {
  if (!preference) return null;
  if (!preference.enabled) return null;

  const channel = preference.channel || null;

  const allowed = [
    'WEB_PUSH',
    'EMAIL',
    'IN_APP',
  ];

  return allowed.includes(channel)
    ? channel
    : null;
}

function isBindingConnected(binding = null) {
  return binding?.binding_state === 'CONNECTED';
}

function isBindingSuggested(binding = null) {
  return binding?.binding_state === 'SUGGESTED';
}

function resolveRouteItem({
  eventType,
  channel,
  binding = null,
}) {
  const initialStatus =
    channelPolicy.resolveInitialDeliveryStatus({
      eventType,
      channel,
    });

  const isManual =
    channelPolicy.isManualChannel({
      eventType,
      channel,
    });

  return {
    channel,
    status: initialStatus,

    manualRequired: isManual,

    bindingState:
      binding?.binding_state || null,

    connected:
      isBindingConnected(binding),

    suggested:
      isBindingSuggested(binding),
  };
}

/**
 * Resolve final routes.
 *
 * @param {Object} params
 * @param {String} params.eventType
 * @param {Object|null} params.preference
 * @param {Array} params.bindings
 * @param {Array|null} params.overrideChannels
 * @param {Boolean} params.includeOpportunistic
 */
function resolveRoutes({
  eventType,
  preference = null,
  bindings = [],
  overrideChannels = null,
  includeOpportunistic = true,
}) {
  const severity =
    reliabilityPolicy.resolveSeverity(eventType);

  const reliability =
    reliabilityPolicy.resolveReliability(eventType);

  const preferredChannel =
    getPreferredChannel(preference);

  const bindingMap =
    normalizeBindingMap(bindings);

  let channels = [];

  // Caller override is strongest.
  if (
    Array.isArray(overrideChannels) &&
    overrideChannels.length
  ) {
    channels = overrideChannels;
  } else {
    channels =
      channelPolicy.resolveCandidateChannels({
        eventType,
        preferredChannel,
        includeOpportunistic,
      });
  }

  channels = uniqueChannels(channels);
  const canonicalChannels = [
    'WEB_PUSH',
    'EMAIL',
    'IN_APP',
  ];

  channels = channels.filter((channel) =>
    canonicalChannels.includes(channel)
  );

  const routes = channels.map((channel) => {
    const binding =
      bindingMap.get(channel) || null;

    return resolveRouteItem({
      eventType,
      channel,
      binding,
    });
  });

  return {
    eventType,
    severity,
    reliability,

    preferredChannel,

    requiresEmail:
      channelPolicy.requiresEmail(eventType),

    routes,
  };
}

/**
 * Resolve whether route contains channel.
 */
function hasChannel(routeResult, channel) {
  return Boolean(
    routeResult?.routes?.some(
      (item) => item.channel === channel
    )
  );
}

/**
 * Resolve manual-required routes.
 */
function getManualRoutes(routeResult) {
  return (routeResult?.routes || []).filter(
    (item) => item.manualRequired
  );
}

/**
 * Resolve automated routes.
 *
 * Sprint 25.0:
 * Automated only means status PENDING.
 * Actual sending is not implemented yet.
 */
function getAutomatedRoutes(routeResult) {
  return (routeResult?.routes || []).filter(
    (item) => !item.manualRequired
  );
}

module.exports = {
  resolveRoutes,
  hasChannel,
  getManualRoutes,
  getAutomatedRoutes,

  normalizeBindingMap,
  getPreferredChannel,
  isBindingConnected,
  isBindingSuggested,
};