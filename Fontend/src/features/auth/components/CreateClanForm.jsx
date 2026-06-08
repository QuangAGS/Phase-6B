/**
 * PATH       : src/features/auth/components/CreateClanForm.jsx
 * DATETIME   : <2026-05-17T10:00:00+07:00>
 * VERSION    : 24.6.7.R1.9
 * DESCRIPTION:
 * PURPOSE
 * - Create a new clan registration flow.
 *
 * RESPONSIBILITIES
 * - Collect clan information
 * - Collect administrator information
 * - Validate identity uniqueness (phone/email)
 * - Validate captcha
 * - Transition to WaitingPage for review
 *
 * ARCHITECTURE
 * - Submit-gated validation (R3.3 doctrine)
 * - Shared captcha zone
 * - User-controlled voice guidance
 * - WaitingPage review lifecycle
 *
 * NON-NEGOTIABLE RULES
 * - Q1: Do not break working business flow
 * - Q2: Preserve UX/UI
 * - Q3: Prefer anchor-level patch
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Loader2,
  Phone,
  LockKeyhole,
  ShieldCheck,
  Eye,
  EyeOff,
  Landmark,
  Mail,
  User,
  AlertCircle,
} from 'lucide-react';

import AudioHelpButton from '../../a11y/tts/AudioHelpButton.jsx';
import { ttsMessages } from '../../a11y/tts/ttsMessages.js';
import { useTts } from '../../a11y/tts/useTts.js';
import ZoneVoiceButton from '../../a11y/voice/ZoneVoiceButton.jsx';

import GuidedFieldWrapper from '../../a11y/guided/GuidedFieldWrapper.jsx';
//import StepCoachBar from '../../a11y/guided/StepCoachBar.jsx';
import useGuidedFlow from '../../a11y/guided/useGuidedFlow.js';
import useProactiveVoiceGuidance from '../../a11y/guided/useProactiveVoiceGuidance.js';

import {
  determineNextAttentionTarget,
  buildAttentionInstruction,
} from '../../a11y/guided/guidedProgression.service.js';

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
import { createClanSchema } from '../utils/createClanValidation.js';
/**
 * Shared captcha runtime
 * - No local Turnstile state
 * - Validation occurs at nextStep()
 * - Token consumed only after safe transition
 */
import useCaptchaZone from '../../a11y/captcha/useCaptchaZone.js';
import CaptchaAttentionField from '../../a11y/captcha/CaptchaAttentionField.jsx';
import { CAPTCHA_RESET_REASONS } from '../../a11y/captcha/captchaZone.service.js';
// --------------------------------------------------------------------------------

/**
 * Static relationship options
 * - UI-only labels
 * - No business logic
 */
const RELATIONSHIP_OPTIONS = [
  { value: '', label: 'Chọn quan hệ với dòng họ' },
  { value: 'CON_DE', label: 'Con đẻ' },
  { value: 'CON_DAU', label: 'Con dâu' },
  { value: 'CON_RE', label: 'Con rể' },
  { value: 'CON_NUOI', label: 'Con nuôi' },
  { value: 'CON_DO_DAU', label: 'Con đỡ đầu' },
  { value: 'KHAC', label: 'Loại Khác' },
];

/**
 * Attention zone model
 * Used by guided progression service
 * to determine next attention target.
 *
 * R3.3:
 * no forced sequential flow
 * only routing assistance.
 */
const GUIDED_PROGRESSION_ZONES = [
  {
    id: 'clanInfo',
    label: 'Thông tin dòng họ',
    fields: ['clanInfo'],
    required: true,
    enabled: true,
    priority: 'high',
  },
  {
    id: 'personalInfo',
    label: 'Thông tin quản trị viên',
    fields: ['personalInfo'],
    required: true,
    enabled: true,
    priority: 'medium',
  },
  {
    id: 'contactInfo',
    label: 'Thông tin liên hệ',
    fields: ['contactInfo'],
    required: true,
    enabled: true,
    priority: 'medium',
  },
  {
    id: 'securityInfo',
    label: 'Bảo mật',
    fields: ['securityInfo'],
    required: true,
    enabled: true,
    priority: 'high',
  },
];

/**
 * Default visual system
 * Parent may override styles,
 * but business logic must stay identical.
 */
const DEFAULT_UI_SYSTEM = {
  container: 'w-full space-y-6',
  section:
    'space-y-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm',
  label: 'text-sm font-black text-slate-700',
  input:
    'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100',
  select:
    'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100',
  footer: 'pt-8',
};

