/**
 * 📋 HỆ THỐNG PHÂN QUYỀN
 * Định nghĩa các quyền truy cập cho từng role
 */

// ✅ Các roles trong hệ thống (chỉ 3 roles cơ bản)
exports.ROLES = {
  ADMIN: 'admin',           // Quản trị hệ thống
  TEACHER: 'teacher',       // Giáo viên (có thể có thêm flags: isHomeroom, isDepartmentHead, isLeader)
  STUDENT: 'student',       // Học sinh
};

// ✅ Các permissions (quyền truy cập)
exports.PERMISSIONS = {
  // 1. Quản lý người dùng
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_VIEW: 'user:view',
  USER_ASSIGN_ROLE: 'user:assign_role',

  // 2. Phân quyền hệ thống
  ROLE_MANAGE: 'role:manage',

  // 3. Quản lý năm học - học kỳ
  YEAR_VIEW: 'year:view',
  YEAR_MANAGE: 'year:manage',

  // 4. Quản lý lớp học
  CLASS_CREATE: 'class:create',
  CLASS_UPDATE: 'class:update',
  CLASS_DELETE: 'class:delete',
  CLASS_VIEW: 'class:view',
  CLASS_VIEW_HOMEROOM: 'class:view_homeroom',      // Xem lớp chủ nhiệm
  CLASS_VIEW_TEACHING: 'class:view_teaching',       // Xem lớp đang dạy

  // 5. Quản lý học sinh
  STUDENT_CREATE: 'student:create',
  STUDENT_UPDATE: 'student:update',
  STUDENT_DELETE: 'student:delete',
  STUDENT_VIEW: 'student:view',
  STUDENT_VIEW_HOMEROOM: 'student:view_homeroom',  // Xem HS lớp chủ nhiệm
  STUDENT_VIEW_TEACHING: 'student:view_teaching',   // Xem HS lớp mình dạy
  STUDENT_VIEW_SELF: 'student:view_self',          // Xem bản thân

  // 6. Quản lý giáo viên
  TEACHER_CREATE: 'teacher:create',
  TEACHER_UPDATE: 'teacher:update',
  TEACHER_DELETE: 'teacher:delete',
  TEACHER_VIEW: 'teacher:view',
  TEACHER_VIEW_DEPARTMENT: 'teacher:view_department', // Xem giáo viên bộ môn

  // 7. Quản lý môn học
  SUBJECT_MANAGE: 'subject:manage',
  SUBJECT_VIEW: 'subject:view',
  SUBJECT_MANAGE_DEPARTMENT: 'subject:manage_department', // Quản lý môn bộ môn
  SUBJECT_VIEW_TEACHING: 'subject:view_teaching',          // Xem môn dạy

  // 7.1. Quản lý Tổ Bộ Môn
  DEPARTMENT_CREATE: 'department:create',
  DEPARTMENT_UPDATE: 'department:update',
  DEPARTMENT_DELETE: 'department:delete',
  DEPARTMENT_VIEW: 'department:view',
  DEPARTMENT_MANAGE: 'department:manage', // Quản lý tổ bộ môn của mình (Trưởng bộ môn)
  DEPARTMENT_ASSIGN_TEACHING: 'department:assign_teaching', // Phân công môn/lớp cho giáo viên trong tổ
  DEPARTMENT_SUPERVISE: 'department:supervise', // Giám sát giáo viên trong tổ

  // 8. Phân công giảng dạy
  TEACHING_ASSIGNMENT_CREATE: 'teaching_assignment:create',
  TEACHING_ASSIGNMENT_UPDATE: 'teaching_assignment:update',
  TEACHING_ASSIGNMENT_VIEW: 'teaching_assignment:view',
  TEACHING_ASSIGNMENT_VIEW_DEPARTMENT: 'teaching_assignment:view_department',
  TEACHING_ASSIGNMENT_VIEW_SELF: 'teaching_assignment:view_self',

  // 9. Thời khóa biểu
  SCHEDULE_CREATE: 'schedule:create',
  SCHEDULE_UPDATE: 'schedule:update',
  SCHEDULE_VIEW: 'schedule:view',
  SCHEDULE_VIEW_ALL: 'schedule:view_all',
  SCHEDULE_VIEW_DEPARTMENT: 'schedule:view_department',
  SCHEDULE_VIEW_HOMEROOM: 'schedule:view_homeroom',
  SCHEDULE_VIEW_TEACHING: 'schedule:view_teaching',
  SCHEDULE_VIEW_SELF: 'schedule:view_self',

  // 10. Nhập điểm môn học
  GRADE_ENTER: 'grade:enter',                      // Nhập điểm môn mình dạy

  // 11. Xem điểm
  GRADE_VIEW: 'grade:view',
  GRADE_VIEW_ALL: 'grade:view_all',
  GRADE_VIEW_DEPARTMENT: 'grade:view_department',
  GRADE_VIEW_HOMEROOM: 'grade:view_homeroom',
  GRADE_VIEW_TEACHING: 'grade:view_teaching',
  GRADE_VIEW_SELF: 'grade:view_self',

  // 12. Hạnh kiểm
  CONDUCT_VIEW: 'conduct:view',
  CONDUCT_ENTER: 'conduct:enter',                  // Nhập hạnh kiểm lớp CN

  // 13. Quản lý kỳ thi
  EXAM_CREATE: 'exam:create',
  EXAM_UPDATE: 'exam:update',
  EXAM_DELETE: 'exam:delete',
  EXAM_VIEW: 'exam:view',
  EXAM_VIEW_DEPARTMENT: 'exam:view_department',
  EXAM_VIEW_HOMEROOM: 'exam:view_homeroom',
  EXAM_VIEW_TEACHING: 'exam:view_teaching',
  EXAM_VIEW_SELF: 'exam:view_self',

  // 14. Tạo lịch thi (auto)
  EXAM_SCHEDULE_AUTO: 'exam_schedule:auto',

  // 15. Phân phòng thi (auto)
  EXAM_ROOM_AUTO: 'exam_room:auto',
  EXAM_ROOM_VIEW: 'exam_room:view',
  EXAM_ROOM_VIEW_SELF: 'exam_room:view_self',

  // 16. Nhập điểm thi
  EXAM_GRADE_ENTER: 'exam_grade:enter',            // Nhập điểm môn mình dạy

  // 17. In phiếu báo danh
  EXAM_PRINT_TICKET: 'exam:print_ticket',
  EXAM_PRINT_TICKET_HOMEROOM: 'exam:print_ticket_homeroom',
  EXAM_PRINT_TICKET_TEACHING: 'exam:print_ticket_teaching',
  EXAM_PRINT_TICKET_SELF: 'exam:print_ticket_self',

  // 18. Quản lý phòng học
  ROOM_CREATE: 'room:create',
  ROOM_UPDATE: 'room:update',
  ROOM_DELETE: 'room:delete',
  ROOM_VIEW: 'room:view',

  // 19. Quản lý phòng thi
  EXAM_ROOM_MANAGE: 'exam_room:manage',
  EXAM_ROOM_VIEW_MANAGE: 'exam_room:view_manage',

  // 20. Quản lý sự cố
  INCIDENT_CREATE: 'incident:create',
  INCIDENT_UPDATE: 'incident:update',
  INCIDENT_VIEW: 'incident:view',
  INCIDENT_HANDLE: 'incident:handle',              // Xử lý sự cố
  INCIDENT_VIEW_HOMEROOM: 'incident:view_homeroom',
  INCIDENT_REPORT: 'incident:report',              // Gửi báo cáo

  // 21. Quản lý thông báo
  NOTIFICATION_CREATE: 'notification:create',
  NOTIFICATION_UPDATE: 'notification:update',
  NOTIFICATION_VIEW: 'notification:view',
  NOTIFICATION_SEND_HOMEROOM: 'notification:send_homeroom',

  // 22. Dashboard thống kê
  DASHBOARD_VIEW_ALL: 'dashboard:view_all',
  DASHBOARD_VIEW_DEPARTMENT: 'dashboard:view_department',
  DASHBOARD_VIEW_HOMEROOM: 'dashboard:view_homeroom',
  DASHBOARD_VIEW_TEACHING: 'dashboard:view_teaching',
};

