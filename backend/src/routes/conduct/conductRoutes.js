const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');
const { auditLog } = require('../../middlewares/auditLogMiddleware');
const { getStudentName } = require('../../utils/auditLogHelpers');
const {
  getConducts,
  getConductById,
  updateConduct,
  createConduct,
  calculateSuggestedConduct,
  approveConduct,
  getPendingConducts,
  bulkApproveConducts,
  updateYearNote,
  getConductClassStatistics,
  approveAllConduct,
  getConductBlockStatistics,  
} = require('../../controllers/conduct/conductController');

// Tất cả routes đều cần xác thực
router.use(authMiddleware);
// 📊 Thống kê hạnh kiểm các lớp
router.get('/statistics', getConductClassStatistics);
router.get('/class-statistics', getConductClassStatistics);

// 📊 Thống kê theo khối
router.get('/block-statistics', getConductBlockStatistics);


// 📋 Lấy danh sách hạnh kiểm
router.get(
  '/',
  checkPermission([
    PERMISSIONS.CONDUCT_VIEW,
    PERMISSIONS.CONDUCT_ENTER
  ], { checkContext: true }),
  getConducts
);

// 📋 Lấy chi tiết hạnh kiểm
router.get(
  '/:id',
  checkPermission([
    PERMISSIONS.CONDUCT_VIEW,
    PERMISSIONS.CONDUCT_ENTER
  ], { checkContext: true }),
  getConductById
);

// ➕ Tạo hạnh kiểm (Chỉ Admin)
router.post(
  '/',
  checkPermission(PERMISSIONS.CONDUCT_VIEW, { checkContext: false }),
  auditLog({
    action: 'CREATE',
    resource: 'Hạnh kiểm',
    getDescription: async (req) => {
      const studentId = req.body?.studentId;
      const semester = req.body?.semester || 'N/A';
      const studentName = await getStudentName(studentId);
      return `Tạo hạnh kiểm: Học sinh ${studentName}, Học kỳ ${semester}`;
    },
  }),
  createConduct
);

// ✏️ Cập nhật hạnh kiểm (GVCN nhập, Admin sửa)
router.put(
  '/:id',
  checkPermission([
    PERMISSIONS.CONDUCT_ENTER,
    PERMISSIONS.CONDUCT_VIEW
  ], { checkContext: true }),
  auditLog({
    action: 'UPDATE',
    resource: 'Hạnh kiểm',
    getResourceId: (req) => req.params.id,
    getDescription: async (req) => {
      try {
        const StudentYearRecord = require('../../models/user/studentYearRecord');
        const record = await StudentYearRecord.findById(req.params.id)
          .populate('studentId', 'name studentCode')
          .lean();
        
        if (record) {
          const studentName = record.studentId ? `${record.studentId.name} (${record.studentId.studentCode || ''})` : 'N/A';
          const conductValue = req.body?.conduct || record.conduct || 'N/A';
          const action = req.body?.action || 'save';
          return `Nhập/sửa hạnh kiểm: Học sinh ${studentName}, Hạnh kiểm: ${conductValue}, Hành động: ${action === 'submit' ? 'Gửi phê duyệt' : 'Lưu bản nháp'}`;
        }
      } catch (e) {
        // Ignore error
      }
      return `Nhập/sửa hạnh kiểm: ${req.params.id}, Hạnh kiểm: ${req.body?.conduct || 'N/A'}`;
    },
  }),
  updateConduct
);

// 🧮 Tính toán hạnh kiểm tự động (Đề xuất)
router.get(
  '/calculate-suggested',
  checkPermission([PERMISSIONS.CONDUCT_VIEW, PERMISSIONS.CONDUCT_ENTER], { checkContext: true }),
  calculateSuggestedConduct
);

// ✅ Phê duyệt hạnh kiểm (BGH)
router.post(
  '/:id/approve',
  checkPermission(PERMISSIONS.CONDUCT_VIEW, { checkContext: true }),
  auditLog({
    action: 'APPROVE_CONDUCT',
    resource: 'Hạnh kiểm',
    getResourceId: (req) => req.params.id,
    getDescription: async (req) => {
      const action = req.body?.action || 'approve';
      const actionMap = {
        approve: 'Phê duyệt',
        reject: 'Từ chối',
        lock: 'Chốt'
      };
      return `${actionMap[action] || 'Phê duyệt'} hạnh kiểm: ${req.params.id}`;
    },
  }),
  approveConduct
);

// ✅ Phê duyệt hàng loạt hạnh kiểm (BGH)
router.post(
  '/approve/bulk',
  checkPermission(PERMISSIONS.CONDUCT_VIEW, { checkContext: true }),
  auditLog({
    action: 'APPROVE_CONDUCT_BULK',
    resource: 'Hạnh kiểm',
    getDescription: async (req) => {
      const action = req.body?.action || 'approve';
      const year = req.body?.year || 'ALL';
      const semester = req.body?.semester || 'ALL';
      const actionMap = {
        approve: 'Phê duyệt hàng loạt',
        lock: 'Chốt hàng loạt'
      };
      return `${actionMap[action] || 'Phê duyệt hàng loạt'} hạnh kiểm - Năm học: ${year}, Học kỳ: ${semester}`;
    },
  }),
  bulkApproveConducts
);

// 📋 Lấy danh sách hạnh kiểm chờ phê duyệt (BGH)
router.get(
  '/pending/list',
  checkPermission(PERMISSIONS.CONDUCT_VIEW, { checkContext: true }),
  getPendingConducts
);

// 📝 Cập nhật nhận xét cuối năm của GVCN
router.put(
  '/year-note/update',
  checkPermission([
    PERMISSIONS.CONDUCT_ENTER,
    PERMISSIONS.CONDUCT_VIEW
  ], { checkContext: true }),
  auditLog({
    action: 'UPDATE',
    resource: 'STUDENT_YEAR_NOTE',
    getDescription: async (req) => {
      const studentId = req.body?.studentId;
      const year = req.body?.year || 'N/A';
      const studentName = await getStudentName(studentId);
      return `Cập nhật nhận xét cuối năm: Học sinh ${studentName}, Năm học ${year}`;
    },
  }),
  updateYearNote
);

// ✔ Phê duyệt tất cả
router.post('/approve-all', approveAllConduct);
module.exports = router;

















