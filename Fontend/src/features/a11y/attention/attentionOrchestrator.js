/**
 * PATH       : src/features/a11y/attention/attentionOrchestrator.js
 * DATETIME   : 2026-05-15T00:00:00+07:00
 * VERSION    : 24.1.0
 * DESCRIPTION:
 * - Sprint EGAL-6.3 — Step 4:
 *   Persistent Attention & Re-entry Recovery.
 *
 * - Central Attention Orchestration Layer.
 *
 * FEATURES:
 * - Restore Once Policy
 * - Attention Priority Queue
 * - Attention Spam Protection
 * - Resume Attention Context
 * - Lightweight recovery integration
 *
 * - Preserve existing API compatibility.
 * - No business logic changes.
 * - No validation changes.
 * - Tuân thủ Q1/Q2.
 */

import {
  loadRecoveryState,
  saveRecoveryState,
} from '../recovery/guidedRecovery.service.js';

const DEFAULT_RECOVERY_KEY = 'attention-orchestrator-global';

const PRIORITY_WEIGHT = {
  low: 1,
  medium: 2,
  high: 3,
};

const ATTENTION_SPAM_WINDOW_MS = 2200;

const RESTORE_ONCE_WINDOW_MS = 1000 * 30;

const attentionState = {
  currentAttentionId: '',
  currentPriority: 'low',

  lastMessage: '',
  lastTimestamp: 0,

  queue: [],

  restoredKeys: new Set(),

  lastRestoredAt: 0,
};

function normalizePriority(priority = 'medium') {
  return PRIORITY_WEIGHT[priority]
    ? priority
    : 'medium';
}

