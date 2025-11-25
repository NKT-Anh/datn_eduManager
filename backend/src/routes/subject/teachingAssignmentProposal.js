const express = require('express');
const router = express.Router();
const proposalController = require('../../controllers/subject/teachingAssignmentProposalController');
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');
const { auditLog } = require('../../middlewares/auditLogMiddleware');
const { getSubjectName } = require('../../utils/auditLogHelpers');

// ✅ Trưởng bộ môn: Tạo proposal phân công cho tổ của mình
router.post('/', 
  authMiddleware, 
  checkPermission(PERMISSIONS.DEPARTMENT_ASSIGN_TEACHING),
  auditLog({
    action: 'CREATE',
    resource: 'TEACHING_PROPOSAL',
    getDescription: async (req) => {
      const assignments = req.body?.assignments || [];
      const departmentId = req.body?.departmentId;
      
      // Lấy tên tổ bộ môn
      let departmentName = departmentId || 'N/A';
      try {
        const Department = require('../../models/subject/department');
        const dept = await Department.findById(departmentId).select('name').lean();
        if (dept) departmentName = dept.name;
      } catch (e) {
        // Ignore error
      }
      
      return `Tạo đề xuất phân công: ${assignments.length} phân công, Tổ ${departmentName}`;
    },
  }),
  proposalController.createProposal
);

// ✅ Lấy danh sách proposal
// - Trưởng bộ môn: chỉ xem proposal của tổ mình
// - Admin/BGH: xem tất cả
router.get('/', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.DEPARTMENT_ASSIGN_TEACHING,
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW
  ], { checkContext: false }), 
  proposalController.getProposals
);

// ✅ Admin/BGH: Duyệt proposal
router.put('/:id/approve', 
  authMiddleware, 
  checkPermission(PERMISSIONS.TEACHING_ASSIGNMENT_CREATE),
  auditLog({
    action: 'APPROVE',
    resource: 'TEACHING_PROPOSAL',
    getResourceId: (req) => req.params.id,
    getDescription: (req) => `BGH duyệt đề xuất phân công: ${req.params.id}`,
  }),
  proposalController.approveProposal
);

// ✅ Admin/BGH: Từ chối proposal
router.put('/:id/reject', 
  authMiddleware, 
  checkPermission(PERMISSIONS.TEACHING_ASSIGNMENT_CREATE),
  auditLog({
    action: 'REJECT',
    resource: 'TEACHING_PROPOSAL',
    getResourceId: (req) => req.params.id,
    getDescription: (req) => `BGH từ chối đề xuất phân công: ${req.params.id}, Lý do: ${req.body?.reason || 'Không có'}`,
  }),
  proposalController.rejectProposal
);

// ✅ Admin/BGH: Xem trước sự khác biệt khi áp dụng proposal
router.post('/preview', 
  authMiddleware, 
  checkPermission(PERMISSIONS.TEACHING_ASSIGNMENT_VIEW, { checkContext: false }), 
  proposalController.previewProposals
);

// ✅ Admin/BGH: Áp dụng proposal vào TeachingAssignment chính thức
router.post('/apply', 
  authMiddleware, 
  checkPermission(PERMISSIONS.TEACHING_ASSIGNMENT_CREATE),
  auditLog({
    action: 'APPLY',
    resource: 'TEACHING_PROPOSAL',
    getDescription: (req) => `BGH áp dụng đề xuất phân công: ${req.body?.proposalIds?.length || 0} đề xuất`,
  }),
  proposalController.applyProposals
);

// ✅ Trưởng bộ môn: Hủy proposal của mình
router.put('/:id/cancel', 
  authMiddleware, 
  checkPermission(PERMISSIONS.DEPARTMENT_ASSIGN_TEACHING),
  auditLog({
    action: 'CANCEL',
    resource: 'TEACHING_PROPOSAL',
    getResourceId: (req) => req.params.id,
    getDescription: (req) => `TBM hủy đề xuất phân công: ${req.params.id}`,
  }),
  proposalController.cancelProposal
);

module.exports = router;

