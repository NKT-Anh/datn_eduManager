const express = require('express');
const router = express.Router();

const gradeController = require('../../controllers/grade/gradesController');
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');
const checkGradeEntryPeriod = require('../../middlewares/checkGradeEntryPeriod');
const { auditLog } = require('../../middlewares/auditLogMiddleware');
const { getStudentName, getSubjectName, getClassName, getComponentLabel } = require('../../utils/auditLogHelpers');
const Schedule = require('../../models/subject/schedule');
const TeacherModel = require('../../models/user/teacher');

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
      return `Nhập điểm: ${scores.length} điểm ${componentLabel} cho học sinh ${studentName}, Môn ${subjectName}, Lớp ${className}, ${schoolYear} - HK${semester}`;
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

// ✅ Điểm TB học kỳ theo học sinh của lớp (cho GVBM/GVCN/Admin)
router.get('/class/semester-gpa',
  authMiddleware,
  checkPermission([
    PERMISSIONS.GRADE_VIEW,
    PERMISSIONS.GRADE_VIEW_ALL,
    PERMISSIONS.GRADE_VIEW_DEPARTMENT,
    PERMISSIONS.GRADE_VIEW_HOMEROOM,
    PERMISSIONS.GRADE_VIEW_TEACHING,
  ], { checkContext: false }),
  gradeController.getClassSemesterGPA
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

// ✅ GVBM công bố điểm môn học cho lớp/học kỳ (hoặc Admin)
router.post('/publish',
  authMiddleware,
  checkPermission([PERMISSIONS.GRADE_ENTER, PERMISSIONS.GRADE_VIEW], { checkContext: false }),
  auditLog({
    action: 'UPDATE',
    resource: 'GRADE_PUBLISH',
    getDescription: async (req) => {
      const { classId, subjectId, schoolYear, semester } = req.body || {};
      const [subjectName, className] = await Promise.all([
        getSubjectName(subjectId),
        getClassName(classId),
      ]);
      return `Công bố điểm: Môn ${subjectName}, Lớp ${className}, ${schoolYear} - HK${semester}`;
    }
  }),
  gradeController.publishSubject
);

// ✅ Công bố điểm cho 1 học sinh - GVBM (môn mình dạy) hoặc Admin
router.post('/publish-student',
  authMiddleware,
  checkPermission([PERMISSIONS.GRADE_ENTER, PERMISSIONS.GRADE_VIEW], { checkContext: false }),
  auditLog({
    action: 'UPDATE',
    resource: 'GRADE_PUBLISH',
    getDescription: async (req) => {
      const { studentId, subjectId, schoolYear, semester } = req.body || {};
      const [studentName, subjectName] = await Promise.all([
        getStudentName(studentId),
        getSubjectName(subjectId),
      ]);
      return `Công bố điểm học sinh: ${studentName}, Môn ${subjectName}, ${schoolYear} - HK${semester}`;
    },
  }),
  gradeController.publishStudentGrade
);

// ✅ GVCN/Admin: Xét học lực lớp chủ nhiệm theo học kỳ/năm
router.post('/homeroom/evaluate-academic',
  authMiddleware,
  checkPermission([PERMISSIONS.GRADE_VIEW_HOMEROOM, PERMISSIONS.GRADE_VIEW_ALL], { checkContext: true }),
  auditLog({
    action: 'UPDATE',
    resource: 'ACADEMIC_EVALUATION',
    getDescription: async (req) => {
      const { classId, schoolYear, semester } = req.body || {};
      const className = await getClassName(classId);
      return `Xét học lực: Lớp ${className}, ${schoolYear} - ${semester === 'CN' ? 'Cả năm' : 'HK' + semester}`;
    }
  }),
  gradeController.evaluateHomeroomAcademicLevel
);

// ✅ Admin/BGH: Xét học lực cho một học sinh
router.post('/evaluate-student-academic',
  authMiddleware,
  checkPermission([PERMISSIONS.GRADE_VIEW_ALL, PERMISSIONS.GRADE_VIEW_HOMEROOM], { checkContext: false }),
  auditLog({
    action: 'UPDATE',
    resource: 'ACADEMIC_EVALUATION_STUDENT',
    getDescription: async (req) => {
      const { studentId, schoolYear, semester } = req.body || {};
      const studentName = await getStudentName(studentId);
      return `Xét học lực: Học sinh ${studentName}, ${schoolYear} - ${semester === 'CN' ? 'Cả năm' : 'HK' + semester}`;
    }
  }),
  gradeController.evaluateStudentAcademicLevel
);

// ✅ Học sinh xem điểm của bản thân, GVCN xem điểm học sinh lớp chủ nhiệm
router.get('/student', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.GRADE_VIEW_SELF,
    PERMISSIONS.GRADE_VIEW_HOMEROOM
  ], { checkContext: true }), 
  gradeController.getStudentGrades
);

