/**
 * DATETIME: 07-04-2026 13:10
 * THƯ MỤC: src/features/genealogy/utils/
 * PHIÊN BẢN: 12.8.4
 * MÔ TẢ: Logic tính toán vị trí Node và Edge cho sơ đồ phả hệ ReactFlow.
 */

/**
 * transformToOverview: Chuyển đổi dữ liệu thành sơ đồ toàn cảnh (Dạng Dot)
 */
export const transformToOverview = (allMembers, onSelect) => {
  const nodes = []; const edges = []; const occupiedX = {};
  if (!allMembers || allMembers.length === 0) return { nodes: [], edges: [] };
  
  // Sắp xếp theo thế hệ
  const sorted = [...allMembers].sort((a, b) => (a.generation ?? 0) - (b.generation ?? 0));
  const minG = sorted[0].generation ?? 0;

  sorted.forEach(member => {
    const g = member.generation ?? 0;
    if (!occupiedX[g]) occupiedX[g] = 0;
    
    nodes.push({
      id: member.id.toString(),
      type: 'memberNode',
      data: { ...member, viewMode: 'dot', onSelect },
      position: { x: occupiedX[g], y: (g - minG) * 200 }
    });

    // Tạo đường nối cha-con
    if (member.father_id) {
      edges.push({
        id: `e-o-${member.id}`,
        source: member.father_id.toString(),
        target: member.id.toString(),
        style: { stroke: '#cbd5e1', opacity: 0.4, strokeWidth: 2 }
      });
    }
    occupiedX[g] += 150; // Khoảng cách ngang giữa các node
  });
  
  return { nodes, edges };
};