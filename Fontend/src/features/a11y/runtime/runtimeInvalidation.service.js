/**
 * PATH       : src/features/a11y/runtime/runtimeInvalidation.service.js
 * DATETIME   : 2026-05-15T00:00:00+07:00
 * VERSION    : 24.0.0
 * DESCRIPTION:
 * - Sprint EGAL-6.5:
 *   Runtime Invalidation Layer.
 *
 * PURPOSE:
 * - Centralized stale runtime invalidation.
 * - Field mutation invalidation.
 * - Dependency invalidation.
 * - Runtime versioning.
 * - Revalidation request signaling.
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

export const INVALIDATION_TYPES = {
  FIELD_MUTATION: 'FIELD_MUTATION',
  DEPENDENCY_MUTATION: 'DEPENDENCY_MUTATION',
  ONLINE_VALIDATION_STALE: 'ONLINE_VALIDATION_STALE',
  PROGRESSION_STALE: 'PROGRESSION_STALE',
  ATTENTION_STALE: 'ATTENTION_STALE',
  FULL_RUNTIME_RESET: 'FULL_RUNTIME_RESET',
};

export const INVALIDATION_SEVERITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
};

export const RUNTIME_INVALIDATION_ACTIONS = {
  CLEAR_COMPLETED_FIELD: 'CLEAR_COMPLETED_FIELD',
  CLEAR_ONLINE_VALIDATION: 'CLEAR_ONLINE_VALIDATION',
  CLEAR_ATTENTION: 'CLEAR_ATTENTION',
  RESET_PROGRESSION: 'RESET_PROGRESSION',
  REQUEST_REVALIDATION: 'REQUEST_REVALIDATION',
  INCREMENT_RUNTIME_VERSION: 'INCREMENT_RUNTIME_VERSION',
};

/**
 * =========================================================
 * DEFAULT DEPENDENCY MAPS
 * =========================================================
 */

export const DEFAULT_FIELD_DEPENDENCY_MAP = {
  tenantId: {
    zones: ['clanSearch'],
    completedFields: ['clanSearch'],
    onlineValidation: [],
    severity: INVALIDATION_SEVERITY.HIGH,
  },

  clanName: {
    zones: ['clanSearch', 'clanInfo'],
    completedFields: ['clanSearch', 'clanInfo'],
    onlineValidation: [],
    severity: INVALIDATION_SEVERITY.HIGH,
  },

  description: {
    zones: ['clanInfo'],
    completedFields: ['clanInfo'],
    onlineValidation: [],
    severity: INVALIDATION_SEVERITY.MEDIUM,
  },

  temp_full_name: {
    zones: ['personalInfo'],
    completedFields: ['personalInfo'],
    onlineValidation: [],
    severity: INVALIDATION_SEVERITY.MEDIUM,
  },

  temp_father_name: {
    zones: ['personalInfo'],
    completedFields: ['personalInfo'],
    onlineValidation: [],
    severity: INVALIDATION_SEVERITY.MEDIUM,
  },

  temp_relationship: {
    zones: ['personalInfo'],
    completedFields: ['personalInfo'],
    onlineValidation: [],
    severity: INVALIDATION_SEVERITY.MEDIUM,
  },

  temp_note: {
    zones: ['personalInfo'],
    completedFields: ['personalInfo'],
    onlineValidation: [],
    severity: INVALIDATION_SEVERITY.MEDIUM,
  },

  phone: {
    zones: ['accountInfo', 'contactInfo'],
    completedFields: ['accountInfo', 'contactInfo'],
    onlineValidation: ['phone'],
    severity: INVALIDATION_SEVERITY.CRITICAL,
  },

  email: {
    zones: ['contactInfo'],
    completedFields: ['contactInfo'],
    onlineValidation: ['email'],
    severity: INVALIDATION_SEVERITY.CRITICAL,
  },

  password: {
    zones: ['accountInfo', 'securityInfo'],
    completedFields: ['accountInfo', 'securityInfo'],
    onlineValidation: [],
    severity: INVALIDATION_SEVERITY.HIGH,
  },
};

/**
 * =========================================================
 * INTERNAL HELPERS
 * =========================================================
 */

function safeObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value = '') {
  return String(value || '').trim();
}

function now() {
  return Date.now();
}

function uniqueArray(items = []) {
  return [...new Set(safeArray(items).filter(Boolean))];
}

/**
 * =========================================================
 * CHANGE DETECTION
 * =========================================================
 */

export function hasFieldChanged(previousValues = {}, nextValues = {}, fieldKey = '') {
  const key = safeString(fieldKey);

  if (!key) return false;

  const prev = safeObject(previousValues);
  const next = safeObject(nextValues);

  return prev[key] !== next[key];
}

export function detectChangedFields(previousValues = {}, nextValues = {}, fieldKeys = []) {
  const keys = safeArray(fieldKeys);

  return keys.filter((fieldKey) =>
    hasFieldChanged(previousValues, nextValues, fieldKey)
  );
}

/**
 * =========================================================
 * INVALIDATION PLAN
 * =========================================================
 */

