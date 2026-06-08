/**
 * DATETIME: 07-04-2026 15:30
 * THƯ MỤC: src/features/genealogy/components/
 * PHIÊN BẢN: 12.8.5
 * MÔ TẢ: Thành phần hiển thị nút (Node) thành viên trên sơ đồ.
 * FIX: Sử dụng tham chiếu từ window object để khắc phục lỗi "Could not resolve" trong Canvas Preview.
 */

import React from 'react';

// Sử dụng ReactFlow từ window object để tránh lỗi biên dịch trong môi trường Canvas Preview
// Trong môi trường local thực tế, bạn vẫn có thể dùng: import { Handle, Position } from 'reactflow';
const Handle = window.ReactFlow?.Handle || (() => null);
const Position = window.ReactFlow?.Position || { Top: 'top', Bottom: 'bottom' };

const MemberNode = ({ data }) => {
  const isMale = data.gender === 'NAM';
  
  return (
    <div className="relative group">
      {/* Điểm kết nối phía trên */}
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      
      <div 
        onClick={() => data.onSelect && data.onSelect(data.id)}
        className={`w-12 h-12 rounded-full border-4 flex items-center justify-center text-[10px] font-black cursor-pointer shadow-xl transition-all active:scale-150
          ${isMale ? 'border-blue-600 bg-blue-500 text-white shadow-blue-100' : 'border-pink-600 bg-pink-500 text-white shadow-pink-100'}`}
      >
        {data.generation ?? '?'}
      </div>
      
      {/* Điểm kết nối phía dưới */}
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
};

export default MemberNode;