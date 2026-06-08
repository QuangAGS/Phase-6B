/**
 * PATH: backend/src/services/memberService.js
 * DATETIME: 14-04-2026 19:45
 * VERSION: 1.7.0
 * DESCRIPTION: Quản lý thành viên phả hệ. Tích hợp Data Integrity Service để quét lỗi logic.
 * UPDATE: Sử dụng Prisma Context (Multi-tenant) và bóc tách dữ liệu theo chuẩn Vét cạn.
 *         Nâng cấp hàm createFullMember
 */

const { prisma } = require('../lib/prisma');
const { v4: uuidv4 } = require('uuid');
const auditService = require('./auditService');
const dataIntegrityService = require('./dataIntegrityService');

const memberService = {
  /**
   * CREATE FULL MEMBER: Lưu đồng thời vào nhiều bảng (Transaction).
   * @param {Object} payload - Dữ liệu từ Controller gửi xuống (bao gồm Metadata).
   * @param {String} tenantId - ID dòng họ lấy từ Context.
   */
  createFullMember: async (payload, tenantId) => {
  const { memberData, currentAddr, biographyData, changed_by, change_reason } = payload;

    return await prisma.$transaction(async (tx) => {
      // 1. Tạo Address trước (Bóc tách metadata)
      let curId = null;
      if (currentAddr?.full_address) {
        const addr = await tx.addresses.create({
          data: { ...currentAddr, id: uuidv4(), tenant_id: tenantId, changed_by }
        });
        curId = addr.id;
        // Ghi log riêng cho địa chỉ
        await auditService.logAction('THEM_MOI', 'addresses', addr.id, null, addr, changed_by, 'Đi kèm tạo mới thành viên', tenantId);
      }

      // 2. Tạo Member (Sử dụng curId vừa lấy)
      const member = await tx.members.create({
        data: {
          ...memberData,
          id: uuidv4(),
          tenant_id: tenantId,
          current_address_id: curId,
          changed_by
        }
      });

      // 3. Tạo Tiểu sử (Biographies)
      if (biographyData) {
        const bio = await tx.biographies.create({
          data: { ...biographyData, id: uuidv4(), member_id: member.id, tenant_id: tenantId, changed_by }
        });
        await auditService.logAction('THEM_MOI', 'biographies', bio.id, null, bio, changed_by, 'Đi kèm tạo mới thành viên', tenantId);
      }

      // 4. Log hành động chính
      await auditService.logAction('THEM_MOI', 'members', member.id, null, member, changed_by, change_reason, tenantId);

      return member;
    });
  },

  /**
   * LẤY DỮ LIỆU CÂY: Bao gồm suy luận đời và kiểm tra sức khỏe dữ liệu.
   * @param {String} branchId - ID chi họ.
   */
  getMemberTreeData: async (branchId) => {
    // 1. Lấy tất cả thành viên trong chi họ (Prisma tự lọc tenant_id)
    const all = await prisma.members.findMany({
      where: { 
        branch_id: branchId,
        deleted_at: null 
      },
      include: {
        marriages_as_husband: { 
          include: { members_marriages_wife_idTomembers: true } 
        },
        marriages_as_wife: { 
          include: { members_marriages_husband_idTomembers: true } 
        }
      }
    });

    // 2. SUY LUẬN PHẢ HỆ: Tự động tính toán generation (đời) nếu bị thiếu
    let changed = true;
    while (changed) {
      changed = false;
      all.forEach(m => {
        const parent = all.find(p => p.id === m.father_id || p.id === m.mother_id);
        if (parent && m.generation === null && parent.generation !== null) {
          m.generation = parent.generation + 1;
          changed = true;
        }
      });
    }

    // 3. KIỂM TRA SỨC KHỎE DỮ LIỆU (Data Integrity)
    const healthIssues = dataIntegrityService.checkBranchHealth(all);

    // 4. DỰNG CẤU TRÚC CÂY (Tree Logic)
    const tree = memberService.buildTreeLogic(all);

    return {
      tree,
      healthIssues,
      stats: {
        totalMembers: all.length,
        issueCount: healthIssues.length
      }
    };
  },

  /**
   * DỰNG CÂY: Chuyển danh sách phẳng thành cấu trúc lồng nhau (Nested).
   */
  buildTreeLogic: (members) => {
    if (members.length === 0) return [];
    
    // Sắp xếp theo đời để dựng từ gốc lên
    const sortedMembers = [...members].sort((a, b) => (a.generation || 0) - (b.generation || 0));
    const map = {};
    
    // Tạo map và khởi tạo mảng con/phối ngẫu
    sortedMembers.forEach(m => { 
      map[m.id] = { ...m, children: [], partners: [] }; 
    });

    // Xử lý quan hệ phối ngẫu (Marriages)
    sortedMembers.forEach(m => {
      const marriages = [...(m.marriages_as_husband || []), ...(m.marriages_as_wife || [])];
      marriages.forEach(rel => {
        const spouse = rel.members_marriages_wife_idTomembers || rel.members_marriages_husband_idTomembers;
        if (spouse || rel.spouse_name_literal) {
          map[m.id].partners.push({ 
            id: spouse?.id || null, 
            full_name: rel.spouse_name_literal || spouse?.full_name,
            relation_type: rel.relation_type
          });
        }
      });
    });

    // Xây dựng quan hệ cha-con
    const roots = [];
    sortedMembers.forEach(m => {
      const pId = m.father_id || m.mother_id;
      if (pId && map[pId]) {
        map[pId].children.push(map[m.id]);
      } else {
        roots.push(map[m.id]);
      }
    });

    return roots;
  }
};

module.exports = memberService;