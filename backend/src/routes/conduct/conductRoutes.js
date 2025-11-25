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
  createConduct
} = require('../../controllers/conduct/conductController');

// Tất cả routes đều cần xác thực
router.use(authMiddleware);

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
    resource: 'CONDUCT',
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
    resource: 'CONDUCT',
    getResourceId: (req) => req.params.id,
    getDescription: async (req) => {
      // Lấy thông tin hạnh kiểm trước khi cập nhật
      try {
        const Conduct = require('../../models/conduct/conduct');
        const conduct = await Conduct.findById(req.params.id)
          .populate('studentId', 'name studentCode')
          .lean();
        
        if (conduct) {
          const studentName = conduct.studentId ? `${conduct.studentId.name} (${conduct.studentId.studentCode || ''})` : 'N/A';
          const conductValue = req.body?.conduct || conduct.conduct || 'N/A';
          const hasComment = req.body?.comment ? 'Có' : (conduct.comment ? 'Có' : 'Không');
          return `Nhập/sửa hạnh kiểm: Học sinh ${studentName}, Hạnh kiểm: ${conductValue}, Nhận xét: ${hasComment}`;
        }
      } catch (e) {
        // Ignore error
      }
      return `Nhập/sửa hạnh kiểm: ${req.params.id}, Hạnh kiểm: ${req.body?.conduct || 'N/A'}, Nhận xét: ${req.body?.comment ? 'Có' : 'Không'}`;
    },
  }),
  updateConduct
);

module.exports = router;

















