/**
 * FILE: src/pages/TreePage.jsx
 * DATETIME: 07-04-2026 17:40
 * VERSION: 1.0.0
 * DESCRIPTION: Trang hiển thị Sơ đồ Phả hệ chính thức.
 * - Đã loại bỏ 'React' import thừa.
 * - Kết nối AuthContext để hiển thị thông tin User đã duyệt.
 * - Sử dụng ReactFlowProvider bao bọc từ App.jsx nên không cần khai báo lại ở đây.
 */

import { useAuth } from '../context/AuthContext';
import { LogOut, Settings, Share2, Search } from 'lucide-react';

const TreePage = () => {
  const { user, logout } = useAuth();

  return (
    <div className="h-screen w-full bg-slate-50 flex flex-col font-sans overflow-hidden">
      {/* Header điều khiển */}
      <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black italic">
            GP
          </div>
          <div>
            <h1 className="text-lg font-black uppercase italic tracking-tighter text-slate-800 leading-none">
              Dòng họ {user?.tenants?.name || 'Gia Phả'}
            </h1>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">
              Admin: {user?.name} [Duyệt: OK]
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative mr-4">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input 
              placeholder="Tìm thành viên..." 
              className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm font-medium w-64 focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
          
          <button className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
            <Share2 size={20} />
          </button>
          <button className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
            <Settings size={20} />
          </button>
          <div className="w-px h-6 bg-slate-200 mx-2" />
          <button 
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl font-bold text-sm hover:bg-rose-100 transition-all"
          >
            <LogOut size={16} /> Thoát
          </button>
        </div>
      </header>

      {/* Canvas Hiển thị Cây (Placeholder cho ReactFlow logic) */}
      <main className="flex-1 relative bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px]">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <h2 className="text-6xl font-black uppercase italic tracking-tighter text-slate-300">
            Genealogy Canvas
          </h2>
        </div>
        
        {/* Nơi render ReactFlow Component trong các bước tiếp theo */}
      </main>
    </div>
  );
};

export default TreePage;