// ✅ Lấy điểm học sinh với so sánh xu hướng (học kỳ trước, năm trước)
router.get('/student/trend', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.GRADE_VIEW_SELF,
    PERMISSIONS.GRADE_VIEW_HOMEROOM,
    PERMISSIONS.GRADE_VIEW_ALL
  ], { checkContext: true }), 
  gradeController.getStudentGradesWithTrend
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

// ✅ Admin/BGH xem tất cả điểm với xu hướng
router.get('/admin/all/trend', 
  authMiddleware, 
  checkPermission([PERMISSIONS.GRADE_VIEW_ALL, PERMISSIONS.GRADE_VIEW], { checkContext: false }), 
  gradeController.getAllStudentsGradesWithTrend
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

// ✅ GVCN xem tất cả điểm của lớp chủ nhiệm với xu hướng
router.get('/homeroom/all/trend', 
  authMiddleware, 
  checkPermission([PERMISSIONS.GRADE_VIEW_HOMEROOM, PERMISSIONS.GRADE_VIEW_ALL], { checkContext: true }), 
  gradeController.getHomeroomClassAllGradesWithTrend
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

// ✅ GVCN tải phiếu kết quả học tập dạng PDF cho học sinh
router.get('/homeroom/report-card/:studentId/pdf',
  authMiddleware,
  checkPermission([PERMISSIONS.GRADE_VIEW_HOMEROOM, PERMISSIONS.GRADE_VIEW_ALL], { checkContext: true }),
  auditLog({
    action: 'EXPORT',
    resource: 'REPORT_CARD',
    getResourceId: (req) => req.params.studentId,
    getDescription: async (req) => {
      const { studentId } = req.params;
      const { classId, schoolYear, semester } = req.query || {};
      const [studentName, className] = await Promise.all([
        getStudentName(studentId),
        getClassName(classId),
      ]);
      const semesterLabel = semester === 'CN' ? 'Cả năm' : `HK${semester || '1'}`;
      return `Tải phiếu kết quả học tập: HS ${studentName}, Lớp ${className}, ${schoolYear} - ${semesterLabel}`;
    }
  }),
  gradeController.exportStudentReportCard
);

// ✅ GVCN tải phiếu kết quả học tập của cả lớp (ZIP)
router.get('/homeroom/report-card/bulk/pdf',
  authMiddleware,
  checkPermission([PERMISSIONS.GRADE_VIEW_HOMEROOM, PERMISSIONS.GRADE_VIEW_ALL], { checkContext: true }),
  auditLog({
    action: 'EXPORT',
    resource: 'REPORT_CARD_BULK',
    getDescription: async (req) => {
      const { classId, schoolYear, semester } = req.query || {};
      const className = await getClassName(classId);
      const semesterLabel = semester === 'CN' ? 'Cả năm' : `HK${semester || '1'}`;
      return `Tải ZIP phiếu kết quả: Lớp ${className}, ${schoolYear} - ${semesterLabel}`;
    }
  }),
  gradeController.exportClassReportCards
);

// ✅ GVBM: Lịch dạy hôm nay (và ngày mai nếu days=2)
router.get('/gvbm/schedule/today',
  authMiddleware,
  checkPermission([PERMISSIONS.GRADE_VIEW_TEACHING, PERMISSIONS.GRADE_VIEW], { checkContext: false }),
  gradeController.getTeacherTodaySchedule
);

module.exports = router;
