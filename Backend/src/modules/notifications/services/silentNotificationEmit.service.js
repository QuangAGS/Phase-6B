// ============================================================
// PATH: src/modules/notifications/services/silentNotificationEmit.service.js
// DATETIME: 2026-06-04 14:00
// VERSION: EGAL-25.1-PHASE-6A.1
// DESCRIPTION:
//   Silent notification emit helper for Auth/Security business flows.
//   Doctrine:
//   - Persist-first notification architecture.
//   - Notification failure must NOT break business flow.
//   - No UI/UX or unrelated business behavior changes.
//   - Do not log sensitive payload data.
// ============================================================

const notificationOrchestrator = require('../orchestrator/notificationOrchestrator');

/**
 * <2026-06-04 14:00>
 * Purpose:
 *   Safely emit a notification event without allowing notification failure
 *   to interrupt the caller's business flow.
 *
 * Notes:
 *   - This function never throws.
 *   - Default executeImmediately is false to preserve Q1-safe behavior.
 *   - Avoid logging full payload because Auth/Security flows may contain
 *     sensitive information.
 *
 * @param {string} eventName
 * @param {Object} payload
 * @param {Object} meta
 * @returns {Promise<Object|null>}
 */
async function silentEmit(eventName, payload = {}, meta = {}) {
  try {
    return await notificationOrchestrator.emit(eventName, {
      ...payload,
      executeImmediately: payload.executeImmediately ?? false,
    });
  } catch (error) {
    console.error('[SilentNotificationEmitFailed]', {
      eventName,
      meta,
      error: error?.message || error,
    });

    return null;
  }
}

/**
 * <2026-06-04 14:00>
 * Purpose:
 *   Export silent notification helper for business services.
 *
 * Notes:
 *   - Keep named export to avoid changing existing module style.
 */
module.exports = {
  silentEmit,
};