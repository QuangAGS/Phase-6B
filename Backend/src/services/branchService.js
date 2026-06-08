/**
 * PATH: backend/src/services/branchService.js
 * DATETIME: 14-04-2026 18:00
 * VERSION: 1.6.1
 * DESCRIPTION: Xử lý logic cây chi họ chuyên biệt. 
 * Tận dụng Prisma Extension để tự động cô lập dữ liệu theo Tenant.
 */

const { prisma } = require('../lib/prisma');

const branchService = {
  /**
   * Lấy toàn bộ cấu trúc cây chi họ của Tenant hiện hành
   */
  getBranchTree: async () => {
    try {
      // 1. Lấy tất cả branch (Prisma Extension tự động lọc tenant_id và deleted_at)
      const allBranches = await prisma.branches.findMany({
        include: {
          founder: {
            select: {
              id: true,
              full_name: true,
              generation: true
            }
          }
        },
        orderBy: {
          name: 'asc'
        }
      });

      // 2. Xây dựng bản đồ truy xuất nhanh
      const branchMap = {};
      allBranches.forEach(branch => {
        branchMap[branch.id] = { 
          ...branch, 
          children: [] 
        };
      });

      const rootBranches = [];

      // 3. Tổ chức cấu trúc phân cấp Cha - Con
      allBranches.forEach(branch => {
        const currentBranch = branchMap[branch.id];
        
        // Kiểm tra nếu có parent_id và parent đó phải tồn tại trong danh sách đã lọc
        if (branch.parent_id && branchMap[branch.parent_id]) {
          branchMap[branch.parent_id].children.push(currentBranch);
        } else {
          // Nếu không có cha hoặc cha không thuộc tenant này -> là chi gốc
          rootBranches.push(currentBranch);
        }
      });

      return rootBranches;
    } catch (error) {
      console.error("❌ [BranchTree Error]:", error.message);
      throw new Error("Không thể xây dựng cấu trúc chi họ. Vui lòng thử lại sau.");
    }
  }
};

module.exports = branchService;