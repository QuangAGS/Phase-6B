/**
 * PATH       : src/features/a11y/validation/validationGate.service.js
 * DATETIME   : 2026-05-15T00:00:00+07:00
 * VERSION    : 24.0.0
 * DESCRIPTION:
 * - Sprint EGAL-6.5:
 *   Hard Validation Gate Layer.
 *
 * PURPOSE:
 * - Centralized transition validation authority.
 * - Fresh validation before navigation.
 * - Async validation integration.
 * - Transition permission control.
 * - Stale runtime protection.
 *
 * IMPORTANT:
 * - NO React dependency.
 * - NO form library dependency.
 * - NO business logic changes.
 * - Tuân thủ Q1/Q2.
 */

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

function safeBoolean(value) {
  return value === true;
}

function now() {
  return Date.now();
}

/**
 * =========================================================
 * VALIDATION RESULT CONSTANTS
 * =========================================================
 */

export const VALIDATION_GATE_STATUS = {
  ALLOWED: 'ALLOWED',

  BLOCKED: 'BLOCKED',

  PENDING: 'PENDING',

  INVALID: 'INVALID',
};

export const VALIDATION_BLOCK_REASONS = {
  LOCAL_VALIDATION_FAILED:
    'LOCAL_VALIDATION_FAILED',

  ASYNC_VALIDATION_PENDING:
    'ASYNC_VALIDATION_PENDING',

  ONLINE_VALIDATION_FAILED:
    'ONLINE_VALIDATION_FAILED',

  REQUIRED_FIELD_MISSING:
    'REQUIRED_FIELD_MISSING',

  UNKNOWN: 'UNKNOWN',
};

/**
 * =========================================================
 * CORE VALIDATION HELPERS
 * =========================================================
 */

/**
 * <2026-05-15T00:00:00+07:00>
 * Determine whether async validation is pending.
 */
