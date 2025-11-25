const express = require('express');
const router = express.Router();

const gradeController = require('../../controllers/grade/gradesController');
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');
const checkGradeEntryPeriod = require('../../middlewares/checkGradeEntryPeriod');
const { auditLog } = require('../../middlewares/auditLogMiddleware');
const { getStudentName, getSubjectName, getClassName, getComponentLabel } = require('../../utils/auditLogHelpers');

// ✅ Thêm hoặc cập nhật điểm (1 học sinh, 1 cột điểm) - GVBM (môn mình dạy) hoặc Admin
// ✅ Không check context ở middleware, để controller tự kiểm tra TeachingAssignment
router.post('/items', 
  authMiddleware, 
  checkPermission([PERMISSIONS.GRADE_ENTER, PERMISSIONS.GRADE_VIEW], { checkContext: false }), 
  checkGradeEntryPeriod,
  auditLog({
    action: 'CREATE',
    resource: 'GRADE',
    getDescription: async (req) => {
      const studentId = req.body?.studentId;
      const subjectId = req.body?.subjectId;
      const component = req.body?.component || 'N/A';
      const score = req.body?.score ?? 'N/A';
      const classId = req.body?.classId;
      const schoolYear = req.body?.schoolYear || 'N/A';
      const semester = req.body?.semester || 'N/A';
      
      // Lấy tên từ database
      const [studentName, subjectName, className] = await Promise.all([
        getStudentName(studentId),
        getSubjectName(subjectId),
        getClassName(classId),
      ]);
      
      const componentLabel = getComponentLabel(component);
      return `Nhập điểm: Điểm ${score} cho học sinh ${studentName}, Môn ${subjectName} (${componentLabel}), Lớp ${className}, ${schoolYear} - HK${semester}`;
    },
  }),
  gradeController.upsertGradeItem
);

// ✅ Xóa tất cả điểm của một component cho học sinh - GVBM (môn mình dạy) hoặc Admins
router.delete('/items', 
  authMiddleware, 
  checkPermission([PERMISSIONS.GRADE_ENTER, PERMISSIONS.GRADE_VIEW], { checkContext: false }),
  auditLog({
    action: 'DELETE',
    resource: 'GRADE',
    getDescription: async (req) => {
      const studentId = req.body?.studentId || req.query?.studentId;
      const subjectId = req.body?.subjectId || req.query?.subjectId;
      const component = req.body?.component || req.query?.component || 'N/A';
      
      const [studentName, subjectName] = await Promise.all([
        getStudentName(studentId),
        getSubjectName(subjectId),
      ]);
      
      const componentLabel = getComponentLabel(component);
      return `Xóa điểm: Học sinh ${studentName}, Môn ${subjectName}, ${componentLabel}`;
    },
  }),
  gradeController.deleteGradeItems
);

// ✅ Lưu mảng điểm cho một component - GVBM (môn mình dạy) hoặc Admin
router.post('/items/bulk', 
  authMiddleware, 
  checkPermission([PERMISSIONS.GRADE_ENTER, PERMISSIONS.GRADE_VIEW], { checkContext: false }), 
  checkGradeEntryPeriod,
  auditLog({
    action: 'CREATE',
    resource: 'GRADE',
    getDescription: async (req) => {
      const scores = req.body?.scores || [];
      const studentId = req.body?.studentId;
      const subjectId = req.body?.subjectId;
      const component = req.body?.component || 'N/A';
      const classId = req.body?.classId;
      const schoolYear = req.body?.schoolYear || 'N/A';
      const semester = req.body?.semester || 'N/A';
      
      // Lấy tên từ database
      const [studentName, subjectName, className] = await Promise.all([
        getStudentName(studentId),
        getSubjectName(subjectId),
        getClassName(classId),
      ]);
      
      const componentLabel = getComponentLabel(component);
      return `Nhập điểm hàng loạt: ${scores.length} điểm ${componentLabel} cho học sinh ${studentName}, Môn ${subjectName}, Lớp ${className}, ${schoolYear} - HK${semester}`;
    },
  }),
  gradeController.upsertGradeItems
);

