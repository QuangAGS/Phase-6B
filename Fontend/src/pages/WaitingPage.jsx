/**
 * PATH       : src/pages/WaitingPage.jsx
 * DATETIME   : 2026-05-15T00:00:00+07:00
 * VERSION    : EGAL-25.x R2
 * DESCRIPTION:
 * - EGAL-6.5 Step 4: TRUE REVIEW PAGE.
 * - Hiển thị đầy đủ effective submission data trước khi gửi.
 * - Preserve props contract hiện có: formData, onConfirmSubmit, onBack, loading.
 * - Không thay đổi API payload, auth flow, Turnstile, Honeypot.
 * - WaitingPage chỉ là review boundary, không trở thành lifecycle authority.
 * - AuthPage vẫn là orchestration root.
 * - Tuân thủ Q1/Q2.
 */

import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  Phone,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';

import AttentionZone from '../features/a11y/attention/AttentionZone.jsx';
import ZoneVoiceButton from '../features/a11y/voice/ZoneVoiceButton.jsx';

const RELATIONSHIP_LABELS = {
  CON_DE: 'Con đẻ',
  CON_DAU: 'Con dâu',
  CON_RE: 'Con rể',
  CON_NUOI: 'Con nuôi',
  CON_DO_DAU: 'Con đỡ đầu',
  KHAC: 'Khác',
};

const maskPassword = (value) => {
  if (!value) return 'Chưa nhập';
  return '********';
};

const displayValue = (value, fallback = 'Chưa có thông tin') => {
  if (value === undefined || value === null) return fallback;

  const text = String(value).trim();

  return text || fallback;

  if (typeof raw === 'string') return raw.trim();

  if (raw && typeof raw === 'object') {
    return String(raw.channel || raw.preferredChannel || '').trim();
  }

  return '';
};

const ReviewRow = ({ label, value, muted = false }) => (
  <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p
      className={`mt-1 text-sm font-bold leading-relaxed ${
        muted ? 'text-slate-500' : 'text-slate-900'
      }`}
    >
      {value}
    </p>
  </div>
);

const ReviewSection = ({ icon: Icon, title, children }) => (
  <section className="space-y-3 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
        <Icon size={19} />
      </div>
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">
        {title}
      </h3>
    </div>

    <div className="grid grid-cols-1 gap-3">{children}</div>
  </section>
);

