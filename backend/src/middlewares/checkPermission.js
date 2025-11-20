const { PERMISSIONS, hasPermission, hasAnyPermission, hasAllPermissions } = require('../config/permissions');
const Account = require('../models/user/account');
const Teacher = require('../models/user/teacher');
const Student = require('../models/user/student');

/**
 * ✅ Middleware kiểm tra quyền truy cập
 * 
 * @param {string|string[]} requiredPermissions - Permission(s) cần kiểm tra
 * @param {object} options - Tùy chọn:
 *   - requireAll: boolean - Nếu true, cần tất cả permissions, nếu false chỉ cần 1
 *   - checkContext: boolean - Kiểm tra context (lớp chủ nhiệm, môn dạy, etc.)
 */
module.exports = (requiredPermissions, options = {}) => {
  const { requireAll = false, checkContext = true } = options;
  const permissions = Array.isArray(requiredPermissions) 
    ? requiredPermissions 
    : [requiredPermissions];

  return async (req, res, next) => {
    try {
      // ✅ Lấy user từ authMiddleware hoặc verifyFirebaseToken
      let userInfo = req.user;
      if (!userInfo && req.firebaseUser) {
        // Nếu dùng verifyFirebaseToken, cần lấy account
        const Account = require('../models/user/account');
        const account = await Account.findOne({ uid: req.firebaseUser.uid });
        if (account) {
          userInfo = {
            uid: req.firebaseUser.uid,
            accountId: account._id,
            role: account.role,
            email: account.email,
            phone: account.phone
          };
        }
      }
      
      if (!userInfo || !userInfo.role) {
        return res.status(401).json({ error: 'Chưa xác thực' });
      }

      const userRole = userInfo.role;
      const accountId = userInfo.accountId;
      
      // Gắn lại vào req.user để các phần khác sử dụng
      req.user = userInfo;

      // ✅ Kiểm tra permission cơ bản
      // Nếu là teacher, cần kiểm tra thêm các flags (isHomeroom, isDepartmentHead, isLeader)
      let hasAccess = false;
      
      if (userRole === 'teacher') {
        // Lấy thông tin teacher để kiểm tra flags
        const Teacher = require('../models/user/teacher');
        const teacher = await Teacher.findOne({ accountId }).lean();
        
        if (teacher) {
          // Kiểm tra quyền dựa trên flags
          // 1. Quyền cơ bản của teacher
          let teacherHasAccess = requireAll
            ? hasAllPermissions('teacher', permissions)
            : hasAnyPermission('teacher', permissions);
          
          // 2. Nếu là BGH (isLeader), có quyền xem tất cả (giống BGH cũ)
          if (teacher.isLeader) {
            // BGH có quyền xem tất cả (tương đương với quyền của BGH cũ)
            const bghPermissions = [
              PERMISSIONS.YEAR_VIEW,
              PERMISSIONS.CLASS_VIEW,
              PERMISSIONS.STUDENT_VIEW,
              PERMISSIONS.TEACHER_VIEW,
              PERMISSIONS.SUBJECT_VIEW,
              PERMISSIONS.TEACHING_ASSIGNMENT_VIEW,
              PERMISSIONS.SCHEDULE_VIEW_ALL,
              PERMISSIONS.GRADE_VIEW_ALL,
              PERMISSIONS.CONDUCT_VIEW,
              PERMISSIONS.EXAM_VIEW,
              PERMISSIONS.EXAM_ROOM_VIEW,
              PERMISSIONS.EXAM_PRINT_TICKET,
              PERMISSIONS.ROOM_VIEW,
              PERMISSIONS.EXAM_ROOM_VIEW_MANAGE,
              PERMISSIONS.INCIDENT_VIEW,
              PERMISSIONS.INCIDENT_HANDLE,
              PERMISSIONS.NOTIFICATION_CREATE,
              PERMISSIONS.NOTIFICATION_UPDATE,
              PERMISSIONS.NOTIFICATION_VIEW,
              PERMISSIONS.DASHBOARD_VIEW_ALL,
            ];
            const bghHasAccess = requireAll
              ? permissions.every(p => bghPermissions.includes(p))
              : permissions.some(p => bghPermissions.includes(p));
            teacherHasAccess = teacherHasAccess || bghHasAccess;
          }
          
          // 3. Nếu là Trưởng bộ môn (isDepartmentHead), có quyền quản lý tổ
          // ✅ Quyền: Dạy + quản lý tổ (phân công môn/lớp, giám sát giáo viên trong tổ)
          if (teacher.isDepartmentHead) {
            const deptHeadPermissions = [
              PERMISSIONS.DEPARTMENT_VIEW,
              PERMISSIONS.DEPARTMENT_MANAGE,
              PERMISSIONS.DEPARTMENT_ASSIGN_TEACHING, // ✅ Phân công môn/lớp cho giáo viên trong tổ
              PERMISSIONS.DEPARTMENT_SUPERVISE, // ✅ Giám sát giáo viên trong tổ
              PERMISSIONS.TEACHER_VIEW_DEPARTMENT,
              PERMISSIONS.TEACHER_VIEW,
              PERMISSIONS.SUBJECT_VIEW,
              PERMISSIONS.SUBJECT_MANAGE_DEPARTMENT,
              PERMISSIONS.TEACHING_ASSIGNMENT_VIEW_DEPARTMENT,
              PERMISSIONS.TEACHING_ASSIGNMENT_CREATE, // ✅ Có thể tạo phân công cho giáo viên trong tổ
              PERMISSIONS.TEACHING_ASSIGNMENT_UPDATE, // ✅ Có thể cập nhật phân công cho giáo viên trong tổ
              PERMISSIONS.SCHEDULE_VIEW_DEPARTMENT,
              PERMISSIONS.CLASS_VIEW,
              PERMISSIONS.STUDENT_VIEW,
              PERMISSIONS.GRADE_VIEW,
              PERMISSIONS.GRADE_VIEW_DEPARTMENT,
              PERMISSIONS.EXAM_VIEW_DEPARTMENT,
              PERMISSIONS.DASHBOARD_VIEW_DEPARTMENT,
            ];
            const deptHeadHasAccess = requireAll
              ? permissions.every(p => deptHeadPermissions.includes(p))
              : permissions.some(p => deptHeadPermissions.includes(p));
            teacherHasAccess = teacherHasAccess || deptHeadHasAccess;
          }
          
          // 4. Nếu là Giáo viên chủ nhiệm (isHomeroom), có quyền quản lý lớp
          // ✅ Quyền: Dạy + quản lý lớp chủ nhiệm
          if (teacher.isHomeroom || teacher.currentHomeroomClassId) {
            const homeroomPermissions = [
              PERMISSIONS.CLASS_VIEW_HOMEROOM,
              PERMISSIONS.CLASS_UPDATE, // ✅ Có thể cập nhật thông tin lớp chủ nhiệm
              PERMISSIONS.STUDENT_VIEW_HOMEROOM,
              PERMISSIONS.STUDENT_UPDATE, // ✅ Có thể cập nhật thông tin học sinh lớp chủ nhiệm
              PERMISSIONS.SCHEDULE_VIEW_HOMEROOM,
              PERMISSIONS.GRADE_VIEW_HOMEROOM,
              PERMISSIONS.CONDUCT_ENTER,
              PERMISSIONS.CONDUCT_VIEW,
              PERMISSIONS.EXAM_VIEW_HOMEROOM,
              PERMISSIONS.EXAM_PRINT_TICKET_HOMEROOM,
              PERMISSIONS.INCIDENT_VIEW_HOMEROOM,
              PERMISSIONS.INCIDENT_HANDLE, // ✅ Có thể xử lý sự cố trong lớp chủ nhiệm
              PERMISSIONS.NOTIFICATION_SEND_HOMEROOM,
              PERMISSIONS.NOTIFICATION_CREATE, // ✅ Có thể tạo thông báo cho lớp chủ nhiệm
              PERMISSIONS.DASHBOARD_VIEW_HOMEROOM,
            ];
            const homeroomHasAccess = requireAll
              ? permissions.every(p => homeroomPermissions.includes(p))
              : permissions.some(p => homeroomPermissions.includes(p));
            teacherHasAccess = teacherHasAccess || homeroomHasAccess;
          }
          
          // 5. Kiểm tra permissions bổ sung
          const hasCustomPermission = teacher.permissions && teacher.permissions.length > 0
            ? (requireAll 
                ? permissions.every(p => teacher.permissions.includes(p))
                : permissions.some(p => teacher.permissions.includes(p)))
            : false;
          
          hasAccess = teacherHasAccess || hasCustomPermission;
        } else {
          // Nếu không tìm thấy teacher, chỉ kiểm tra role cơ bản
          hasAccess = requireAll
            ? hasAllPermissions(userRole, permissions)
            : hasAnyPermission(userRole, permissions);
        }
      } else {
        // Admin và Student: kiểm tra permission bình thường
        hasAccess = requireAll
          ? hasAllPermissions(userRole, permissions)
          : hasAnyPermission(userRole, permissions);
      }

      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Không có quyền truy cập',
          required: permissions,
          role: userRole
        });
      }

      // ✅ Kiểm tra context nếu cần (lớp chủ nhiệm, môn dạy, etc.)
      if (checkContext) {
        const contextCheck = await checkContextPermissions(
          userRole,
          accountId,
          permissions,
          req
        );

        if (!contextCheck.allowed) {
          return res.status(403).json({ 
            error: contextCheck.message || 'Không có quyền truy cập trong context này',
            context: contextCheck.context
          });
        }

        // ✅ Gắn thông tin context vào request để controller sử dụng
        req.permissionContext = contextCheck.context;
      }

      next();
    } catch (error) {
      console.error('❌ [Permission Check Error]:', error);
      res.status(500).json({ error: 'Lỗi kiểm tra quyền truy cập' });
    }
  };
};

