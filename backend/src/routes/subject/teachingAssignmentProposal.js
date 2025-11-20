const express = require('express');
const router = express.Router();
const proposalController = require('../../controllers/subject/teachingAssignmentProposalController');
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');

// ✅ Trưởng bộ môn: Tạo proposal phân công cho tổ của mình
router.post('/', 
  authMiddleware, 
  checkPermission(PERMISSIONS.DEPARTMENT_ASSIGN_TEACHING), 
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
  proposalController.approveProposal
);

// ✅ Admin/BGH: Từ chối proposal
router.put('/:id/reject', 
  authMiddleware, 
  checkPermission(PERMISSIONS.TEACHING_ASSIGNMENT_CREATE), 
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
  proposalController.applyProposals
);

// ✅ Trưởng bộ môn: Hủy proposal của mình
router.put('/:id/cancel', 
  authMiddleware, 
  checkPermission(PERMISSIONS.DEPARTMENT_ASSIGN_TEACHING), 
  proposalController.cancelProposal
);

module.exports = router;

