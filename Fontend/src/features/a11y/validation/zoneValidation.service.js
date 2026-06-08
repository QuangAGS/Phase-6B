/**
 * PATH       : src/features/a11y/validation/zoneValidation.service.js
 * DATETIME   : 2026-05-19T00:00:00+07:00
 * VERSION    : EGAL-24.6.7.R3.1A
 * DESCRIPTION:
 * - Shared Guided Zone Validation Service.
 * - Zone completed ONLY when zone data is valid.
 * - Field rules remain owned by schema / validationRules.js.
 * - No React dependency.
 * - No form library dependency.
 * - No business logic.
 * - Q1/Q2/Q9/Q10 safe.
 */

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

function getNestedValue(source = {}, path = '') {
  if (!path) return undefined;

  return String(path)
    .split('.')
    .reduce((acc, key) => {
      if (acc === undefined || acc === null) return undefined;
      return acc[key];
    }, source);
}

function isEmptyValue(value) {
  return (
    value === undefined ||
    value === null ||
    safeString(value).length === 0
  );
}

/**
 * =========================================================
 * ERROR NORMALIZATION
 * =========================================================
 */

export function getFieldErrorMessage(errors = {}, fieldKey = '') {
  const source = safeObject(errors);
  const error = getNestedValue(source, fieldKey);

  if (!error) return '';

  if (typeof error === 'string') {
    return safeString(error);
  }

  if (error.message) {
    return safeString(error.message);
  }

  return '';
}

export function getFirstInvalidField({
  zoneId = '',
  zoneFields = {},
  errors = {},
  values = {},
  requiredFields = [],
} = {}) {
  const fields = safeArray(zoneFields[zoneId]);
  const requiredSet = new Set(safeArray(requiredFields));

  const fieldWithError = fields.find((fieldKey) =>
    safeString(getFieldErrorMessage(errors, fieldKey))
  );

  if (fieldWithError) return fieldWithError;

  const missingRequiredField = fields.find((fieldKey) => {
    if (!requiredSet.has(fieldKey)) return false;
    return isEmptyValue(getNestedValue(values, fieldKey));
  });

  return missingRequiredField || '';
}

export function buildZoneValidationMessage({
  errors = {},
  firstInvalidField = '',
  fallbackMessage = '',
} = {}) {
  const fieldMessage =
    getFieldErrorMessage(errors, firstInvalidField);

  if (fieldMessage) return fieldMessage;

  if (safeString(fallbackMessage)) {
    return safeString(fallbackMessage);
  }

  return 'Thông tin trong mục này chưa đầy đủ hoặc chưa đúng. Bác vui lòng kiểm tra lại.';
}

/**
 * =========================================================
 * CORE ZONE VALIDATION
 * =========================================================
 */

export function validateZone({
  zoneId = '',
  values = {},
  errors = {},
  zoneFields = {},
  requiredFields = [],
  fallbackMessage = '',
} = {}) {
  const fields = safeArray(zoneFields[zoneId]);

  if (!zoneId || fields.length === 0) {
    return {
      valid: false,
      zoneId,
      fields,
      firstInvalidField: '',
      message:
        'Hệ thống chưa xác định được mục cần kiểm tra. Bác vui lòng thử lại.',
      errors: safeObject(errors),
    };
  }

  const firstInvalidField = getFirstInvalidField({
    zoneId,
    zoneFields,
    errors,
    values,
    requiredFields,
  });

  if (firstInvalidField) {
    return {
      valid: false,
      zoneId,
      fields,
      firstInvalidField,
      message: buildZoneValidationMessage({
        errors,
        firstInvalidField,
        fallbackMessage,
      }),
      errors: safeObject(errors),
    };
  }

  return {
    valid: true,
    zoneId,
    fields,
    firstInvalidField: '',
    message: '',
    errors: {},
  };
}

/**
 * =========================================================
 * COMPLETION DECISION
 * =========================================================
 */

export function canCompleteZone(zoneResult = {}) {
  return zoneResult?.valid === true;
}

export function applyZoneCompletion({
  zoneResult = {},
  guidedFlow,
} = {}) {
  const zoneId = safeString(zoneResult.zoneId);

  if (!guidedFlow || !zoneId) {
    return zoneResult;
  }

  if (canCompleteZone(zoneResult)) {
    guidedFlow.markCompleted?.(zoneId);
  } else {
    guidedFlow.unmarkCompleted?.(zoneId);
  }

  return zoneResult;
}

export function blockZoneAndReturnAttention({
  zoneResult = {},
  guidedFlow,
  speak,
} = {}) {
  const zoneId = safeString(zoneResult.zoneId);

  if (guidedFlow && zoneId) {
    guidedFlow.unmarkCompleted?.(zoneId);
    guidedFlow.goToField?.(zoneId);
  }

  if (typeof speak === 'function') {
    speak(
      zoneResult.message ||
        'Thông tin trong mục này chưa đầy đủ hoặc chưa đúng. Bác vui lòng kiểm tra lại.'
    );
  }

  return zoneResult;
}

/**
 * =========================================================
 * NEXT ZONE HELPER
 * =========================================================
 */

export function getNextZone({
  currentZoneId = '',
  orderedZones = [],
} = {}) {
  const zones = safeArray(orderedZones);
  const index = zones.indexOf(currentZoneId);

  if (index < 0) return '';

  return zones[index + 1] || '';
}

export function completeZoneAndMoveNext({
  zoneResult = {},
  guidedFlow,
  orderedZones = [],
} = {}) {
  const zoneId = safeString(zoneResult.zoneId);

  if (!canCompleteZone(zoneResult)) {
    return {
      moved: false,
      nextZone: '',
      zoneResult,
    };
  }

  guidedFlow?.markCompleted?.(zoneId);

  const nextZone = getNextZone({
    currentZoneId: zoneId,
    orderedZones,
  });

  if (nextZone) {
    guidedFlow?.goToField?.(nextZone);
  }

  return {
    moved: !!nextZone,
    nextZone,
    zoneResult,
  };
}

/**
 * =========================================================
 * SERVICE EXPORT
 * =========================================================
 */

const zoneValidationService = {
  getFieldErrorMessage,
  getFirstInvalidField,
  buildZoneValidationMessage,
  validateZone,
  canCompleteZone,
  applyZoneCompletion,
  blockZoneAndReturnAttention,
  getNextZone,
  completeZoneAndMoveNext,
};

export default zoneValidationService;