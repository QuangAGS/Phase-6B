/**
 * PATH       : src/features/auth/components/RegisterForm.jsx
 * DATETIME   : <2026-05-17T10:00:00+07:00>
 * VERSION    : 24.6.7.R1.9
 * DESCRIPTION:
 * - PURPOSE 24.6.7.R1.9:
 *    - Chỉ WaitingPage/Edit mới được truyền draft initialData xuống form con.
 *    - Fresh RegisterForm -> Join/Create phải là fresh session.
 * - EGAL-24.6.7.R1: Register Intent Selector.
 * - RegisterForm chỉ hiển thị 2 lựa chọn ban đầu:
 *   1) Gia nhập một dòng họ
 *   2) Tạo mới một dòng họ
 * - Chỉ mount JoinClanForm/CreateClanForm sau khi người dùng chọn intent.
 * - Preserve AuthPage orchestration root.
 * - Preserve JoinClanForm/CreateClanForm payload/API/Turnstile/Honeypot contract.
 * - Preserve lifecycleContext/reentry/edit-return.
 * - Không thay đổi business logic của form con.
 * - Tuân thủ Q1/Q2.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Landmark,
  PlusCircle,
  LogIn,
  ArrowLeft,
} from 'lucide-react';

import JoinClanForm from './JoinClanForm.jsx';
import CreateClanForm from './CreateClanForm.jsx';

import AttentionZone from '../../a11y/attention/AttentionZone.jsx';
import AudioHelpButton from '../../a11y/tts/AudioHelpButton.jsx';
import { ttsMessages } from '../../a11y/tts/ttsMessages.js';

const REGISTER_MODES = {
  JOIN: 'join',
  CREATE: 'create',
};

/**
 * <2026-05-16T18:30:00+07:00>
 * PURPOSE:
 * - Xác định mode khởi tạo an toàn.
 * - Fresh register: chưa chọn gì, trả về null để hiện intent selector.
 * - WaitingPage/Edit: nếu có initialData.isNewClan thì restore đúng form.
 */
const resolveInitialRegisterMode = (initialData) => {
  if (initialData?.isNewClan === true) {
    return REGISTER_MODES.CREATE;
  }

  if (initialData?.isNewClan === false) {
    return REGISTER_MODES.JOIN;
  }

  return null;
};

