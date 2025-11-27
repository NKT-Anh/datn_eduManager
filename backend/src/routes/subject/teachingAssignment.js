const teachingAssignmentController = require('../../controllers/subject/teachingAssignmentController');
const autoAssignTeachingController = require('../../controllers/subject/autoAssignTeachingController');
const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');
const { auditLog } = require('../../middlewares/auditLogMiddleware');
const { getTeacherName, getSubjectName, getClassName } = require('../../utils/auditLogHelpers');

// ✅ Tạo phân công giảng dạy - Admin hoặc Trưởng bộ môn (cho giáo viên trong tổ)
router.post('/', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.TEACHING_ASSIGNMENT_CREATE,
    PERMISSIONS.DEPARTMENT_ASSIGN_TEACHING
  ]),
  auditLog({
    action: 'CREATE',
    resource: 'TEACHING_ASSIGNMENT',
    getDescription: async (req) => {
      const teacherId = req.body?.teacherId;
      const subjectId = req.body?.subjectId;
      const classId = req.body?.classId;
      
      const [teacherName, subjectName, className] = await Promise.all([
        getTeacherName(teacherId),
        getSubjectName(subjectId),
        getClassName(classId),
      ]);
      
      return `Tạo phân công giảng dạy: Giáo viên ${teacherName} - Môn ${subjectName} - Lớp ${className}`;
    },
  }),
  teachingAssignmentController.createAssignment
);

// ✅ Danh sách phân công giảng dạy - Tất cả roles có quyền xem
router.get('/', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW,
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW_DEPARTMENT,
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW_SELF
  ], { checkContext: false }),
  teachingAssignmentController.getAllAssignments
);

// ✅ Lấy phân công giảng dạy theo giáo viên - Giáo viên xem của mình hoặc Admin/QLBM
router.get('/teacher/:teacherId', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW,
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW_DEPARTMENT,
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW_SELF
  ], { checkContext: false }),
  teachingAssignmentController.getAssignmentsByTeacher
);

// ✅ Cập nhật phân công giảng dạy - Admin hoặc Trưởng bộ môn (cho giáo viên trong tổ)
router.put('/:id', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.TEACHING_ASSIGNMENT_UPDATE,
    PERMISSIONS.DEPARTMENT_ASSIGN_TEACHING
  ]),
  auditLog({
    action: 'UPDATE',
    resource: 'TEACHING_ASSIGNMENT',
    getResourceId: (req) => req.params.id,
    getDescription: async (req) => {
      const teacherId = req.body?.teacherId;
      const subjectId = req.body?.subjectId;
      const classId = req.body?.classId;
      
      const [teacherName, subjectName, className] = await Promise.all([
        getTeacherName(teacherId),
        getSubjectName(subjectId),
        getClassName(classId),
      ]);
      
      return `Cập nhật phân công giảng dạy: Giáo viên ${teacherName} - Môn ${subjectName} - Lớp ${className}`;
    },
  }),
  teachingAssignmentController.updateAssignment
);

// ✅ Kiểm tra số lượng điểm của phân công - Tất cả roles có quyền xem
router.get('/:id/grade-count', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW,
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW_DEPARTMENT,
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW_SELF
  ], { checkContext: false }),
  teachingAssignmentController.getGradeCount
);

// ✅ Xóa phân công giảng dạy - Admin hoặc Trưởng bộ môn (cho giáo viên trong tổ)
router.delete('/:id', 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.TEACHING_ASSIGNMENT_UPDATE,
    PERMISSIONS.DEPARTMENT_ASSIGN_TEACHING
  ]),
  auditLog({
    action: 'DELETE',
    resource: 'TEACHING_ASSIGNMENT',
    getResourceId: (req) => req.params.id,
    getDescription: async (req) => {
      // Lấy thông tin phân công trước khi xóa
      try {
        const TeachingAssignment = require('../../models/subject/teachingAssignment');
        const assignment = await TeachingAssignment.findById(req.params.id)
          .populate('teacherId', 'name')
          .populate('subjectId', 'name')
          .populate('classId', 'className')
          .lean();
        
        if (assignment) {
          const teacherName = assignment.teacherId?.name || 'N/A';
          const subjectName = assignment.subjectId?.name || 'N/A';
          const className = assignment.classId?.className || 'N/A';
          return `Xóa phân công giảng dạy: Giáo viên ${teacherName} - Môn ${subjectName} - Lớp ${className}`;
        }
      } catch (e) {
        // Ignore error
      }
      return `Xóa phân công giảng dạy: ${req.params.id}`;
    },
  }),
  teachingAssignmentController.deleteAssignment
);

// ✅ Tạo nhiều phân công giảng dạy - Chỉ Admin
router.post("/bulk", 
  authMiddleware, 
  checkPermission(PERMISSIONS.TEACHING_ASSIGNMENT_CREATE), 
  teachingAssignmentController.createBulkAssignments
);

// ✅ Kiểm tra môn học thiếu giáo viên - Admin và QLBM có quyền xem
router.get("/check-missing", 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW,
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW_DEPARTMENT
  ], { checkContext: false }),
  teachingAssignmentController.checkMissingTeachers
);

// ✅ Phân công tự động - Chỉ Admin
router.post("/auto-assign", 
  authMiddleware, 
  checkPermission(PERMISSIONS.TEACHING_ASSIGNMENT_CREATE), 
  autoAssignTeachingController.autoAssignTeaching
);

// ✅ Khóa danh sách phân công giảng dạy - Chỉ Admin
router.post("/lock", 
  authMiddleware, 
  checkPermission(PERMISSIONS.TEACHING_ASSIGNMENT_UPDATE), 
  auditLog({
    action: 'LOCK',
    resource: 'TEACHING_ASSIGNMENT',
    getDescription: (req) => `Khóa danh sách phân công giảng dạy: ${req.body.year} - HK${req.body.semester}`,
  }),
  teachingAssignmentController.lockAssignments
);

// ✅ Mở khóa danh sách phân công giảng dạy - Chỉ Admin
router.post("/unlock", 
  authMiddleware, 
  checkPermission(PERMISSIONS.TEACHING_ASSIGNMENT_UPDATE), 
  auditLog({
    action: 'UNLOCK',
    resource: 'TEACHING_ASSIGNMENT',
    getDescription: (req) => `Mở khóa danh sách phân công giảng dạy: ${req.body.year} - HK${req.body.semester}`,
  }),
  teachingAssignmentController.unlockAssignments
);

// ✅ Kiểm tra trạng thái khóa - Tất cả roles có quyền xem
router.get("/lock-status", 
  authMiddleware, 
  checkPermission([
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW,
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW_DEPARTMENT,
    PERMISSIONS.TEACHING_ASSIGNMENT_VIEW_SELF
  ], { checkContext: false }), 
  teachingAssignmentController.getLockStatus
);

// ✅ Công bố phân công giảng dạy - Chỉ Admin
router.post("/publish", 
  authMiddleware, 
  checkPermission(PERMISSIONS.TEACHING_ASSIGNMENT_UPDATE), 
  auditLog({
    action: 'PUBLISH',
    resource: 'TEACHING_ASSIGNMENT',
    getDescription: (req) => `Công bố phân công giảng dạy: ${req.body.year} - HK${req.body.semester}`,
  }),
  teachingAssignmentController.publishAssignments
);

module.exports = router;
