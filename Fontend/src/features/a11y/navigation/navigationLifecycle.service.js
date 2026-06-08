/**
 * PATH       : src/features/a11y/navigation/navigationLifecycle.service.js
 * DATETIME   : 2026-05-15T00:00:00+07:00
 * VERSION    : 24.0.0
 * DESCRIPTION:
 * - Sprint EGAL-6.5:
 *   Form Navigation State Lifecycle.
 *
 * PURPOSE:
 * - Centralized navigation lifecycle model.
 * - State category management.
 * - Transition policy resolution.
 * - Re-entry reconstruction strategy.
 * - Runtime state reset rules.
 *
 * ARCHITECTURE:
 * - Draft State          => persistable
 * - Runtime State        => recomputed
 * - Transition Snapshot  => contextual
 * - Re-entry Policy      => deterministic
 *
 * IMPORTANT:
 * - NO React dependency.
 * - NO form library dependency.
 * - NO business logic changes.
 * - Tuân thủ Q1/Q2.
 */

/**
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

export const NAVIGATION_TYPES = {
  SOFT: 'SOFT',
  VIEW: 'VIEW',
  HARD: 'HARD',
};

export const REENTRY_TYPES = {
  RELOAD: 'RELOAD',

  EDIT_FROM_WAITING:
    'EDIT_FROM_WAITING',

  AUTH_MODE_SWITCH:
    'AUTH_MODE_SWITCH',

  RESULT_RETRY:
    'RESULT_RETRY',

  MANUAL_BACK:
    'MANUAL_BACK',

  UNKNOWN: 'UNKNOWN',
};

export const STATE_CATEGORIES = {
  INITIAL: 'INITIAL',

  DRAFT: 'DRAFT',

  RUNTIME: 'RUNTIME',

  TRANSITION: 'TRANSITION',
};

/**
 * =========================================================
 * INTERNAL HELPERS
 * =========================================================
 */

function safeObject(value) {
  return value &&
    typeof value === 'object'
    ? value
    : {};
}

function safeString(value = '') {
  return String(value || '').trim();
}

function now() {
  return Date.now();
}

/**
 * =========================================================
 * STATE CATEGORY HELPERS
 * =========================================================
 */

/**
 * <2026-05-15T00:00:00+07:00>
 * Extract persistable draft data only.
 *
 * IMPORTANT:
 * Runtime-derived state MUST NOT persist.
 */