export function hasPendingAsyncValidation(
  asyncState = {}
) {
  const source =
    safeObject(asyncState);

  return Object.values(source).some(
    (value) => value === true
  );
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Determine whether online validation has blocking errors.
 */
export function hasBlockingOnlineErrors(
  onlineErrors = {}
) {
  const source =
    safeObject(onlineErrors);

  return Object.values(source).some(
    (value) => safeString(value).length > 0
  );
}

/**
 * <2026-05-15T00:00:00+07:00>
 * Detect first online validation error.
 */
export function getFirstOnlineError(
  onlineErrors = {}
) {
  const source =
    safeObject(onlineErrors);

  const matchedKey =
    Object.keys(source).find(
      (key) =>
        safeString(source[key]).length > 0
    );

  if (!matchedKey) {
    return null;
  }

  return {
    field: matchedKey,

    message:
      safeString(source[matchedKey]),
  };
}

/**
 * =========================================================
 * REQUIRED FIELD VALIDATION
 * =========================================================
 */

/**
 * <2026-05-15T00:00:00+07:00>
 * Check required fields.
 */
export function validateRequiredFields(
  values = {},
  requiredFields = []
) {
  const source =
    safeObject(values);

  const missingFields = [];

  requiredFields.forEach((fieldKey) => {
    const value = source[fieldKey];

    const isMissing =
      value === undefined ||
      value === null ||
      safeString(value).length === 0;

    if (isMissing) {
      missingFields.push(fieldKey);
    }
  });

  return {
    valid:
      missingFields.length === 0,

    missingFields,
  };
}

/**
 * =========================================================
 * LOCAL VALIDATION RESULT
 * =========================================================
 */

/**
 * <2026-05-15T00:00:00+07:00>
 * Normalize local validation result.
 *
 * Accepts:
 * - boolean
 * - object
 */
/**
 * <2026-05-19T00:00:00+07:00>
 * VERSION: EGAL-24.6.7.R3.1A
 * PURPOSE:
 * - Harden local validation result normalization.
 * - Prevent invalid local data from leaking to backend.
 * - valid=false MUST block transition even when errors snapshot is stale/empty.
 */
export function normalizeLocalValidationResult(
  result
) {
  if (typeof result === 'boolean') {
    return {
      valid: result === true,
      errors: {},
    };
  }

  if (
    result &&
    typeof result === 'object'
  ) {
    const explicitInvalid =
      result.valid === false;

    return {
      valid:
        !explicitInvalid &&
        safeBoolean(result.valid),

      errors:
        safeObject(result.errors),
    };
  }

  return {
    valid: false,
    errors: {},
  };
}

/**
 * =========================================================
 * HARD VALIDATION GATE
 * =========================================================
 */

/**
 * <2026-05-15T00:00:00+07:00>
 * Central hard validation gate.
 *
 * IMPORTANT:
 * Transition authority MUST derive from:
 * - fresh validation
 * - current runtime state
 * - async validation state
 *
 * NEVER trust stale progression state.
 */
export async function runValidationGate(
  payload = {}
) {
  const startedAt = now();

  const {
    values = {},

    requiredFields = [],

    localValidation,

    asyncValidationState = {},

    onlineErrors = {},

    metadata = {},
  } = payload;

  /**
   * ---------------------------------------------------------
   * STEP 1:
   * Required fields check
   * ---------------------------------------------------------
   */

  const requiredResult =
    validateRequiredFields(
      values,
      requiredFields
    );

  if (!requiredResult.valid) {
    return {
      allowed: false,

      status:
        VALIDATION_GATE_STATUS.INVALID,

      reason:
        VALIDATION_BLOCK_REASONS.REQUIRED_FIELD_MISSING,

      blockingField:
        requiredResult.missingFields[0] ||
        '',

      missingFields:
        requiredResult.missingFields,

      requiresAttention: true,

      elapsedMs:
        now() - startedAt,

      metadata,
    };
  }

  /**
   * ---------------------------------------------------------
   * STEP 2:
   * Async validation pending
   * ---------------------------------------------------------
   */

  if (
    hasPendingAsyncValidation(
      asyncValidationState
    )
  ) {
    return {
      allowed: false,

      status:
        VALIDATION_GATE_STATUS.PENDING,

      reason:
        VALIDATION_BLOCK_REASONS.ASYNC_VALIDATION_PENDING,

      blockingField: '',

      requiresAttention: true,

      elapsedMs:
        now() - startedAt,

      metadata,
    };
  }

  /**
   * ---------------------------------------------------------
   * STEP 3:
   * Online validation errors
   * ---------------------------------------------------------
   */

  if (
    hasBlockingOnlineErrors(
      onlineErrors
    )
  ) {
    const firstError =
      getFirstOnlineError(
        onlineErrors
      );

    return {
      allowed: false,

      status:
        VALIDATION_GATE_STATUS.INVALID,

      reason:
        VALIDATION_BLOCK_REASONS.ONLINE_VALIDATION_FAILED,

      blockingField:
        firstError?.field || '',

      blockingMessage:
        firstError?.message || '',

      requiresAttention: true,

      elapsedMs:
        now() - startedAt,

      metadata,
    };
  }

  /**
   * ---------------------------------------------------------
   * STEP 4:
   * Local validation
   * ---------------------------------------------------------
   */

  let localValidationResult = {
    valid: true,
    errors: {},
  };

  /**
   * Validation function mode.
   */
  if (
    typeof localValidation ===
    'function'
  ) {
    const result =
      await localValidation();

    localValidationResult =
      normalizeLocalValidationResult(
        result
      );
  }

  /**
   * Static validation mode.
   */
  else if (
    localValidation !== undefined
  ) {
    localValidationResult =
      normalizeLocalValidationResult(
        localValidation
      );
  }

  if (
    !localValidationResult.valid
  ) {
    const firstErrorField =
      Object.keys(
        localValidationResult.errors
      )[0] || '';

    return {
      allowed: false,

      status:
        VALIDATION_GATE_STATUS.INVALID,

      reason:
        VALIDATION_BLOCK_REASONS.LOCAL_VALIDATION_FAILED,

      blockingField:
        firstErrorField,

      validationErrors:
        localValidationResult.errors,

      requiresAttention: true,

      elapsedMs:
        now() - startedAt,

      metadata,
    };
  }

  /**
   * ---------------------------------------------------------
   * SUCCESS
   * ---------------------------------------------------------
   */

  return {
    allowed: true,

    status:
      VALIDATION_GATE_STATUS.ALLOWED,

    reason: '',

    blockingField: '',

    requiresAttention: false,

    elapsedMs:
      now() - startedAt,

    metadata,
  };
}

/**
 * =========================================================
 * TRANSITION AUTHORITY
 * =========================================================
 */

/**
 * <2026-05-15T00:00:00+07:00>
 * Determine whether navigation is authorized.
 */
export function isTransitionAuthorized(
  gateResult = {}
) {
  return (
    safeBoolean(gateResult.allowed) &&
    gateResult.status ===
      VALIDATION_GATE_STATUS.ALLOWED
  );
}

/**
 * =========================================================
 * ATTENTION TARGET HELPER
 * =========================================================
 */
/**
 * <2026-05-19T00:00:00+07:00>
 * VERSION: EGAL-24.6.7.R3.1A
 * PURPOSE:
 * - Convert internal validation reason to elderly-friendly message.
 * - Do not expose technical codes to users.
 */
function resolveFriendlyValidationMessage(
  gateResult = {}
) {
  const blockingMessage =
    safeString(gateResult.blockingMessage);

  if (blockingMessage) {
    return blockingMessage;
  }

  switch (gateResult.reason) {
    case VALIDATION_BLOCK_REASONS.LOCAL_VALIDATION_FAILED:
      return 'Thông tin vừa nhập chưa đúng. Bác vui lòng kiểm tra lại mục được báo lỗi.';

    case VALIDATION_BLOCK_REASONS.REQUIRED_FIELD_MISSING:
      return 'Thông tin còn thiếu. Bác vui lòng kiểm tra lại.';

    case VALIDATION_BLOCK_REASONS.ASYNC_VALIDATION_PENDING:
      return 'Hệ thống đang kiểm tra thông tin. Bác vui lòng chờ thêm một chút.';

    case VALIDATION_BLOCK_REASONS.ONLINE_VALIDATION_FAILED:
      return 'Có thông tin cần kiểm tra lại. Bác vui lòng xem lại mục được báo lỗi.';

    default:
      return 'Thông tin hồ sơ chưa đầy đủ hoặc chưa đúng. Bác vui lòng kiểm tra lại.';
  }
}
/**
 * <2026-05-15T00:00:00+07:00>
 * Build attention target from gate result.
 */
export function buildValidationAttentionTarget(
  gateResult = {}
) {
  if (
    isTransitionAuthorized(
      gateResult
    )
  ) {
    return {
      type: 'SUCCESS',

      field: '',

      message: '',
    };
  }

  return {
    type: 'ERROR',

    field:
      safeString(
        gateResult.blockingField
      ),

    message:
      resolveFriendlyValidationMessage(
        gateResult
      ),

    reason:
      safeString(gateResult.reason),
  };
}

/**
 * =========================================================
 * PUBLIC SERVICE EXPORT
 * =========================================================
 */

const validationGateService = {
  VALIDATION_GATE_STATUS,

  VALIDATION_BLOCK_REASONS,

  hasPendingAsyncValidation,

  hasBlockingOnlineErrors,

  getFirstOnlineError,

  validateRequiredFields,

  normalizeLocalValidationResult,

  runValidationGate,

  isTransitionAuthorized,

  buildValidationAttentionTarget,
};

export default validationGateService;