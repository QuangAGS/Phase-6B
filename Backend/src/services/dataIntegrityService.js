/**
 * PATH: backend/src/services/dataIntegrityService.js
 * DATETIME: 14-04-2026 18:30
 * VERSION: 1.1.0
 * DESCRIPTION: Quét và phát hiện lỗi logic phả hệ (Huyết thống, Đời, Hôn nhân).
 * RULE: Không truy vấn DB trực tiếp, nhận dữ liệu phẳng từ Service cha.
 */

const dataIntegrityService = {
  /**
   * Phân tích sức khỏe dữ liệu của một danh sách thành viên
   * @param {Array} members - Danh sách thành viên đã kèm quan hệ hôn nhân
   */
  checkBranchHealth: (members) => {
    const issues = [];
    if (!members || members.length === 0) return issues;

    // 1. Khởi tạo bản đồ thành viên và tìm đời nhỏ nhất (Gốc)
    const memberMap = new Map(members.map(m => [m.id, m]));
    const gens = members.map(m => m.generation).filter(g => g !== null);
    const minGeneration = gens.length > 0 ? Math.min(...gens) : 1;

    members.forEach(m => {
      // --- PHẦN 1: KIỂM TRA QUAN HỆ HUYẾT THỐNG ---
      const father = m.father_id ? memberMap.get(m.father_id) : null;
      const mother = m.mother_id ? memberMap.get(m.mother_id) : null;

      // Lỗi: Đời con <= đời cha/mẹ
      if (father && m.generation <= father.generation) {
        issues.push({
          level: 'ERROR',
          type: 'INVALID_GENERATION',
          member: m.full_name,
          message: `Lỗi đời: ${m.full_name} (Đời ${m.generation}) không thể cùng đời hoặc lớn đời hơn cha (${father.full_name}).`
        });
      }

      // Cảnh báo: Nhảy đời (> 1 thế hệ)
      if (father && (m.generation - father.generation > 1)) {
        issues.push({
          level: 'WARNING',
          type: 'JUMP_GENERATION',
          member: m.full_name,
          message: `Nhảy đời: ${m.full_name} cách cha ${father.full_name} quá xa (${m.generation - father.generation} đời).`
        });
      }

      // Cảnh báo: Nhánh mồ côi (Không cha mẹ nhưng không phải đời gốc)
      if (!m.father_id && !m.mother_id && m.generation > minGeneration) {
        issues.push({
          level: 'INFO',
          type: 'ORPHAN_NODE',
          member: m.full_name,
          message: `${m.full_name} (Đời ${m.generation}) hiện không có cha mẹ trong hệ thống.`
        });
      }

      // --- PHẦN 2: KIỂM TRA HÔN NHÂN PHỨC TẠP ---
      const marriages = [...(m.marriages_as_husband || []), ...(m.marriages_as_wife || [])];

      marriages.forEach(rel => {
        const spouseId = (rel.husband_id === m.id) ? rel.wife_id : rel.husband_id;
        const spouse = spouseId ? memberMap.get(spouseId) : null;

        if (spouse) {
          if (m.id >= spouse.id) return; // Chỉ check 1 lần mỗi cặp

          // A. KIỂM TRA TRỰC HỆ (Cha/Mẹ - Con)
          const isDirectIncest = 
            spouse.id === m.father_id || spouse.id === m.mother_id || 
            m.id === spouse.father_id || m.id === spouse.mother_id;

          if (isDirectIncest) {
            issues.push({
              level: 'CRITICAL',
              type: 'DIRECT_LINE_INCEST',
              member: `${m.full_name} & ${spouse.full_name}`,
              message: `VI PHẠM TRỰC HỆ: Hôn nhân giữa cha/mẹ và con cái.`
            });
          }

          // B. KIỂM TRA CẬN HUYẾT NỘI TỘC
          if (m.child_type === 'CON_DE' && spouse.child_type === 'CON_DE') {
            if (m.generation === spouse.generation) {
              issues.push({
                level: 'CRITICAL',
                type: 'SAME_GEN_INCEST',
                member: `${m.full_name} & ${spouse.full_name}`,
                message: `Cảnh báo: Hôn nhân nội tộc cùng đời ${m.generation}.`
              });
            } else {
              issues.push({
                level: 'WARNING',
                type: 'CONSANGUINITY',
                member: `${m.full_name} & ${spouse.full_name}`,
                message: `Cảnh báo cận huyết lệch đời (Đời ${m.generation} & Đời ${spouse.generation}).`
              });
            }
          }
        }
      });
    });

    return issues;
  }
};

module.exports = dataIntegrityService;