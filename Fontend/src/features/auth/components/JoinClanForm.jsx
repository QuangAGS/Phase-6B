/**
 * PATH       : src/features/auth/components/JoinClanForm.jsx
 * DATETIME   : <2026-05-28T09:55:00+07:00>
 * VERSION    : EGAL-25.X. R6.2.2A
 * DESCRIPTION:
 * - PURPOSE EGAL-25.X. R6.2.2A: 
 *    chỉ gỡ social preferred-channel khỏi JoinClanForm, thêm email optional, 
 *    và giữ WaitingPage/payload ổn định.
 * - PURPOSE EGAL-24.6.7.R3.3: New doctrine:
      1. Keep `GuidedFieldWrapper` only as UI/AZ shell.
      2. Remove old guided doctrine:
        - no `StepCoachBar`
        - no `useGuidedFlow`
        - no `useProactiveVoiceGuidance`
        - no forced sequential navigation
        - no blur auto-move
      3. User may freely touch/focus any AZ.
      4. Validation happens on submit only.
      5. Error must:
        - show in the correct inline message area
        - be read aloud
        - route/focus to the correct field/AZ
      6. Only one message source should be visible at a time:
        - lock countdown overrides backend error
        - success/pending overrides error
      7. Native browser validation must not block React validation:
        - use `noValidate`
        - remove `required` from inputs handled by React validation

      ## CAPTCHA doctrine
      Shared captcha package is the target:
      - `useCaptchaZone`
      - `CaptchaAttentionField`
      - `captchaZone.service.js`
      Rules:
      - missing token = non-destructive
      - expired/error/backend invalid = destructive reset/remount allowed
      - consumed token must not be reused
      - submit payload uses `captchaCheck.token || captchaZone.getToken()`
      Status:
      - LoginForm: OK
      - ForgotPasswordForm: OK
      - VerifyResetCodeForm: now OK with shared captcha zone
      - ChangePasswordForm: no captcha
 * - PURPOSE 24.6.7.R1.9:
 *    - Chỉ WaitingPage/Edit mới được truyền draft initialData xuống form con.
 *    - Fresh RegisterForm -> Join/Create phải là fresh session.
 * - EGAL-6.5.3: Lifecycle-safe JoinClanForm.
 * - EGAL-24.6.7.R1.5: Tách CAPTCHA thành guided field riêng để TTS đọc đúng hướng dẫn xác minh.
 * - Patch từ VERSION 24.1.0.
 * - Tích hợp validationGate.service.js để hard-validate trước khi chuyển WaitingPage.
 * - Tích hợp runtimeInvalidation.service.js để chống stale validation/runtime state.
 * - Re-check phone online ngay trước transition.
 * - Consume lifecycleContext từ RegisterForm/AuthPage.
 * - Preserve schema/API/payload/Turnstile/Honeypot/auth flow.
 * - Tuân thủ Q1/Q2.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Search,
  Loader2,
  Phone,
  LockKeyhole,
  Landmark,
  Eye,
  EyeOff,
  User,
  Mail, // EGAL-25.X. R6.2.2A: thêm icon mail cho email optional field.
  AlertCircle,
} from 'lucide-react';

// Shared captcha zone (R3.3 doctrine). giữ context, bỏ legacy noise
import AudioHelpButton from '../../a11y/tts/AudioHelpButton.jsx';
import { ttsMessages } from '../../a11y/tts/ttsMessages.js';

import GuidedFieldWrapper from '../../a11y/guided/GuidedFieldWrapper.jsx';
import useGuidedFlow from '../../a11y/guided/useGuidedFlow.js';

import {
  runValidationGate,
  buildValidationAttentionTarget,
} from '../../a11y/validation/validationGate.service.js';

import {
  createInvalidationPlan,
  shouldClearOnlineValidation,
  shouldClearCompletedField,
} from '../../a11y/runtime/runtimeInvalidation.service.js';

import AttentionZone from '../../a11y/attention/AttentionZone.jsx';

import apiClient from '../../../lib/axios.js';
import { joinClanSchema } from '../utils/joinClanValidation.js';
import { useTts } from '../../a11y/tts/useTts.js';
import ZoneVoiceButton from '../../a11y/voice/ZoneVoiceButton.jsx';
// Dùng shared captcha zone thay vì Turnstile component riêng. ------------------
import useCaptchaZone from '../../a11y/captcha/useCaptchaZone.js';
import CaptchaAttentionField from '../../a11y/captcha/CaptchaAttentionField.jsx';
// --------------------------------------------------------------------------------

/**
 * Static option maps
 * - Chỉ phục vụ UI label/select.
 * - Không chứa business logic.
 */
const RELATIONSHIP_OPTIONS = [
  { value: '', label: 'Chọn quan hệ với dòng họ' },
  { value: 'CON_DE', label: 'Con đẻ' },
  { value: 'CON_DAU', label: 'Con dâu' },
  { value: 'CON_RE', label: 'Con rể' },
  { value: 'CON_NUOI', label: 'Con nuôi' },
  { value: 'CON_DO_DAU', label: 'Con đỡ đầu' },
  { value: 'KHAC', label: 'Khác' },
];

/**
 * Default visual system for JoinClanForm.
 * Parent có thể override qua uiSystem nhưng flow/validation không phụ thuộc UI class.
 */
const DEFAULT_UI_SYSTEM = {
  container: 'w-full space-y-6',
  section: 'space-y-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm',
  label: 'text-sm font-black text-slate-700',
  input:
    'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100',
  select:
    'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100',
  buttonSecondary:
    'flex-1 rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm font-black text-slate-700 transition hover:bg-slate-50',
  footer: 'flex gap-3 pt-8',
};