const CreateClanForm = ({
  onGoToWaiting,
  onSubmit,
  uiSystem: uiSystemProp,
  loading = false,
  isSubmitting = false,
  initialData = null,
  lifecycleContext = null,
  runtimeSessionId = 0,
  onBackToRegister,
}) => {
  const uiSystem = uiSystemProp || DEFAULT_UI_SYSTEM;

  /**
   * Local runtime state
   *
   * - isChecking: async phone/email validation
   * - onlineErrors: uniqueness validation errors
   * - attentionMessage: single authoritative attention
   * - attentionField: current routed field
   * - showPassword: password visibility
   */
  const effectiveLoading = loading || isSubmitting;

  const step = 1;

  const captchaZone = useCaptchaZone({
    scope: 'createClan',
  });

  const [isChecking, setIsChecking] = useState({
      phone: false,
      email: false,
  });

  const [onlineErrors, setOnlineErrors] = useState({
    phone: '',
    email: '',
  });

  
  const [showPassword, setShowPassword] = useState(false);
  const [attentionMessage, setAttentionMessage] = useState('');
  const [attentionField, setAttentionField] = useState('');
  const { speak } = useTts();

  /**
   * Mandatory speech helper
   *
   * Safari-safe:
   * use speak() instead of speakError()
   * for more stable playback.
   *
   * Elder UX:
   * slower speech rate = 0.82
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

        window.setTimeout(() => {
          speakMandatoryError(message);
        }, 250);
      });
    },
    [speakMandatoryError]
  );

  const lastLifecycleVersionRef = useRef(lifecycleContext?.runtimeVersion || 0);
  /**
   * <2026-05-17T10:00:00+07:00>
   * VERSION: 24.6.7.R1.9
   * PURPOSE:
   * - SecurityInfo chỉ được coi là hoàn thành nếu người dùng hoàn thành
   *   trong session hiện tại.
   * - Chặn Turnstile auto-verify kéo attention thẳng tới submit
   *   khi form vừa mount lại.
   */
  const securityInfoCompletedInSessionRef = useRef(false);

  const clanInfoRef = useRef(null);
  const personalInfoRef = useRef(null);
  const contactInfoRef = useRef(null);
  const securityInfoRef = useRef(null);
  /**
   * Field refs for routing
   * Used by routeFieldError()
   * to scroll/focus correct section.
   */
  /**
   * React Hook Form contract
   *
   * Validation:
   * - submit-gated
   * - revalidate on change after submit
   *
   * Browser native validation:
   * disabled via noValidate
   */
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    getValues,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createClanSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      temp_relationship: '',
      hp_field: '',
      ...(initialData || {}),
    },
  });

  const formValues = watch();
  /**
   * Zone voice guidance
   * Used by ZoneVoiceButton
   * and captcha helper speech.
   */
  const zoneHelpText = useMemo(
    () => ({
      clanInfo:
        ttsMessages?.createClan?.clanNameFocus ||
        'Bác nhập tên dòng họ cần tạo và mô tả ngắn về dòng họ.',
      personalInfo:
        ttsMessages?.createClan?.personalInfo ||
        'Bác nhập thông tin cá nhân của người quản trị.',
      contactInfo:
        ttsMessages?.createClan?.contactInfo ||
        'Bác nhập số điện thoại đăng nhập và email nhận thông báo.',
      securityInfo:
        ttsMessages?.createClan?.passwordFocus ||
        'Bác nhập mật khẩu đăng nhập.',
      captcha:
        ttsMessages?.createClan?.captcha ||
        'Bác hãy bấm vào ô vuông. Khi thấy dấu tích màu xanh là đã xác nhận xong.',
      submit:
        ttsMessages?.createClan?.submit ||
        'Bác bấm nút tiếp tục rà soát để kiểm tra lại hồ sơ.',
    }),
    []
  );

  //Auto-clear inline errors (R3.3 standard)
  useEffect(() => {
    const subscription = watch((_, { name }) => {
      if (!name) return;

      if (errors?.[name]) {
        trigger(name);
      }
    });

    return () => subscription.unsubscribe();
  }, [watch, trigger, errors]);
  /**
   * Attention step model
   *
   * Used only for:
   * - active attention zone
   * - helper text
   * - voice guidance
   *
   * No forced progression.
   */
  const guidedSteps = useMemo(
    () => [
      {
        fieldKey: 'clanInfo',
        title: 'Nhập thông tin dòng họ',
        description:
          ttsMessages?.createClan?.clanNameFocus ||
          'Bác nhập tên dòng họ cần tạo.',
        nextLabel: 'Tiếp theo: nhập thông tin quản trị viên.',
      },
      {
        fieldKey: 'personalInfo',
        title: 'Nhập thông tin quản trị viên',
        description:
          ttsMessages?.createClan?.personalInfo ||
          'Bác nhập thông tin cá nhân của người quản trị.',
        nextLabel: 'Tiếp theo: nhập số điện thoại và email.',
      },
      {
        fieldKey: 'contactInfo',
        title: 'Nhập thông tin liên hệ',
        description:
          ttsMessages?.createClan?.contactInfo ||
          'Bác nhập số điện thoại đăng nhập và email nhận thông báo.',
        nextLabel: 'Tiếp theo: tạo mật khẩu.',
      },
      {
        fieldKey: 'securityInfo',
        title: 'Tạo mật khẩu',
        description:
          ttsMessages?.createClan?.passwordFocus ||
          'Bác nhập mật khẩu đăng nhập.',
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
          ttsMessages?.createClan?.captcha ||
          'Bác hãy bấm vào ô vuông. Khi thấy dấu tích màu xanh là đã xác nhận xong.',
        nextLabel: 'Tiếp theo: rà soát hồ sơ.',
      },
      {
        fieldKey: 'submit',
        title: 'Rà soát hồ sơ',
        description:
          ttsMessages?.createClan?.submit ||
          'Bác bấm nút tiếp tục rà soát để kiểm tra lại hồ sơ.',
        nextLabel: '',
      },
    ],
    []
  );

  const guidedFlow = useGuidedFlow(guidedSteps, {
    initialStepIndex: 0,
    initialFieldKey: 'clanInfo',
    enabled: true,

    /**
     * <2026-05-17T10:00:00+07:00>
     * VERSION: 24.6.7.R1.9
     * PURPOSE:
     * - CreateClanForm trong Register flow không restore activeField cũ.
     * - Refresh hoặc quay lại từ selector luôn bắt đầu lại từ clanInfo.
     */
    persistRecovery: false,
  });
  /**
   * Only show voice button
   * for active attention zone.
   */
  const showAzVoiceButton = (zoneId) => guidedFlow.activeField === zoneId;

  /**
   * <2026-05-16T20:00:00+07:00>
   * VERSION: 24.6.7.R1.4
   * PURPOSE:
   * - EGAL-6.7 proactive spoken guidance cho CreateClanForm.
   * - Đọc hướng dẫn thao tác theo activeField.
   * - Safari-safe initial voice guidance dùng default delay từ hook.
   *
   * Q1 SAFE:
   * - Không đổi validation.
   * - Không đổi payload/API contract.
   * - Không đổi Turnstile/Honeypot.
   * - Không đổi WaitingPage transition.
   */
  useProactiveVoiceGuidance({
    activeField: guidedFlow.activeField,
    guidedSteps,
    scope: 'createClan',
    enabled: true,
    speakOnMount: true,
  });
  /**
   * <2026-05-17T10:00:00+07:00>
   * VERSION: 24.6.7.R1.9.1
   * PURPOSE:
   * - Fresh runtime boundary phải chạy lại theo runtimeSessionId.
   * - RegisterForm -> CreateClanForm
   * - Browser refresh
   * - Back-forward navigation
   * đều phải reset runtime sạch.
   *
   * Q1/Q2 SAFE:
   * - Không đổi draft data
   * - Không đổi payload/API
   * - Không đổi validation
   * - Chỉ reset runtime state
   */
  /**
   * Fresh runtime boundary
   *
   * RegisterForm → CreateClanForm
   * refresh
   * back-forward
   *
   * reset runtime only:
   * - captcha
   * - attention
   * - online validation
   * - activeField
   */
  useEffect(() => {
    requestAnimationFrame(() => {
      captchaZone.reset();
      setAttentionMessage('');
      setAttentionField('');
      setOnlineErrors({
        phone: '',
        email: '',
      });

      setIsChecking({
        phone: false,
        email: false,
      });

      securityInfoCompletedInSessionRef.current = false;

      if (guidedFlow.resetGuidedFlow) {
        guidedFlow.resetGuidedFlow();
      } else if (guidedFlow.resetFlow) {
        guidedFlow.resetFlow();
      }

      guidedFlow.goToField('clanInfo');
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimeSessionId]);

  /**
   * WaitingPage → Edit reconstruction
   *
   * Preserve draft values
   * but reset runtime state.
   */
  useEffect(() => {
    const nextVersion = lifecycleContext?.runtimeVersion || 0;
    const versionChanged = nextVersion !== lastLifecycleVersionRef.current;
    const shouldReconstruct =
      lifecycleContext?.reconstructRuntime === true ||
      lifecycleContext?.reentryContext?.resetRuntime === true;

    const isEditFromWaiting =
      lifecycleContext?.reentryContext?.from === 'WaitingPage' &&
      lifecycleContext?.reentryContext?.action === 'edit';

    if (versionChanged && shouldReconstruct) {
      /**
       * <2026-05-17T10:00:00+07:00>
       * VERSION: 24.6.7.R1.9.1
       * PURPOSE:
       * WaitingPage -> Edit:
       * giữ draft data
       * nhưng reset runtime sạch.
       *
       * reset:
       * - captcha
       * - attention
       * - online validation runtime
       * - security progression state
       */
      captchaZone.reset();

      securityInfoCompletedInSessionRef.current = false;

      setAttentionMessage('');
      setAttentionField('');

      setOnlineErrors({
        phone: '',
        email: '',
      });

      setIsChecking({
        phone: false,
        email: false,
      });

      if (guidedFlow.resetGuidedFlow) {
        guidedFlow.resetGuidedFlow();
      } else if (guidedFlow.resetFlow) {
        guidedFlow.resetFlow();
      }

      /**
       * EGAL-6.5.4.1:
       * WaitingPage -> Edit phải quay về đầu review context.
       * Không restore activeField/progression cũ.
       */
      requestAnimationFrame(() => {
        guidedFlow.goToField(isEditFromWaiting ? 'clanInfo' : 'clanInfo');
      });
    }

    lastLifecycleVersionRef.current = nextVersion;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifecycleContext?.runtimeVersion]);

  useEffect(() => {
    const isEditFromWaiting =
      lifecycleContext?.reentryContext?.from === 'WaitingPage' &&
      lifecycleContext?.reentryContext?.action === 'edit';

    if (isEditFromWaiting && initialData) {
      const mappedInitialData = Object.keys(initialData).reduce((acc, key) => {
        const mappedKey = key === 'clanDescription' ? 'description' : key;
        acc[mappedKey] = initialData[key];
        return acc;
      }, {});

      reset(
        {
          temp_relationship: '',
          hp_field: '',
          ...mappedInitialData,
        },
        {
          keepErrors: false,
          keepDirty: false,
          keepTouched: false,
        }
      );

      return;
    }

    reset(
      {
        temp_relationship: '',
        hp_field: '',
      },
      {
        keepErrors: false,
        keepDirty: false,
        keepTouched: false,
      }
    );
  }, [
    initialData,
    lifecycleContext?.reentryContext?.from,
    lifecycleContext?.reentryContext?.action,
    reset,
  ]);

  const applyInvalidationPlan = useCallback(
    (plan) => {
      if (!plan?.invalidated) return;

      setOnlineErrors((prev) => ({
        phone: shouldClearOnlineValidation(plan, 'phone') ? '' : prev.phone,
        email: shouldClearOnlineValidation(plan, 'email') ? '' : prev.email,
      }));

      if (
        shouldClearOnlineValidation(plan, 'phone') ||
        shouldClearOnlineValidation(plan, 'email')
      ) {
        setIsChecking({ phone: false, email: false });
      }

      ['clanInfo', 'personalInfo', 'contactInfo', 'securityInfo', 'captcha'].forEach(
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

  /**
   * Error routing authority
   *
   * Responsibilities:
   * - show attention message
   * - move active attention zone
   * - scroll/focus target
   * - Safari-safe delayed speech
   */
  const routeFieldError = useCallback(
    (fieldName, message = '') => {
      const finalMessage =
        message ||
        'Thông tin hồ sơ chưa đầy đủ hoặc chưa đúng. Bác vui lòng kiểm tra lại.';

      const routingMap = {
        clanName: { zone: 'clanInfo', ref: clanInfoRef },
        description: { zone: 'clanInfo', ref: clanInfoRef },

        temp_full_name: { zone: 'personalInfo', ref: personalInfoRef },
        temp_father_name: { zone: 'personalInfo', ref: personalInfoRef },
        temp_birth_year: { zone: 'personalInfo', ref: personalInfoRef },
        temp_relationship: { zone: 'personalInfo', ref: personalInfoRef },
        temp_note: { zone: 'personalInfo', ref: personalInfoRef },

        phone: { zone: 'contactInfo', ref: contactInfoRef },
        email: { zone: 'contactInfo', ref: contactInfoRef },

        password: { zone: 'securityInfo', ref: securityInfoRef },
        captcha: { zone: 'captcha', ref: null },
        submit: { zone: 'submit', ref: null },
      };

      const target = routingMap[fieldName];

      setAttentionField(fieldName);
      setAttentionMessage('');

      requestAnimationFrame(() => {
        setAttentionMessage(finalMessage);

        if (target?.zone) {
          guidedFlow.goToField(target.zone);
        }

        target?.ref?.current?.scrollIntoView?.({
          behavior: 'smooth',
          block: 'center',
        });

        window.setTimeout(() => {
          speakMandatoryError(finalMessage);
        }, 250);
      });
    },
    [guidedFlow, speakMandatoryError]
  );

  const clearAttentionForField = useCallback(
    (fieldName) => {
      if (attentionField !== fieldName) return;

      setAttentionMessage('');
      setAttentionField('');
    },
    [attentionField]
  );

  /**
   * Online uniqueness validation
   *
   * Used for:
   * - phone uniqueness
   * - email uniqueness
   *
   * Fail-safe:
   * network error does not block transition.
   */
  const checkIdentityOnline = useCallback(async (type, value) => {
    const normalizedValue = String(value || '').trim();

    if (!normalizedValue) {
      setOnlineErrors((prev) => ({ ...prev, [type]: '' }));
      return {
        valid: false,
        message: '',
      };
    }

    setIsChecking((prev) => ({ ...prev, [type]: true }));

    try {
      const res = await apiClient.get('/auth/check-identity', {
        params: { type, value: normalizedValue },
      });

      if (res.data?.available === false) {
        const message = `${
          type === 'phone' ? 'Số điện thoại' : 'Email'
        } này đã được sử dụng.`;

        setOnlineErrors((prev) => ({
          ...prev,
          [type]: message,
        }));

        return {
          valid: false,
          message,
        };
      }

      setOnlineErrors((prev) => ({
        ...prev,
        [type]: '',
      }));

      return {
        valid: true,
        message: '',
      };
    } catch (err) {
      console.error(`Lỗi check ${type}:`, err);

      setOnlineErrors((prev) => ({
        ...prev,
        [type]: '',
      }));

      return {
        valid: true,
        message: '',
      };
    } finally {
      setIsChecking((prev) => ({ ...prev, [type]: false }));
    }
  }, []);

  useEffect(() => {
    if (formValues.phone && !errors.phone) {
      checkIdentityOnline('phone', formValues.phone);
    } else {
      setOnlineErrors((prev) => ({ ...prev, phone: '' }));
    }
  }, [formValues.phone, errors.phone, checkIdentityOnline]);

  useEffect(() => {
    if (formValues.email && !errors.email) {
      checkIdentityOnline('email', formValues.email);
    } else {
      setOnlineErrors((prev) => ({ ...prev, email: '' }));
    }
  }, [formValues.email, errors.email, checkIdentityOnline]);

  const getProgressionValidationState = useCallback(
    (values = getValues()) => {
      const clanInfoOk =
        !!values?.clanName?.trim?.() && !!values?.description?.trim?.();

      const personalInfoOk =
        !!values?.temp_full_name?.trim?.() &&
        !!values?.temp_father_name?.trim?.() &&
        !!values?.temp_relationship &&
        !!values?.temp_note?.trim?.();

      const contactInfoOk =
        !!values?.phone?.trim?.() &&
        !!values?.email?.trim?.() &&
        !onlineErrors.phone &&
        !onlineErrors.email &&
        !isChecking.phone &&
        !isChecking.email;

      const securityInfoOk =
        !!values?.password?.trim?.() &&
        !isChecking.phone &&
        !isChecking.email;

      return {
        validFields: {
          clanInfo: clanInfoOk,
          personalInfo: personalInfoOk,
          contactInfo: contactInfoOk,
          securityInfo: securityInfoOk,
        },
        completedFields: {
          clanInfo: guidedFlow.isCompleted('clanInfo'),
          personalInfo: guidedFlow.isCompleted('personalInfo'),
          contactInfo: guidedFlow.isCompleted('contactInfo'),
          securityInfo: guidedFlow.isCompleted('securityInfo'),
        },
        invalidFields: {
          clanInfo: !clanInfoOk,
          personalInfo: !personalInfoOk,
          contactInfo: !contactInfoOk,
          securityInfo: !securityInfoOk,
        },
      };
    },
    [getValues, guidedFlow, isChecking, onlineErrors]
  );

  const advanceAttentionByProgression = useCallback(
    (values = getValues(), options = {}) => {
      const validationState = getProgressionValidationState(values);

      const target = determineNextAttentionTarget(
        GUIDED_PROGRESSION_ZONES,
        validationState
      );

      const instruction = buildAttentionInstruction(target, {
        message:
          options.message ||
          'Bác tiếp tục sang phần tiếp theo để hoàn tất hồ sơ.',
        completionMessage: 'Thông tin hồ sơ đã đủ để rà soát.',
      });

      if (instruction.type === 'MOVE' && instruction.field) {
        if (instruction.field !== guidedFlow.activeField) {
          guidedFlow.goToField(instruction.field);
        }

        return instruction;
      }

      return instruction;
    },
    [getProgressionValidationState, getValues, guidedFlow]
  );
/*
  const handleClanInfoProgression = () => {
    const values = getValues();

    if (values?.clanName?.trim?.() && values?.description?.trim?.()) {
      guidedFlow.markCompleted('clanInfo');
      advanceAttentionByProgression(values);
    }
  };
*/
/*
  const handlePersonalInfoProgression = () => {
    const values = getValues();

    if (
      values?.temp_full_name?.trim?.() &&
      values?.temp_father_name?.trim?.() &&
      values?.temp_relationship &&
      values?.temp_note?.trim?.()
    ) {
      guidedFlow.markCompleted('personalInfo');
      advanceAttentionByProgression(values);
    }
  };
*/
  const handleContactInfoProgression = () => {
    const values = getValues();

    if (
      values?.phone?.trim?.() &&
      values?.email?.trim?.() &&
      !onlineErrors.phone &&
      !onlineErrors.email &&
      !isChecking.phone &&
      !isChecking.email
    ) {
      guidedFlow.markCompleted('contactInfo');
      advanceAttentionByProgression(values);
    }
  };

  const hasCoreRequiredData = (values) => {
    return (
      !!values?.clanName?.trim?.() &&
      !!values?.description?.trim?.() &&
      !!values?.temp_full_name?.trim?.() &&
      !!values?.temp_father_name?.trim?.() &&
      !!values?.temp_relationship &&
      !!values?.temp_note?.trim?.() &&
      !!values?.phone?.trim?.() &&
      !!values?.email?.trim?.() &&
      !!values?.password?.trim?.()
    );
  };

  const getAttentionFieldFromGate = (gateTarget, values) => {
    if (['clanName', 'description'].includes(gateTarget?.field)) {
      return 'clanInfo';
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

    if (['phone', 'email'].includes(gateTarget?.field)) {
      return 'contactInfo';
    }

    if (gateTarget?.field === 'password') {
      return 'securityInfo';
    }

    if (!values?.clanName?.trim?.() || !values?.description?.trim?.()) {
      return 'clanInfo';
    }

    if (
      !values?.temp_full_name?.trim?.() ||
      !values?.temp_father_name?.trim?.() ||
      !values?.temp_relationship ||
      !values?.temp_note?.trim?.()
    ) {
      return 'personalInfo';
    }

    if (!values?.phone?.trim?.() || !values?.email?.trim?.()) {
      return 'contactInfo';
    }

    return 'securityInfo';
  };

  /**
   * Submit-gated transition authority
   *
   * Order:
   * 1. Sync latest values
   * 2. Required field validation
   * 3. Online uniqueness re-check
   * 4. Captcha validation
   * 5. Validation gate
   * 6. Build finalPayload
   * 7. Transition to WaitingPage
   */
  const nextStep = async () => {
    setValue('hp_field', formValues.hp_field || '', {
      shouldValidate: true,
      shouldDirty: false,
    });

    const latestValues = {
      ...getValues(),
      hp_field: formValues.hp_field || '',
    };

    if (!latestValues?.clanName?.trim?.()) {
      routeFieldError(
        'clanName',
        'Bác vui lòng nhập tên dòng họ cần tạo.',
        // 'clanName'
      );
      return;
    }

    if (!latestValues?.description?.trim?.()) {
      routeFieldError(
        'description',
        'Bác vui lòng nhập mô tả dòng họ.',
        //'description'
      );
      return;
    }

    if (!latestValues?.temp_full_name?.trim?.()) {
      routeFieldError(
        'temp_full_name',
        'Bác vui lòng nhập họ và tên người quản trị.',
        //'personalInfo'
      );
      return;
    }

    if (!latestValues?.temp_father_name?.trim?.()) {
      routeFieldError(
        'temp_father_name',
        'Bác vui lòng nhập tên cha hoặc mẹ để đối chiếu.',
        //'personalInfo'
      );
      return;
    }

    if (!latestValues?.temp_relationship) {
      routeFieldError(
        'temp_relationship',
        'Bác vui lòng chọn quan hệ với dòng họ.',
        //'personalInfo'
      );
      return;
    }

    if (!latestValues?.temp_note?.trim?.()) {
      routeFieldError(
        'temp_note',
        'Bác vui lòng nhập lời nhắn tới Ban quản trị.',
        //'personalInfo'
      );
      return;
    }

    if (!latestValues?.phone?.trim?.()) {
      routeFieldError(
        'phone',
        'Bác vui lòng nhập số điện thoại đăng nhập.',
        //'contactInfo'
      );
      return;
    }

    if (!latestValues?.email?.trim?.()) {
      routeFieldError(
        'email',
        'Bác vui lòng nhập email nhận thông báo.',
        //'contactInfo'
      );
      return;
    }

    const phoneCheck = await checkIdentityOnline('phone', latestValues.phone);

    if (!phoneCheck.valid) {
      routeFieldError(
        'phone',
        phoneCheck.message || 'Số điện thoại cần được kiểm tra lại.',
        'contactInfo'
      );
      //guidedFlow.unmarkCompleted('contactInfo');
      //guidedFlow.goToField('contactInfo');
      return;
    }

    const emailCheck = await checkIdentityOnline('email', latestValues.email);

    if (!emailCheck.valid) {
      routeFieldError(
        'email',
        emailCheck.message || 'Email cần được kiểm tra lại.',
        //'contactInfo'
      );
      //guidedFlow.unmarkCompleted('contactInfo');
      //guidedFlow.goToField('contactInfo');
      return;
    }

    if (!latestValues?.password?.trim?.()) {
      routeFieldError(
        'password',
        'Bác vui lòng nhập mật khẩu đăng nhập.',
        //'securityInfo'
      );
      return;
    }

    const captchaCheck = captchaZone.validateBeforeSubmit();

    if (!captchaCheck.valid) {
      const captchaMessage =
        captchaCheck.message ||
        ttsMessages?.createClan?.captcha ||
        'Bác vui lòng hoàn tất phần xác minh ở bên trên. Khi thấy dấu tích màu xanh, bác bấm lại nút Tiếp tục rà soát.';

      setAttentionMessage(captchaMessage);

      captchaZone.applyValidationFailure({
        validationResult: captchaCheck,
        guidedFlow,
        speak: speakMandatoryError,
        focusDelayMs: 520,
      });

      return;
    }

    const gateResult = await runValidationGate({
      values: latestValues,
      requiredFields: [
        'clanName',
        'description',
        'temp_full_name',
        'temp_father_name',
        'temp_relationship',
        'temp_note',
        'phone',
        'email',
        'password',
      ],
      asyncValidationState: {
        phone: isChecking.phone,
        email: isChecking.email,
      },
      onlineErrors,
      localValidation: async () => {
        const valid = await trigger();

        return {
          valid,
          errors,
        };
      },
      metadata: {
        form: 'CreateClanForm',
        transition: 'CreateClanForm->WaitingPage',
        lifecycleRuntimeVersion: lifecycleContext?.runtimeVersion || 0,
      },
    });

    if (!gateResult.allowed) {
      const target = buildValidationAttentionTarget(gateResult);
      const attentionField = getAttentionFieldFromGate(target, latestValues);

      speakCriticalAttention(
        target.message ||
          'Thông tin hồ sơ chưa đầy đủ hoặc chưa đúng. Bác vui lòng kiểm tra lại các mục được báo lỗi trên màn hình.'
      );

      guidedFlow.goToField(attentionField);
      return;
    }

    if (!hasCoreRequiredData(latestValues)) {
      speakCriticalAttention(
        'Thông tin hồ sơ chưa đầy đủ hoặc chưa đúng. Bác vui lòng kiểm tra lại các mục được báo lỗi trên màn hình.'
      );

      advanceAttentionByProgression(latestValues, {
        message: 'Bác vui lòng kiểm tra lại phần còn thiếu.',
      });

      return;
    }

    setAttentionMessage('');
    setAttentionField('');

    const finalPayload = {
      ...latestValues,
      isNewClan: true,
      description: latestValues.description,
      turnstileToken: captchaCheck.token || captchaZone.getToken(),
      hp_field: latestValues.hp_field || '',
    };

    if (onGoToWaiting) {
      onGoToWaiting(finalPayload);
      return;
    }

    if (onSubmit) {
      onSubmit(finalPayload);
    }
  };
  
  const hasOnlineError = !!onlineErrors.phone || !!onlineErrors.email;
  const isPendingCheck = isChecking.phone || isChecking.email;

  /**
   * Submit action footer
   *
   * Must call nextStep().
   * Never bypass using native submit.
   */
  const ActionFooter = () => (
    <div className="pt-8">
      <GuidedFieldWrapper
        fieldKey="submit"
        activeField={guidedFlow.activeField}
        helperText={
          ttsMessages?.createClan?.submit ||
          'Bác bấm nút tiếp tục rà soát để kiểm tra lại hồ sơ.'
        }
        completed={false}
        voiceAction={
          <ZoneVoiceButton
          visible={showAzVoiceButton('submit')}
          text={zoneHelpText.submit}
          label="Nghe"
          />
        }
      >
        <button
          type="button"
          onClick={nextStep}
          disabled={effectiveLoading || isPendingCheck}
          className={`w-full py-4 rounded-3xl font-bold transition-all ${
            effectiveLoading || isPendingCheck
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-amber-600 text-white hover:bg-amber-700'
          }`}
        >
          {isPendingCheck ? 'Đang kiểm tra...' : 'Tiếp tục rà soát →'}
        </button>
      </GuidedFieldWrapper>
    </div>
  );

  const completedStepLabels = useMemo(() => {
    const labels = [];

    if (guidedFlow.isCompleted('clanInfo')) labels.push('Đã nhập dòng họ');
    if (guidedFlow.isCompleted('personalInfo')) labels.push('Đã nhập cá nhân');
    if (guidedFlow.isCompleted('contactInfo')) labels.push('Đã nhập liên hệ');
    if (guidedFlow.isCompleted('securityInfo')) labels.push('Đã nhập mật khẩu');
    if (guidedFlow.isCompleted('captcha')) labels.push('Đã xác minh');

    return labels;
  }, [guidedFlow]);

  //const currentStep = guidedFlow.currentStep || guidedSteps[0];

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
        onSubmit={handleSubmit(() => {})}
        noValidate
        className="space-y-6"
      >
        {/*
        <div className="flex justify-center">
          <AudioHelpButton
            text={
              ttsMessages?.createClan?.help ||
              'Bác đang tạo mới một dòng họ, nhập thông tin dòng họ, thông tin quản trị viên, thông tin liên hệ và mật khẩu đăng nhập.'
            }
            label="Nghe hướng dẫn"
            variant="soft"
          />
        </div>
        */}

        <section className="rounded-3xl border border-indigo-100 bg-indigo-50/80 p-5 text-center shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-600">
            Hồ sơ đăng ký
          </p>

          <h2 className="mt-2 text-2xl font-black leading-tight text-slate-900">
            Tạo mới một dòng họ
          </h2>

          <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-relaxed text-slate-600">
            Bác vui lòng nhập thông tin dòng họ, thông tin người quản trị,
            cách liên hệ và tạo tài khoản để gửi hồ sơ tạo dòng họ mới.
          </p>

          <div className="mt-4 flex justify-center">
            <AudioHelpButton
              text={
                ttsMessages?.createClan?.help ||
                'Bác nhập thông tin dòng họ, thông tin người quản trị, cách liên hệ và tạo tài khoản để gửi hồ sơ tạo dòng họ mới.'
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
            recoveryKey="create-clan-form-attention"
            className="flex items-start gap-3 border-rose-100 bg-rose-50 text-rose-700"
            data-testid="create-clan-attention-message"
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
              fieldKey="clanInfo"
              activeField={guidedFlow.activeField}
              helperText={
                ttsMessages?.createClan?.clanNameFocus ||
                'Bác nhập tên dòng họ cần tạo và mô tả ngắn về dòng họ của bác'
              }
              voiceAction={
                <ZoneVoiceButton
                  visible={showAzVoiceButton('clanInfo')}
                  text={zoneHelpText.clanInfo}
                  label="Nghe"
                  disabled={effectiveLoading}
                />
              }
              completed={guidedFlow.isCompleted('clanInfo')}
            >
              <div
                ref={clanInfoRef}
                className={uiSystem.section}
              >
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400">
                  <Landmark size={18} />
                  Thông tin dòng họ
                </h3>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className={uiSystem.label}>
                      Tên dòng họ <span className="text-rose-500">*</span>
                    </label>

                    <input
                      {...register('clanName', {
                        onChange: () => {
                          invalidateRuntimeForField('clanName');
                          clearAttentionForField('clanName');
                        },
                      })}
                      onFocus={() => guidedFlow.goToField('clanInfo')}
                      className={uiSystem.input}
                      placeholder="Nguyễn Tộc - Chi Phái 2"
                    />

                    {errors.clanName && (
                      <p className="text-[11px] font-bold text-rose-600">
                        {errors.clanName.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className={uiSystem.label}>
                      Mô tả dòng họ <span className="text-rose-500">*</span>
                    </label>

                    <textarea
                      {...register('description', {
                        onChange: () => {
                          invalidateRuntimeForField('description');
                          clearAttentionForField('description');
                        },
                      })}
                      onFocus={() => guidedFlow.goToField('clanInfo')}
                      className={`${uiSystem.input} min-h-[100px] resize-none`}
                      placeholder="Thông tin giới thiệu ngắn về dòng họ..."
                    />

                    {errors.description && (
                      <p className="text-xs font-bold text-rose-600">
                        {errors.description.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </GuidedFieldWrapper>

            <GuidedFieldWrapper
              fieldKey="personalInfo"
              activeField={guidedFlow.activeField}
              helperText={
                ttsMessages?.createClan?.personalInfo ||
                'Bác nhập thông tin cá nhân của người quản trị.'
              }
              voiceAction={
                <ZoneVoiceButton
                  visible={showAzVoiceButton('personalInfo')}
                  text={zoneHelpText.personalInfo}
                  label="Nghe"
                  disabled={effectiveLoading}
                />
              }
              completed={guidedFlow.isCompleted('personalInfo')}
            >
              <div
                ref={personalInfoRef}
                className={uiSystem.section}
              >
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400">
                  <User size={18} />
                  Thông tin quản trị viên
                </h3>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className={uiSystem.label}>
                      Họ và tên <span className="text-rose-500">*</span>
                    </label>

                    <input
                      {...register('temp_full_name', {
                        onChange: () => {
                          invalidateRuntimeForField('temp_full_name');
                          clearAttentionForField('temp_full_name');
                        },
                      })}
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
                      {...register('temp_father_name', {
                        onChange: () => {
                          invalidateRuntimeForField('temp_father_name');
                          clearAttentionForField('temp_father_name');
                        },
                      })}
                      onFocus={() => guidedFlow.goToField('personalInfo')}
                      className={uiSystem.input}
                      placeholder="Tên cha hoặc mẹ"
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
                      {...register('temp_birth_year', {
                        onChange: () => {
                          invalidateRuntimeForField('temp_birth_year');
                          clearAttentionForField('temp_birth_year');
                        },
                      })}
                      onFocus={() => guidedFlow.goToField('personalInfo')}
                      className={uiSystem.input}
                      placeholder="Ví dụ: 1960"
                    />

                    {errors.temp_birth_year && (
                      <p className="text-xs font-bold text-rose-600">
                        {errors.temp_birth_year.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className={uiSystem.label}>
                      Quan hệ với họ tộc <span className="text-rose-500">*</span>
                    </label>
                    <select
                      {...register('temp_relationship', {
                        onChange: () => {
                          invalidateRuntimeForField('temp_relationship');
                          clearAttentionForField('temp_relationship');
                        },
                      })}
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
                      Lời nhắn tới Ban quản trị{' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      {...register('temp_note', {
                        onChange: () => {
                          invalidateRuntimeForField('temp_note');
                          clearAttentionForField('temp_note');
                        },
                      })}
                      onFocus={() => guidedFlow.goToField('personalInfo')}
                      className={`${uiSystem.input} min-h-[100px] resize-none`}
                      placeholder="Bác ghi thông tin để Ban quản trị dễ xác minh..."
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
              fieldKey="contactInfo"
              activeField={guidedFlow.activeField}
              helperText={
                ttsMessages?.createClan?.contactInfo ||
                'Bác nhập số điện thoại đăng nhập và email nhận thông báo.'
              }
              voiceAction={
                <ZoneVoiceButton
                  visible={showAzVoiceButton('contactInfo')}
                  text={zoneHelpText.contactInfo}
                  label="Nghe"
                  disabled={effectiveLoading}
                />
              }
              completed={guidedFlow.isCompleted('contactInfo')}
            >
              <div
                ref={contactInfoRef}
                className={uiSystem.section}
              >
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400">
                  <Mail size={18} />
                  Thông tin liên hệ
                </h3>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className={uiSystem.label}>
                      Số điện thoại <span className="text-rose-500">*</span>
                    </label>

                    <div className="relative">
                      <Phone
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                        size={18}
                      />

                      <input
                        {...register('phone', {
                          onChange: () => {
                          invalidateRuntimeForField('phone');
                          clearAttentionForField('phone');
                        },
                        })}
                        onFocus={() => guidedFlow.goToField('contactInfo')}
                        onBlur={async (e) => {
                          const result = await checkIdentityOnline('phone', e.target.value);

                          if (!result.valid && result.message) {
                            routeFieldError('phone', result.message);
                          }
                        }}
                        className={`pl-11 ${uiSystem.input}`}
                        placeholder="Số điện thoại chính"
                      />

                      {isChecking.phone && (
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

                    {onlineErrors.phone && (
                      <p className="text-xs font-bold text-rose-600">
                        {onlineErrors.phone}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className={uiSystem.label}>
                      Email <span className="text-rose-500">*</span>
                    </label>

                    <div className="relative">
                      <Mail
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                        size={18}
                      />

                      <input
                        {...register('email', {
                          onChange: () => {
                            invalidateRuntimeForField('email');
                            clearAttentionForField('email');
                          },
                        })}
                        onFocus={() => guidedFlow.goToField('contactInfo')}
                        onBlur={async (e) => {
                          const result = await checkIdentityOnline('email', e.target.value);

                          if (!result.valid && result.message) {
                            routeFieldError('email', result.message);
                          }
                        }}
                        className={`pl-11 ${uiSystem.input}`}
                        placeholder="email@example.com"
                      />

                      {isChecking.email && (
                        <Loader2
                          className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-blue-500"
                          size={18}
                        />
                      )}
                    </div>

                    {errors.email && (
                      <p className="text-xs font-bold text-rose-600">
                        {errors.email.message}
                      </p>
                    )}

                    {onlineErrors.email && (
                      <p className="text-xs font-bold text-rose-600">
                        {onlineErrors.email}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </GuidedFieldWrapper>

            <GuidedFieldWrapper
              fieldKey="securityInfo"
              activeField={guidedFlow.activeField}
              helperText={
                ttsMessages?.createClan?.passwordFocus ||
                'Bác nhập mật khẩu đăng nhập.'
              }
              voiceAction={
                <ZoneVoiceButton
                  visible={showAzVoiceButton('securityInfo')}
                  text={zoneHelpText.securityInfo}
                  label="Nghe"
                  disabled={effectiveLoading}
                />
              }
              completed={guidedFlow.isCompleted('securityInfo')}
            >
              <div
                ref={securityInfoRef}
                className={uiSystem.section}
              >
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400">
                  <ShieldCheck size={18} />
                  Bảo mật
                </h3>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className={uiSystem.label}>
                      Mật khẩu <span className="text-rose-500">*</span>
                    </label>

                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                      <input
                        type={showPassword ? 'text' : 'password'}
                        {...register('password', {
                          onChange: () => {
                            invalidateRuntimeForField('password');
                            clearAttentionForField('password');
                          },
                        })}
                        onFocus={() => guidedFlow.goToField('securityInfo')}
                        placeholder="Nhập mật khẩu"
                        autoComplete="new-password"
                        className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-10 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
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

            <ActionFooter />
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

export default CreateClanForm;