/**
 * ✅ Kiểm tra quyền theo context (lớp chủ nhiệm, môn dạy, etc.)
 */
async function checkContextPermissions(role, accountId, permissions, req) {
  // ✅ Admin có quyền tất cả
  if (role === 'admin') {
    return { allowed: true, context: { role } };
  }

  // ✅ Lấy thông tin user chi tiết
  let user = null;
  if (role === 'teacher') {
    // Tìm Teacher qua accountId
    user = await Teacher.findOne({ accountId })
      .populate('homeroomClassIds')
      .populate('currentHomeroomClassId')
      .populate('subjects.subjectId');
  } else if (role === 'student') {
    user = await Student.findOne({ accountId })
      .populate('classId');
  }

  // ✅ Nếu không tìm thấy user chi tiết, vẫn cho phép nếu là admin
  if (!user && role === 'admin') {
    return { allowed: true, context: { role } };
  }

  if (!user && role !== 'admin') {
    return { allowed: false, message: 'Không tìm thấy thông tin người dùng' };
  }

  const context = {
    role,
    userId: user?._id,
    accountId,
    // Thêm flags của teacher vào context
    isHomeroom: user?.isHomeroom || false,
    isDepartmentHead: user?.isDepartmentHead || false,
    isLeader: user?.isLeader || false,
  };

  // ✅ Kiểm tra từng permission với context
  for (const permission of permissions) {
    const check = await checkSinglePermissionContext(permission, role, user, req, context);
    if (!check.allowed) {
      return check;
    }
  }

  return { allowed: true, context };
}