// ✅ Lấy bảng tổng hợp điểm của 1 lớp + môn học - Tất cả roles có quyền xem
// ✅ Không check context ở middleware, để frontend tự kiểm tra
router.get('/summary', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.GRADE_VIEW,
    PERMISSIONS.GRADE_VIEW_ALL,
    PERMISSIONS.GRADE_VIEW_DEPARTMENT,
    PERMISSIONS.GRADE_VIEW_HOMEROOM,
    PERMISSIONS.GRADE_VIEW_TEACHING,
    PERMISSIONS.GRADE_VIEW_SELF
  ], { checkContext: false }),
  gradeController.getClassSubjectSummary
);

// ✅ Tính lại điểm tổng hợp - Chỉ Admin
router.post('/recompute', 
  authMiddleware, 
  checkPermission(PERMISSIONS.GRADE_VIEW), 
  gradeController.recomputeSummary
);

// ✅ Lưu điểm nhiều học sinh cùng lúc - GVBM (môn mình dạy) hoặc Admin
// ✅ Không check context ở middleware, để controller tự kiểm tra TeachingAssignment
router.post('/save', 
  authMiddleware, 
  checkPermission([PERMISSIONS.GRADE_ENTER, PERMISSIONS.GRADE_VIEW], { checkContext: false }), 
  checkGradeEntryPeriod,
  auditLog({
    action: 'CREATE',
    resource: 'GRADE',
    getDescription: async (req) => {
      const scores = req.body?.scores || [];
      const subjectId = req.body?.subjectId;
      const classId = req.body?.classId;
      const schoolYear = req.body?.schoolYear || 'N/A';
      const semester = req.body?.semester || 'N/A';
      
      // Đếm tổng số điểm và các loại component (mỗi học sinh có thể có nhiều component)
      let totalScores = 0;
      const componentCounts = {};
      scores.forEach((s) => {
        if (s.components && Array.isArray(s.components)) {
          s.components.forEach((c) => {
            totalScores++;
            const compLabel = getComponentLabel(c.component);
            componentCounts[compLabel] = (componentCounts[compLabel] || 0) + 1;
          });
        }
      });
      
      // Tạo chuỗi mô tả các loại điểm
      const componentSummary = Object.entries(componentCounts)
        .map(([label, count]) => `${count} ${label}`)
        .join(', ');
      
      // Lấy tên từ database
      const [subjectName, className] = await Promise.all([
        getSubjectName(subjectId),
        getClassName(classId),
      ]);
      
      return `Lưu điểm nhiều học sinh: ${totalScores} điểm (${componentSummary}) cho ${scores.length} học sinh, Môn ${subjectName}, Lớp ${className}, ${schoolYear} - HK${semester}`;
    },
  }),
  gradeController.saveScores
);

// ✅ Học sinh xem điểm của bản thân
router.get('/student', 
  authMiddleware, 
  checkPermission(PERMISSIONS.GRADE_VIEW_SELF, { checkContext: true }), 
  gradeController.getStudentGrades
);

// ✅ Khởi tạo bảng điểm cho tất cả lớp - Chỉ Admin
router.post('/init', 
  authMiddleware, 
  checkPermission(PERMISSIONS.GRADE_VIEW), 
  gradeController.initGradeTable
);

// ✅ Admin/BGH xem tất cả điểm của tất cả học sinh
router.get('/admin/all', 
  authMiddleware, 
  checkPermission([PERMISSIONS.GRADE_VIEW_ALL, PERMISSIONS.GRADE_VIEW], { checkContext: false }), 
  gradeController.getAllStudentsGrades
);

// ✅ Thống kê điểm theo lớp/khối/năm học
router.get('/admin/statistics', 
  authMiddleware, 
  checkPermission([PERMISSIONS.GRADE_VIEW_ALL, PERMISSIONS.GRADE_VIEW], { checkContext: false }), 
  gradeController.getStatistics
);

// ✅ Lịch sử nhập/sửa điểm
router.get('/admin/audit-log', 
  authMiddleware, 
  checkPermission([PERMISSIONS.GRADE_VIEW_ALL, PERMISSIONS.GRADE_VIEW], { checkContext: false }), 
  gradeController.getAuditLog
);

