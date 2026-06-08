/**
 * PATH       : src/features/a11y/tts/useTts.js
 * DATETIME   : 2026-05-11T00:00:00+07:00
 * VERSION    : 1.0.0
 * DESCRIPTION:
 * - Sprint 2: Tạo hook dùng chung để các component frontend gọi TTS context.
 * - Không chứa business logic.
 * - Không thay đổi UI/UX hiện có.
 * - Tuân thủ Q1 & Q2.
 */

import { useTtsContext } from './TtsProvider';

/**
 * <2026-05-11T00:00:00+07:00>
 * useTts:
 * - Public hook cho các component như AudioHelpButton, FormErrorSpeaker.
 * - Giúp các component không cần import trực tiếp TtsContext.
 */
export function useTts() {
  return useTtsContext();
}

export default useTts;