/**
 * PATH       : src/features/a11y/attention/AttentionZone.jsx
 * DATETIME   : 2026-05-15T00:00:00+07:00
 * VERSION    : 24.1.0
 * DESCRIPTION:
 * - Sprint EGAL-6.3 — Step 3:
 *   Persistent Attention & Re-entry Recovery.
 *
 * - Persist:
 *   + lastAttentionMessage
 *   + lastAttentionPriority
 *   + lastAttentionTimestamp
 *
 * - Auto restore attention after reload/re-entry.
 *
 * - Preserve existing AttentionZone public contract.
 * - Preserve business logic/UI behavior.
 * - NO breaking changes.
 * - Tuân thủ Q1/Q2.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  loadRecoveryState,
  saveRecoveryState,
} from '../recovery/guidedRecovery.service.js';

/**
 * <2026-05-15T00:00:00+07:00>
 * EGAL-6.3:
 * Lightweight class merge helper.
 * Tránh thêm dependency clsx vào project hiện tại.
 * Helper này chỉ phục vụ cho Attention Zone nên không cần quá phức tạp
 */
function mergeClassNames(...classes) {    
  return classes.filter(Boolean).join(' ');
}

const DEFAULT_RECOVERY_KEY = 'attention-zone-global';

const PRIORITY_CLASS_MAP = {
  low: 'border-slate-200 bg-slate-50 text-slate-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
  high: 'border-rose-200 bg-rose-50 text-rose-700',
};

const FLASH_CLASS = 'egal-attention-flash';
const LOCK_CLASS = 'egal-attention-locked';

const AttentionZone = forwardRef(function AttentionZone(
  {
    active = false,

    /**
     * Existing API
     */
    children,
    className = '',
    priority = 'medium',

    role = 'status',
    ariaLive = 'polite',

    autoFocus = false,
    autoScroll = false,

    flash = false,
    lock = false,

    tabIndex = -1,

    /**
     * <2026-05-15T00:00:00+07:00>
     * EGAL-6.3:
     * Optional recovery persistence.
     */
    persistRecovery = true,

    recoveryKey = DEFAULT_RECOVERY_KEY,

    recoveryTtlMs = 1000 * 60 * 30, // 30 phút

    restoreOnMount = true,

    /**
     * Existing props passthrough
     */
    ...restProps
  },
  forwardedRef
) {
  const internalRef = useRef(null);

  const [restoredMessage, setRestoredMessage] = useState(null);

  useImperativeHandle(forwardedRef, () => internalRef.current);

  /**
   * <2026-05-15T00:00:00+07:00>
   * Serialize children text nhẹ để persist.
   * Không cố persist React tree đầy đủ.
   */
  const serializedMessage = useMemo(() => {
    if (typeof children === 'string') {
      return children;
    }

    if (
      Array.isArray(children) &&
      children.every((item) => typeof item === 'string')
    ) {
      return children.join(' ');
    }

    return '';
  }, [children]);

  /**
   * <2026-05-15T00:00:00+07:00>
   * Restore previous attention message.
   */
  useEffect(() => {
    if (!persistRecovery || !restoreOnMount) return;

    const recoveryState = loadRecoveryState(recoveryKey);

    if (!recoveryState?.lastAttentionMessage) return;

    setRestoredMessage({
      message: recoveryState.lastAttentionMessage,
      priority:
        recoveryState.lastAttentionPriority || 'medium',
      timestamp:
        recoveryState.lastAttentionTimestamp || null,
    });
  }, [
    persistRecovery,
    recoveryKey,
    restoreOnMount,
  ]);

  /**
   * <2026-05-15T00:00:00+07:00>
   * Persist latest attention message.
   */
  useEffect(() => {
    if (!persistRecovery) return;

    if (!active) return;

    if (!serializedMessage) return;

    saveRecoveryState(
      recoveryKey,
      {
        lastAttentionMessage: serializedMessage,
        lastAttentionPriority: priority,
        lastAttentionTimestamp: Date.now(),

        meta: {
          source: 'AttentionZone',
        },
      },
      {
        ttlMs: recoveryTtlMs,
      }
    );
  }, [
    persistRecovery,
    recoveryKey,
    serializedMessage,
    active,
    priority,
    recoveryTtlMs,
  ]);

  /**
   * Existing behavior:
   * auto focus
   */
  useEffect(() => {
    if (!active || !autoFocus) return;

    if (!internalRef.current) return;

    requestAnimationFrame(() => {
      internalRef.current?.focus?.();
    });
  }, [active, autoFocus]);

  /**
   * Existing behavior:
   * auto scroll
   */
  useEffect(() => {
    if (!active || !autoScroll) return;

    if (!internalRef.current) return;

    requestAnimationFrame(() => {
      internalRef.current?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'center',
      });
    });
  }, [active, autoScroll]);

  /**
   * Existing behavior:
   * flash class
   */
  useEffect(() => {
    if (!flash || !active) return;

    const element = internalRef.current;

    if (!element) return;

    element.classList.add(FLASH_CLASS);

    const timer = setTimeout(() => {
      element.classList.remove(FLASH_CLASS);
    }, 2600);

    return () => clearTimeout(timer);
  }, [flash, active]);

  /**
   * <2026-05-15T00:00:00+07:00>
   * Determine render content.
   *
   * Priority:
   * active children
   * → restored message
   */
  const renderContent = useMemo(() => {
    if (active && children) {
      return children;
    }

    if (
      !active &&
      restoredMessage?.message
    ) {
      return (
        <div className="text-xs font-medium opacity-75">
          {restoredMessage.message}
        </div>
      );
    }

    return children;
  }, [
    active,
    children,
    restoredMessage,
  ]);

  /**
   * <2026-05-15T00:00:00+07:00>
   * Effective priority.
   */
  const effectivePriority =
    active
      ? priority
      : restoredMessage?.priority || priority;

  /**
   * Existing visibility rule:
   * render if:
   * - active
   * OR
   * - restored message exists
   */
  const shouldRender =
    active ||
    !!restoredMessage?.message;

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      ref={internalRef}
      role={role}
      aria-live={ariaLive}
      tabIndex={tabIndex}
      className={mergeClassNames(
        'relative rounded-3xl border p-4 shadow-sm transition-all duration-300 outline-none',

        PRIORITY_CLASS_MAP[effectivePriority] ||
          PRIORITY_CLASS_MAP.medium,

        lock && LOCK_CLASS,

        className
      )}
      data-attention-active={active ? 'true' : 'false'}
      data-attention-priority={effectivePriority}
      data-attention-restored={
        !active && restoredMessage?.message
          ? 'true'
          : 'false'
      }
      {...restProps}
    >
      {renderContent}
    </div>
  );
});

export default AttentionZone;