export function extractDraftState(
  formData = {}
) {
  const source = safeObject(formData);

  const draft = {};

  Object.keys(source).forEach((key) => {
    /**
     * Exclude internal runtime keys.
     */
    if (
      key.startsWith('__') ||
      key.startsWith('_runtime') ||
      key.startsWith('_guided') ||
      key.startsWith('_attention')
    ) {
      return;
    }

    draft[key] = source[key];
  });

  return draft;
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Create clean runtime state.
 */
export function createInitialRuntimeState() {
  return {
    completedFields: {},

    activeField: '',

    activeZone: '',

    currentStep: 0,

    onlineValidation: {},

    progression: {},

    attention: {},

    validationVersion: 0,

    reinitializedAt: now(),
  };
}

/**
 * =========================================================
 * NAVIGATION TYPE RESOLUTION
 * =========================================================
 */

/**
 * <2026-05-15T00:00:00+07:00>
 * Resolve navigation boundary type.
 */
export function resolveNavigationType(
  transition = {}
) {
  const source =
    safeString(transition?.source);

  const target =
    safeString(transition?.target);

  /**
   * Soft intra-view transitions.
   */
  if (
    source === target &&
    transition?.soft === true
  ) {
    return NAVIGATION_TYPES.SOFT;
  }

  /**
   * Hard transitions.
   */
  if (
    transition?.hard === true ||
    target === 'ResultPage' ||
    target === 'Dashboard'
  ) {
    return NAVIGATION_TYPES.HARD;
  }

  /**
   * Default view navigation.
   */
  return NAVIGATION_TYPES.VIEW;
}

/**
 * =========================================================
 * REENTRY POLICY RESOLUTION
 * =========================================================
 */

/**
 * <2026-05-15T00:00:00+07:00>
 * Detect re-entry type.
 */
export function resolveReentryType(
  context = {}
) {
  if (context?.reload === true) {
    return REENTRY_TYPES.RELOAD;
  }

  if (
    context?.from === 'WaitingPage' &&
    context?.action === 'edit'
  ) {
    return REENTRY_TYPES.EDIT_FROM_WAITING;
  }

  if (
    context?.authModeSwitch === true
  ) {
    return REENTRY_TYPES.AUTH_MODE_SWITCH;
  }

  if (
    context?.from === 'ResultPage' &&
    context?.action === 'retry'
  ) {
    return REENTRY_TYPES.RESULT_RETRY;
  }

  if (context?.manualBack === true) {
    return REENTRY_TYPES.MANUAL_BACK;
  }

  return REENTRY_TYPES.UNKNOWN;
}

/**
 * =========================================================
 * REENTRY RECONSTRUCTION POLICY
 * =========================================================
 */

/**
 * <2026-05-15T00:00:00+07:00>
 * Decide what to restore/reset/recompute.
 */
export function resolveReentryPolicy(
  reentryType =
    REENTRY_TYPES.UNKNOWN
) {
  switch (reentryType) {
    /**
     * Browser reload.
     */
    case REENTRY_TYPES.RELOAD:
      return {
        restoreDraft: true,

        restoreRuntime: false,

        restoreAttention: false,

        recomputeRuntime: true,

        resetProgression: true,

        resetOnlineValidation: true,

        resetAttention: true,
      };

    /**
     * WaitingPage -> edit.
     */
    case REENTRY_TYPES.EDIT_FROM_WAITING:
      return {
        restoreDraft: true,

        restoreRuntime: false,

        restoreAttention: false,

        recomputeRuntime: true,

        resetProgression: true,

        resetOnlineValidation: true,

        resetAttention: true,
      };

    /**
     * Login <-> Register.
     */
    case REENTRY_TYPES.AUTH_MODE_SWITCH:
      return {
        restoreDraft: true,

        restoreRuntime: false,

        restoreAttention: false,

        recomputeRuntime: true,

        resetProgression: true,

        resetOnlineValidation: true,

        resetAttention: true,
      };

    /**
     * Retry after failure.
     */
    case REENTRY_TYPES.RESULT_RETRY:
      return {
        restoreDraft: true,

        restoreRuntime: false,

        restoreAttention: false,

        recomputeRuntime: true,

        resetProgression: true,

        resetOnlineValidation: true,

        resetAttention: true,
      };

    /**
     * Default safe behavior.
     */
    default:
      return {
        restoreDraft: true,

        restoreRuntime: false,

        restoreAttention: false,

        recomputeRuntime: true,

        resetProgression: true,

        resetOnlineValidation: true,

        resetAttention: true,
      };
  }
}

/**
 * =========================================================
 * TRANSITION SNAPSHOT
 * =========================================================
 */

/**
 * <2026-05-15T00:00:00+07:00>
 * Build lightweight transition snapshot.
 */
export function createTransitionSnapshot(
  payload = {}
) {
  return {
    from:
      safeString(payload?.from),

    to:
      safeString(payload?.to),

    intent:
      safeString(payload?.intent),

    timestamp: now(),

    navigationType:
      resolveNavigationType(payload),

    metadata:
      safeObject(payload?.metadata),
  };
}

/**
 * =========================================================
 * RUNTIME RECONSTRUCTION
 * =========================================================
 */

/**
 * <2026-05-15T00:00:00+07:00>
 * Rebuild runtime state from current draft values.
 *
 * IMPORTANT:
 * Runtime truth MUST derive from draft.
 */
export function reconstructRuntimeState(
  draftState = {},
  options = {}
) {
  return {
    ...createInitialRuntimeState(),

    reconstructed: true,

    reconstructedAt: now(),

    draftHash:
      JSON.stringify(
        extractDraftState(draftState)
      ).length,
  };
}

/**
 * =========================================================
 * STALE INVALIDATION
 * =========================================================
 */

/**
 * <2026-05-15T00:00:00+07:00>
 * Determine whether runtime state
 * must be invalidated after mutation.
 */
export function shouldInvalidateRuntimeState(
  previousValues = {},
  nextValues = {}
) {
  const prev =
    safeObject(previousValues);

  const next =
    safeObject(nextValues);

  const criticalFields = [
    'phone',
    'email',
    'password',

    'tenantId',
    'clanName',

    'temp_full_name',
    'temp_relationship',
    'temp_note',
  ];

  return criticalFields.some(
    (field) =>
      prev[field] !== next[field]
  );
}

/**
 * =========================================================
 * VALIDATION GATE PREPARATION
 * =========================================================
 */

/**
 * <2026-05-15T00:00:00+07:00>
 * Build validation gate context.
 */
export function createValidationContext(
  payload = {}
) {
  return {
    source:
      safeString(payload?.source),

    target:
      safeString(payload?.target),

    transitionType:
      resolveNavigationType(payload),

    timestamp: now(),

    requiresFreshValidation: true,

    metadata:
      safeObject(payload?.metadata),
  };
}

/**
 * =========================================================
 * PUBLIC SERVICE EXPORT
 * =========================================================
 */

const navigationLifecycleService = {
  NAVIGATION_TYPES,

  REENTRY_TYPES,

  STATE_CATEGORIES,

  extractDraftState,

  createInitialRuntimeState,

  resolveNavigationType,

  resolveReentryType,

  resolveReentryPolicy,

  createTransitionSnapshot,

  reconstructRuntimeState,

  shouldInvalidateRuntimeState,

  createValidationContext,
};

export default navigationLifecycleService;