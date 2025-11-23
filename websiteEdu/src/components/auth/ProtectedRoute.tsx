import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getUserRoutePrefix } from '@/utils/permissions';

interface ProtectedRouteProps {
  children: JSX.Element;
  allowedRoles?: string[];
  requireFlags?: {
    isLeader?: boolean;
    isHomeroom?: boolean;
    isDepartmentHead?: boolean;
  };
}

/**
 * Component bảo vệ route - kiểm tra quyền truy cập
 * Chỉ cho phép truy cập nếu user có role hoặc flags phù hợp
 */
export const ProtectedRoute = ({ children, allowedRoles, requireFlags }: ProtectedRouteProps) => {
  const { backendUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Đang kiểm tra quyền truy cập...</p>
        </div>
      </div>
    );
  }

  if (!backendUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Helper: Lấy trang home phù hợp với user
  const getHomePath = () => {
    const prefix = getUserRoutePrefix(backendUser);
    return `${prefix}/home`;
  };

  // Kiểm tra role nếu có yêu cầu
  if (allowedRoles && !allowedRoles.includes(backendUser.role)) {
    return <Navigate to={getHomePath()} replace />;
  }

  // Kiểm tra flags nếu có yêu cầu
  if (requireFlags) {
    // ✅ Admin và BGH được truy cập mọi nơi (bỏ flag check)
    if (backendUser.role === 'admin') {
      // Admin có quyền truy cập tất cả routes
      return children;
    }

    if (backendUser.role !== 'teacher') {
      // Route yêu cầu flags nhưng user không phải teacher và không phải admin
      return <Navigate to={getHomePath()} replace />;
    }

    const isBGH = backendUser.teacherFlags?.isLeader === true;
    const isGVCN = backendUser.teacherFlags?.isHomeroom === true;
    const isQLBM = backendUser.teacherFlags?.isDepartmentHead === true;

    // ✅ BGH (isLeader) được truy cập mọi nơi
    if (isBGH) {
      return children;
    }

    // Kiểm tra từng flag yêu cầu cho teacher khác
    if (requireFlags.isLeader && !isBGH) {
      return <Navigate to={getHomePath()} replace />;
    }
    if (requireFlags.isHomeroom && !isGVCN) {
      return <Navigate to={getHomePath()} replace />;
    }
    if (requireFlags.isDepartmentHead && !isQLBM) {
      return <Navigate to={getHomePath()} replace />;
    }
  }

  // ✅ User có quyền truy cập
  return children;
};
