/**
 * ✅ Middleware kiểm tra quyền tạo thông báo
 * Theo bảng quyền:
 * - BGH: Có thể tạo và gửi tất cả (all, role, class, user)
 * - Admin: Có thể tạo và gửi tất cả
 * - GVCN: Chỉ có thể gửi class (lớp CN) và user, KHÔNG được gửi all/role
 * - GVBM: Chỉ có thể gửi class (lớp đang dạy) và user, KHÔNG được gửi all/role
 * - Học sinh: KHÔNG được tạo thông báo
 */
module.exports = (action = 'create') => {
  return async (req, res, next) => {
    try {
      const { role } = req.user;
      
      // ✅ Học sinh: KHÔNG được tạo thông báo
      if (role === 'student' && action === 'create') {
        return res.status(403).json({ error: 'Học sinh không được tạo thông báo' });
      }
      
      // ✅ Admin: Có quyền tất cả
      if (role === 'admin') {
        return next();
      }
      
      // ✅ BGH (isLeader): Có quyền tất cả
      if (role === 'teacher' && req.user.teacherFlags?.isLeader) {
        return next();
      }
      
      // ✅ Tất cả giáo viên: Chỉ được tạo, không được sửa/xóa
      if (action === 'create' && role === 'teacher') {
        const isBGH = req.user.teacherFlags?.isLeader;
        const isGVCN = req.user.teacherFlags?.isHomeroom && !isBGH; // BGH có thể có isHomeroom nhưng vẫn được phép
        const isQLBM = req.user.teacherFlags?.isDepartmentHead && !isBGH; // BGH có thể có isDepartmentHead nhưng vẫn được phép
        const isGVBM = !req.user.teacherFlags?.isHomeroom && !isBGH && !req.user.teacherFlags?.isDepartmentHead;
        
        // ✅ BGH và QLBM: Được phép gửi tất cả (all, role, class, user)
        if (isBGH || isQLBM) {
          return next();
        }
        
        // ✅ Kiểm tra recipientType nếu có trong body
        const recipientType = req.body.recipientType || 'all';
        
        // ✅ GVCN và GVBM (KHÔNG phải BGH, KHÔNG phải QLBM): Không được gửi all/role, chỉ được gửi class/user
        if ((isGVCN || isGVBM) && (recipientType === 'all' || recipientType === 'role')) {
          return res.status(403).json({ 
            error: 'Bạn không có quyền gửi thông báo toàn trường hoặc theo vai trò' 
          });
        }
        
        // ✅ GVCN và GVBM: Chỉ được gửi class hoặc user
        if ((isGVCN || isGVBM) && recipientType !== 'class' && recipientType !== 'user') {
          return res.status(400).json({ 
            error: 'Bạn chỉ được gửi thông báo cho lớp học hoặc người cụ thể' 
          });
        }
        
        // ✅ Tất cả giáo viên đều có quyền tạo
        return next();
      }
      
      // ✅ Chỉ Admin mới được sửa/xóa
      if ((action === 'update' || action === 'delete') && role !== 'admin') {
        return res.status(403).json({ error: 'Chỉ admin mới được sửa/xóa thông báo' });
      }
      
      // ✅ Các trường hợp khác: Không có quyền
      return res.status(403).json({ error: 'Không có quyền truy cập' });
    } catch (error) {
      console.error('❌ Lỗi checkNotificationPermission:', error);
      return res.status(500).json({ error: error.message });
    }
  };
};