const WaitingPage = ({
  formData,
  onConfirmSubmit,
  onBack,
  loading = false,
}) => {
  const [reviewChecked, setReviewChecked] = useState(false);

  const data = formData || {};

  const isJoinClan =
    data.isNewClan === false ||
    !!data.tenantId;

  const isNewClan = !isJoinClan;

  const relationshipLabel =
    RELATIONSHIP_LABELS[data.temp_relationship] ||
    displayValue(data.temp_relationship);

  /*
  const reviewTitle = isNewClan
    ? 'Rà soát hồ sơ tạo dòng họ mới'
    : 'Rà soát hồ sơ gia nhập dòng họ';
  */
  const reviewTitle = 'Rà soát hồ sơ';
  const reviewInstruction = isNewClan
    ? 'Bác vui lòng kiểm tra kỹ các thông tin dưới đây. Đây là dữ liệu sẽ được gửi tới Ban Quản trị để tạo dòng họ mới. Nếu thông tin chưa đúng, bác bấm “Quay lại chỉnh sửa”. Nếu đã đúng, bác tích xác nhận rồi bấm “Gửi hồ sơ”.'
    : 'Bác vui lòng kiểm tra kỹ các thông tin dưới đây. Đây là dữ liệu sẽ được gửi tới Ban Quản trị để xin tham gia dòng họ. Nếu thông tin chưa đúng, bác bấm “Quay lại chỉnh sửa”. Nếu đã đúng, bác tích xác nhận rồi bấm “Gửi hồ sơ”.';

  
  const reviewType = isNewClan
    ? 'Tạo dòng họ mới'
    : 'Gia nhập dòng họ';
  
  const effectiveSections = useMemo(() => {
    if (isNewClan) {
      return [
        {
          id: 'clan',
          icon: Users,
          title: 'Thông tin dòng họ',
          rows: [
            ['Tên dòng họ', displayValue(data.clanName)],
            ['Mô tả dòng họ', displayValue(data.description)],
          ],
        },
        {
          id: 'personal',
          icon: User,
          title: 'Thông tin người quản trị',
          rows: [
            ['Họ và tên', displayValue(data.temp_full_name)],
            ['Tên cha/mẹ', displayValue(data.temp_father_name)],
            ['Năm sinh', displayValue(data.temp_birth_year)],
            ['Quan hệ', relationshipLabel],
            ['Lời nhắn tới Ban quản trị', displayValue(data.temp_note)],
          ],
        },
        {
          id: 'contact',
          icon: Phone,
          title: 'Thông tin liên hệ',
          rows: [
            ['Số điện thoại', displayValue(data.phone)],
            ['Email', displayValue(data.email)],
          ],
        },
        {
          id: 'security',
          icon: LockKeyhole,
          title: 'Thông tin bảo mật',
          rows: [['Mật khẩu', maskPassword(data.password)]],
        },
      ];
    }

    return [
      {
        id: 'clan',
        icon: Users,
        title: 'Thông tin dòng họ',
        rows: [
          ['Tên dòng họ', displayValue(data.clanName)],
          ['Định danh dòng họ', displayValue(data.tenantSlug, 'Đã chọn từ danh sách'), true],
        ],
      },
      {
        id: 'personal',
        icon: User,
        title: 'Thông tin cá nhân',
        rows: [
          ['Họ và tên', displayValue(data.temp_full_name)],
          ['Tên cha/mẹ', displayValue(data.temp_father_name)],
          ['Năm sinh', displayValue(data.temp_birth_year)],
          ['Quan hệ với dòng họ', relationshipLabel],
          ['Lời nhắn tới Ban quản trị', displayValue(data.temp_note)],
        ],
      },
      {
        id: 'contact',
        icon: MessageSquareText,
        title: 'Thông tin liên hệ',
        rows: [
          ['Số điện thoại đăng nhập', displayValue(data.phone)],
          ['Email', displayValue(data.email, 'Không khai báo')],
        ],
      },
      {
        id: 'security',
        icon: LockKeyhole,
        title: 'Thông tin bảo mật',
        rows: [['Mật khẩu', maskPassword(data.password)]],
      },
    ];
  }, [data, isNewClan, relationshipLabel]);

  const handleConfirm = () => {
    if (!reviewChecked) return;

    const {
      tenantSlug,
      clanSlug,
      ...apiPayload
    } = data;

    if (onConfirmSubmit) {
      onConfirmSubmit(apiPayload);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack({
        from: 'WaitingPage',
        action: 'edit',
        preserveDraft: true,
        resetRuntime: true,
      });
    }
  };

  return (
    <div className="space-y-6">
      <AttentionZone
        active
        priority="medium"
        role="status"
        ariaLive="polite"
        autoScroll
        flash
        lock
        recoveryKey="waiting-page-review"
        className="border-blue-100 bg-blue-50 text-blue-800"
        data-testid="waiting-page-review-attention"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <FileCheck2 size={24} className="mt-1 shrink-0" />

            <div className="min-w-0">
              {/*
              <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">
                Hồ sơ đăng ký
              </p>
              */}
              <h2 className="mt-1 text-2xl font-black leading-snug text-blue-900">
                {reviewTitle}
              </h2>

              <p className="mt-3 text-sm font-bold leading-relaxed text-blue-700">
                {reviewInstruction}
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <ZoneVoiceButton
              visible
              text={reviewInstruction}
              label="Nghe hướng dẫn"
              disabled={loading}
            />
          </div>
        </div>
      </AttentionZone>
      {/*}
      <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4 text-amber-800">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-black">Lưu ý trước khi gửi</p>
            <p className="mt-1 text-sm font-bold leading-relaxed">
              Nếu thông tin chưa đúng, bác hãy bấm “Quay lại chỉnh sửa”. Nếu đã
              đúng, bác tích xác nhận rồi bấm “Gửi hồ sơ”.
            </p>
          </div>
        </div>
      </div>
      */}
      <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
          Loại hồ sơ
        </p>
        <div className="mt-2 flex items-center gap-2 text-base font-black text-slate-900">
          <ShieldCheck size={20} className="text-emerald-600" />
          {reviewType}
        </div>
      </div>

      <div className="space-y-4">
        {effectiveSections.map((section) => (
          <ReviewSection
            key={section.id}
            icon={section.icon}
            title={section.title}
          >
            {section.rows.map(([label, value, muted]) => (
              <ReviewRow
                key={`${section.id}-${label}`}
                label={label}
                value={value}
                muted={muted}
              />
            ))}
          </ReviewSection>
        ))}
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-800">
        <input
          type="checkbox"
          checked={reviewChecked}
          onChange={(e) => setReviewChecked(e.target.checked)}
          className="mt-1 h-5 w-5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
        />

        <span className="text-sm font-bold leading-relaxed">
          Tôi đã rà soát và xác nhận các thông tin trên là đúng để gửi tới Ban
          Quản trị.
        </span>
      </label>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleBack}
          disabled={loading}
          className="flex-1 rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="inline-flex items-center justify-center gap-2">
            <ArrowLeft size={18} />
            Quay lại chỉnh sửa
          </span>
        </button>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading || !reviewChecked}
          className={`flex-[1.4] rounded-3xl px-4 py-4 text-sm font-black text-white transition ${
            loading || !reviewChecked
              ? 'cursor-not-allowed bg-slate-300'
              : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {loading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin" />
              Đang gửi...
            </span>
          ) : (
            <span className="inline-flex items-center justify-center gap-2">
              <CheckCircle2 size={18} />
              Gửi hồ sơ
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

export default WaitingPage;