function now() {
  return Date.now();
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Build lightweight attention payload.
 */
function buildAttentionPayload(payload = {}) {
  return {
    id: payload.id || '',
    message: payload.message || '',
    priority: normalizePriority(payload.priority),
    source: payload.source || 'unknown',
    timestamp: payload.timestamp || now(),
  };
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Compare priority.
 */
function hasHigherPriority(a = 'low', b = 'low') {
  return (
    PRIORITY_WEIGHT[normalizePriority(a)] >
    PRIORITY_WEIGHT[normalizePriority(b)]
  );
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Prevent repeated attention spam.
 */
function isAttentionSpam(message = '') {
  const currentTime = now();

  return (
    attentionState.lastMessage === message &&
    currentTime - attentionState.lastTimestamp <
      ATTENTION_SPAM_WINDOW_MS
  );
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Persist orchestrator state.
 */
function persistAttentionState(
  recoveryKey = DEFAULT_RECOVERY_KEY
) {
  saveRecoveryState(
    recoveryKey,
    {
      lastAttentionMessage:
        attentionState.lastMessage,

      lastAttentionPriority:
        attentionState.currentPriority,

      lastAttentionTimestamp:
        attentionState.lastTimestamp,

      meta: {
        source: 'attentionOrchestrator',
        currentAttentionId:
          attentionState.currentAttentionId,
      },
    },
    {
      ttlMs: 1000 * 60 * 30,
    }
  );
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Register new attention event.
 */
export function registerAttention(
  payload = {},
  options = {}
) {
  const {
    recoveryKey = DEFAULT_RECOVERY_KEY,
    preventSpam = true,
    persist = true,
  } = options;

  const normalizedPayload =
    buildAttentionPayload(payload);

  if (
    preventSpam &&
    normalizedPayload.message &&
    isAttentionSpam(normalizedPayload.message)
  ) {
    return {
      accepted: false,
      reason: 'SPAM_PREVENTED',
    };
  }

  const hasPriorityUpgrade =
    hasHigherPriority(
      normalizedPayload.priority,
      attentionState.currentPriority
    );

  /**
   * <2026-05-15T00:00:00+07:00>
   * Queue lower priority attention.
   */
  if (
    attentionState.currentAttentionId &&
    !hasPriorityUpgrade
  ) {
    attentionState.queue.push(
      normalizedPayload
    );

    return {
      accepted: true,
      queued: true,
      payload: normalizedPayload,
    };
  }

  attentionState.currentAttentionId =
    normalizedPayload.id;

  attentionState.currentPriority =
    normalizedPayload.priority;

  attentionState.lastMessage =
    normalizedPayload.message;

  attentionState.lastTimestamp =
    normalizedPayload.timestamp;

  if (persist) {
    persistAttentionState(recoveryKey);
  }

  return {
    accepted: true,
    queued: false,
    payload: normalizedPayload,
  };
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Resolve current attention.
 */
export function resolveAttention(
  attentionId = ''
) {
  if (
    attentionState.currentAttentionId !==
    attentionId
  ) {
    return false;
  }

  attentionState.currentAttentionId = '';
  attentionState.currentPriority = 'low';

  /**
   * <2026-05-15T00:00:00+07:00>
   * Resume queued attention if available.
   */
  if (attentionState.queue.length > 0) {
    const nextAttention =
      attentionState.queue.shift();

    registerAttention(nextAttention, {
      persist: true,
    });
  }

  return true;
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Restore previous attention once.
 */
export function restoreAttentionContext(
  options = {}
) {
  const {
    recoveryKey = DEFAULT_RECOVERY_KEY,
    restoreOnce = true,
  } = options;

  const currentTime = now();

  /**
   * Prevent restore loop.
   */
  if (
    restoreOnce &&
    currentTime -
      attentionState.lastRestoredAt <
      RESTORE_ONCE_WINDOW_MS
  ) {
    return null;
  }

  if (
    restoreOnce &&
    attentionState.restoredKeys.has(
      recoveryKey
    )
  ) {
    return null;
  }

  const recoveryState =
    loadRecoveryState(recoveryKey);

  if (
    !recoveryState?.lastAttentionMessage
  ) {
    return null;
  }

  const restoredPayload =
    buildAttentionPayload({
      id: `restored:${recoveryKey}`,
      message:
        recoveryState.lastAttentionMessage,
      priority:
        recoveryState.lastAttentionPriority ||
        'medium',
      source: 'recovery',
      timestamp:
        recoveryState.lastAttentionTimestamp ||
        currentTime,
    });

  attentionState.currentAttentionId =
    restoredPayload.id;

  attentionState.currentPriority =
    restoredPayload.priority;

  attentionState.lastMessage =
    restoredPayload.message;

  attentionState.lastTimestamp =
    currentTime;

  attentionState.lastRestoredAt =
    currentTime;

  attentionState.restoredKeys.add(
    recoveryKey
  );

  return restoredPayload;
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Get current orchestrator state.
 */
export function getAttentionState() {
  return {
    currentAttentionId:
      attentionState.currentAttentionId,

    currentPriority:
      attentionState.currentPriority,

    lastMessage:
      attentionState.lastMessage,

    lastTimestamp:
      attentionState.lastTimestamp,

    queueLength:
      attentionState.queue.length,

    restoredCount:
      attentionState.restoredKeys.size,
  };
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Clear restore-once tracking.
 */
export function clearAttentionRestoreTracking() {
  attentionState.restoredKeys.clear();
  attentionState.lastRestoredAt = 0;
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Force reset orchestrator state.
 */
export function resetAttentionOrchestrator() {
  attentionState.currentAttentionId = '';
  attentionState.currentPriority = 'low';

  attentionState.lastMessage = '';
  attentionState.lastTimestamp = 0;

  attentionState.queue = [];

  attentionState.restoredKeys.clear();

  attentionState.lastRestoredAt = 0;
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Lightweight attention helper.
 */
export function createAttentionId(
  prefix = 'attention'
) {
  return `${prefix}:${now()}:${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Existing compatibility export.
 */
const attentionOrchestrator = {
  registerAttention,
  
  resolveAttention,

  restoreAttentionContext,

  getAttentionState,

  clearAttentionRestoreTracking,

  resetAttentionOrchestrator,

  createAttentionId,
};

export default attentionOrchestrator;