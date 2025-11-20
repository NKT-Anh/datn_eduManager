import { useAuth } from "@/contexts/AuthContext";
import { hasPermission, hasAnyPermission, hasAllPermissions, PERMISSIONS, ROLES, isAdminOrBGH } from "@/utils/permissions";

/**
 * ✅ Hook để kiểm tra quyền truy cập
 */
export const usePermissions = () => {
  const { backendUser } = useAuth();
  const role = backendUser?.role || "";

  // ✅ Admin và BGH có tất cả quyền
  const checkPermission = (permission: string) => {
    if (isAdminOrBGH(backendUser)) return true;
    return hasPermission(role, permission);
  };

  const checkAnyPermission = (permissionList: string[]) => {
    if (isAdminOrBGH(backendUser)) return true;
    return hasAnyPermission(role, permissionList);
  };

  const checkAllPermissions = (permissionList: string[]) => {
    if (isAdminOrBGH(backendUser)) return true;
    return hasAllPermissions(role, permissionList);
  };

  return {
    role,
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

