/**
 * PATH       : src/pages/ResultPage.jsx
 * DATETIME   : 2026-05-14T00:00:00+07:00
 * VERSION    : 24.1.0
 * DESCRIPTION:
 * - Sprint EGAL-6.1: Attention Transfer Engine.
 * - Patch từ VERSION 24.0.0.
 * - Bổ sung AttentionZone cho success/result hero để kết quả luôn nằm trong vùng chú ý.
 * - Bảo tồn ResultPage flow hiện có.
 * - Không thay đổi business logic, auth flow, validation hoặc API contract.
 * - Tuân thủ Q1/Q2.
 */

import {
  Check,
  Landmark,
  User,
  Mail,
  MessageCircle,
} from 'lucide-react';

import AudioHelpButton from '../features/a11y/tts/AudioHelpButton.jsx';
import { ttsMessages } from '../features/a11y/tts/ttsMessages.js';

import StepCoachBar from '../features/a11y/guided/StepCoachBar.jsx';

/**
 * <2026-05-14T00:00:00+07:00>
 * EGAL-6.1:
 * AttentionZone dùng để đưa success result vào trung tâm chú ý khi page render.
 * Không thay đổi navigation hoặc result flow.
 */
import AttentionZone from '../features/a11y/attention/AttentionZone.jsx';

const ResultPage = ({ formData }) => {
  const data = formData || {};
  const isNewClan = !!data.isNewClan;

  return (
    <div className="w-full overflow-hidden rounded-[40px] bg-white shadow-2xl">
      {/*
        <2026-05-14T00:00:00+07:00>
        EGAL-6.1 local CSS:
        - Bổ sung animation class cho AttentionZone.
        - Đặt tại page để patch độc lập, không bắt buộc sửa global CSS.
      */}
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

      {/*
        <2026-05-14T00:00:00+07:00>
        EGAL-6.1:
        - Wrap success hero bằng AttentionZone.
        - Khi ResultPage render, người dùng được đưa ngay tới kết quả thành công.
        - Không thay đổi nội dung result hoặc callback navigation.
      */}
      <AttentionZone
        active
        priority="success"
        role="status"
        ariaLive="polite"
        autoScroll
        autoFocus
        flash
        lock
        className="rounded-none border-0 bg-gradient-to-br from-emerald-500 to-teal-600 px-8 py-16 text-center text-white"
        data-testid="result-page-attention-success"
      >
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-white/20 backdrop-blur-md">
          <Check className="h-12 w-12" strokeWidth={4} />
        </div>

        <h1 className="text-3xl font-black uppercase tracking-tighter">
          HỒ SƠ ĐÃ ĐƯỢC GỬI THÀNH CÔNG
        </h1>

        <p className="mt-3 text-lg opacity-90">
          Cảm ơn bạn! Ban Quản trị sẽ xem xét và liên hệ sớm nhất.
        </p>
      </AttentionZone>

      <div className="px-8 pt-6">
        <div className="flex justify-center">
          <AudioHelpButton
            text={
              ttsMessages?.resultPage?.help ||
              'Hồ sơ của bác đã được gửi thành công. Ban quản trị sẽ xem xét và liên hệ lại trong thời gian sớm nhất.'
            }
            label="Nghe kết quả"
            variant="soft"
          />
        </div>

        <div className="mt-6">
          <StepCoachBar
            currentStep={1}
            totalSteps={1}
            title="Hồ sơ đã được gửi"
            description="Bác đã hoàn tất bước gửi hồ sơ. Ban quản trị sẽ xem xét và liên hệ lại."
            nextLabel="Bác có thể quay về trang chủ hoặc chờ thông báo từ Ban quản trị."
            completedSteps={['Đã gửi hồ sơ']}
            className="border-emerald-100 bg-emerald-50/80"
          />
        </div>
      </div>

      <div className="space-y-10 p-8">
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400">
            <Landmark size={18} /> DÒNG HỌ
          </h3>

          <div className="rounded-3xl bg-slate-50 p-6 text-center">
            <p className="text-2xl font-black text-slate-900">
              {data.clanName}
            </p>

            {isNewClan && (
              <p className="mt-2 text-sm text-emerald-600">
                • Dòng họ mới được khởi tạo
              </p>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400">
            <User size={18} /> THÔNG TIN CÁ NHÂN
          </h3>

          <div className="space-y-3 rounded-3xl bg-slate-50 p-6 text-[15px]">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Họ và tên:</span>
              <span className="text-right font-semibold">
                {data.temp_full_name}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Tên cha/mẹ:</span>
              <span className="text-right">{data.temp_father_name}</span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Năm sinh:</span>
              <span className="text-right">{data.temp_birth_year}</span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Quan hệ:</span>
              <span className="text-right">{data.temp_relationship}</span>
            </div>

            <div className="flex justify-between gap-4 border-t pt-3">
              <span className="text-slate-500">Số điện thoại:</span>
              <span className="text-right font-semibold">{data.phone}</span>
            </div>

            {data.temp_note && (
              <div className="border-t pt-3">
                <span className="block text-slate-500">
                  Lời nhắn cho quản trị viên:
                </span>
                <p className="mt-1 italic text-slate-700">
                  "{data.temp_note}"
                </p>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400">
            <Mail size={18} />
            THÔNG TIN LIÊN HỆ
          </h3>

          <div className="space-y-3 rounded-3xl bg-slate-50 p-6 text-[15px]">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Số điện thoại:</span>
              <span className="text-right font-semibold">{data.phone}</span>
            </div>

            <div className="flex justify-between gap-4 border-t pt-3">
              <span className="text-slate-500">Email:</span>
              <span className="break-all text-right font-semibold">
                {data.email || 'Không khai báo'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t bg-slate-50 p-8">
        <button
          type="button"
          onClick={() => {
            window.location.href = '/';
          }}
          className="w-full rounded-3xl bg-slate-900 py-4 text-lg font-black text-white transition-all hover:bg-black active:scale-[0.98]"
        >
          Về trang chủ
        </button>
      </div>
    </div>
  );
};

export default ResultPage;