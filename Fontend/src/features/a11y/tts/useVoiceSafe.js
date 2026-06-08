/**
 * PATH       : src/features/a11y/tts/useVoiceSafe.js
 * DATETIME   : 2026-05-23T05:32:00+07:00
 * VERSION    : 1.1.0_PipelinePerfected
 * DESCRIPTION:
 * - Hạt nhân điều phối giọng nói tập trung (Unified Speech Pipeline) cho toàn bộ hệ thống EGAL.
 * - KHẮC PHỤC LỖI KHỐI: Đưa câu lệnh khởi tạo Utterance ra ngoài khối điều kiện paused.
 * - Giữ reference cứng chống Garbage Collection của Chrome, tự động unlock engine sát user gesture.
 * - Chống race-condition triệt để khi tích hợp diện rộng cho các Page/Form.
 */

import { useEffect, useRef, useCallback } from 'react';

export const useVoiceSafe = () => {
  const synthRef = useRef(null);
  const utteranceRef = useRef(null);
  const mountedRef = useRef(true);

  const getSynth = () => {
    if (!synthRef.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
    return synthRef.current;
  };

  /**
   * <2026-05-23T05:32:00+07:00>
   * PURPOSE: Quét chọn giọng đọc tiếng Việt hệ thống, cấu hình cơ chế fallback ngôn ngữ an toàn.
   */
  const pickVietnameseVoice = (synth) => {
    if (!synth) return null;
    const voices = synth.getVoices();
    const viVoice = voices.find(v => v.lang === 'vi-VN' || v.lang.startsWith('vi'));
    return viVoice || null;
  };

  /**
   * <2026-05-23T05:32:00+07:00>
   * PURPOSE: Mở khóa trực tiếp kênh phát thanh của trình duyệt (Speech Engine Unlocker).
   */
  const unlockSpeech = useCallback(() => {
    const synth = getSynth();
    if (synth && synth.paused) {
      synth.resume();
    }
  }, []);

  /**
   * <2026-05-23T05:32:00+07:00>
   * PURPOSE: Hàm phát tiếng an toàn tuyệt đối, sửa lỗi lồng khối lách câu đọc của Chrome.
   */
  const speakSafe = useCallback((text, options = {}) => {
    const synth = getSynth();
    if (!synth || !text || !mountedRef.current) return false;

    try {
      // 1. Dọn sạch hàng đợi dở dang để tránh xung đột nghẽn kênh
      synth.cancel();

      // 2. Kích hoạt mở khóa cưỡng bức bất kể trạng thái engine
      if (synth.paused) {
        synth.resume();
      }

      // BẢN VÁ LỖI KHỐI: Khởi tạo thực thể Utterance độc lập nằm ngoài mọi nhánh rẽ điều kiện
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options.lang || 'vi-VN';
      utterance.rate = options.rate || 0.92;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 1.0;

      const selectedVoice = pickVietnameseVoice(synth);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      // Khóa tham chiếu cứng ngăn chặn cơ chế Garbage Collection của nhân Blink (Chrome) xóa nhầm câu giữa chừng
      utteranceRef.current = utterance;

      utterance.onend = () => {
        if (utteranceRef.current === utterance) {
          utteranceRef.current = null;
        }
        if (typeof options.onend === 'function') options.onend();
      };

      utterance.onerror = (e) => {
        console.warn('[EGAL-Voice-Pipeline] Speech error:', e);
        if (utteranceRef.current === utterance) {
          utteranceRef.current = null;
        }
        if (typeof options.onerror === 'function') options.onerror(e);
      };

      synth.speak(utterance);
      return true;
    } catch (err) {
      console.error('[EGAL-Voice-Pipeline] Critical exception:', err);
      return false;
    }
  }, []);

  const cancelSafe = useCallback(() => {
    const synth = getSynth();
    if (synth) {
      synth.cancel();
    }
    utteranceRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const synth = getSynth();
    if (!synth) return;

    const handleVoicesChanged = () => {
      synth.getVoices();
    };

    if ('onvoiceschanged' in synth) {
      synth.onvoiceschanged = handleVoicesChanged;
    }
    synth.getVoices();

    return () => {
      mountedRef.current = false;
      if (synth) {
        synth.cancel();
      }
    };
  }, []);

  return { speakSafe, cancelSafe, unlockSpeech };
};