const JoinClanForm = ({
  onSubmit,
  loading = false,
  isSubmitting = false,
  onBackToRegister,
  uiSystem: uiSystemProp,
  onGoToWaiting,
  initialData = null,
  lifecycleContext = null,
  runtimeSessionId = 0,
}) => {
  const uiSystem = uiSystemProp || DEFAULT_UI_SYSTEM;
  const effectiveLoading = loading || isSubmitting;

  /**
   * Local UI state
   * - searchKeyword/tenantResults: phục vụ tìm và chọn dòng họ.
   * - selectedTenant: authority cho dòng họ đã chọn.
   * - selectedChannel: authority cho kênh liên lạc.
   * - attentionMessage: một thông báo đỏ tại một thời điểm.
   */
  //const [step, setStep] = useState(1);
  const step = 1;
  const [searchKeyword, setSearchKeyword] = useState(
    initialData?.clanName || ''
  );
  const [tenantResults, setTenantResults] = useState([]);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(
    initialData?.tenantId
      ? {
          id: initialData.tenantId,
          name: initialData.clanName,
        }
      : null
  );

  const [phoneRemoteError, setPhoneRemoteError] = useState('');
  const [phoneChecking, setPhoneChecking] = useState(false);
  /* EGAL-25 R6.2.2A: ---------------------------------- 
   * nhưng UI chỉ dùng selectedChannel làm authority.
  const [selectedChannel, setSelectedChannel] = useState(
    initialData?.preferredChannel || 'zalo'
  );
  ------------------------------------------------ */
  const [emailRemoteError, setEmailRemoteError] = useState('');
  const [emailChecking, setEmailChecking] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [attentionMessage, setAttentionMessage] = useState('');
  const { speak } = useTts();
  /**
   * Mandatory speech helper
   * - Dùng speak() thay vì speakError() để ổn định hơn trên Safari.
   * - rate 0.82 là tốc độ dễ nghe cho elder UX.
   * - Chỉ dùng cho lỗi/attention bắt buộc phải đọc.
   */
  const speakMandatoryError = useCallback(
    (text, options = {}) => {
      if (!text) return false;

      return speak?.(text, {
        rate: 0.82,
        ...options,
      });
    },
    [speak]
  );
  /**
   * Shared captcha runtime
   * - Không dùng Turnstile local state.
   * - Token được validate tại nextStep().
   * - Token chỉ consume sau khi payload đã chuyển sang WaitingPage/submit flow an toàn.
   */
  const captchaZone = useCaptchaZone({
    zoneId: 'captcha',
    nextZone: 'submit',
    debugName: 'JOIN_CLAN',
    debug: import.meta.env.DEV || import.meta.env.VITE_DEBUG_MODE === 'true',
  });
  /**
   * <2026-05-15T16:00:00+07:00>
   * EGAL-6.6.1:
   * Critical attention message must be spoken every time,
   * even when the same validation error repeats.
   *
   * Q1/Q2 safe:
   * - UI guidance only
   * - no validation change
   * - no payload/API change
   */
  const speakCriticalAttention = useCallback(
    (message) => {
      if (!message) return;

      setAttentionMessage('');

      requestAnimationFrame(() => {
        setAttentionMessage(message);
        speakMandatoryError(message);
      });
    },
    [speakMandatoryError]
  );

  /**
   * Field refs for precise routing
   * - routeFieldError() dùng refs này để scroll/focus đúng field.
   * - Không dùng để điều khiển forced flow.
   */
  const searchTimerRef = useRef(null);
  /**
   * R3.3
   * Field refs for precise focus routing.
   */
  const tenantSearchRef = useRef(null);
  const fullNameRef = useRef(null);
  const fatherNameRef = useRef(null);
  const birthYearRef = useRef(null);
  const relationshipRef = useRef(null);
  const noteRef = useRef(null);
  const phoneRef = useRef(null);
  const emailRef = useRef(null); // EGAL-25.X. R6.2.2A: thêm ref cho email optional field.
  const passwordRef = useRef(null);

  const lastLifecycleVersionRef = useRef(
    lifecycleContext?.runtimeVersion || 0
  );

  /**
   * Fresh default values
   * - Fresh Register → JoinClanForm luôn trắng.
   * - WaitingPage/Edit mới được restore initialData.
   * - preferredChannel mặc định là zalo để không rỗng payload.
   */
  const JOIN_CLAN_EMPTY_VALUES = {
    tenantId: '',
    clanName: '',
    temp_full_name: '',
    temp_father_name: '',
    temp_birth_year: '',
    temp_relationship: '',
    temp_note: '',
    /*
      preferredChannel: 'zalo',
      temp_social_profiles: {
        channel: 'zalo',
      },
      phone: '',
      password: '',
     */
    //EGAL-25.X. R6.2.2A
    email: '',
    phone: '',
    password: '',
    hp_field: '',
  };

  /**
   * React Hook Form contract
   * - Validation chỉ chạy khi submit.
   * - Sau submit lỗi, sửa field sẽ revalidate field đó.
   * - Native browser validation bị tắt ở <form noValidate>.
   */
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    getValues,
    reset,
    clearErrors,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(joinClanSchema),

    /**
     * EGAL-24.6.7.R3.3
     * Validation authoritative on submit.
     * Error shown after submit attempt.
     */
    mode: 'onSubmit',

    /**
     * Sau submit đầu tiên:
     * sửa field sẽ validate lại field đó.
     */
    reValidateMode: 'onChange',
    defaultValues: {
      ...JOIN_CLAN_EMPTY_VALUES,
      ...(initialData || {}),
    },
  });

  const formValues = watch();
  /** EGAL-25.X. R6.2.2A ----------------------------------
   * Contact channel UI map
   * - selectedChannel là state authority.
   * - useEffect bên dưới sync selectedChannel vào RHF values.

    const channels = {
      zalo: {
        name: 'Zalo',
        color: 'bg-blue-600',
        icon: '💬',
        link: 'https://zalo.me/',
      },
      telegram: {
        name: 'Telegram',
        color: 'bg-sky-500',
        icon: '✈️',
        link: 'https://t.me/',
      },
      whatsapp: {
        name: 'WhatsApp',
        color: 'bg-green-600',
        icon: '📱',
        link: 'https://wa.me/',
      },
    };
    const currentChannel = channels[selectedChannel];
    * ------------------------------------------------ 
  */

  const showAzVoiceButton = (zoneId) => guidedFlow.activeField === zoneId;

  /**
   * Per-zone voice guidance text
   * - ZoneVoiceButton đọc text của AZ đang active.
   * - Không tự động đọc khi focus, chỉ đọc khi user bấm "Nghe".
   */
  const zoneHelpText = useMemo(
    () => ({
      clanSearch:
        ttsMessages?.joinClan?.clanSearch ||
        'Bác nhập tên dòng họ cần tìm.',
      personalInfo:
        ttsMessages?.joinClan?.personalInfo ||
        'Bác nhập thông tin cá nhân để Ban quản trị xác minh.',
      /* --- EGAL-25.X R6.2.2A
        contactChannel:
        ttsMessages?.joinClan?.contactChannel ||
        'Bác chọn kênh liên lạc thuận tiện nhất.',
        -------------------------------------------------- */
      accountInfo:
        ttsMessages?.joinClan?.accountInfo ||
        'Bác nhập số điện thoại, email nếu có, và mật khẩu để tạo tài khoản đăng nhập.',
      captcha:
        ttsMessages?.joinClan?.captcha ||
        'Bác hãy bấm vào ô vuông. Khi thấy dấu tích màu xanh là đã xác nhận xong.',
      submit:
        ttsMessages?.joinClan?.submit ||
        'Bác bấm nút tiếp tục rà soát để kiểm tra lại hồ sơ.',
    }),
    []
  );

  /**
   * Attention zone model
   * - useGuidedFlow chỉ còn dùng để biết AZ active/completed.
   * - Không còn forced sequential navigation.
   */
  const guidedSteps = useMemo(
    () => [
      {
        fieldKey: 'clanSearch',
        title: 'Tìm dòng họ cần gia nhập',
        description:
          ttsMessages?.joinClan?.clanSearch ||
          'Bác nhập tên dòng họ cần tìm.',
        nextLabel: 'Tiếp theo: chọn đúng dòng họ.',
      },
      {
        fieldKey: 'personalInfo',
        title: 'Nhập thông tin cá nhân',
        description:
          ttsMessages?.joinClan?.personalInfo ||
          'Bác nhập thông tin cá nhân để Ban quản trị xác minh.',
        nextLabel: 'Tiếp theo: tạo thông tin đăng nhập.',
      },
      /* --- EGAL-25.X R6.2.2A
        {
          fieldKey: 'contactChannel',
          title: 'Chọn kênh liên lạc',
          description:
            ttsMessages?.joinClan?.contactChannel ||
            'Bác chọn kênh liên lạc thuận tiện nhất.',
          nextLabel: 'Tiếp theo: tạo thông tin đăng nhập.',
        },
      -------------------------------------------------- */

      {
        fieldKey: 'accountInfo',
        title: 'Tạo thông tin đăng nhập',
        description:
          ttsMessages?.joinClan?.accountInfo ||
          'Bác nhập số điện thoại và mật khẩu để tạo tài khoản đăng nhập.',
        nextLabel: 'Tiếp theo: xác minh.',
      },
      /**
       * <2026-05-16T20:30:00+07:00>
       * VERSION: 24.6.7.R1.5
       * PURPOSE:
       * - CAPTCHA có guided field riêng để proactive voice guidance đọc đúng.
       * - Không thay đổi Turnstile, validation, payload hoặc API contract.
       */
      {
        fieldKey: 'captcha',
        title: 'Xác minh',
        description:
          ttsMessages?.joinClan?.captcha ||
          'Bác hãy bấm vào ô vuông. Khi thấy dấu tích màu xanh là đã xác nhận xong.',
        nextLabel: 'Tiếp theo: rà soát hồ sơ.',
      },
      {
        fieldKey: 'submit',
        title: 'Rà soát hồ sơ',
        description:
          ttsMessages?.joinClan?.submit ||
          'Bác bấm nút tiếp tục rà soát để kiểm tra lại hồ sơ.',
        nextLabel: '',
      },
    ],
    []
  );

  const guidedFlow = useGuidedFlow(guidedSteps, {
    initialStepIndex: 0,
    initialFieldKey: 'clanSearch',
    enabled: true,

    /**
     * <2026-05-17T10:00:00+07:00>
     * VERSION: 24.6.7.R1.9
     * PURPOSE:
     * - JoinClanForm trong Register flow không restore activeField cũ.
     * - Refresh hoặc quay lại từ selector luôn bắt đầu lại từ clanSearch.
     */
    persistRecovery: false,
  });
  
  /**
   * <2026-05-15T15:00:00+07:00>
   * EGAL-6.6:
   * Fresh mount MUST always begin from step 1/4.
   * Prevent stale attention restoration after refresh
   * or Login -> Register transition.
   *
   * Q1/Q2 safe:
   * only UI guidance reset.
   * no business logic change.
   */
  /**
   * <2026-05-17T10:00:00+07:00>
   * VERSION: 24.6.7.R1.9
   * PURPOSE:
   * - Fresh runtime boundary cho JoinClanForm.
   * - Không giữ captchaToken, attentionMessage, online phone check,
   *   completedFields hoặc activeField cũ.
   */
  /**
   * Fresh runtime boundary
   * - Khi user mở JoinClanForm từ selector, reset draft runtime.
   * - Không giữ captcha, attention, online check, activeField cũ.
   */
  useEffect(() => {
    const isEditFromWaiting = !!initialData;

    if (!isEditFromWaiting) {
      reset(JOIN_CLAN_EMPTY_VALUES);
      setSearchKeyword('');
      setTenantResults([]);
      setSelectedTenant(null);
      //setSelectedChannel('zalo');   --EGAL-25.X. R6.2.2A
    }

    requestAnimationFrame(() => {
      captchaZone.reset({
        reason: 'runtime-reset',
        remount: true,
      });
      setAttentionMessage('');
      setPhoneRemoteError('');
      setPhoneChecking(false);

      if (guidedFlow.resetGuidedFlow) {
        guidedFlow.resetGuidedFlow();
      } else if (guidedFlow.resetFlow) {
        guidedFlow.resetFlow();
      }

      guidedFlow.goToField('clanSearch');
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimeSessionId]);

  /**
   * <2026-05-15T00:00:00+07:00>
   * EGAL-6.5.3:
   * Re-entry reconstruction.
   * Khi quay lại từ WaitingPage/Edit, chỉ giữ draft values.
   * Runtime authority phải reset/recompute.
   */
  /**
   * WaitingPage/Edit reconstruction
   * - Giữ draft values qua initialData.
   * - Chỉ reset runtime authority: attention, captcha, activeField.
   */
  useEffect(() => {
    const nextVersion = lifecycleContext?.runtimeVersion || 0;
    const versionChanged = nextVersion !== lastLifecycleVersionRef.current;
    const shouldReconstruct =
      lifecycleContext?.reconstructRuntime === true ||
      lifecycleContext?.reentryContext?.resetRuntime === true;

    if (versionChanged && shouldReconstruct) {
      setAttentionMessage('');
      setPhoneRemoteError('');
      setPhoneChecking(false);
      //EGAL-25.X. R6.2.2A: thêm reset email remote error khi reconstruct runtime.
      setEmailRemoteError('');
      setEmailChecking(false);

      if (guidedFlow.resetGuidedFlow) {
        guidedFlow.resetGuidedFlow();
      } else if (guidedFlow.resetFlow) {
        guidedFlow.resetFlow();
      }

      guidedFlow.goToField('clanSearch');
    }

    lastLifecycleVersionRef.current = nextVersion;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifecycleContext?.runtimeVersion]);

  useEffect(() => {
    if (initialData) {
      if (initialData.tenantId && initialData.clanName) {
        setSelectedTenant({
          id: initialData.tenantId,
          name: initialData.clanName,
          slug: initialData.tenantSlug || '',
        });
        setValue('tenantId', initialData.tenantId, { shouldValidate: true });
        setValue('clanName', initialData.clanName, { shouldValidate: true });
      }
      /* -----  EGAL-25.X. R6.2.2A
        if (initialData.preferredChannel) {
          setSelectedChannel(initialData.preferredChannel);
          setValue('preferredChannel', initialData.preferredChannel, {
            shouldValidate: true,
          });
          setValue(
            'temp_social_profiles',
            { channel: initialData.preferredChannel },
            { shouldValidate: true }
          );
        }
        -------------------------------------------------- */
        
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, setValue]);

/* -----  EGAL-25.X. R6.2.2A
  useEffect(() => {
    setValue('preferredChannel', selectedChannel, {
      shouldValidate: true,
      shouldDirty: true,
    });

    setValue(
      'temp_social_profiles',
      { channel: selectedChannel },
      { shouldValidate: true, shouldDirty: true }
    );
  }, [selectedChannel, setValue]);
  -------------------------------------------------- */

  const applyInvalidationPlan = useCallback(
    (plan) => {
      if (!plan?.invalidated) return;

      if (shouldClearOnlineValidation(plan, 'phone')) {
        setPhoneRemoteError('');
        setPhoneChecking(false);
      }

      ['clanSearch', 'personalInfo', 'accountInfo', 'captcha'].forEach(
        (fieldKey) => {
          if (shouldClearCompletedField(plan, fieldKey)) {
            guidedFlow.unmarkCompleted(fieldKey);
          }
        }
      );

      if (plan.affectedZones?.[0]) {
        guidedFlow.goToField(plan.affectedZones[0]);
      }
    },
    [guidedFlow]
  );

  const invalidateRuntimeForField = useCallback(
    (fieldKey) => {
      const plan = createInvalidationPlan([fieldKey]);
      applyInvalidationPlan(plan);
    },
    [applyInvalidationPlan]
  );

  /**   Helper
   * Clear field error on user edit
   * - Xoá inline error và attention message khi user bắt đầu sửa field.
   * - Đồng thời invalidate runtime liên quan.
   */
  const clearFieldErrorOnEdit = useCallback(
    (fieldName, options = {}) => {
      clearErrors(fieldName);
      setAttentionMessage('');

      if (options.clearPhoneRemoteError) {
        setPhoneRemoteError('');
      }
      //EGAL-25.X. R6.2.2A: thêm reset email remote error khi reconstruct runtime.
      if (options.clearEmailRemoteError) {
        setEmailRemoteError('');
      }

      invalidateRuntimeForField(options.invalidateField || fieldName);
    },
    [clearErrors, invalidateRuntimeForField]
  );

  /**
   * Focus router
   * - Map field name thật sang DOM ref.
   * - Dùng cho error routing, không dùng cho guided progression.
   */
  const focusFieldByName = useCallback((fieldName) => {
    const refMap = {
      clanSearch: tenantSearchRef,
      tenantId: tenantSearchRef,
      clanName: tenantSearchRef,
      temp_full_name: fullNameRef,
      temp_birth_year: birthYearRef,
      temp_father_name: fatherNameRef,
      temp_relationship: relationshipRef,
      temp_note: noteRef,
      phone: phoneRef,
      email: emailRef, // EGAL-25.X. R6.2.2A: thêm email vào ref map.
      password: passwordRef,
    };

    const targetRef = refMap[fieldName];

    requestAnimationFrame(() => {
      targetRef?.current?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'center',
      });

      targetRef?.current?.focus?.({
        preventScroll: true,
      });
    });
  }, []);

  /**
   * Error routing authority
   * - Hiển thị attentionMessage.
   * - Chuyển active AZ.
   * - Scroll/focus đúng field.
   * - Delay đọc 250ms để Safari không nuốt tiếng.
   */
  const routeFieldError = useCallback(
    (fieldName, message, attentionField) => {
      const finalMessage =
        message ||
        'Thông tin hồ sơ chưa đầy đủ hoặc chưa đúng. Bác vui lòng kiểm tra lại.';

      setAttentionMessage('');

      requestAnimationFrame(() => {
        setAttentionMessage(finalMessage);

        if (attentionField) {
          guidedFlow.goToField(attentionField);
        }

        focusFieldByName(fieldName);

        window.setTimeout(() => {
          speakMandatoryError(finalMessage);
        }, 250);
      });
    },
    [focusFieldByName, guidedFlow, speakMandatoryError]
  );

  /**
   * Tenant search
   * - Debounced qua searchTimerRef.
   * - Chỉ tìm khi keyword đủ dài.
   */
  const searchTenant = useCallback(async (keyword) => {
    const q = keyword?.trim();

    if (!q || q.length < 2) {
      setTenantResults([]);
      return;
    }

    setTenantLoading(true);

    try {
      const res = await apiClient.get('/tenants/search', {
        params: { q, field: 'name' },
      });
      setTenantResults(res.data?.data || []);
    } catch (err) {
      setTenantResults([]);
    } finally {
      setTenantLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    searchTimerRef.current = setTimeout(() => searchTenant(searchKeyword), 450);

    return () => clearTimeout(searchTimerRef.current);
  }, [searchKeyword, searchTenant]);

  /**
   * Online phone uniqueness check
   * - Re-check khi blur và trước transition.
   * - Nếu trùng, đọc lỗi và route về accountInfo.
   */
  const checkPhoneAvailability = async (phone) => {
    const normalizedPhone = String(phone || '').trim();

    if (!normalizedPhone || normalizedPhone.length < 10) {
      setPhoneRemoteError('');
      return {
        valid: false,
        message: '',
      };
    }

    setPhoneChecking(true);

    try {
      const res = await apiClient.get('/auth/check-identity', {
        params: { type: 'phone', value: normalizedPhone },
      });

      if (res.data?.available === false) {
        const message = 'Số điện thoại này đã được sử dụng.';
        setPhoneRemoteError(message);
        setAttentionMessage(message);

        guidedFlow.goToField('accountInfo');

        window.setTimeout(() => {
          phoneRef?.current?.scrollIntoView?.({
            behavior: 'smooth',
            block: 'center',
          });

          phoneRef?.current?.focus?.({
            preventScroll: true,
          });

          speakMandatoryError(message);
        }, 180);

        return {
          valid: false,
          message,
        };
      }

      setPhoneRemoteError('');

      return {
        valid: true,
        message: '',
      };
    } catch (err) {
      setPhoneRemoteError('');

      return {
        valid: true,
        message: '',
      };
    } finally {
      setPhoneChecking(false);
    }
  };

  // EGAL-25.X. R6.2.2A: thêm online check cho email optional field.
  const checkEmailAvailability = async (email) => {
    const normalizedEmail = String(email || '').trim();

    if (!normalizedEmail) {
      setEmailRemoteError('');
      return {
        valid: true,
        message: '',
      };
    }

    setEmailChecking(true);

    try {
      const res = await apiClient.get('/auth/check-identity', {
        params: { type: 'email', value: normalizedEmail },
      });

      if (res.data?.available === false) {
        const message = 'Email này đã được sử dụng.';

        setEmailRemoteError(message);
        setAttentionMessage(message);

        guidedFlow.goToField('accountInfo');

        window.setTimeout(() => {
          emailRef?.current?.scrollIntoView?.({
            behavior: 'smooth',
            block: 'center',
          });

          emailRef?.current?.focus?.({
            preventScroll: true,
          });

          speakMandatoryError(message);
        }, 180);

        return {
          valid: false,
          message,
        };
      }

      setEmailRemoteError('');

      return {
        valid: true,
        message: '',
      };
    } catch (err) {
      setEmailRemoteError('');

      return {
        valid: true,
        message: '',
      };
    } finally {
      setEmailChecking(false);
    }
  };

  const handleSelectTenant = (tenant) => {
    setSelectedTenant(tenant);
    setValue('tenantId', tenant.id, {
      shouldValidate: true,
      shouldDirty: true,
    });
    setValue('clanName', tenant.name, {
      shouldValidate: true,
      shouldDirty: true,
    });

    setAttentionMessage('');

    guidedFlow.markCompleted('clanSearch');
  };

  /**
   * <2026-05-16T20:30:00+07:00>
   * VERSION: 24.6.7.R1.5
   * PURPOSE:
   * - Khi Turnstile xác minh xong, đánh dấu guided field CAPTCHA là completed.
   * - Giữ nguyên captchaToken và accountInfo completion logic hiện có.
  const handleTurnstileVerify = (token) => {
    setCaptchaToken(token);
    setAttentionMessage('');

    guidedFlow.markCompleted('captcha');

    const values = getValues();

    if (
      values?.phone?.trim?.() &&
      values?.password?.trim?.() &&
      !phoneRemoteError
    ) {
      guidedFlow.markCompleted('accountInfo');
    }
  };
  */

  const hasCoreRequiredData = (values) => {
    return (
      !!selectedTenant?.id &&
      !!selectedTenant?.name &&
      !!values?.temp_full_name?.trim?.() &&
      !!values?.temp_father_name?.trim?.() &&
      !!values?.temp_birth_year?.trim?.() &&
      !!values?.temp_relationship &&
      !!values?.temp_note?.trim?.() &&
      !!values?.phone?.trim?.() &&
      !!values?.password?.trim?.()
    );
  };

  const getAttentionFieldFromGate = (gateTarget, values) => {
    if (gateTarget?.field === 'tenantId' || gateTarget?.field === 'clanName') {
      return 'clanSearch';
    }
    if (
      [
        'temp_full_name',
        'temp_father_name',
        'temp_relationship',
        'temp_note',
      ].includes(gateTarget?.field)
    ) {
      return 'personalInfo';
    }
    /* --- EGAL-25.X. R6.2.2A
      if (gateTarget?.field === 'preferredChannel') {
        return 'contactChannel';
      }
    -------------------------------------------------- */

    if (['phone', 'email', 'password'].includes(gateTarget?.field)) {
      return 'accountInfo';
    }

    if (!selectedTenant?.id) return 'clanSearch';
    if (
      !values?.temp_full_name?.trim?.() ||
      !values?.temp_father_name?.trim?.() ||
      !values?.temp_relationship ||
      !values?.temp_note?.trim?.()
    ) {
      return 'personalInfo';
    }

    // if (!selectedChannel) return 'contactChannel'; // EGAL-25.X. R6.2.2A

    return 'accountInfo';
  };

  /**
   * Submit-gated transition to WaitingPage
   * Authority duy nhất trước khi chuyển review:
   * 1. Sync selectedTenant/selectedChannel vào latestValues.
   * 2. Validate required fields.
   * 3. Re-check phone online.
   * 4. Validate captcha token.
   * 5. Run validation gate.
   * 6. Build finalPayload đầy đủ.
   */
  const nextStep = async () => {
    if (selectedTenant?.id) {
      setValue('tenantId', selectedTenant.id, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }

    if (selectedTenant?.name) {
      setValue('clanName', selectedTenant.name, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
    /* EGAL-25.X. R6.2.2A: selectedChannel là authority cho contact channel, sync vào RHF value để validation gate check.
      setValue('preferredChannel', selectedChannel, {
        shouldValidate: true,
        shouldDirty: true,
      });

      setValue(
        'temp_social_profiles',
        { channel: selectedChannel },
        { shouldValidate: true, shouldDirty: true }
      );
    ------------------------------------------------ */


    setValue('hp_field', formValues.hp_field || '', {
      shouldValidate: true,
      shouldDirty: false,
    });

    const latestValues = {
      ...getValues(),
      tenantId: selectedTenant?.id || '',
      clanName: selectedTenant?.name || '',
      tenantSlug: selectedTenant?.slug || '',
      /* preferredChannel: selectedChannel, // EGAL-25.X. R6.2.2A: 
        temp_social_profiles: { channel: selectedChannel },
        */
      hp_field: formValues.hp_field || '',
    };

    if (!selectedTenant?.id) {
      routeFieldError(
        'clanSearch',
        'Bác vui lòng chọn đúng dòng họ cần gia nhập.',
        'clanSearch'
      );
      return;
    }

    if (!latestValues?.temp_full_name?.trim?.()) {
      routeFieldError(
        'temp_full_name',
        'Bác vui lòng nhập họ và tên của mình.',
        'personalInfo'
      );
      return;
    }

    if (!latestValues?.temp_father_name?.trim?.()) {
      routeFieldError(
        'temp_father_name',
        'Bác vui lòng nhập tên cha hoặc mẹ để Ban quản trị đối chiếu.',
        'personalInfo'
      );
      return;
    }

    if (!latestValues?.temp_birth_year?.trim()) {
      routeFieldError(
        'temp_birth_year',
        'Bác vui lòng nhập năm sinh của bác.',
        'personalInfo'
      );
      return;
    }

    if (
      !/^\d{4}$/.test(
        String(latestValues.temp_birth_year).trim()
      )
    ) {
      routeFieldError(
        'temp_birth_year',
        'Bác vui lòng nhập năm sinh gồm bốn chữ số, ví dụ một chín sáu mươi lăm.',
        'personalInfo'
      );
      return;
    }

    if (!latestValues?.temp_relationship) {
      routeFieldError(
        'temp_relationship',
        'Bác vui lòng chọn quan hệ với dòng họ.',
        'personalInfo'
      );
      return;
    }

    if (!latestValues?.temp_note?.trim?.()) {
      routeFieldError(
        'temp_note',
        'Bác vui lòng nhập lời nhắn tới Ban quản trị.',
        'personalInfo'
      );
      return;
    }

    if (!latestValues?.phone?.trim?.()) {
      routeFieldError(
        'phone',
        'Bác vui lòng nhập số điện thoại đăng nhập.',
        'accountInfo'
      );
      return;
    }

    if (!latestValues?.password?.trim?.()) {
      routeFieldError(
        'password',
        'Bác vui lòng nhập mật khẩu đăng nhập.',
        'accountInfo'
      );
      return;
    }

    /**
     * <2026-05-15T00:00:00+07:00>
     * EGAL-6.5.3:
     * Fresh online re-check trước transition.
     * Không tin phoneRemoteError cũ.
     */
    const phoneCheck = await checkPhoneAvailability(latestValues.phone);

    if (!phoneCheck.valid) {
      routeFieldError(
        'phone',
        phoneCheck.message || 'Số điện thoại cần được kiểm tra lại.',
        'accountInfo'
      );
      guidedFlow.unmarkCompleted('accountInfo');
      return;
    }

    const emailCheck = await checkEmailAvailability(latestValues.email);

    if (!emailCheck.valid) {
      routeFieldError(
        'email',
        emailCheck.message || 'Email cần được kiểm tra lại.',
        'accountInfo'
      );
      guidedFlow.unmarkCompleted('accountInfo');
      return;
    }

    const captchaCheck = captchaZone.validateBeforeSubmit();

    if (!captchaCheck.valid) {
      const captchaMessage =
        captchaCheck.message ||
        ttsMessages?.joinClan?.captcha ||
        'Bác hãy bấm vào ô vuông. Khi thấy dấu tích màu xanh là đã xác nhận xong.';

      setAttentionMessage(captchaMessage);

      captchaZone.applyValidationFailure({
        validationResult: captchaCheck,
        guidedFlow,
        speak: speakMandatoryError,
        focus: focusFieldByName,
        focusDelayMs: 520,
      });

      return;
    }

    const gateResult = await runValidationGate({
      values: latestValues,
      requiredFields: [
        'tenantId',
        'clanName',
        'temp_full_name',
        'temp_father_name',
        'temp_birth_year',
        'temp_relationship',
        'temp_note',
        'phone',
        'password',
      ],
      asyncValidationState: {
        phone: phoneChecking,
        email: emailChecking,
      },
      onlineErrors: {
        phone: phoneRemoteError,
        email: emailRemoteError,
      },
      localValidation: async () => {
        const valid = await trigger();

        return {
          valid,
          errors,
        };
      },
      metadata: {
        form: 'JoinClanForm',
        transition: 'JoinClanForm->WaitingPage',
        lifecycleRuntimeVersion: lifecycleContext?.runtimeVersion || 0,
      },
    });

    if (!gateResult.allowed) {
      const target = buildValidationAttentionTarget(gateResult);
      const attentionField = getAttentionFieldFromGate(target, latestValues);

      const targetField = target.field || attentionField;

      const fieldSpecificMessage =
        targetField && errors?.[targetField]?.message
          ? errors[targetField].message
          : '';

      routeFieldError(
        targetField,
        target.message ||
          fieldSpecificMessage ||
          'Thông tin hồ sơ chưa đầy đủ hoặc chưa đúng. Bác vui lòng kiểm tra lại các mục được báo lỗi trên màn hình.',
        attentionField
      );

      return;
    }

    if (!hasCoreRequiredData(latestValues)) {
      routeFieldError(
        'submit',
        'Thông tin hồ sơ chưa đầy đủ hoặc chưa đúng. Bác vui lòng kiểm tra lại các mục được báo lỗi trên màn hình.',
        'submit'
      );

      return;
    }
    setAttentionMessage('');

    const finalPayload = {
      ...latestValues,
      tenantId: selectedTenant.id,
      clanName: selectedTenant.name,
      tenantSlug: selectedTenant.slug || '',
      /* preferredChannel: selectedChannel, // EGAL-25.X. R6.2.2A
        preferredChannel: selectedChannel,
        temp_social_profiles: { channel: selectedChannel },
        */
      turnstileToken: captchaCheck.token || captchaZone.getToken(),
      hp_field: latestValues.hp_field || '',
      isNewClan: false,
    };

    if (onGoToWaiting) {
      onGoToWaiting(finalPayload);
      return;
    }

    captchaZone.consume({
      guidedFlow,
    });

    if (onSubmit) {
      onSubmit(finalPayload);
    }
  };

  /**
   * Field registrations
   * - Tách register object để gắn chung RHF ref + DOM ref.
   * - Mỗi onChange chỉ clear lỗi và invalidate runtime, không auto progression.
   */
  const fullNameRegister = register('temp_full_name', {
    onChange: () => clearFieldErrorOnEdit('temp_full_name'),
  });

  const fatherNameRegister = register('temp_father_name', {
    onChange: () => clearFieldErrorOnEdit('temp_father_name'),
  });

  const birthYearRegister = register('temp_birth_year', {
    onChange: () => clearFieldErrorOnEdit('temp_birth_year'),
  });

  const relationshipRegister = register('temp_relationship', {
    onChange: (e) => {
      clearFieldErrorOnEdit('temp_relationship');

      setValue('temp_relationship', e.target.value, {
        shouldValidate: false,
        shouldDirty: true,
      });
    },
  });

  const noteRegister = register('temp_note', {
    onChange: () => clearFieldErrorOnEdit('temp_note'),
  });

  const phoneRegister = register('phone', {
    onChange: () =>
      clearFieldErrorOnEdit('phone', {
        clearPhoneRemoteError: true,
      }),
  });

  // EGAL-25.X. R6.2.2A: thêm email optional field vào form và validation gate, nhưng không bắt buộc phải nhập.
  const emailRegister = register('email', {
    onChange: () =>
      clearFieldErrorOnEdit('email', {
        clearEmailRemoteError: true,
      }),
  });

  const passwordRegister = register('password', {
    onChange: () => clearFieldErrorOnEdit('password'),
  });

  /**
   * Action footer
   * - isStep1=true bắt buộc dùng button type="button" gọi nextStep().
   * - Không được bypass bằng native submit vì sẽ thiếu finalPayload.
   */
  const ActionFooter = ({ isStep1 }) => (
    <div className="pt-8">
      {isStep1 ? (
        <GuidedFieldWrapper
          fieldKey="submit"
          activeField={guidedFlow.activeField}
          helperText={
            ttsMessages?.joinClan?.submit ||
            'Bác bấm nút tiếp tục rà soát để kiểm tra lại hồ sơ.'
          }
          completed={false}
          voiceAction={
            <ZoneVoiceButton
              visible={showAzVoiceButton('submit')}
              text={zoneHelpText.submit}
              label="Nghe"
              disabled={effectiveLoading || phoneChecking || emailChecking}
            />
          }
        >
          <button
            type="button"
            onClick={nextStep}
            disabled={effectiveLoading || phoneChecking || emailChecking}
            className={`w-full py-4 rounded-3xl font-bold transition-all ${
              effectiveLoading || phoneChecking || emailChecking
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {phoneChecking || emailChecking ? 'Đang kiểm tra...' : 'Tiếp tục rà soát →'}
          </button>
        </GuidedFieldWrapper>
      ) : (
        <button
          type="submit"
          disabled={effectiveLoading}
          className="flex-[2] py-4 bg-emerald-600 text-white rounded-3xl font-bold"
        >
          {effectiveLoading ? (
            <Loader2 className="animate-spin mx-auto" size={20} />
          ) : (
            'Gửi hồ sơ gia nhập'
          )}
        </button>
      )}
    </div>
  );

  return (
    <div className={uiSystem.container}>
      <style>
        {`
          @keyframes egalAttentionSoftFlash {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
              transform: translateY(0);
            }
            35% {
              box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.14);
              transform: translateY(-1px);
            }
            70% {
              box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.08);
              transform: translateY(0);
            }
          }

          .egal-attention-flash {
            animation: egalAttentionSoftFlash 2.4s ease-out 1;
          }

          .egal-attention-locked {
            position: relative;
            z-index: 1;
          }

          @media (prefers-reduced-motion: reduce) {
            .egal-attention-flash {
              animation: none;
              box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.10);
            }
          }
        `}
      </style>

      <form
        noValidate
        onSubmit={handleSubmit(() => {})}
        className="space-y-6"
      >
        <section className="rounded-3xl border border-emerald-100 bg-emerald-50/80 p-5 text-center shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">
            Hồ sơ đăng ký
          </p>

          <h2 className="mt-2 text-2xl font-black leading-tight text-slate-900">
            Gia nhập một dòng họ
          </h2>

          <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-relaxed text-slate-600">
            Bác vui lòng tìm đúng dòng họ, nhập thông tin cá nhân, nhập số điện thoại, email nếu có, và tạo tài khoản
            để gửi hồ sơ xin gia nhập.
          </p>

          <div className="mt-4 flex justify-center">
            <AudioHelpButton
              text={
                ttsMessages?.joinClan?.help ||
                'Bác tìm dòng họ cần gia nhập, nhập thông tin cá nhân, chọn cách liên lạc và tạo tài khoản đăng nhập.'
              }
              label="Nghe hướng dẫn"
              variant="soft"
            />
          </div>
        </section>

        {attentionMessage && (
          <AttentionZone
            active={!!attentionMessage}
            priority="high"
            role="alert"
            ariaLive="assertive"
            autoScroll
            autoFocus
            flash
            lock
            recoveryKey="join-clan-form-attention"
            className="flex items-start gap-3 border-rose-100 bg-rose-50 text-rose-700"
            data-testid="join-clan-attention-message"
          >
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
            <span className="text-sm font-bold leading-relaxed">
              {attentionMessage}
            </span>
          </AttentionZone>
        )}

        <>
          <>
            <GuidedFieldWrapper
              fieldKey="clanSearch"
              activeField={guidedFlow.activeField}
              helperText={zoneHelpText.clanSearch}
              completed={guidedFlow.isCompleted('clanSearch')}
              voiceAction={
                <ZoneVoiceButton
                  visible={showAzVoiceButton('clanSearch')}
                  text={zoneHelpText.clanSearch}
                  label="Nghe"
                  disabled={effectiveLoading}
                />
              }
            >
              <div className={uiSystem.section}>
                <div className="space-y-1">
                  <label className={uiSystem.label}>
                    Tìm dòng họ gia nhập{' '}
                    <span className="text-rose-500">*</span>
                  </label>

                  <div className="relative">
                    <Search
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={18}
                    />

                    <input
                      ref={tenantSearchRef}
                      type="text"
                      value={searchKeyword}
                      onChange={(e) => {
                        setSearchKeyword(e.target.value);
                        setAttentionMessage('');
                        invalidateRuntimeForField('tenantId');
                        guidedFlow.goToField('clanSearch');
                      }}
                      onFocus={() => guidedFlow.goToField('clanSearch')}
                      className={`pl-11 ${uiSystem.input}`}
                      placeholder="Gõ tên dòng họ hoặc định danh."
                    />

                    {tenantLoading && (
                      <Loader2
                        className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-blue-500"
                        size={18}
                      />
                    )}
                  </div>
                </div>

                {!selectedTenant && tenantResults.length > 0 && (
                  <div className="mt-3 space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {tenantResults.map((tenant) => (
                      <button
                        key={tenant.id}
                        type="button"
                        onClick={() => handleSelectTenant(tenant)}
                        className="w-full rounded-3xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                            <Landmark size={22} />
                          </div>

                          <div>
                            <p className="font-black text-slate-900">
                              {tenant.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Bấm để chọn dòng họ này
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedTenant && (
                  <div className="mt-3 rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-800">
                    <p className="text-xs font-black uppercase tracking-widest">
                      Đã chọn dòng họ
                    </p>
                    <p className="mt-1 text-lg font-black">
                      {selectedTenant.name}
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTenant(null);
                        setValue('tenantId', '', { shouldValidate: true });
                        setValue('clanName', '', { shouldValidate: true });
                        setAttentionMessage('');
                        invalidateRuntimeForField('tenantId');
                        guidedFlow.goToField('clanSearch');
                      }}
                      className="mt-3 text-sm font-bold text-emerald-700 underline"
                    >
                      Chọn lại dòng họ
                    </button>
                  </div>
                )}
              </div>
            </GuidedFieldWrapper>

            <GuidedFieldWrapper
              fieldKey="personalInfo"
              activeField={guidedFlow.activeField}
              helperText={
                ttsMessages?.joinClan?.personalInfo ||
                'Bác nhập thông tin cá nhân để Ban quản trị xác minh.'
              }
              completed={guidedFlow.isCompleted('personalInfo')}
              voiceAction={
                <ZoneVoiceButton
                  visible={showAzVoiceButton('personalInfo')}
                  text={zoneHelpText.personalInfo}
                  label="Nghe"
                  disabled={effectiveLoading}
                />
              }
            >
              <div className={uiSystem.section}>
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400">
                  <User size={18} />
                  Thông tin cá nhân
                </h3>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className={uiSystem.label}>
                      Họ và tên <span className="text-rose-500">*</span>
                    </label>
                    <input
                      {...fullNameRegister}
                      ref={(el) => {
                        fullNameRegister.ref(el);
                        fullNameRef.current = el;
                      }}
                      onFocus={() => guidedFlow.goToField('personalInfo')}
                      className={uiSystem.input}
                      placeholder="Nguyễn Văn A"
                    />
                    {errors.temp_full_name && (
                      <p className="text-xs font-bold text-rose-600">
                        {errors.temp_full_name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className={uiSystem.label}>
                      Tên cha/mẹ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      {...fatherNameRegister}
                      ref={(el) => {
                        fatherNameRegister.ref(el);
                        fatherNameRef.current = el;
                      }}
                      onFocus={() => guidedFlow.goToField('personalInfo')}
                      className={uiSystem.input}
                      placeholder="Tên cha hoặc mẹ để đối chiếu"
                    />
                    {errors.temp_father_name && (
                      <p className="text-xs font-bold text-rose-600">
                        {errors.temp_father_name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className={uiSystem.label}>Năm sinh</label>
                    <input
                      {...birthYearRegister}
                      ref={(el) => {
                        birthYearRegister.ref(el);
                        birthYearRef.current = el;
                      }}
                      onFocus={() => guidedFlow.goToField('personalInfo')}
                      className={uiSystem.input}
                      placeholder="Ví dụ: 1965"
                    />
                    {errors.temp_birth_year && (
                      <p className="text-xs font-bold text-rose-600">
                        {errors.temp_birth_year.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className={uiSystem.label}>
                      Quan hệ với dòng họ{' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <select
                      {...relationshipRegister}
                      ref={(el) => {
                        relationshipRegister.ref(el);
                        relationshipRef.current = el;
                      }}
                      onFocus={() => guidedFlow.goToField('personalInfo')}
                      className={uiSystem.select || uiSystem.input}
                    >
                      {RELATIONSHIP_OPTIONS.map((item) => (
                        <option key={item.value || 'empty'} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    {errors.temp_relationship && (
                      <p className="text-xs font-bold text-rose-600">
                        {errors.temp_relationship.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className={uiSystem.label}>
                      Lời nhắn cho quản trị viên{' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      {...noteRegister}
                      ref={(el) => {
                        noteRegister.ref(el);
                        noteRef.current = el;
                      }}
                      onFocus={() => guidedFlow.goToField('personalInfo')}
                      className={`${uiSystem.input} min-h-[100px] resize-none`}
                      placeholder="Thông tin bổ sung để Ban quản trị xác minh..."
                    />
                    {errors.temp_note && (
                      <p className="text-xs font-bold text-rose-600">
                        {errors.temp_note.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </GuidedFieldWrapper>

            <GuidedFieldWrapper
              fieldKey="accountInfo"
              activeField={guidedFlow.activeField}
              helperText={
                ttsMessages?.joinClan?.accountInfo ||
                'Bác nhập số điện thoại và mật khẩu để tạo tài khoản đăng nhập.'
              }
              completed={guidedFlow.isCompleted('accountInfo')}
              voiceAction={
                <ZoneVoiceButton
                  visible={showAzVoiceButton('accountInfo')}
                  text={zoneHelpText.accountInfo}
                  label="Nghe"
                  disabled={effectiveLoading}
                />
              }
            >
              <div className={uiSystem.section}>
                <div className="space-y-5">
                  <div className="space-y-1">
                    <label className={uiSystem.label}>
                      Số điện thoại đăng nhập{' '}
                      <span className="text-rose-500">*</span>
                    </label>

                    <div className="relative">
                      <Phone
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                        size={18}
                      />

                      <input
                        {...phoneRegister}
                        ref={(el) => {
                          phoneRegister.ref(el);
                          phoneRef.current = el;
                        }}
                        onFocus={() => guidedFlow.goToField('accountInfo')}
                        onBlur={async (e) => {
                          await checkPhoneAvailability(e.target.value);
                        }}
                        className={`pl-11 ${uiSystem.input}`}
                        placeholder="Số điện thoại chính (10 số)"
                      />

                      {phoneChecking && (
                        <Loader2
                          className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-blue-500"
                          size={18}
                        />
                      )}
                    </div>

                    {errors.phone && (
                      <p className="text-xs font-bold text-rose-600">
                        {errors.phone.message}
                      </p>
                    )}

                    {phoneRemoteError && (
                      <p className="text-rose-600 text-xs mt-1">
                        {phoneRemoteError}
                      </p>
                    )}
                  </div>
                  
                  {/* EGAL-25.X. R6.2.2A */}
                  <div className="space-y-1">
                    <label className={uiSystem.label}>
                      Email <span className="text-slate-400">(không bắt buộc)</span>
                    </label>

                    <div className="relative">
                      <Mail
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                        size={18}
                      />

                      <input
                        {...emailRegister}
                        ref={(el) => {
                          emailRegister.ref(el);
                          emailRef.current = el;
                        }}
                        type="email"
                        onFocus={() => guidedFlow.goToField('accountInfo')}
                        onBlur={async (e) => {
                          await checkEmailAvailability(e.target.value);
                        }}
                        className={`pl-11 ${uiSystem.input}`}
                        placeholder="email@example.com"
                      />
                    </div>

                    {errors.email && (
                      <p className="text-xs font-bold text-rose-600">
                        {errors.email.message}
                      </p>
                    )}

                    {emailRemoteError && (
                      <p className="text-xs font-bold text-rose-600">
                        {emailRemoteError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className={uiSystem.label}>
                      Mật khẩu <span className="text-rose-500">*</span>
                    </label>

                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                      <input
                        type={showPassword ? 'text' : 'password'}
                        {...passwordRegister}
                        ref={(el) => {
                          passwordRegister.ref(el);
                          passwordRef.current = el;
                        }}
                        onFocus={() => guidedFlow.goToField('accountInfo')}
                        placeholder="Nhập mật khẩu"
                        autoComplete="new-password"
                        className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-10 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    {errors.password && (
                      <p className="text-xs font-bold text-rose-600">
                        {errors.password.message}
                      </p>
                    )}
                  </div>

                  <input
                    type="text"
                    name="hp_field"
                    value={formValues.hp_field || ''}
                    onChange={(e) => setValue('hp_field', e.target.value)}
                    tabIndex="-1"
                    autoComplete="off"
                    className="hidden"
                  />
                </div>
              </div>
            </GuidedFieldWrapper>

            <CaptchaAttentionField
              captchaZone={captchaZone}
              guidedFlow={guidedFlow}
              fieldKey="captcha"
              nextZone="submit"
              disabled={effectiveLoading}
              loading={effectiveLoading}
              elderAssistMode
              helperText={zoneHelpText.captcha}
              voiceText={zoneHelpText.captcha}
              voiceLabel="Nghe"
              onFocus={() => guidedFlow.goToField('captcha')}
            />

            <ActionFooter isStep1={true} />
            {onBackToRegister && (
              <button
                type="button"
                onClick={onBackToRegister}
                disabled={effectiveLoading}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm font-black text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Quay lại chọn hình thức đăng ký
              </button>
            )}
          </>
        </>
      </form>
    </div>
  );
};

export default JoinClanForm;