const RegisterForm = ({
  onRegisterSubmit,
  toggleAuthMode,
  isSubmitting = false,

  /**
   * Existing draft source.
   */
  initialData = null,

  /**
   * EGAL-6.5.1+
   * Lifecycle context from AuthPage.
   */
  reentryContext = null,
  runtimeVersion = 0,
  runtimeReconstruction = null,
  transitionSnapshot = null,
}) => {
  /**
   * <2026-05-16T18:30:00+07:00>
   * PURPOSE:
   * - Local UI state only.
   * - null = show selector.
   * - join/create = mount selected child form.
   */
  const [registerMode, setRegisterMode] = useState(() =>
    resolveInitialRegisterMode(initialData)
  );
  /**
   * <2026-05-16T21:30:00+07:00>
   * VERSION: 24.6.7.R1.6
   * PURPOSE:
   * - Mỗi lần chọn Join/Create từ selector tạo một runtime session mới.
   * - Tránh restore activeField cũ như submit/captcha khi quay lại form con.
   */
  const [registerSessionId, setRegisterSessionId] = useState(0);
  const [registerOpenSource, setRegisterOpenSource] = useState(() =>
    resolveInitialRegisterMode(initialData) ? 'draft' : 'selector'
  );

  const previousRuntimeVersionRef = useRef(runtimeVersion);
  const [reentryDetected, setReentryDetected] = useState(false);

  /**
   * <2026-05-15T00:00:00+07:00>
   * PURPOSE:
   * - Detect runtime reconstruction from AuthPage.
   * - RegisterForm does not become lifecycle authority.
   */
  useEffect(() => {
    const previousVersion = previousRuntimeVersionRef.current;
    const versionChanged = previousVersion !== runtimeVersion;
    const hasReentryContext = !!reentryContext;
    const shouldResetRuntime = reentryContext?.resetRuntime === true;

    if (versionChanged && hasReentryContext && shouldResetRuntime) {
      setReentryDetected(true);
    }

    previousRuntimeVersionRef.current = runtimeVersion;
  }, [runtimeVersion, reentryContext]);

  /**
   * <2026-05-16T18:30:00+07:00>
   * PURPOSE:
   * - Restore correct mode only when editing existing draft.
   * - Fresh register must remain selector-first.
   */
  useEffect(() => {
    const nextMode = resolveInitialRegisterMode(initialData);

    setRegisterMode(nextMode);
    setRegisterOpenSource(nextMode ? 'draft' : 'selector');
  }, [initialData]);

  /**
   * <2026-05-15T00:00:00+07:00>
   * PURPOSE:
   * - Package lifecycle context for child forms.
   * - Child forms may recompute runtime but AuthPage remains orchestration root.
   */
  const lifecycleContext = useMemo(() => {
    return {
      reentryContext,
      runtimeVersion,
      runtimeReconstruction,
      transitionSnapshot,
      reentryDetected,
      reconstructRuntime: reentryContext?.resetRuntime === true,
    };
  }, [
    reentryContext,
    runtimeVersion,
    runtimeReconstruction,
    transitionSnapshot,
    reentryDetected,
  ]);

  /**
   * <2026-05-17T10:00:00+07:00>
   * VERSION: 24.6.7.R1.9
   * PURPOSE:
   * - Chỉ WaitingPage/Edit mới truyền draft initialData xuống form con.
   * - Fresh RegisterForm -> Join/Create phải là fresh session.
   * - Tránh giữ password/captcha/submit state cũ khi quay lại selector hoặc refresh.
   */
  const isEditFromWaiting =
    reentryContext?.from === 'WaitingPage' &&
    reentryContext?.action === 'edit';

  const childInitialData =
    isEditFromWaiting && registerOpenSource === 'draft'
      ? initialData
      : null;

  /**
   * <2026-05-16T18:30:00+07:00>
   * PURPOSE:
   * - User explicitly chooses register intent.
   * - No child form is mounted before this selection.
   */
  const handleChooseJoin = () => {
    setRegisterOpenSource('selector');
    setRegisterSessionId((prev) => prev + 1);
    setRegisterMode(REGISTER_MODES.JOIN);
  };

  const handleChooseCreate = () => {
    setRegisterOpenSource('selector');
    setRegisterSessionId((prev) => prev + 1);
    setRegisterMode(REGISTER_MODES.CREATE);
  };

  /**
   * <2026-05-16T18:30:00+07:00>
   * PURPOSE:
   * - Return from child form to selector.
   * - This intentionally remounts child form later and clears Turnstile/runtime token.
   */
  const handleBackToSelector = () => {
    setRegisterMode(null);
  };

  /**
   * <2026-05-15T00:00:00+07:00>
   * PURPOSE:
   * - Preserve original submit semantics.
   * - Join payload must remain isNewClan=false.
   */
  const handleJoinSubmit = (payload) => {
    if (!onRegisterSubmit) return;

    onRegisterSubmit({
      ...payload,
      isNewClan: false,
    });
  };

  /**
   * <2026-05-15T00:00:00+07:00>
   * PURPOSE:
   * - Preserve original submit semantics.
   * - Create payload must remain isNewClan=true.
   */
  const handleCreateSubmit = (payload) => {
    if (!onRegisterSubmit) return;

    onRegisterSubmit({
      ...payload,
      isNewClan: true,
    });
  };

  /**
   * <2026-05-16T18:30:00+07:00>
   * PURPOSE:
   * - Selector-first screen.
   * - Avoid mounting child forms too early.
   */
  const renderIntentSelector = () => (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-black text-slate-900">
          Đăng ký tài khoản
        </h1>

        <p className="text-sm font-bold text-slate-500">
          Chọn hình thức đăng ký phù hợp để tiếp tục
        </p>
      </div>

      <AttentionZone
        active
        priority="medium"
        role="status"
        ariaLive="polite"
        autoScroll
        recoveryKey="register-form-intent-selector"
        className="border-indigo-100 bg-indigo-50 text-indigo-800"
      >
        <div className="space-y-2">
          <h2 className="text-xl font-black leading-tight">
            {ttsMessages?.register?.intentTitle ||
              'Bác muốn đăng ký theo hình thức nào?'}
          </h2>

          <p className="text-sm font-bold leading-relaxed text-indigo-700">
            {ttsMessages?.register?.intentSubtitle ||
              'Bác chọn một trong hai hình thức bên dưới để tiếp tục đăng ký.'}
          </p>

          <div className="pt-2">
            <AudioHelpButton
              text={
                ttsMessages?.register?.intentHelp ||
                'Bác chọn Gia nhập một dòng họ nếu dòng họ đã có trong hệ thống. Bác chọn Tạo mới một dòng họ nếu muốn đăng ký một dòng họ chưa có trong hệ thống.'
              }
              label="Nghe hướng dẫn"
              variant="soft"
            />
          </div>

          {reentryDetected && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">
              Hệ thống đã khôi phục dữ liệu nháp và làm mới trạng thái rà soát
              để bảo đảm tính chính xác.
            </div>
          )}
        </div>
      </AttentionZone>

      <div className="grid gap-4">
        <button
          type="button"
          onClick={handleChooseJoin}
          disabled={isSubmitting}
          className="group rounded-3xl border border-indigo-100 bg-white p-5 text-left shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100">
              <Landmark size={26} />
            </div>

            <div className="space-y-1">
              <p className="text-base font-black text-slate-900">
                Gia nhập một dòng họ
              </p>
              <p className="text-sm font-medium leading-relaxed text-slate-500">
                Chọn mục này nếu dòng họ đã có trong hệ thống và bác muốn gửi hồ
                sơ xin gia nhập.
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={handleChooseCreate}
          disabled={isSubmitting}
          className="group rounded-3xl border border-emerald-100 bg-white p-5 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100">
              <PlusCircle size={26} />
            </div>

            <div className="space-y-1">
              <p className="text-base font-black text-slate-900">
                Tạo mới một dòng họ
              </p>
              <p className="text-sm font-medium leading-relaxed text-slate-500">
                Chọn mục này nếu dòng họ chưa có trong hệ thống và bác muốn đăng
                ký tạo mới.
              </p>
            </div>
          </div>
        </button>
      </div>

      <button
        type="button"
        onClick={toggleAuthMode}
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LogIn size={18} />
        Đã có tài khoản? Đăng nhập
      </button>
    </div>
  );

  /**
   * <2026-05-16T18:30:00+07:00>
   * PURPOSE:
   * - Render selected child form only after user intent is chosen.
   * - Forward lifecycle/auth contracts unchanged.
   */
  return (
    <div className="space-y-6">
      {!registerMode && renderIntentSelector()}

      {registerMode && (
        <button
          type="button"
          onClick={handleBackToSelector}
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm font-black text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowLeft size={17} />
          Quay lại chọn hình thức đăng ký
        </button>
      )}

      {registerMode === REGISTER_MODES.JOIN && (
        <JoinClanForm
          key={`join-${registerSessionId}`}
          runtimeSessionId={registerSessionId}
          initialData={childInitialData}
          onSubmit={handleJoinSubmit}
          onBackToRegister={handleBackToSelector}
          isSubmitting={isSubmitting}
          lifecycleContext={lifecycleContext}
        />
      )}

      {registerMode === REGISTER_MODES.CREATE && (
        <CreateClanForm
          key={`create-${registerSessionId}`}
          runtimeSessionId={registerSessionId}
          initialData={childInitialData}
          onSubmit={handleCreateSubmit}
          onBackToRegister={handleBackToSelector}
          isSubmitting={isSubmitting}
          lifecycleContext={lifecycleContext}
        />
      )}
    </div>
  );
};

export default RegisterForm;