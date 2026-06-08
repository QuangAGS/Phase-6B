/**
 * PATH       : src/features/a11y/tts/TtsProvider.jsx
 * DATETIME   : 2026-05-14T00:00:00+07:00
 * VERSION    : 24.2.0
 * DESCRIPTION:
 * - Sprint EGAL-6.2: Single Elder Assistance Mode.
 * - Bổ sung elderAssistMode làm chế độ hỗ trợ duy nhất cho người lớn tuổi.
 * - Khi bật elderAssistMode: elderMode, guidedMode, autoSpeakErrors cùng bật.
 * - Khi tắt elderAssistMode: elderMode, guidedMode, autoSpeakErrors cùng tắt.
 * - Preserve public useTts contract cũ: elderMode, guidedMode, autoSpeakErrors, speak, speakError, speakField, speakStep.
 * - Không thay đổi business logic, auth flow, validation hoặc API contract.
 * - Tuân thủ Q1/Q2.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  isTtsSupported,
  speakText,
  stopSpeaking,
  preloadTtsVoices,
} from './tts.service.js';

const TtsContext = createContext(null);

const STORAGE_KEYS = {
  elderMode: 'EGAL_ELDER_MODE',
  guidedMode: 'EGAL_GUIDED_MODE',
  autoSpeakErrors: 'EGAL_AUTO_SPEAK_ERRORS',
  elderAssistMode: 'EGAL_ELDER_ASSIST_MODE',
};

const readBooleanStorage = (key, fallback = false) => {
  if (typeof window === 'undefined') return fallback;

  try {
    const value = window.localStorage.getItem(key);
    if (value === null) return fallback;
    return value === 'true';
  } catch (err) {
    return fallback;
  }
};

const writeBooleanStorage = (key, value) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, value ? 'true' : 'false');
  } catch (err) {
    // localStorage có thể bị chặn trong một số trình duyệt.
  }
};

export function TtsProvider({ children }) {
  const [elderMode, setElderModeState] = useState(() =>
    readBooleanStorage(STORAGE_KEYS.elderMode, false)
  );

  const [guidedMode, setGuidedModeState] = useState(() =>
    readBooleanStorage(STORAGE_KEYS.guidedMode, false)
  );

  const [autoSpeakErrors, setAutoSpeakErrorsState] = useState(() =>
    readBooleanStorage(STORAGE_KEYS.autoSpeakErrors, false)
  );

  const [elderAssistMode, setElderAssistModeState] = useState(() =>
    readBooleanStorage(STORAGE_KEYS.elderAssistMode, false)
  );

  /**
   * <2026-05-15T17:00:00+07:00>
   * EGAL-6.6.2:
   * Persist TTS activation between routes/refresh.
   *
   * Root cause:
   * Browser refresh resets runtime state,
   * causing critical errors not to speak
   * until ElderAssistButton toggled again.
   *
   * Q1/Q2 safe:
   * no business logic change.
   * accessibility runtime only.
   */
  const [hasUserActivatedTts, setHasUserActivatedTts] = useState(() =>
    readBooleanStorage('EGAL_TTS_ACTIVATED', false)
  );

  const [currentGuidedField, setCurrentGuidedField] = useState('');
  const [currentGuidedStep, setCurrentGuidedStep] = useState('');

  const lastSpokenKeyRef = useRef('');
  const lastSpeakAtRef = useRef(0);

  useEffect(() => {
    preloadTtsVoices();
  }, []);
  /**
   * Persist TTS activation.
   */
  useEffect(() => {
    writeBooleanStorage(
      'EGAL_TTS_ACTIVATED',
      hasUserActivatedTts
    );
  }, [hasUserActivatedTts]);

  /**
   * <2026-05-14T00:00:00+07:00>
   * EGAL-6.2:
   * Nếu user đã bật elderAssistMode từ localStorage,
   * đảm bảo các state phụ thuộc cũng đồng bộ khi app khởi động.
   */
  useEffect(() => {
    if (!elderAssistMode) return;

    setElderModeState(true);
    setGuidedModeState(true);
    setAutoSpeakErrorsState(true);

    writeBooleanStorage(STORAGE_KEYS.elderMode, true);
    writeBooleanStorage(STORAGE_KEYS.guidedMode, true);
    writeBooleanStorage(STORAGE_KEYS.autoSpeakErrors, true);
  }, [elderAssistMode]);

  /**
   * <2026-05-14T00:00:00+07:00>
   * EGAL-6.2:
   * Helper nội bộ để ghi đồng bộ cả 4 trạng thái hỗ trợ.
   * Không đổi public API cũ.
   */
  const applyFullElderAssistState = (value) => {
    const nextValue = !!value;

    setElderAssistModeState(nextValue);
    setElderModeState(nextValue);
    setGuidedModeState(nextValue);
    setAutoSpeakErrorsState(nextValue);
    /**
     * EGAL-6.6.2:
     * If user explicitly enables Elder Assist,
     * treat this as TTS consent/activation.
     */
    if (nextValue) {
      setHasUserActivatedTts(true);
    }

    writeBooleanStorage(STORAGE_KEYS.elderAssistMode, nextValue);
    writeBooleanStorage(STORAGE_KEYS.elderMode, nextValue);
    writeBooleanStorage(STORAGE_KEYS.guidedMode, nextValue);
    writeBooleanStorage(STORAGE_KEYS.autoSpeakErrors, nextValue);
  };

  const enableFullElderAssist = () => {
    applyFullElderAssistState(true);
  };

  const disableFullElderAssist = () => {
    applyFullElderAssistState(false);
  };

  const toggleElderAssistMode = () => {
    applyFullElderAssistState(!elderAssistMode);
  };

  const setElderMode = (value) => {
    const nextValue = !!value;

    setElderModeState(nextValue);
    writeBooleanStorage(STORAGE_KEYS.elderMode, nextValue);

    /**
     * <2026-05-14T00:00:00+07:00>
     * Preserve EGAL-5 behavior:
     * Khi bật Elder Mode thì guidedMode cũng bật.
     * Khi tắt Elder Mode thì guidedMode và autoSpeakErrors tắt.
     */
    setGuidedModeState(nextValue);
    writeBooleanStorage(STORAGE_KEYS.guidedMode, nextValue);

    if (!nextValue) {
      setAutoSpeakErrorsState(false);
      setElderAssistModeState(false);

      writeBooleanStorage(STORAGE_KEYS.autoSpeakErrors, false);
      writeBooleanStorage(STORAGE_KEYS.elderAssistMode, false);
    }
  };

  const setGuidedMode = (value) => {
    const nextValue = !!value;

    setGuidedModeState(nextValue);
    writeBooleanStorage(STORAGE_KEYS.guidedMode, nextValue);

    /**
     * <2026-05-14T00:00:00+07:00>
     * Preserve EGAL-5.1:
     * Khi guidedMode OFF thì autoSpeakErrors OFF.
     */
    if (!nextValue) {
      setAutoSpeakErrorsState(false);
      setElderAssistModeState(false);

      writeBooleanStorage(STORAGE_KEYS.autoSpeakErrors, false);
      writeBooleanStorage(STORAGE_KEYS.elderAssistMode, false);
    }
  };

  const setAutoSpeakErrors = (value) => {
    const nextValue = !!value;

    setAutoSpeakErrorsState(nextValue);
    writeBooleanStorage(STORAGE_KEYS.autoSpeakErrors, nextValue);

    /**
     * <2026-05-14T00:00:00+07:00>
     * EGAL-6.2:
     * Nếu người dùng tắt đọc lỗi quan trọng riêng lẻ,
     * elderAssistMode không còn là full assist nữa.
     */
    if (!nextValue) {
      setElderAssistModeState(false);
      writeBooleanStorage(STORAGE_KEYS.elderAssistMode, false);
    }
  };

  const canSpeakGuidance = () => {
    return elderMode && guidedMode && hasUserActivatedTts;
  };

  const preventDuplicateSpeak = (key) => {
    const now = Date.now();

    if (
      lastSpokenKeyRef.current === key &&
      now - lastSpeakAtRef.current < 1800
    ) {
      return true;
    }

    lastSpokenKeyRef.current = key;
    lastSpeakAtRef.current = now;

    return false;
  };

  const value = useMemo(() => {
    const supported = isTtsSupported();

    const speak = (text, options = {}) => {
      if (!text) return false;

      setHasUserActivatedTts(true);

      return speakText(text, options);
    };

    const stop = () => {
      return stopSpeaking();
    };

    const speakError = (text, options = {}) => {
      if (!elderMode || !autoSpeakErrors || !hasUserActivatedTts) {
        return false;
      }

      return speakText(text, {
        rate: 0.82,
        ...options,
      });
    };

    const speakGuidance = (key, text, options = {}) => {
      if (!text || !key) return false;

      if (!canSpeakGuidance()) {
        return false;
      }

      if (preventDuplicateSpeak(key)) {
        return false;
      }

      return speakText(text, {
        rate: 0.8,
        ...options,
      });
    };

    const speakField = (fieldKey, text, options = {}) => {
      if (!fieldKey || !text) return false;

      /**
       * EGAL-24.6.7.R3.1B
       * Speak first, then update guided state.
       * Prevent provider re-render from interrupting initial narration.
       */
      const spoken = speakGuidance(`field:${fieldKey}`, text, options);

      if (spoken) {
        window.requestAnimationFrame(() => {
          setCurrentGuidedField(fieldKey);
        });
      }

      return spoken;
    };

    const speakStep = (stepKey, text, options = {}) => {
      if (!stepKey || !text) return false;

      /**
       * EGAL-24.6.7.R3.1B
       * Speak first, then update guided state.
       * Prevent provider re-render from interrupting initial narration.
       */
      const spoken = speakGuidance(`step:${stepKey}`, text, options);

      if (spoken) {
        window.requestAnimationFrame(() => {
          setCurrentGuidedStep(stepKey);
        });
      }

      return spoken;
    };

    const resetGuidedContext = () => {
      setCurrentGuidedField('');
      setCurrentGuidedStep('');
    };

    const toggleElderMode = () => {
      setElderMode(!elderMode);
    };

    return {
      supported,

      /**
       * <2026-05-14T00:00:00+07:00>
       * EGAL-6.2 public state:
       * elderAssistMode là single mode mới.
       */
      elderAssistMode,
      enableFullElderAssist,
      disableFullElderAssist,
      toggleElderAssistMode,

      /**
       * <2026-05-14T00:00:00+07:00>
       * Preserve public contract cũ.
       */
      elderMode,
      setElderMode,
      toggleElderMode,

      guidedMode,
      setGuidedMode,

      autoSpeakErrors,
      setAutoSpeakErrors,

      hasUserActivatedTts,

      currentGuidedField,
      setCurrentGuidedField,

      currentGuidedStep,
      setCurrentGuidedStep,

      speak,
      stop,
      speakError,

      speakGuidance,
      speakField,
      speakStep,

      resetGuidedContext,
    };
  }, [
    elderAssistMode,
    elderMode,
    guidedMode,
    autoSpeakErrors,
    hasUserActivatedTts,
    currentGuidedField,
    currentGuidedStep,
  ]);

  return (
    <TtsContext.Provider value={value}>
      {children}
    </TtsContext.Provider>
  );
}

export function useTtsContext() {
  const context = useContext(TtsContext);

  if (!context) {
    throw new Error('useTtsContext must be used inside TtsProvider');
  }

  return context;
}

export default TtsProvider;