// Import type từ AuthContext
// Note: BackendUser được định nghĩa trong AuthContext nhưng không được export
// Nên ta sẽ định nghĩa lại interface ở đây
interface BackendUser {
  name: string;
  email: string;
  role: string;
  idToken: string;
  phone: string;
  uid: string;
  _id: string;
  teacherId?: string;
  studentId?: string;
  adminId?: string;
  teacherFlags?: {
    isHomeroom?: boolean;
    isDepartmentHead?: boolean;
    isLeader?: boolean;
    permissions?: any[];
  };
}

/**
 * Kiểm tra user có phải Admin không
 */
export const isAdmin = (user: BackendUser | null): boolean => {
  return user?.role === 'admin';
};

/**
 * Kiểm tra user có phải BGH không
 */
export const isBGH = (user: BackendUser | null): boolean => {
  return user?.role === 'teacher' && user?.teacherFlags?.isLeader === true;
};

/**
 * Kiểm tra user có phải Admin hoặc BGH không (có quyền truy cập mọi nơi)
 */
export const isAdminOrBGH = (user: BackendUser | null): boolean => {
  return isAdmin(user) || isBGH(user);
};

/**
 * Kiểm tra user có phải GVCN không
 */
export const isGVCN = (user: BackendUser | null): boolean => {
  return user?.role === 'teacher' && user?.teacherFlags?.isHomeroom === true;
};

/**
 * Kiểm tra user có phải QLBM không
 */
export const isQLBM = (user: BackendUser | null): boolean => {
  return user?.role === 'teacher' && user?.teacherFlags?.isDepartmentHead === true;
};

/**
 * Kiểm tra user có phải GVBM không (teacher không có flags đặc biệt)
 */
export const isGVBM = (user: BackendUser | null): boolean => {
  return user?.role === 'teacher' && 
         !user?.teacherFlags?.isLeader && 
         !user?.teacherFlags?.isHomeroom && 
         !user?.teacherFlags?.isDepartmentHead;
};

/**
 * Lấy prefix route phù hợp với user
 */
export const getUserRoutePrefix = (user: BackendUser | null): string => {
  if (!user) return '/login';
  
  if (user.role === 'admin') return '/admin';
  if (user.role === 'student') return '/student';
  
  if (user.role === 'teacher') {
    if (isBGH(user)) return '/bgh';
    if (isGVCN(user)) return '/gvcn';
    if (isQLBM(user)) return '/qlbm';
    return '/gvbm';
  }
  
  return '/';
};

/**
 * Kiểm tra user có quyền truy cập route BGH không
 */
export const canAccessBGH = (user: BackendUser | null): boolean => {
  return isBGH(user);
};

/**
 * Kiểm tra user có quyền truy cập route GVCN không
 */
export const canAccessGVCN = (user: BackendUser | null): boolean => {
  return isGVCN(user);
};

/**
 * Kiểm tra user có quyền truy cập route QLBM không
 */
export const canAccessQLBM = (user: BackendUser | null): boolean => {
  return isQLBM(user);
};

/**
 * ROLES constants
 */
export const ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
  BGH: 'bgh',
  GVCN: 'gvcn',
  QLBM: 'qlbm',
  GVBM: 'gvbm',
};

/**
 * PERMISSIONS constants (để tương thích với code cũ)
 */
