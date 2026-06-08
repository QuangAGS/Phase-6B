/**
 * PATH: src/features/management/components/ApprovalCenter.jsx
 * DATETIME: 14-04-2026 20:45
 * VERSION: 1.0.0
 * DESCRIPTION: Trung tâm duyệt thành viên (BR3). 
 * Thiết kế Mobile-first theo dạng thẻ so sánh dữ liệu "Vét cạn" (temp_ fields) 
 * giúp Clan Admin đối soát nhân thân trước khi nối vào cây.
 */

import { useState } from 'react';
import { 
  Check, X, UserSearch, MapPin, 
  Calendar, Info, ChevronRight, AlertCircle, Search 
} from 'lucide-react';
import apiClient from '../../../lib/axios';

const ApprovalCenter = ({ pendingUsers, onActionSuccess }) => {
  const [processingId, setProcessingId] = useState(null);
  const [searchMember, setSearchMember] = useState("");

  const handleApprove = async (userId, targetMemberId) => {
    if (!targetMemberId) {
      alert("Vui lòng chọn một vị trí (Node) trên cây để nối thành viên này vào!");
      return;
    }
    
    setProcessingId(userId);
    try {
      // Gọi API Patch khớp với authService/memberService ở Backend
      await apiClient.patch(`/members/${targetMemberId}/approve`, { userId });
      onActionSuccess(); // Load lại danh sách sau khi duyệt thành công
    } catch (err) {
      console.error("Lỗi duyệt:", err);
      alert(err.response?.data?.message || "Không thể duyệt thành viên này.");
    } finally {
      setProcessingId(null);
    }
  };

  if (!pendingUsers || pendingUsers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <UserSearch size={32} className="opacity-20" />
        </div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em]">Hòm thư duyệt trống</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 pb-24 font-sans">
      {pendingUsers.map((user) => (
        <div 
          key={user.id} 
          className="bg-white rounded-[35px] shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-500"
        >
          {/* Header Card: Tên người đăng ký */}
          <div className="p-6 bg-slate-900 text-white relative">
            <div className="absolute top-0 right-0 p-6">
              <div className="bg-amber-500 text-slate-900 text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-tighter">
                {user.temp_relationship || 'Gia nhập'}
              </div>
            </div>
            <h3 className="font-black italic text-xl uppercase tracking-tighter leading-none mb-1">
              {user.temp_full_name}
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Calendar size={10} /> {new Date(user.createdAt).toLocaleDateString('vi-VN')}
            </p>
          </div>

          {/* Body: Đối soát dữ liệu Vét cạn */}
          <div className="p-6 space-y-5">
            
            {/* Khối 1: Thông tin nhân thân khai báo */}
            <div className="bg-blue-50/70 p-5 rounded-[25px] border border-blue-100/50">
              <h4 className="text-[10px] font-black text-blue-600 uppercase mb-4 tracking-widest flex items-center gap-2">
                <ShieldCheck size={14} /> Dữ liệu khai báo (Vét cạn)
              </h4>
              
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm shrink-0">
                    <UserSearch className="text-blue-500" size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Cha & Ông nội</p>
                    <p className="text-sm font-black text-slate-700 leading-tight italic">
                      {user.temp_father_name} <span className="text-slate-300 mx-1">/</span> {user.temp_grandfather_name}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm shrink-0">
                    <MapPin className="text-blue-500" size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Năm sinh & Địa chỉ</p>
                    <p className="text-sm font-black text-slate-700 leading-tight italic">
                      {user.temp_birth_year || '????'} <span className="text-slate-300 mx-1">•</span> {user.temp_address || 'Không rõ địa chỉ'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Khối 2: Lời nhắn/Ghi chú thêm */}
            {user.temp_note && (
              <div className="px-5 py-4 bg-slate-50 rounded-[20px] border border-dashed border-slate-200">
                <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Ghi chú từ thành viên:</span>
                <p className="text-xs font-bold text-slate-600 italic leading-relaxed">"{user.temp_note}"</p>
              </div>
            )}

            {/* Khối 3: Tìm kiếm vị trí trên cây (Duyệt) */}
            <div className="space-y-3 pt-2">
              <label className="text-[10px] font-black text-slate-800 uppercase px-1 flex items-center gap-2">
                <AlertCircle size={12} className="text-amber-500" /> Chọn vị trí nối vào cây:
              </label>
              
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Search size={16} />
                </div>
                <select 
                  className="w-full pl-11 pr-10 py-4 bg-white border-2 border-slate-100 rounded-[22px] text-[13px] font-bold text-slate-700 appearance-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-sm"
                  onChange={(e) => user.selectedTarget = e.target.value}
                >
                  <option value="">-- Tìm người cha trên cây --</option>
                  {/* Dữ liệu này sẽ được map từ kết quả search Member API */}
                  <option value="member_id_1">Ông {user.temp_father_name} (Đời 4 - Nhánh 1)</option>
                  <option value="manual_add">Thêm mới Node cha (Vét cạn)</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronRight size={18} className="text-slate-300" />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Card: Hành động */}
          <div className="p-6 bg-slate-50/80 flex gap-3 border-t border-slate-100">
            <button 
              className="flex-1 py-4 bg-white border border-rose-200 text-rose-500 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm"
              onClick={() => {/* Gọi API Reject */}}
            >
              <X size={14} /> Từ chối
            </button>
            <button 
              disabled={processingId === user.id}
              className="flex-[2.5] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              onClick={() => handleApprove(user.id, user.selectedTarget)}
            >
              {processingId === user.id ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><Check size={16} /> Xác nhận & Cấp quyền</>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ApprovalCenter;