/**
 * ✅ Kiểm tra một permission cụ thể với context
 */
async function checkSinglePermissionContext(permission, role, user, req, context) {
  // ✅ Quyền xem lớp chủ nhiệm
  if (permission.includes('homeroom')) {
    if (role === 'teacher' && user.isHomeroom) {
      if (!user) return { allowed: false, message: 'Không tìm thấy thông tin giáo viên' };
      
      const classId = req.params.classId || req.query.classId || req.body.classId;
      if (classId) {
        const homeroomIds = user.homeroomClassIds || [];
        const hasHomeroom = homeroomIds.some(
          id => String(id._id || id) === String(classId)
        );
        if (!hasHomeroom) {
          return { 
            allowed: false, 
            message: 'Không phải lớp chủ nhiệm của bạn',
            context: { ...context, classId }
          };
        }
        context.homeroomClassIds = homeroomIds.map(id => String(id._id || id));
      } else {
        // Nếu không có classId, lưu tất cả lớp chủ nhiệm
        context.homeroomClassIds = (user.homeroomClassIds || []).map(id => String(id._id || id));
      }
    } else if (role === 'teacher' && !user.isHomeroom) {
      return { allowed: false, message: 'Bạn không phải giáo viên chủ nhiệm' };
    }
  }

  // ✅ Quyền xem lớp đang dạy
  if (permission.includes('teaching')) {
    if (role === 'teacher') {
      if (!user) return { allowed: false, message: 'Không tìm thấy thông tin giáo viên' };
      
      const classId = req.params.classId || req.query.classId || req.body.classId;
      if (classId) {
        // Kiểm tra xem giáo viên có dạy lớp này không (qua TeachingAssignment)
        // Tạm thời cho phép, sẽ kiểm tra chi tiết sau
        context.teachingClassIds = (user.classIds || []).map(id => String(id._id || id));
      } else {
        context.teachingClassIds = (user.classIds || []).map(id => String(id._id || id));
      }
    }
  }

  // ✅ Quyền xem môn dạy
  if (permission.includes('teaching') || permission.includes('subject')) {
    if (role === 'teacher') {
      if (!user) return { allowed: false, message: 'Không tìm thấy thông tin giáo viên' };
      
      const subjectId = req.params.subjectId || req.query.subjectId || req.body.subjectId;
      if (subjectId) {
        const subjects = user.subjects || [];
        const teachesSubject = subjects.some(
          sub => String(sub.subjectId?._id || sub.subjectId) === String(subjectId)
        );
        // Trưởng bộ môn có thể xem tất cả môn trong tổ
        if (!teachesSubject && !user.isDepartmentHead) {
          return { 
            allowed: false, 
            message: 'Bạn không dạy môn này',
            context: { ...context, subjectId }
          };
        }
        context.subjectIds = subjects.map(sub => String(sub.subjectId?._id || sub.subjectId));
      } else {
        context.subjectIds = (user.subjects || []).map(sub => String(sub.subjectId?._id || sub.subjectId));
      }
    }
  }

  // ✅ Quyền xem bản thân (student)
  if (permission.includes('self')) {
    if (role === 'student') {
      if (!user) return { allowed: false, message: 'Không tìm thấy thông tin học sinh' };
      
      const studentId = req.params.studentId || req.query.studentId || req.body.studentId;
      if (studentId && String(user._id) !== String(studentId)) {
        return { 
          allowed: false, 
          message: 'Chỉ có thể xem thông tin của chính mình',
          context: { ...context, studentId }
        };
      }
      context.studentId = user._id;
      context.classId = user.classId ? String(user.classId._id || user.classId) : null;
    }
  }

  // ✅ Quyền xem/quản lý bộ môn (Trưởng bộ môn)
  if (permission.includes('department')) {
    if (role === 'teacher' && user.isDepartmentHead) {
      // Trưởng bộ môn có thể xem/quản lý tất cả môn trong tổ của mình
      context.departmentSubjects = user.subjects?.map(sub => String(sub.subjectId?._id || sub.subjectId)) || [];
      context.departmentId = user.departmentId ? String(user.departmentId._id || user.departmentId) : null;
      
      // ✅ Trưởng bộ môn có thể phân công môn/lớp cho giáo viên trong tổ
      if (permission === PERMISSIONS.DEPARTMENT_ASSIGN_TEACHING) {
        // Kiểm tra xem giáo viên được phân công có thuộc tổ không
        const targetTeacherId = req.params.teacherId || req.query.teacherId || req.body.teacherId;
        if (targetTeacherId && context.departmentId) {
          const Teacher = require('../models/user/teacher');
          const targetTeacher = await Teacher.findById(targetTeacherId).lean();
          if (targetTeacher && targetTeacher.departmentId) {
            const targetDeptId = String(targetTeacher.departmentId._id || targetTeacher.departmentId);
            if (targetDeptId !== context.departmentId) {
              return { 
                allowed: false, 
                message: 'Giáo viên này không thuộc tổ bộ môn của bạn',
                context: { ...context, targetTeacherId }
              };
            }
          }
        }
      }
    } else if (role === 'teacher' && !user.isDepartmentHead) {
      return { allowed: false, message: 'Bạn không phải trưởng bộ môn' };
    }
  }

  return { allowed: true, context };
}