export const PERMISSIONS = {
  // Quản lý người dùng
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_VIEW: 'user:view',
  USER_ASSIGN_ROLE: 'user:assign_role',
  
  // Phân quyền hệ thống
  ROLE_MANAGE: 'role:manage',
  
  // Quản lý năm học
  YEAR_VIEW: 'year:view',
  YEAR_MANAGE: 'year:manage',
  
  // Quản lý lớp học
  CLASS_CREATE: 'class:create',
  CLASS_UPDATE: 'class:update',
  CLASS_DELETE: 'class:delete',
  CLASS_VIEW: 'class:view',
  CLASS_VIEW_HOMEROOM: 'class:view_homeroom',
  CLASS_VIEW_TEACHING: 'class:view_teaching',
  
  // Quản lý học sinh
  STUDENT_CREATE: 'student:create',
  STUDENT_UPDATE: 'student:update',
  STUDENT_DELETE: 'student:delete',
  STUDENT_VIEW: 'student:view',
  STUDENT_VIEW_HOMEROOM: 'student:view_homeroom',
  STUDENT_VIEW_TEACHING: 'student:view_teaching',
  STUDENT_VIEW_SELF: 'student:view_self',
  
  // Quản lý giáo viên
  TEACHER_CREATE: 'teacher:create',
  TEACHER_UPDATE: 'teacher:update',
  TEACHER_DELETE: 'teacher:delete',
  TEACHER_VIEW: 'teacher:view',
  TEACHER_VIEW_DEPARTMENT: 'teacher:view_department',
  
  // Quản lý môn học
  SUBJECT_MANAGE: 'subject:manage',
  SUBJECT_VIEW: 'subject:view',
  SUBJECT_MANAGE_DEPARTMENT: 'subject:manage_department',
  SUBJECT_VIEW_TEACHING: 'subject:view_teaching',
  
  // Quản lý Tổ Bộ Môn
  DEPARTMENT_CREATE: 'department:create',
  DEPARTMENT_UPDATE: 'department:update',
  DEPARTMENT_DELETE: 'department:delete',
  DEPARTMENT_VIEW: 'department:view',
  DEPARTMENT_MANAGE: 'department:manage',
  
  // Phân công giảng dạy
  TEACHING_ASSIGNMENT_CREATE: 'teaching_assignment:create',
  TEACHING_ASSIGNMENT_UPDATE: 'teaching_assignment:update',
  TEACHING_ASSIGNMENT_VIEW: 'teaching_assignment:view',
  TEACHING_ASSIGNMENT_VIEW_DEPARTMENT: 'teaching_assignment:view_department',
  TEACHING_ASSIGNMENT_VIEW_SELF: 'teaching_assignment:view_self',
  
  // Thời khóa biểu
  SCHEDULE_CREATE: 'schedule:create',
  SCHEDULE_UPDATE: 'schedule:update',
  SCHEDULE_VIEW: 'schedule:view',
  SCHEDULE_VIEW_ALL: 'schedule:view_all',
  SCHEDULE_VIEW_DEPARTMENT: 'schedule:view_department',
  SCHEDULE_VIEW_HOMEROOM: 'schedule:view_homeroom',
  SCHEDULE_VIEW_TEACHING: 'schedule:view_teaching',
  SCHEDULE_VIEW_SELF: 'schedule:view_self',
  
  // Nhập điểm môn học
  GRADE_ENTER: 'grade:enter',
  
  // Xem điểm
  GRADE_VIEW: 'grade:view',
  GRADE_VIEW_ALL: 'grade:view_all',
  GRADE_VIEW_DEPARTMENT: 'grade:view_department',
  GRADE_VIEW_HOMEROOM: 'grade:view_homeroom',
  GRADE_VIEW_TEACHING: 'grade:view_teaching',
  GRADE_VIEW_SELF: 'grade:view_self',
  
  // Hạnh kiểm
  CONDUCT_VIEW: 'conduct:view',
  CONDUCT_ENTER: 'conduct:enter',
  
  // Quản lý kỳ thi
  EXAM_CREATE: 'exam:create',
  EXAM_UPDATE: 'exam:update',
  EXAM_DELETE: 'exam:delete',
  EXAM_VIEW: 'exam:view',
  EXAM_VIEW_DEPARTMENT: 'exam:view_department',
  EXAM_VIEW_HOMEROOM: 'exam:view_homeroom',
  EXAM_VIEW_TEACHING: 'exam:view_teaching',
  EXAM_VIEW_SELF: 'exam:view_self',
  
  // Tạo lịch thi
  EXAM_SCHEDULE_AUTO: 'exam_schedule:auto',
  
  // Phân phòng thi
  EXAM_ROOM_AUTO: 'exam_room:auto',
  EXAM_ROOM_VIEW: 'exam_room:view',
  EXAM_ROOM_VIEW_SELF: 'exam_room:view_self',
  EXAM_ROOM_MANAGE: 'exam_room:manage',
  EXAM_ROOM_VIEW_MANAGE: 'exam_room:view_manage',
  
  // Nhập điểm thi
  EXAM_GRADE_ENTER: 'exam_grade:enter',
  
  // In phiếu báo danh
  EXAM_PRINT_TICKET: 'exam:print_ticket',
  EXAM_PRINT_TICKET_HOMEROOM: 'exam:print_ticket_homeroom',
  EXAM_PRINT_TICKET_TEACHING: 'exam:print_ticket_teaching',
  EXAM_PRINT_TICKET_SELF: 'exam:print_ticket_self',
  
  // Quản lý phòng học
  ROOM_CREATE: 'room:create',
  ROOM_UPDATE: 'room:update',
  ROOM_DELETE: 'room:delete',
  ROOM_VIEW: 'room:view',
  
  // Quản lý sự cố
  INCIDENT_CREATE: 'incident:create',
  INCIDENT_UPDATE: 'incident:update',
  INCIDENT_VIEW: 'incident:view',
  INCIDENT_HANDLE: 'incident:handle',
  INCIDENT_VIEW_HOMEROOM: 'incident:view_homeroom',
  INCIDENT_REPORT: 'incident:report',
  
  // Quản lý thông báo
  NOTIFICATION_CREATE: 'notification:create',
  NOTIFICATION_UPDATE: 'notification:update',
  NOTIFICATION_VIEW: 'notification:view',
  NOTIFICATION_SEND_HOMEROOM: 'notification:send_homeroom',
  
  // Dashboard thống kê
  DASHBOARD_VIEW_ALL: 'dashboard:view_all',
  DASHBOARD_VIEW_DEPARTMENT: 'dashboard:view_department',
  DASHBOARD_VIEW_HOMEROOM: 'dashboard:view_homeroom',
  DASHBOARD_VIEW_TEACHING: 'dashboard:view_teaching',
};

/**
 * Kiểm tra role có permission không (để tương thích với code cũ)
 * Note: Admin và BGH luôn có tất cả quyền
 */
export const hasPermission = (role: string, permission: string): boolean => {
  // Admin và BGH có tất cả quyền
  if (role === ROLES.ADMIN) return true;
  
  // BGH (teacher với isLeader) có tất cả quyền xem
  // Note: Cần check flag isLeader trong usePermissions hook
  
  // Các role khác cần check cụ thể (có thể implement sau)
  return false;
};

/**
 * Kiểm tra role có ít nhất 1 permission trong danh sách không
 */
export const hasAnyPermission = (role: string, permissionList: string[]): boolean => {
  return permissionList.some(permission => hasPermission(role, permission));
};

/**
 * Kiểm tra role có tất cả permissions trong danh sách không
 */
export const hasAllPermissions = (role: string, permissionList: string[]): boolean => {
  return permissionList.every(permission => hasPermission(role, permission));
};
