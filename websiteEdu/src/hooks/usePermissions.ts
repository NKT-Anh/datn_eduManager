import { useAuth } from "@/contexts/AuthContext";
import { hasPermission, hasAnyPermission, hasAllPermissions, PERMISSIONS, ROLES, isAdminOrBGH, getEffectivePermissions } from "@/utils/permissions";

/**
 * ✅ Hook để kiểm tra quyền truy cập
 * Sử dụng effectivePermissions từ BackendUser nếu có (đã được tính toán từ năm học hiện tại)
 */
export const usePermissions = () => {
  const { backendUser } = useAuth();
  const role = backendUser?.role || "";

  // ✅ Lấy effective permissions (từ BackendUser hoặc tính toán lại)
  const effectivePermissions = backendUser?.effectivePermissions || getEffectivePermissions(backendUser);

  // ✅ Admin và BGH có tất cả quyền
  const checkPermission = (permission: string) => {
    if (isAdminOrBGH(backendUser)) return true;
    return effectivePermissions.includes(permission);
  };

  const checkAnyPermission = (permissionList: string[]) => {
    if (isAdminOrBGH(backendUser)) return true;
    return permissionList.some(permission => effectivePermissions.includes(permission));
  };

  const checkAllPermissions = (permissionList: string[]) => {
    if (isAdminOrBGH(backendUser)) return true;
    return permissionList.every(permission => effectivePermissions.includes(permission));
  };

  return {
    role,
    effectivePermissions,
    hasPermission: checkPermission,
    hasAnyPermission: checkAnyPermission,
    hasAllPermissions: checkAllPermissions,
    isAdmin: role === ROLES.ADMIN,
    isBGH: backendUser?.role === 'teacher' && backendUser?.teacherFlags?.isLeader === true,
    isTeacher: role === ROLES.TEACHER,
    isStudent: role === ROLES.STUDENT,
    PERMISSIONS,
  };
};