export function createInvalidationPlan(changedFields = [], options = {}) {
  const dependencyMap =
    options.dependencyMap || DEFAULT_FIELD_DEPENDENCY_MAP;

  const changed = uniqueArray(changedFields);

  const affectedZones = [];
  const completedFieldsToClear = [];
  const onlineValidationToClear = [];
  const reasons = [];

  let severity = INVALIDATION_SEVERITY.LOW;

  const severityRank = {
    [INVALIDATION_SEVERITY.LOW]: 1,
    [INVALIDATION_SEVERITY.MEDIUM]: 2,
    [INVALIDATION_SEVERITY.HIGH]: 3,
    [INVALIDATION_SEVERITY.CRITICAL]: 4,
  };

  changed.forEach((fieldKey) => {
    const rule = dependencyMap[fieldKey] || {};

    affectedZones.push(...safeArray(rule.zones));
    completedFieldsToClear.push(...safeArray(rule.completedFields));
    onlineValidationToClear.push(...safeArray(rule.onlineValidation));

    reasons.push({
      type: INVALIDATION_TYPES.FIELD_MUTATION,
      field: fieldKey,
      severity: rule.severity || INVALIDATION_SEVERITY.MEDIUM,
    });

    if (
      severityRank[rule.severity || INVALIDATION_SEVERITY.MEDIUM] >
      severityRank[severity]
    ) {
      severity = rule.severity || INVALIDATION_SEVERITY.MEDIUM;
    }
  });

  const actions = [
    RUNTIME_INVALIDATION_ACTIONS.REQUEST_REVALIDATION,
    RUNTIME_INVALIDATION_ACTIONS.INCREMENT_RUNTIME_VERSION,
  ];

  if (completedFieldsToClear.length > 0) {
    actions.push(RUNTIME_INVALIDATION_ACTIONS.CLEAR_COMPLETED_FIELD);
  }

  if (onlineValidationToClear.length > 0) {
    actions.push(RUNTIME_INVALIDATION_ACTIONS.CLEAR_ONLINE_VALIDATION);
  }

  if (changed.length > 0) {
    actions.push(RUNTIME_INVALIDATION_ACTIONS.RESET_PROGRESSION);
    actions.push(RUNTIME_INVALIDATION_ACTIONS.CLEAR_ATTENTION);
  }

  return {
    invalidated: changed.length > 0,

    changedFields: changed,

    affectedZones: uniqueArray(affectedZones),

    completedFieldsToClear: uniqueArray(completedFieldsToClear),

    onlineValidationToClear: uniqueArray(onlineValidationToClear),

    actions: uniqueArray(actions),

    reasons,

    severity,

    requiresRevalidation: changed.length > 0,

    runtimeVersionIncrement: changed.length > 0 ? 1 : 0,

    createdAt: now(),
  };
}

export function createFullRuntimeResetPlan(reason = 'FULL_RUNTIME_RESET') {
  return {
    invalidated: true,

    changedFields: [],

    affectedZones: [],

    completedFieldsToClear: ['*'],

    onlineValidationToClear: ['*'],

    actions: [
      RUNTIME_INVALIDATION_ACTIONS.CLEAR_COMPLETED_FIELD,
      RUNTIME_INVALIDATION_ACTIONS.CLEAR_ONLINE_VALIDATION,
      RUNTIME_INVALIDATION_ACTIONS.CLEAR_ATTENTION,
      RUNTIME_INVALIDATION_ACTIONS.RESET_PROGRESSION,
      RUNTIME_INVALIDATION_ACTIONS.REQUEST_REVALIDATION,
      RUNTIME_INVALIDATION_ACTIONS.INCREMENT_RUNTIME_VERSION,
    ],

    reasons: [
      {
        type: INVALIDATION_TYPES.FULL_RUNTIME_RESET,
        reason,
        severity: INVALIDATION_SEVERITY.CRITICAL,
      },
    ],

    severity: INVALIDATION_SEVERITY.CRITICAL,

    requiresRevalidation: true,

    runtimeVersionIncrement: 1,

    createdAt: now(),
  };
}

/**
 * =========================================================
 * RUNTIME VERSIONING
 * =========================================================
 */

export function incrementRuntimeVersion(currentVersion = 0, plan = {}) {
  const increment = Number(plan?.runtimeVersionIncrement || 0);

  return Number(currentVersion || 0) + increment;
}

export function isRuntimeStale(currentVersion = 0, transitionVersion = 0) {
  return Number(currentVersion || 0) !== Number(transitionVersion || 0);
}

/**
 * =========================================================
 * ATTENTION TARGET HELPERS
 * =========================================================
 */

export function getPrimaryAffectedZone(plan = {}) {
  const zones = safeArray(plan.affectedZones);

  return zones[0] || '';
}

export function getPrimaryChangedField(plan = {}) {
  const fields = safeArray(plan.changedFields);

  return fields[0] || '';
}

export function shouldClearOnlineValidation(plan = {}, fieldKey = '') {
  const key = safeString(fieldKey);

  if (!key) return false;

  const fields = safeArray(plan.onlineValidationToClear);

  return fields.includes('*') || fields.includes(key);
}

export function shouldClearCompletedField(plan = {}, fieldKey = '') {
  const key = safeString(fieldKey);

  if (!key) return false;

  const fields = safeArray(plan.completedFieldsToClear);

  return fields.includes('*') || fields.includes(key);
}

/**
 * =========================================================
 * PUBLIC SERVICE EXPORT
 * =========================================================
 */

const runtimeInvalidationService = {
  INVALIDATION_TYPES,
  INVALIDATION_SEVERITY,
  RUNTIME_INVALIDATION_ACTIONS,

  DEFAULT_FIELD_DEPENDENCY_MAP,

  hasFieldChanged,
  detectChangedFields,

  createInvalidationPlan,
  createFullRuntimeResetPlan,

  incrementRuntimeVersion,
  isRuntimeStale,

  getPrimaryAffectedZone,
  getPrimaryChangedField,

  shouldClearOnlineValidation,
  shouldClearCompletedField,
};

export default runtimeInvalidationService;