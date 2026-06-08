/**
 * PATH       : src/features/a11y/guided/guidedProgression.service.js
 * DATETIME   : 2026-05-15T00:00:00+07:00
 * VERSION    : 24.0.0
 * DESCRIPTION:
 * - Sprint EGAL-6.4:
 *   Validation Driven Attention Flow.
 *
 * PURPOSE:
 * - Determine next guided attention target.
 * - Validation-aware progression engine.
 * - Smart field/group navigation.
 * - Lightweight orchestration helper.
 *
 * - NO React dependency.
 * - NO form library dependency.
 * - NO business logic changes.
 * - NO validation schema changes.
 * - Tuân thủ Q1/Q2.
 */

/**
 * <2026-05-15T00:00:00+07:00>
 * Normalize field key.
 */
function normalizeKey(value = '') {
  return String(value || '').trim();
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Convert unknown value to boolean safely.
 */
function toBoolean(value) {
  return value === true;
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Normalize guided zones.
 *
 * Zone structure:
 * {
 *   id,
 *   label,
 *   fields: [],
 *   required: true,
 *   enabled: true,
 * }
 */
export function normalizeGuidedZones(
  zones = []
) {
  if (!Array.isArray(zones)) {
    return [];
  }

  return zones
    .filter(Boolean)
    .map((zone, index) => ({
      id:
        normalizeKey(zone?.id) ||
        `zone-${index}`,

      label:
        zone?.label ||
        `Zone ${index + 1}`,

      fields: Array.isArray(zone?.fields)
        ? zone.fields
            .map(normalizeKey)
            .filter(Boolean)
        : [],

      required:
        zone?.required !== false,

      enabled:
        zone?.enabled !== false,

      priority:
        zone?.priority || 'medium',

      metadata:
        zone?.metadata || {},
    }));
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Determine if field is valid.
 */
export function isFieldAcceptable(
  fieldKey,
  validationState = {},
  options = {}
) {
  const normalizedField =
    normalizeKey(fieldKey);

  if (!normalizedField) {
    return false;
  }

  const {
    validFields = {},
    completedFields = {},
    invalidFields = {},
  } = validationState;

  /**
   * Explicit invalid has highest priority.
   */
  if (
    toBoolean(
      invalidFields[normalizedField]
    )
  ) {
    return false;
  }

  /**
   * Explicit valid.
   */
  if (
    toBoolean(
      validFields[normalizedField]
    )
  ) {
    return true;
  }

  /**
   * Completed fallback.
   */
  if (
    toBoolean(
      completedFields[normalizedField]
    )
  ) {
    return true;
  }

  return false;
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Determine whether entire zone is acceptable.
 */
export function isZoneAcceptable(
  zone,
  validationState = {},
  options = {}
) {
  if (!zone?.enabled) {
    return true;
  }

  if (
    !Array.isArray(zone?.fields) ||
    zone.fields.length === 0
  ) {
    return true;
  }

  return zone.fields.every((fieldKey) =>
    isFieldAcceptable(
      fieldKey,
      validationState,
      options
    )
  );
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Find first invalid field inside zone.
 */
export function findFirstPendingField(
  zone,
  validationState = {},
  options = {}
) {
  if (!zone?.fields?.length) {
    return '';
  }

  return (
    zone.fields.find(
      (fieldKey) =>
        !isFieldAcceptable(
          fieldKey,
          validationState,
          options
        )
    ) || ''
  );
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Find next target zone.
 */
export function findNextPendingZone(
  zones = [],
  validationState = {},
  options = {}
) {
  const normalizedZones =
    normalizeGuidedZones(zones);

  return (
    normalizedZones.find(
      (zone) =>
        zone.enabled &&
        !isZoneAcceptable(
          zone,
          validationState,
          options
        )
    ) || null
  );
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Core progression resolver.
 *
 * RETURN:
 * {
 *   done,
 *   nextZoneId,
 *   nextField,
 *   reason,
 * }
 */
export function determineNextAttentionTarget(
  zones = [],
  validationState = {},
  options = {}
) {
  const normalizedZones =
    normalizeGuidedZones(zones);

  if (normalizedZones.length === 0) {
    return {
      done: true,
      nextZoneId: '',
      nextField: '',
      reason: 'NO_ZONES',
    };
  }

  const nextZone =
    findNextPendingZone(
      normalizedZones,
      validationState,
      options
    );

  /**
   * All complete.
   */
  if (!nextZone) {
    return {
      done: true,
      nextZoneId: '',
      nextField: '',
      reason: 'ALL_COMPLETE',
    };
  }

  const nextField =
    findFirstPendingField(
      nextZone,
      validationState,
      options
    );

  return {
    done: false,

    nextZoneId: nextZone.id,

    nextField,

    priority:
      nextZone.priority || 'medium',

    reason:
      nextField
        ? 'NEXT_PENDING_FIELD'
        : 'NEXT_PENDING_ZONE',

    zone: nextZone,
  };
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Determine whether attention should advance.
 */
export function shouldAdvanceAttention(
  previousState = {},
  nextState = {},
  options = {}
) {
  const previousField =
    normalizeKey(
      previousState?.activeField
    );

  const nextField =
    normalizeKey(nextState?.nextField);

  if (!nextField) {
    return false;
  }

  /**
   * Same field → no movement.
   */
  if (
    previousField &&
    previousField === nextField
  ) {
    return false;
  }

  return true;
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Build lightweight attention instruction.
 */
export function buildAttentionInstruction(
  target = {},
  options = {}
) {
  if (!target || target.done) {
    return {
      type: 'COMPLETE',
      field: '',
      zoneId: '',
      message:
        options?.completionMessage ||
        'Thông tin đã hoàn tất.',
    };
  }

  return {
    type: 'MOVE',

    field:
      normalizeKey(target.nextField),

    zoneId:
      normalizeKey(target.nextZoneId),

    priority:
      target.priority || 'medium',

    message:
      options?.message ||
      'Xin vui lòng tiếp tục bước tiếp theo.',
  };
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Public service export.
 */
const guidedProgressionService = {
  normalizeGuidedZones,

  isFieldAcceptable,

  isZoneAcceptable,

  findFirstPendingField,

  findNextPendingZone,

  determineNextAttentionTarget,

  shouldAdvanceAttention,

  buildAttentionInstruction,
};

export default guidedProgressionService;