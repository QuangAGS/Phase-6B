/**
 * PATH       : src/features/a11y/guided/useGuidedFlow.js
 * DATETIME   : 2026-05-15T00:00:00+07:00
 * VERSION    : 24.1.0
 * DESCRIPTION:
 * - Sprint EGAL-6.3 — Step 2:
 *   Persistent Guided Context & Re-entry Recovery.
 *
 * - Auto persist:
 *   + currentStep
 *   + currentStepIndex
 *   + activeField
 *
 * - Auto restore guided context after reload/re-entry.
 *
 * - Preserve existing public contract:
 *   currentStep
 *   currentStepNumber
 *   totalSteps
 *   activeField
 *   completedFields
 *   goToField()
 *   nextStep()
 *   previousStep()
 *   markCompleted()
 *   unmarkCompleted()
 *   resetFlow()
 *
 * - NO business logic changes.
 * - NO validation changes.
 * - NO auth/API contract changes.
 * - Tuân thủ Q1/Q2.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  loadRecoveryState,
  saveRecoveryState,
  clearRecoveryState,
} from '../recovery/guidedRecovery.service.js';

const DEFAULT_RECOVERY_PREFIX = 'guided-flow';

function normalizeFieldKey(fieldKey) {
  return String(fieldKey || '').trim();
}

function normalizeSteps(steps = []) {
  if (!Array.isArray(steps)) return [];

  return steps.map((step, index) => ({
    ...step,
    index,
    fieldKey: normalizeFieldKey(step?.fieldKey || `step-${index}`),
  }));
}

function buildRecoveryKey(recoveryKey, normalizedSteps) {
  if (recoveryKey) return recoveryKey;

  const signature = normalizedSteps
    .map((s) => s.fieldKey)
    .join('|');

  return `${DEFAULT_RECOVERY_PREFIX}:${signature}`;
}

export function useGuidedFlow(steps = [], options = {}) {
  const {
    initialStepIndex = 0,
    initialFieldKey = '',
    enabled = true,

    /**
     * <2026-05-15T00:00:00+07:00>
     * EGAL-6.3:
     * Allow custom recovery key per flow.
     */
    recoveryKey = '',

    /**
     * <2026-05-15T00:00:00+07:00>
     * EGAL-6.3:
     * Enable/disable recovery persistence.
     */
    persistRecovery = true,

    /**
     * <2026-05-15T00:00:00+07:00>
     * EGAL-6.3:
     * Recovery TTL.
     */
    recoveryTtlMs = 1000 * 60 * 60 * 24,
  } = options;

  const normalizedSteps = useMemo(
    () => normalizeSteps(steps),
    [steps]
  );

  const internalRecoveryKey = useMemo(
    () => buildRecoveryKey(recoveryKey, normalizedSteps),
    [recoveryKey, normalizedSteps]
  );

  const hasRestoredRef = useRef(false);

  /**
   * <2026-05-15T00:00:00+07:00>
   * EGAL-6.3:
   * Restore previous guided context if available.
   */
  const recoveryState = useMemo(() => {
    if (!persistRecovery) return null;

    return loadRecoveryState(internalRecoveryKey);
  }, [internalRecoveryKey, persistRecovery]);

  const restoredStepIndex =
    typeof recoveryState?.currentStepIndex === 'number'
      ? recoveryState.currentStepIndex
      : initialStepIndex;

  const restoredFieldKey =
    recoveryState?.activeField || initialFieldKey || '';

  const [currentStepIndex, setCurrentStepIndex] = useState(
    restoredStepIndex >= 0
      ? Math.min(restoredStepIndex, normalizedSteps.length - 1)
      : 0
  );

  const [activeField, setActiveField] = useState(restoredFieldKey);

  const [completedFields, setCompletedFields] = useState([]);

  const currentStep =
    normalizedSteps[currentStepIndex] || normalizedSteps[0] || null;

  /**
   * <2026-05-15T00:00:00+07:00>
   * EGAL-6.3:
   * Auto restore current field once after mount.
   */
  useEffect(() => {
    if (!enabled) return;

    if (hasRestoredRef.current) return;

    hasRestoredRef.current = true;

    if (restoredFieldKey) {
      setActiveField(restoredFieldKey);
    }

    if (
      typeof restoredStepIndex === 'number' &&
      restoredStepIndex >= 0
    ) {
      setCurrentStepIndex(
        Math.min(restoredStepIndex, normalizedSteps.length - 1)
      );
    }
  }, [
    enabled,
    normalizedSteps.length,
    restoredFieldKey,
    restoredStepIndex,
  ]);

  /**
   * <2026-05-15T00:00:00+07:00>
   * EGAL-6.3:
   * Persist guided context.
   */
  useEffect(() => {
    if (!enabled || !persistRecovery) return;

    saveRecoveryState(
      internalRecoveryKey,
      {
        currentStep:
          currentStep?.fieldKey || '',
        currentStepIndex,
        activeField,
        meta: {
          source: 'useGuidedFlow',
        },
      },
      {
        ttlMs: recoveryTtlMs,
      }
    );
  }, [
    enabled,
    persistRecovery,
    internalRecoveryKey,
    currentStep,
    currentStepIndex,
    activeField,
    recoveryTtlMs,
  ]);

  const currentStepNumber = useMemo(
    () => currentStepIndex + 1,
    [currentStepIndex]
  );

  const totalSteps = useMemo(
    () => normalizedSteps.length,
    [normalizedSteps]
  );

  const goToField = useCallback(
    (fieldKey) => {
      if (!enabled) return;

      const normalizedField = normalizeFieldKey(fieldKey);

      setActiveField(normalizedField);

      const foundIndex = normalizedSteps.findIndex(
        (step) => step.fieldKey === normalizedField
      );

      if (foundIndex >= 0) {
        setCurrentStepIndex(foundIndex);
      }
    },
    [enabled, normalizedSteps]
  );

  const nextStep = useCallback(() => {
    if (!enabled) return;

    setCurrentStepIndex((prev) => {
      const nextIndex = Math.min(
        prev + 1,
        normalizedSteps.length - 1
      );

      const nextStepObj = normalizedSteps[nextIndex];

      if (nextStepObj?.fieldKey) {
        setActiveField(nextStepObj.fieldKey);
      }

      return nextIndex;
    });
  }, [enabled, normalizedSteps]);

  const previousStep = useCallback(() => {
    if (!enabled) return;

    setCurrentStepIndex((prev) => {
      const nextIndex = Math.max(prev - 1, 0);

      const previousStepObj = normalizedSteps[nextIndex];

      if (previousStepObj?.fieldKey) {
        setActiveField(previousStepObj.fieldKey);
      }

      return nextIndex;
    });
  }, [enabled, normalizedSteps]);

  const markCompleted = useCallback((fieldKey) => {
    const normalizedField = normalizeFieldKey(fieldKey);

    setCompletedFields((prev) => {
      if (prev.includes(normalizedField)) {
        return prev;
      }

      return [...prev, normalizedField];
    });
  }, []);

  const unmarkCompleted = useCallback((fieldKey) => {
    const normalizedField = normalizeFieldKey(fieldKey);

    setCompletedFields((prev) =>
      prev.filter((item) => item !== normalizedField)
    );
  }, []);

  const isCompleted = useCallback(
    (fieldKey) => {
      return completedFields.includes(
        normalizeFieldKey(fieldKey)
      );
    },
    [completedFields]
  );

  const resetFlow = useCallback(() => {
    setCurrentStepIndex(initialStepIndex);
    setActiveField(initialFieldKey || '');
    setCompletedFields([]);

    /**
     * <2026-05-15T00:00:00+07:00>
     * EGAL-6.3:
     * Clear persisted recovery state.
     */
    if (persistRecovery) {
      clearRecoveryState(internalRecoveryKey);
    }
  }, [
    initialStepIndex,
    initialFieldKey,
    persistRecovery,
    internalRecoveryKey,
  ]);

  return {
    currentStep,
    currentStepIndex,
    currentStepNumber,
    totalSteps,

    activeField,
    completedFields,

    goToField,
    nextStep,
    previousStep,

    markCompleted,
    unmarkCompleted,
    isCompleted,

    resetFlow,
    resetGuidedFlow: resetFlow,

    /**
     * <2026-05-15T00:00:00+07:00>
     * EGAL-6.3:
     * Expose recovery metadata.
     */
    recoveryKey: internalRecoveryKey,
    hasRecoveryState: !!recoveryState,
  };
}
export default useGuidedFlow;
