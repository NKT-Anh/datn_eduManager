import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionGuardProps {
  children: ReactNode;
  requiredPermission?: string | string[];
  requireAll?: boolean;
  fallback?: ReactNode;
}

/**
 * ✅ Component để hiển thị/ẩn UI elements dựa trên quyền
 */
export const PermissionGuard = ({ 
  children, 
  requiredPermission,
  requireAll = false,
  fallback = null
}: PermissionGuardProps) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  if (!requiredPermission) {
    return <>{children}</>;
  }

  const permissions = Array.isArray(requiredPermission) 
    ? requiredPermission 
    : [requiredPermission];
  
  const hasAccess = requireAll
    ? hasAllPermissions(permissions)
    : hasAnyPermission(permissions);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

















