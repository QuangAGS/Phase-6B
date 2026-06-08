/**
 * FILE       : src/pages/HomePage.jsx
 * DATETIME   : 2026-05-18T00:00:00+07:00
 * VERSION    : 24.6.7.B0.3
 * DESCRIPTION:
 * - 24.6.7.B0.3:
 *   - Gỡ auto welcome voice do browser policy không ổn định.
 *   - Giữ mobile-first ElderAssist discoverability.
 *   - Voice guidance bắt đầu sau khi user bấm ElderAssistButton.
 * - 24.6.7.B0:
 *   - Người cao tuổi nhìn thấy và hiểu ngay: “Hỗ trợ thao tác ở đây”.
 * - Sprint EGAL-6.2:
 *   - Single Elder Assistance Mode.
 * - Bảo tồn layout, navigation và mobile-first UI hiện có.
 * - Không thay đổi business logic, auth flow hoặc API contract.
 * - Tuân thủ Q1/Q2.
 */

import { Link } from 'react-router-dom';
import {
  BookOpenText,
  CalendarDays,
  Users,
  Flame,
  ArrowRight,
} from 'lucide-react';

//import ElderAssistButton from '../features/a11y/elder/ElderAssistButton.jsx';

const featuredEvents = [
  {
    id: 1,
    title: 'Giỗ Tổ Dòng Họ',
    date: 'Mùng 10 tháng 3 (Âm lịch)',
    type: 'GIO_CHAP',
  },
  {
    id: 2,
    title: 'Họp Họ Thường Niên',
    date: 'Chủ Nhật, 15/04/2026',
    type: 'HOP_HO',
  },
];

const HomePage = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans overflow-x-hidden flex flex-col">
      <style>
        {`
          @keyframes egalAssistBreathingGlow {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.00);
              transform: translateY(0);
            }

            45% {
              box-shadow: 0 0 0 8px rgba(37, 99, 235, 0.10);
              transform: translateY(-1px);
            }
          }

          .egal-assist-discovery-glow {
            animation: egalAssistBreathingGlow 3.4s ease-in-out infinite;
          }

          @media (prefers-reduced-motion: reduce) {
            .egal-assist-discovery-glow {
              animation: none;
              box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
            }
          }
        `}
      </style>

      <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm z-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black italic shadow-md">
              GP
            </div>

            <h1 className="text-xl font-black uppercase italic tracking-tighter text-slate-950 leading-none">
              Gia Phả Hệ
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/*}
            <div className="hidden w-[320px] shrink-0 items-center sm:flex">
              <ElderAssistButton
                size="md"
                fullWidth
                variant="plain"
                showStatus={false}
                className="
                  [&>button]:h-[36px]
                  [&>button]:py-0
                  [&>button]:rounded-full
                  [&>button]:whitespace-nowrap
                  [&>button_span]:whitespace-nowrap
                "
              />
            </div>
            */}

            <Link
              to="/auth"
              className="px-5 py-2 bg-slate-900 text-white rounded-full text-sm font-bold uppercase tracking-widest hover:bg-black active:scale-95 transition-all shadow-lg shadow-slate-200"
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-20 pb-16 px-4 sm:px-5 space-y-8 sm:space-y-10">
        <div className="flex justify-center sm:hidden">
          <div className="egal-assist-discovery-glow w-full max-w-md rounded-[28px] border border-blue-200 bg-blue-50/90 p-3 shadow-lg shadow-blue-100/70">
            <div className="mb-2 text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-700">
                Hỗ trợ thao tác bằng âm thanh
              </p>

              <p className="mt-1 text-xs font-bold leading-relaxed text-blue-900/70">
                Khuyên dùng cho người mới sử dụng
              </p>
            </div>
          </div>
        </div>

        <section className="text-center py-4 sm:py-8 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-50 rounded-full border border-amber-100 text-amber-700 text-xs font-bold uppercase tracking-widest">
            <Flame size={14} className="animate-pulse" />
            Tôn vinh cội nguồn
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-slate-950 leading-[1.15] max-w-2xl mx-auto">
            Gìn giữ lửa thiền,
            <br />
            Nối dài dòng chảy{' '}
            <span className="text-amber-600">tổ tiên</span>.
          </h2>

          <p className="text-slate-600 text-base font-medium max-w-xl mx-auto leading-relaxed">
            Hệ thống quản lý gia phả hiện đại, giúp kết nối các thế hệ, bảo tồn
            văn hóa và truyền thống quý báu của dòng họ.
          </p>

          <div className="pt-6">
            <Link
              to="/auth"
              className="px-8 py-4 bg-amber-600 text-white rounded-2xl font-bold uppercase tracking-widest hover:bg-amber-700 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-amber-100 max-w-sm mx-auto"
            >
              Khám phá Gia phả của bạn <ArrowRight size={20} />
            </Link>
          </div>
        </section>

        <section className="space-y-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: BookOpenText,
                title: 'Tra cứu Gia phả',
                desc: 'Dễ dàng tra cứu thành viên, đời, và nhánh trong dòng họ.',
              },
              {
                icon: Users,
                title: 'Kết nối Thành viên',
                desc: 'Tạo hồ sơ, cập nhật thông tin và kết nối với họ hàng gần xa.',
              },
              {
                icon: Flame,
                title: 'Tôn vinh Achievements',
                desc: 'Lưu trữ và vinh danh những thành tựu nổi bật của con cháu.',
              },
            ].map((item, index) => (
              <div
                key={index}
                className="bg-white p-7 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100 flex gap-5 items-start"
              >
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-700 flex-shrink-0">
                  <item.icon size={28} />
                </div>

                <div>
                  <h3 className="text-lg font-black uppercase text-slate-900 tracking-tight">
                    {item.title}
                  </h3>

                  <p className="text-sm font-medium text-slate-500 mt-1 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6 max-w-3xl mx-auto">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-950">
              Sự kiện Dòng họ
            </h2>

            <Link
              to="/auth"
              className="text-xs font-bold uppercase text-amber-700 hover:underline"
            >
              Xem tất cả
            </Link>
          </div>

          <div className="space-y-4">
            {featuredEvents.map((event) => (
              <div
                key={event.id}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg shadow-slate-100 flex items-center gap-5"
              >
                <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 flex-shrink-0">
                  <CalendarDays size={32} />
                </div>

                <div className="flex-1">
                  <h3 className="font-bold text-slate-900">{event.title}</h3>

                  <p className="text-sm font-medium text-amber-700 italic mt-1">
                    {event.date}
                  </p>
                </div>

                <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse flex-shrink-0" />
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="py-8 bg-slate-950 text-slate-400 px-5 text-center mt-auto border-t border-slate-800">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 text-slate-600">
          Gia Phả Hệ v24.1 | Hanoi, Vietnam
        </p>

        <p className="text-sm font-medium leading-relaxed max-w-sm mx-auto">
          Ứng dụng phát triển bởi GiaPhảHệ.com. All rights reserved © 2026.
        </p>
      </footer>
    </div>
  );
};

export default HomePage;