// ✅ Admin cập nhật điểm
router.put('/admin/item/:id', 
  authMiddleware, 
  checkPermission(PERMISSIONS.GRADE_VIEW, { checkContext: false }),
  auditLog({
    action: 'UPDATE',
    resource: 'GRADE',
    getResourceId: (req) => req.params.id,
    getDescription: async (req) => {
      // Lấy thông tin điểm trước khi cập nhật
      try {
        const GradeItem = require('../../models/grade/gradeItem');
        const gradeItem = await GradeItem.findById(req.params.id)
          .populate('studentId', 'name studentCode')
          .populate('subjectId', 'name')
          .populate('classId', 'className')
          .lean();
        
        if (gradeItem) {
          const studentName = gradeItem.studentId ? `${gradeItem.studentId.name} (${gradeItem.studentId.studentCode || ''})` : 'N/A';
          const subjectName = gradeItem.subjectId?.name || 'N/A';
          const className = gradeItem.classId?.className || 'N/A';
          const component = gradeItem.component || 'N/A';
          const componentLabel = getComponentLabel(component);
          const oldScore = gradeItem.score ?? 'N/A';
          const newScore = req.body?.score ?? 'N/A';
          return `Admin sửa điểm: Học sinh ${studentName}, Môn ${subjectName}, Lớp ${className}, ${componentLabel}, Điểm cũ: ${oldScore} → Điểm mới: ${newScore}`;
        }
      } catch (e) {
        // Ignore error
      }
      return `Admin sửa điểm: ${req.params.id}, Điểm mới: ${req.body?.score || 'N/A'}`;
    },
  }),
  gradeController.updateGradeItem
);

// ✅ Admin xóa điểm
router.delete('/admin/item/:id', 
  authMiddleware, 
  checkPermission(PERMISSIONS.GRADE_VIEW, { checkContext: false }),
  auditLog({
    action: 'DELETE',
    resource: 'GRADE',
    getResourceId: (req) => req.params.id,
    getDescription: async (req) => {
      // Lấy thông tin điểm trước khi xóa
      try {
        const GradeItem = require('../../models/grade/gradeItem');
        const gradeItem = await GradeItem.findById(req.params.id)
          .populate('studentId', 'name studentCode')
          .populate('subjectId', 'name')
          .populate('classId', 'className')
          .lean();
        
        if (gradeItem) {
          const studentName = gradeItem.studentId ? `${gradeItem.studentId.name} (${gradeItem.studentId.studentCode || ''})` : 'N/A';
          const subjectName = gradeItem.subjectId?.name || 'N/A';
          const className = gradeItem.classId?.className || 'N/A';
          const score = gradeItem.score ?? 'N/A';
          const component = gradeItem.component || 'N/A';
          const componentLabel = getComponentLabel(component);
          return `Admin xóa điểm: Học sinh ${studentName}, Môn ${subjectName}, Lớp ${className}, ${componentLabel}, Điểm ${score}`;
        }
      } catch (e) {
        // Ignore error
      }
      return `Admin xóa điểm: ${req.params.id}`;
    },
  }),
  gradeController.deleteGradeItem
);

// ✅ GVCN xem tất cả điểm của lớp chủ nhiệm (tất cả môn)
router.get('/homeroom/all', 
  authMiddleware, 
  checkPermission([PERMISSIONS.GRADE_VIEW_HOMEROOM, PERMISSIONS.GRADE_VIEW_ALL], { checkContext: true }), 
  gradeController.getHomeroomClassAllGrades
);

// ✅ GVCN xem điểm trung bình từng môn, điểm TB học kỳ/năm của học sinh
router.get('/homeroom/averages', 
  authMiddleware, 
  checkPermission([PERMISSIONS.GRADE_VIEW_HOMEROOM, PERMISSIONS.GRADE_VIEW_ALL], { checkContext: true }), 
  gradeController.getHomeroomClassAverages
);

// ✅ GVCN xem hạnh kiểm và kết quả xếp loại học tập của lớp
router.get('/homeroom/classification', 
  authMiddleware, 
  checkPermission([PERMISSIONS.GRADE_VIEW_HOMEROOM, PERMISSIONS.CONDUCT_VIEW, PERMISSIONS.GRADE_VIEW_ALL], { checkContext: true }), 
  gradeController.getHomeroomClassClassification
);

module.exports = router;
