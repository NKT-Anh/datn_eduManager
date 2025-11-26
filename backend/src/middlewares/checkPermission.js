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
      // ✅ Admin luôn có tất cả quyền
      if (userRole === 'admin') {
        hasAccess = true;
      } else if (userRole === 'teacher') {
        // Lấy thông tin teacher để kiểm tra flags
          const Teacher = require('../models/user/teacher');
          // compute effective schoolYear: prefer request -> active SchoolYear -> settings -> env
          const SchoolYearModel = require('../models/schoolYear');
          const Setting = require('../models/settings');
          const getEffectiveSchoolYear = async () => {
            const fromReq = (req.headers && (req.headers['x-school-year'] || req.headers['x-school-year-code']))
              || (req.query && (req.query.year || req.query.schoolYear))
              || (req.body && req.body.schoolYear) || null;
            if (fromReq) return String(fromReq);
            // try active SchoolYear
            try {
              const active = await SchoolYearModel.findOne({ isActive: true }).lean();
              if (active && active.code) return String(active.code);
            } catch (e) {
              // ignore and fallback
            }
            // try settings.currentSchoolYear
            try {
              const s = await Setting.findOne().lean();
              if (s && s.currentSchoolYear) return String(s.currentSchoolYear);
            } catch (e) {
              // ignore
            }
            // fallback to env
            return process.env.SCHOOL_YEAR || null;
          };

          const teacher = await Teacher.findOne({ accountId })
            .select('isHomeroom isDepartmentHead isLeader permissions yearRoles currentHomeroomClassId')
            .lean();
        
        if (teacher) {
          // ✅ Xác định năm học hiện tại: ưu tiên header > query > active SchoolYear > settings > env
          // QUAN TRỌNG: Luôn kiểm tra theo năm học hiện tại, KHÔNG dùng lịch sử
          const schoolYear = await getEffectiveSchoolYear();
          let yearRoleEntry = null;
          if (schoolYear && Array.isArray(teacher.yearRoles)) {
            yearRoleEntry = teacher.yearRoles.find(r => r && String(r.schoolYear) === String(schoolYear));
          }

          // ✅ Flags phải dựa trên năm học hiện tại (yearRoleEntry), KHÔNG dùng lịch sử
          // Role gốc (teacher, admin, student) giữ nguyên, nhưng flags thay đổi theo năm học
          // ✅ isLeader được set cứng ở top-level (teacher.isLeader) để BGH luôn truy cập ở mọi năm
          const flags = {
            // ✅ Chỉ kiểm tra flags theo năm học hiện tại (yearRoleEntry)
            // Nếu không có yearRoleEntry cho năm hiện tại → không có flag đó trong năm này
            isHomeroom: yearRoleEntry 
              ? !!yearRoleEntry.isHomeroom 
              : (schoolYear ? false : (!!teacher.isHomeroom || !!teacher.currentHomeroomClassId)), // Nếu không có năm học, fallback về legacy
            isDepartmentHead: yearRoleEntry 
              ? !!yearRoleEntry.isDepartmentHead 
              : (schoolYear ? false : !!teacher.isDepartmentHead), // Nếu không có năm học, fallback về legacy
            // ✅ isLeader CHỈ lấy từ top-level (teacher.isLeader) - BGH được set cứng để luôn truy cập ở mọi năm
            isLeader: !!teacher.isLeader, // Không lấy từ yearRoles
            permissions: yearRoleEntry 
              ? (Array.isArray(yearRoleEntry.permissions) ? yearRoleEntry.permissions : (yearRoleEntry.permissions ? [yearRoleEntry.permissions] : []))
              : (teacher.permissions || []),
            currentHomeroomClassId: yearRoleEntry 
              ? (yearRoleEntry.currentHomeroomClassId || null) 
              : (teacher.currentHomeroomClassId || null)
          };

          // Kiểm tra quyền dựa trên flags
          let teacherHasAccess = requireAll
            ? hasAllPermissions('teacher', permissions)
            : hasAnyPermission('teacher', permissions);

          // BGH
          if (flags.isLeader) {
            const bghPermissions = [
              PERMISSIONS.YEAR_VIEW,
              PERMISSIONS.CLASS_VIEW,
              PERMISSIONS.STUDENT_VIEW,
              PERMISSIONS.TEACHER_VIEW,
              PERMISSIONS.SUBJECT_VIEW,
              PERMISSIONS.DEPARTMENT_VIEW, // ✅ BGH có thể xem tổ bộ môn
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
              PERMISSIONS.ROLE_MANAGE, // ✅ BGH có thể xem settings (read-only)
            ];
            const bghHasAccess = requireAll
              ? permissions.every(p => bghPermissions.includes(p))
              : permissions.some(p => bghPermissions.includes(p));
            teacherHasAccess = teacherHasAccess || bghHasAccess;
          }

          // Trưởng bộ môn
          if (flags.isDepartmentHead) {
            const deptHeadPermissions = [
              PERMISSIONS.DEPARTMENT_VIEW,
              PERMISSIONS.DEPARTMENT_MANAGE,
              PERMISSIONS.DEPARTMENT_ASSIGN_TEACHING,
              PERMISSIONS.DEPARTMENT_SUPERVISE,
              PERMISSIONS.TEACHER_VIEW_DEPARTMENT,
              PERMISSIONS.TEACHER_VIEW,
              PERMISSIONS.SUBJECT_VIEW,
              PERMISSIONS.SUBJECT_MANAGE_DEPARTMENT,
              PERMISSIONS.TEACHING_ASSIGNMENT_VIEW_DEPARTMENT,
              PERMISSIONS.TEACHING_ASSIGNMENT_CREATE,
              PERMISSIONS.TEACHING_ASSIGNMENT_UPDATE,
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

          // Giáo viên chủ nhiệm
          if (flags.isHomeroom) {
            const homeroomPermissions = [
              PERMISSIONS.CLASS_VIEW_HOMEROOM,
              PERMISSIONS.CLASS_UPDATE,
              PERMISSIONS.STUDENT_VIEW_HOMEROOM,
              PERMISSIONS.STUDENT_UPDATE,
              PERMISSIONS.SCHEDULE_VIEW_HOMEROOM,
              PERMISSIONS.GRADE_VIEW_HOMEROOM,
              PERMISSIONS.CONDUCT_ENTER,
              PERMISSIONS.CONDUCT_VIEW,
              PERMISSIONS.EXAM_VIEW_HOMEROOM,
              PERMISSIONS.EXAM_PRINT_TICKET_HOMEROOM,
              PERMISSIONS.INCIDENT_VIEW_HOMEROOM,
              PERMISSIONS.INCIDENT_HANDLE,
              PERMISSIONS.NOTIFICATION_SEND_HOMEROOM,
              PERMISSIONS.NOTIFICATION_CREATE,
              PERMISSIONS.DASHBOARD_VIEW_HOMEROOM,
              PERMISSIONS.ATTENDANCE_CREATE,
              PERMISSIONS.ATTENDANCE_VIEW_CLASS,
            ];
            const homeroomHasAccess = requireAll
              ? permissions.every(p => homeroomPermissions.includes(p))
              : permissions.some(p => homeroomPermissions.includes(p));
            teacherHasAccess = teacherHasAccess || homeroomHasAccess;
          }

          const hasCustomPermission = flags.permissions && flags.permissions.length > 0
            ? (requireAll
                ? permissions.every(p => flags.permissions.includes(p))
                : permissions.some(p => flags.permissions.includes(p)))
            : false;

          hasAccess = teacherHasAccess || hasCustomPermission;
        } else {
          // Nếu không tìm thấy teacher, chỉ kiểm tra role cơ bản
          hasAccess = requireAll
            ? hasAllPermissions(userRole, permissions)
            : hasAnyPermission(userRole, permissions);
        }
      } else if (userRole === 'student') {
        // Student: kiểm tra permission bình thường
        hasAccess = requireAll
          ? hasAllPermissions(userRole, permissions)
          : hasAnyPermission(userRole, permissions);
      }
      // Admin đã được xử lý ở trên, luôn có hasAccess = true

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

  // ✅ BGH (isLeader) có quyền xem tất cả - kiểm tra trước khi load user
  if (role === 'teacher') {
    const Teacher = require('../models/user/teacher');
    const teacher = await Teacher.findOne({ accountId })
      .select('isLeader')
      .lean();
    if (teacher && teacher.isLeader) {
      // BGH có quyền xem tất cả, không cần kiểm tra context chi tiết
      return { allowed: true, context: { role, isLeader: true } };
    }
  }

  // ✅ Lấy thông tin user chi tiết
  let user = null;
  if (role === 'teacher') {
    // Tìm Teacher qua accountId (lấy yearRoles để ưu tiên flags theo năm)
    user = await Teacher.findOne({ accountId })
      .populate('homeroomClassIds')
      .populate('currentHomeroomClassId')
      .populate('subjects.subjectId');
    const SchoolYearModel = require('../models/schoolYear');
    const Setting = require('../models/settings');
    const getEffectiveSchoolYear = async () => {
      const fromReq = (req.headers && (req.headers['x-school-year'] || req.headers['x-school-year-code']))
        || (req.query && (req.query.year || req.query.schoolYear))
        || (req.body && req.body.schoolYear) || null;
      if (fromReq) return String(fromReq);
      try {
        const active = await SchoolYearModel.findOne({ isActive: true }).lean();
        if (active && active.code) return String(active.code);
      } catch (e) {}
      try {
        const s = await Setting.findOne().lean();
        if (s && s.currentSchoolYear) return String(s.currentSchoolYear);
      } catch (e) {}
      return process.env.SCHOOL_YEAR || null;
    };

    const schoolYear = await getEffectiveSchoolYear();
    let yearRoleEntry = null;
    if (user && schoolYear && Array.isArray(user.yearRoles)) {
      yearRoleEntry = user.yearRoles.find(r => r && String(r.schoolYear) === String(schoolYear));
    }
    if (user) {
      user._effectiveFlags = {
        isHomeroom: yearRoleEntry ? !!yearRoleEntry.isHomeroom : !!user.isHomeroom || !!user.currentHomeroomClassId,
        isDepartmentHead: yearRoleEntry ? !!yearRoleEntry.isDepartmentHead : !!user.isDepartmentHead,
        isLeader: yearRoleEntry ? !!yearRoleEntry.isLeader : !!user.isLeader,
        permissions: yearRoleEntry ? (yearRoleEntry.permissions || []) : (user.permissions || []),
        currentHomeroomClassId: yearRoleEntry ? (yearRoleEntry.currentHomeroomClassId || null) : (user.currentHomeroomClassId || null)
      };
    }
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

  const eff = user?._effectiveFlags || {};
  const context = {
    role,
    userId: user?._id,
    accountId,
    // Thêm flags của teacher vào context (đã ưu tiên yearRoles)
    isHomeroom: eff.isHomeroom || false,
    isDepartmentHead: eff.isDepartmentHead || false,
    isLeader: eff.isLeader || false,
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
    if (role === 'teacher' && (user?._effectiveFlags?.isHomeroom)) {
      if (!user) return { allowed: false, message: 'Không tìm thấy thông tin giáo viên' };
      
      const classId = (req.params && req.params.classId) 
        || (req.query && req.query.classId) 
        || (req.body && req.body.classId);
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
    } else if (role === 'teacher' && !(user?._effectiveFlags?.isHomeroom)) {
      return { allowed: false, message: 'Bạn không phải giáo viên chủ nhiệm' };
    }
  }

  // ✅ Quyền xem lớp đang dạy
  if (permission.includes('teaching')) {
    if (role === 'teacher') {
      if (!user) return { allowed: false, message: 'Không tìm thấy thông tin giáo viên' };
      // Use TeachingAssignment collection to verify teacher actually teaches the subject/class
      const TeachingAssignment = require('../models/subject/teachingAssignment');
      const classId = (req.params && req.params.classId) 
        || (req.query && req.query.classId) 
        || (req.body && req.body.classId);
      const subjectId = (req.params && req.params.subjectId) 
        || (req.query && req.query.subjectId) 
        || (req.body && req.body.subjectId);
      const SchoolYearModel = require('../models/schoolYear');
      const Setting = require('../models/settings');
      const getEffectiveSchoolYear = async () => {
        const fromReq = (req.headers && (req.headers['x-school-year'] || req.headers['x-school-year-code']))
          || (req.query && (req.query.year || req.query.schoolYear))
          || (req.body && req.body.schoolYear) || null;
        if (fromReq) return String(fromReq);
        try {
          const active = await SchoolYearModel.findOne({ isActive: true }).lean();
          if (active && active.code) return String(active.code);
        } catch (e) {}
        try {
          const s = await Setting.findOne().lean();
          if (s && s.currentSchoolYear) return String(s.currentSchoolYear);
        } catch (e) {}
        return process.env.SCHOOL_YEAR || null;
      };
      const schoolYear = await getEffectiveSchoolYear();
      const semester = (req.params && req.params.semester) 
        || (req.query && req.query.semester) 
        || (req.body && req.body.semester) 
        || process.env.SEMESTER 
        || null;

      // If classId and subjectId provided, require an explicit assignment for that (teacher, subject, class, year, semester)
      if (classId && subjectId && schoolYear && semester) {
        const exists = await TeachingAssignment.findOne({
          teacherId: user._id,
          subjectId,
          classId,
          year: String(schoolYear),
          semester: String(semester),
        }).lean();
        if (!exists) {
          return { allowed: false, message: 'Bạn không được phân công dạy lớp/môn này trong năm/học kỳ đã chọn', context: { classId, subjectId, schoolYear, semester } };
        }
        context.teachingClassIds = [String(classId)];
      } else if (subjectId && schoolYear && semester) {
        // If only subject provided, check teacher has any assignment for that subject in the year/semester
        const anyAssign = await TeachingAssignment.findOne({
          teacherId: user._id,
          subjectId,
          year: String(schoolYear),
          semester: String(semester),
        }).lean();
        if (!anyAssign && !(user._effectiveFlags?.isDepartmentHead)) {
          return { allowed: false, message: 'Bạn không được phân công dạy môn này trong năm/học kỳ đã chọn', context: { subjectId, schoolYear, semester } };
        }
        // Provide list of classes the teacher teaches for this subject/year/semester
        const assigns = await TeachingAssignment.find({ teacherId: user._id, subjectId, year: String(schoolYear), semester: String(semester) }).lean();
        context.teachingClassIds = (assigns || []).map(a => String(a.classId));
      } else {
        // No specific class/subject/year provided — include all assignments for teacher
        const assigns = await TeachingAssignment.find({ teacherId: user._id }).lean();
        context.teachingClassIds = (assigns || []).map(a => String(a.classId));
      }
    }
  }

  // ✅ Quyền xem môn dạy
  if (permission.includes('teaching') || permission.includes('subject')) {
    if (role === 'teacher') {
      if (!user) return { allowed: false, message: 'Không tìm thấy thông tin giáo viên' };
      
      const subjectId = (req.params && req.params.subjectId) 
        || (req.query && req.query.subjectId) 
        || (req.body && req.body.subjectId);
      if (subjectId) {
        const subjects = user.subjects || [];
        const teachesSubject = subjects.some(
          sub => String(sub.subjectId?._id || sub.subjectId) === String(subjectId)
        );
        // Trưởng bộ môn có thể xem tất cả môn trong tổ
        if (!teachesSubject && !(user._effectiveFlags?.isDepartmentHead)) {
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

  // ✅ Quyền điểm danh (attendance)
  if (permission.includes('attendance')) {
    // attendance:create, attendance:view_class - GVCN chỉ điểm danh/xem lớp chủ nhiệm
    if (permission.includes('create') || permission.includes('view_class')) {
      if (role === 'teacher' && (user?._effectiveFlags?.isHomeroom)) {
        if (!user) return { allowed: false, message: 'Không tìm thấy thông tin giáo viên' };
        
        const classId = (req.params && req.params.classId) 
          || (req.query && req.query.classId) 
          || (req.body && req.body.classId);
        if (classId) {
          const homeroomIds = user.homeroomClassIds || [];
          const hasHomeroom = homeroomIds.some(
            id => String(id._id || id) === String(classId)
          );
          if (!hasHomeroom) {
            return { 
              allowed: false, 
              message: 'Bạn chỉ có thể điểm danh/xem điểm danh lớp chủ nhiệm',
              context: { ...context, classId }
            };
          }
          context.homeroomClassIds = homeroomIds.map(id => String(id._id || id));
        } else {
          context.homeroomClassIds = (user.homeroomClassIds || []).map(id => String(id._id || id));
        }
      } else if (role === 'teacher' && !(user?._effectiveFlags?.isHomeroom)) {
        return { allowed: false, message: 'Chỉ giáo viên chủ nhiệm mới được điểm danh' };
      }
    }
    // attendance:view_self - Học sinh xem điểm danh của mình
    if (permission.includes('view_self')) {
      if (role === 'student') {
        if (!user) return { allowed: false, message: 'Không tìm thấy thông tin học sinh' };
        context.studentId = user._id;
      }
    }
    // attendance:view_all - Admin và BGH xem tất cả (không cần kiểm tra context)
  }

  // ✅ Quyền xem học sinh (STUDENT_VIEW)
  // Admin và BGH (isLeader) có thể xem tất cả học sinh
  if (permission === PERMISSIONS.STUDENT_VIEW) {
    if (role === 'admin') {
      // Admin có quyền xem tất cả, không cần kiểm tra context
      return { allowed: true, context };
    } else if (role === 'teacher' && (user?._effectiveFlags?.isLeader)) {
      // BGH (isLeader) có quyền xem tất cả học sinh
      return { allowed: true, context };
    }
    // Các trường hợp khác sẽ được xử lý bởi các permission cụ thể (homeroom, teaching, self)
  }

  // ✅ Quyền xem bản thân (student)
  if (permission.includes('self')) {
    if (role === 'student') {
      if (!user) return { allowed: false, message: 'Không tìm thấy thông tin học sinh' };
      
      // ✅ Kiểm tra an toàn trước khi truy cập req.body, req.params, req.query
      const studentId = (req.params && req.params.studentId) 
        || (req.query && req.query.studentId) 
        || (req.body && req.body.studentId);
      
      // ✅ Nếu là route /students/:id, lấy id từ params
      if (!studentId && req.params && req.params.id) {
        const idFromParams = req.params.id;
        if (String(user._id) !== String(idFromParams)) {
          return { 
            allowed: false, 
            message: 'Chỉ có thể xem thông tin của chính mình',
            context: { ...context, studentId: idFromParams }
          };
        }
        context.studentId = user._id;
        context.classId = (user.classId && (user.classId._id || user.classId)) 
          ? String(user.classId._id || user.classId) 
          : null;
        return { allowed: true, context };
      }
      
      if (studentId && String(user._id) !== String(studentId)) {
        return { 
          allowed: false, 
          message: 'Chỉ có thể xem thông tin của chính mình',
          context: { ...context, studentId }
        };
      }
      context.studentId = user._id;
      context.classId = (user.classId && (user.classId._id || user.classId)) 
        ? String(user.classId._id || user.classId) 
        : null;
    }
  }

  // ✅ Quyền xem/quản lý bộ môn (Trưởng bộ môn)
  if (permission.includes('department')) {
    if (role === 'teacher' && (user._effectiveFlags?.isDepartmentHead)) {
      // Trưởng bộ môn có thể xem/quản lý tất cả môn trong tổ của mình
      context.departmentSubjects = user.subjects?.map(sub => String(sub.subjectId?._id || sub.subjectId)) || [];
      context.departmentId = user.departmentId ? String(user.departmentId._id || user.departmentId) : null;
      
      // ✅ Trưởng bộ môn có thể phân công môn/lớp cho giáo viên trong tổ
      if (permission === PERMISSIONS.DEPARTMENT_ASSIGN_TEACHING) {
        // Kiểm tra xem giáo viên được phân công có thuộc tổ không
        const targetTeacherId = (req.params && req.params.teacherId) 
          || (req.query && req.query.teacherId) 
          || (req.body && req.body.teacherId);
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
    } else if (role === 'teacher' && !(user._effectiveFlags?.isDepartmentHead)) {
      return { allowed: false, message: 'Bạn không phải trưởng bộ môn' };
    }
  }

  // ✅ Quyền nhập/xem điểm (grade:enter, grade:view)d
  if (permission.includes('grade:')) {
    if (role === 'teacher') {
      if (!user) return { allowed: false, message: 'Không tìm thấy thông tin giáo viên' };
      
      // Use TeachingAssignment collection to verify teacher actually teaches the subject/class
      const TeachingAssignment = require('../models/subject/teachingAssignment');
      const classId = (req.params && req.params.classId) 
        || (req.query && req.query.classId) 
        || (req.body && req.body.classId);
      const subjectId = (req.params && req.params.subjectId) 
        || (req.query && req.query.subjectId) 
        || (req.body && req.body.subjectId);
      const SchoolYearModel = require('../models/schoolYear');
      const Setting = require('../models/settings');
      const getEffectiveSchoolYear = async () => {
        const fromReq = (req.headers && (req.headers['x-school-year'] || req.headers['x-school-year-code']))
          || (req.query && (req.query.year || req.query.schoolYear))
          || (req.body && req.body.schoolYear) || null;
        if (fromReq) return String(fromReq);
        try {
          const active = await SchoolYearModel.findOne({ isActive: true }).lean();
          if (active && active.code) return String(active.code);
        } catch (e) {}
        try {
          const s = await Setting.findOne().lean();
          if (s && s.currentSchoolYear) return String(s.currentSchoolYear);
        } catch (e) {}
        return process.env.SCHOOL_YEAR || null;
      };
      const schoolYear = await getEffectiveSchoolYear();
      const semester = (req.params && req.params.semester) 
        || (req.query && req.query.semester) 
        || (req.body && req.body.semester) 
        || process.env.SEMESTER 
        || null;

      // If classId and subjectId provided, require an explicit assignment for that (teacher, subject, class, year, semester)
      if (classId && subjectId && schoolYear && semester) {
        console.log(`[checkPermission] Checking grade permission. Teacher: ${user._id}, Subject: ${subjectId}, Class: ${classId}, Year: ${schoolYear}, Semester: ${semester}`);
        console.log(`[checkPermission] Teacher flags:`, {
          isHomeroom: user._effectiveFlags?.isHomeroom,
          isDepartmentHead: user._effectiveFlags?.isDepartmentHead,
          isLeader: user._effectiveFlags?.isLeader,
          yearRoles: user.yearRoles
        });
        
        const exists = await TeachingAssignment.findOne({
          teacherId: user._id,
          subjectId,
          classId,
          year: String(schoolYear),
          semester: String(semester),
        }).lean();
        
        console.log(`[checkPermission] TeachingAssignment exists:`, exists ? 'Yes' : 'No');
        
        // ✅ Tất cả giáo viên (GVBM, GVCN, QLBM) đều cần TeachingAssignment để nhập/xem điểm
        // GVCN và QLBM là quyền mở rộng của GVBM, không phải thay thế
        // Chỉ có điều: GVCN có thể XEM điểm tất cả môn của lớp chủ nhiệm (nhưng vẫn cần assignment để NHẬP)
        if (!exists) {
          // ✅ Nếu là GVCN, kiểm tra xem có phải lớp chủ nhiệm không (cho phép XEM nhưng không cho NHẬP)
          if (user._effectiveFlags?.isHomeroom) {
            // Lấy lớp chủ nhiệm từ yearRoles theo năm học (yearRoles chỉ lưu lớp chủ nhiệm, không lưu lớp dạy)
            let isHomeroomClass = false;
            
            if (Array.isArray(user.yearRoles)) {
              const yearRole = user.yearRoles.find(yr => 
                yr && 
                String(yr.schoolYear) === String(schoolYear) && 
                yr.isHomeroom && 
                yr.currentHomeroomClassId &&
                String(yr.currentHomeroomClassId) === String(classId)
              );
              if (yearRole) {
                isHomeroomClass = true;
                console.log(`[checkPermission] ✅ GVCN - Found homeroom class in yearRoles:`, yearRole);
              } else {
                console.log(`[checkPermission] ⚠️ GVCN - No matching yearRole found. Looking for:`, {
                  schoolYear,
                  classId,
                  yearRoles: user.yearRoles
                });
              }
            } else {
              console.log(`[checkPermission] ⚠️ GVCN - yearRoles is not an array:`, user.yearRoles);
            }
            
            if (isHomeroomClass) {
              // GVCN có thể xem điểm lớp chủ nhiệm (không cần assignment), nhưng vẫn cần assignment để nhập
              context.canViewButNotEnter = true;
              context.isHomeroom = true;
              context.homeroomClassIds = [String(classId)];
              console.log(`[checkPermission] ✅ GVCN - Allowed to view (but not enter) grades for homeroom class`);
            } else {
              console.log(`[checkPermission] ❌ GVCN but not homeroom class. Teacher: ${user._id}, Class: ${classId}, Year: ${schoolYear}`);
              return { allowed: false, message: 'Bạn không được phân công dạy lớp/môn này trong năm/học kỳ đã chọn', context: { classId, subjectId, schoolYear, semester } };
            }
          } 
          // ✅ QLBM và GVBM: bắt buộc phải có TeachingAssignment
          else {
            console.log(`[checkPermission] ❌ No TeachingAssignment found. Teacher: ${user._id}, Subject: ${subjectId}, Class: ${classId}, Year: ${schoolYear}, Semester: ${semester}`);
            // Kiểm tra xem có assignment nào cho giáo viên này không (để debug)
            const anyAssign = await TeachingAssignment.findOne({ teacherId: user._id, year: String(schoolYear), semester: String(semester) }).lean();
            console.log(`[checkPermission] Any assignment for this teacher/year/semester:`, anyAssign ? 'Yes' : 'No');
            if (anyAssign) {
              console.log(`[checkPermission] Sample assignment:`, {
                subjectId: anyAssign.subjectId,
                classId: anyAssign.classId,
                year: anyAssign.year,
                semester: anyAssign.semester
              });
            }
            return { allowed: false, message: 'Bạn không được phân công dạy lớp/môn này trong năm/học kỳ đã chọn', context: { classId, subjectId, schoolYear, semester } };
          }
        } else {
          console.log(`[checkPermission] ✅ TeachingAssignment found - Allowing access`);
        }
        context.teachingClassIds = [String(classId)];
        // ✅ Set subjectIds từ TeachingAssignment
        const allAssigns = await TeachingAssignment.find({ teacherId: user._id, year: String(schoolYear), semester: String(semester) }).lean();
        context.subjectIds = [...new Set((allAssigns || []).map(a => String(a.subjectId)))];
        console.log(`[checkPermission] Context set:`, {
          teachingClassIds: context.teachingClassIds,
          subjectIds: context.subjectIds,
          canViewButNotEnter: context.canViewButNotEnter
        });
      } else if (subjectId && schoolYear && semester) {
        // If only subject provided, check teacher has any assignment for that subject in the year/semester
        const anyAssign = await TeachingAssignment.findOne({
          teacherId: user._id,
          subjectId,
          year: String(schoolYear),
          semester: String(semester),
        }).lean();
        if (!anyAssign && !(user._effectiveFlags?.isDepartmentHead)) {
          return { allowed: false, message: 'Bạn không được phân công dạy môn này trong năm/học kỳ đã chọn', context: { subjectId, schoolYear, semester } };
        }
        // Provide list of classes the teacher teaches for this subject/year/semester
        const assigns = await TeachingAssignment.find({ teacherId: user._id, subjectId, year: String(schoolYear), semester: String(semester) }).lean();
        context.teachingClassIds = (assigns || []).map(a => String(a.classId));
        // ✅ Set subjectIds từ TeachingAssignment
        const allAssigns = await TeachingAssignment.find({ teacherId: user._id, year: String(schoolYear), semester: String(semester) }).lean();
        context.subjectIds = [...new Set((allAssigns || []).map(a => String(a.subjectId)))];
      } else {
        // No specific class/subject/year provided — include all assignments for teacher
        const assigns = await TeachingAssignment.find({ teacherId: user._id }).lean();
        context.teachingClassIds = (assigns || []).map(a => String(a.classId));
        // ✅ Set subjectIds từ TeachingAssignment
        context.subjectIds = [...new Set((assigns || []).map(a => String(a.subjectId)))];
      }
    }
  }

  return { allowed: true, context };
}

