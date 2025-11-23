import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/utils/permissions';
import { PermissionGuard } from './PermissionGuard';

interface RoleBasedPageProps {
  children: ReactNode;
  // Permissions để xem trang
  viewPermissions?: string | string[];
  // Permissions để tạo mới
  createPermissions?: string | string[];
  // Permissions để sửa
  updatePermissions?: string | string[];
  // Permissions để xóa
  deletePermissions?: string | string[];
  // Custom render function với permissions
  render?: (permissions: {
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  }) => ReactNode;
}

/**
 * ✅ Component wrapper để hiển thị page với các chức năng theo quyền
 */
export const RoleBasedPage = ({
  children,
  viewPermissions,
  createPermissions,
  updatePermissions,
  deletePermissions,
  render
}: RoleBasedPageProps) => {
  const { backendUser } = useAuth();
  const { hasPermission, hasAnyPermission } = usePermissions();

  const canView = viewPermissions 
    ? hasAnyPermission(Array.isArray(viewPermissions) ? viewPermissions : [viewPermissions])
    : true;
  
  const canCreate = createPermissions
    ? hasAnyPermission(Array.isArray(createPermissions) ? createPermissions : [createPermissions])
    : false;
  
  const canUpdate = updatePermissions
    ? hasAnyPermission(Array.isArray(updatePermissions) ? updatePermissions : [updatePermissions])
    : false;
  
  const canDelete = deletePermissions
    ? hasAnyPermission(Array.isArray(deletePermissions) ? deletePermissions : [deletePermissions])
    : false;

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">Không có quyền truy cập</h2>
          <p className="text-muted-foreground mt-2">Bạn không có quyền truy cập trang này.</p>
        </div>
      </div>
    );
  }

  if (render) {
    return <>{render({ canView, canCreate, canUpdate, canDelete })}</>;
  }

  // Pass permissions as props to children
  return (
    <div>
      {typeof children === 'function' 
        ? children({ canView, canCreate, canUpdate, canDelete })
        : children
      }
    </div>
  );
};

/**
 * ✅ Hook để lấy permissions cho một page
 */
export const usePagePermissions = (
  viewPermissions?: string | string[],
  createPermissions?: string | string[],
  updatePermissions?: string | string[],
  deletePermissions?: string | string[]
) => {
  const { hasAnyPermission } = usePermissions();

  return {
    canView: viewPermissions 
      ? hasAnyPermission(Array.isArray(viewPermissions) ? viewPermissions : [viewPermissions])
      : true,
    canCreate: createPermissions
      ? hasAnyPermission(Array.isArray(createPermissions) ? createPermissions : [createPermissions])
      : false,
    canUpdate: updatePermissions
      ? hasAnyPermission(Array.isArray(updatePermissions) ? updatePermissions : [updatePermissions])
      : false,
    canDelete: deletePermissions
      ? hasAnyPermission(Array.isArray(deletePermissions) ? deletePermissions : [deletePermissions])
      : false,
  };
};

















