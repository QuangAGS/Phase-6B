/**
 * PATH       : src/features/a11y/guided/useProactiveVoiceGuidance.js
 * DATETIME   : 2026-05-23T05:32:00+07:00
 * VERSION    : 24.6.7 - PatchedPipeline
 * DESCRIPTION:
 * - Bản vá chuyển đổi luồng phát thanh chủ động theo bước (Guided Steps Navigation).
 * - Loại bỏ hoàn toàn sự phụ thuộc vào useTts().speakStep() cũ gây nhiễu dải âm trên Chrome.
 * - Nhận hàm nhúng `speak` (speakSafe) từ pipeline tập trung truyền vào để đồng bộ hóa mạch Render.
 * - Sử dụng cooldown và quản lý tham chiếu timer chặt chẽ chống lặp tiếng.
 */

import { useEffect, useRef } from 'react';

export default function useProactiveVoiceGuidance({
  activeField,
  guidedSteps,
  scope,
  enabled,
  speakOnMount = true,
  speakOnMountDelayMs = 2200,
  speak, // Nhận hàm speakSafe từ pipeline tập trung truyền vào
}) {
  const timerRef = useRef(null);
  const lastSpokenFieldRef = useRef(null);
  const isFirstMountRef = useRef(true);

  useEffect(() => {
    if (!enabled || !speak || !activeField || !guidedSteps) return;

    const currentStep = guidedSteps.find(step => step.fieldKey === activeField);
    if (!currentStep || !currentStep.description) return;

    // Phân tách mạch xử lý nhịp đọc đầu tiên khi mount form (Tránh xung đột Safari/Chrome)
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      if (!speakOnMount) return;

      timerRef.current = setTimeout(() => {
        lastSpokenFieldRef.current = activeField;
        speak(currentStep.description, { source: `guided:${scope}:${activeField}:mount` });
      }, speakOnMountDelayMs);

      return;
    }

    // Cơ chế chống đọc lặp lại dồn dập khi cùng một trường nhận lại focus nhiều lần
    if (lastSpokenFieldRef.current === activeField) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Tạo độ trễ hình ảnh 150ms để Chrome hoàn tất Reflow Layout trước khi phát tiếng
    timerRef.current = setTimeout(() => {
      lastSpokenFieldRef.current = activeField;
      speak(currentStep.description, { source: `guided:${scope}:${activeField}:change` });
    }, 150);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [activeField, guidedSteps, scope, enabled, speakOnMount, speakOnMountDelayMs, speak]);
}