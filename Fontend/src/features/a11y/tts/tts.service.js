/**
 * PATH       : src/features/a11y/tts/tts.service.js
 * DATETIME   : 2026-05-23T00:00:00+07:00
 * VERSION    : 1.0.0-ROLLBACK-CLEAN
 * DESCRIPTION:
 * - Core service cho Web Speech API.
 * - Rollback các patch thử nghiệm immediate / Safari-specific debug.
 * - Giữ vai trò TTS core dùng chung, không chứa logic riêng captcha/form.
 * - Không phụ thuộc backend, DB, Supabase hoặc Prisma.
 * - Tuân thủ Q1/Q2.
 */

export const DEFAULT_TTS_OPTIONS = {
  lang: 'vi-VN',
  rate: 0.85,
  pitch: 1,
  volume: 1,
};

const debugTts =
  import.meta.env.DEV ||
  import.meta.env.VITE_DEBUG_MODE === 'true';

const ttsLog = (checkpoint, payload = {}) => {
  if (!debugTts) return;

  console.log(`[EGAL-TTS][${checkpoint}]`, {
    at: new Date().toISOString(),
    ...payload,
  });
};

export function isTtsSupported() {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window
  );
}

export function stopSpeaking() {
  if (!isTtsSupported()) return false;

  window.speechSynthesis.cancel();
  return true;
}

export function getVietnameseVoice() {
  if (!isTtsSupported()) return null;

  const voices = window.speechSynthesis.getVoices?.() || [];

  return (
    voices.find((voice) => voice.lang === 'vi-VN') ||
    voices.find((voice) => voice.lang?.toLowerCase().startsWith('vi')) ||
    null
  );
}

export function speakText(text, options = {}) {
  ttsLog('speakText-called', {
    hasText: !!text,
    supported: isTtsSupported(),
    options,
  });

  if (!text || !isTtsSupported()) return false;

  const normalizedText = String(text).trim();
  if (!normalizedText) return false;

  const mergedOptions = {
    ...DEFAULT_TTS_OPTIONS,
    ...options,
  };

  const deferMs =
    typeof mergedOptions.deferMs === 'number'
      ? mergedOptions.deferMs
      : 80;

  const createUtterance = () => {
    const utterance = new SpeechSynthesisUtterance(normalizedText);

    utterance.lang = mergedOptions.lang || 'vi-VN';
    utterance.rate = mergedOptions.rate || 0.85;
    utterance.pitch = mergedOptions.pitch || 1;
    utterance.volume = mergedOptions.volume || 1;

    const voices = window.speechSynthesis.getVoices?.() || [];

    const viVoice =
      voices.find((v) => v.lang === 'vi-VN') ||
      voices.find((v) => v.lang?.toLowerCase().startsWith('vi')) ||
      voices.find((v) => v.name?.toLowerCase().includes('vietnam')) ||
      voices.find((v) => v.name?.toLowerCase().includes('tiếng việt')) ||
      null;

    ttsLog('voices-loaded', {
      count: voices.length,
      selected: viVoice
        ? {
            name: viVoice.name,
            lang: viVoice.lang,
          }
        : null,
    });

    if (viVoice) {
      utterance.voice = viVoice;
    }

    return utterance;
  };

  ttsLog('before-cancel', {
    speaking: window.speechSynthesis.speaking,
    pending: window.speechSynthesis.pending,
    paused: window.speechSynthesis.paused,
  });

  window.speechSynthesis.cancel();

  ttsLog('after-cancel', {
    speaking: window.speechSynthesis.speaking,
    pending: window.speechSynthesis.pending,
    paused: window.speechSynthesis.paused,
  });

  setTimeout(() => {
    try {
      window.speechSynthesis.resume();
    } catch (err) {
      // ignore
    }

    const utterance = createUtterance();

    let started = false;

    utterance.onstart = () => {
      started = true;

      ttsLog('utterance-onstart', {
        text: normalizedText,
      });
    };

    utterance.onend = () => {
      ttsLog('utterance-onend', {
        text: normalizedText,
      });
    };

    utterance.onerror = (event) => {
      ttsLog('utterance-onerror', {
        error: event?.error,
        text: normalizedText,
      });

      if (!started) {
        setTimeout(() => {
          try {
            window.speechSynthesis.resume();
          } catch (err) {
            // ignore
          }

          const retryUtterance = createUtterance();

          ttsLog('retry-speak-now', {
            text: normalizedText,
            speaking: window.speechSynthesis.speaking,
            pending: window.speechSynthesis.pending,
            paused: window.speechSynthesis.paused,
          });

          window.speechSynthesis.speak(retryUtterance);
        }, 180);
      }
    };

    ttsLog('speak-now-deferred', {
      text: normalizedText,
      speaking: window.speechSynthesis.speaking,
      pending: window.speechSynthesis.pending,
      paused: window.speechSynthesis.paused,
    });

    window.speechSynthesis.speak(utterance);
  }, deferMs);

  return true;
}

export function preloadTtsVoices() {
  if (!isTtsSupported()) return;

  window.speechSynthesis.getVoices();

  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}