// ✅ Mapping roles với permissions
const ROLE_PERMISSIONS = {
  [exports.ROLES.ADMIN]: [
    // Tất cả quyền
    ...Object.values(exports.PERMISSIONS),
  ],

  // ✅ BGH (Ban Giám Hiệu) - Teacher với isLeader = true
  // Quyền BGH sẽ được kiểm tra trong checkPermission middleware dựa trên isLeader flag
  // Không cần định nghĩa riêng vì sẽ được xử lý động

  // ✅ Teacher với các flags khác nhau sẽ có quyền tương ứng
  // Quyền cơ bản của teacher (tất cả giáo viên đều có)
  [exports.ROLES.TEACHER]: [
    // Xem năm học
    exports.PERMISSIONS.YEAR_VIEW,
    // Xem lớp đang dạy
    exports.PERMISSIONS.CLASS_VIEW_TEACHING,
    exports.PERMISSIONS.STUDENT_VIEW_TEACHING,
    exports.PERMISSIONS.SUBJECT_VIEW_TEACHING,
    exports.PERMISSIONS.TEACHING_ASSIGNMENT_VIEW_SELF,
    exports.PERMISSIONS.SCHEDULE_VIEW_TEACHING,
    exports.PERMISSIONS.GRADE_ENTER,
    exports.PERMISSIONS.GRADE_VIEW_TEACHING,
    exports.PERMISSIONS.EXAM_VIEW_TEACHING,
    exports.PERMISSIONS.EXAM_GRADE_ENTER,
    exports.PERMISSIONS.EXAM_PRINT_TICKET_TEACHING,
    exports.PERMISSIONS.DASHBOARD_VIEW_TEACHING,
    // Xem thông báo
    exports.PERMISSIONS.NOTIFICATION_VIEW,
  ],

  [exports.ROLES.STUDENT]: [
    // Xem bản thân
    exports.PERMISSIONS.STUDENT_VIEW_SELF,
    exports.PERMISSIONS.SCHEDULE_VIEW_SELF,
    exports.PERMISSIONS.GRADE_VIEW_SELF,
    exports.PERMISSIONS.CONDUCT_VIEW,
    exports.PERMISSIONS.EXAM_VIEW_SELF,
    exports.PERMISSIONS.EXAM_ROOM_VIEW_SELF,
    exports.PERMISSIONS.EXAM_PRINT_TICKET_SELF,
    exports.PERMISSIONS.INCIDENT_REPORT,
    exports.PERMISSIONS.NOTIFICATION_VIEW,
  ],
};

exports.ROLE_PERMISSIONS = ROLE_PERMISSIONS;

// ✅ Helper: Kiểm tra role có permission không
exports.hasPermission = (role, permission) => {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
};

// ✅ Helper: Kiểm tra role có bất kỳ permission nào trong danh sách không
exports.hasAnyPermission = (role, permissionList) => {
  return permissionList.some(permission => exports.hasPermission(role, permission));
};

// ✅ Helper: Kiểm tra role có tất cả permissions trong danh sách không
exports.hasAllPermissions = (role, permissionList) => {
  return permissionList.every(permission => exports.hasPermission(role, permission));
};

