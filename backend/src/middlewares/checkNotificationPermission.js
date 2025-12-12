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
        
        // ✅ BGH: Được phép gửi tất cả (all, role, class, user)
        if (isBGH) {
          return next();
        }
        
        // ✅ Kiểm tra recipientType nếu có trong body
        const recipientType = req.body.recipientType || 'all';
        
        // ✅ QLBM: Quyền như GVBM + thêm quyền gửi cho giáo viên trong tổ bộ môn
        // Có thể gửi: class (lớp đang dạy), user (giáo viên trong tổ), role='teacher' (chỉ giáo viên trong tổ)
        if (isQLBM) {
          if (recipientType === 'all') {
            return res.status(403).json({ 
              error: 'Bạn không có quyền gửi thông báo toàn trường' 
            });
          }
          if (recipientType === 'role' && req.body.recipientRole !== 'teacher') {
            return res.status(403).json({ 
              error: 'Bạn chỉ được gửi thông báo cho giáo viên trong tổ bộ môn' 
            });
          }
          return next(); // QLBM có thể gửi class, user, hoặc role='teacher'
        }
        
        // ✅ GVCN: Quyền như GVBM + thêm quyền gửi cho lớp chủ nhiệm
        // Có thể gửi: class (lớp đang dạy + lớp chủ nhiệm), user
        if (isGVCN) {
          if (recipientType === 'all' || recipientType === 'role') {
            return res.status(403).json({ 
              error: 'Bạn không có quyền gửi thông báo toàn trường hoặc theo vai trò' 
            });
          }
          if (recipientType !== 'class' && recipientType !== 'user') {
            return res.status(400).json({ 
              error: 'Bạn chỉ được gửi thông báo cho lớp học hoặc người cụ thể' 
            });
          }
          return next();
        }
        
        // ✅ GVBM: Chỉ được gửi cho lớp đang giảng dạy
        // Có thể gửi: class (lớp đang dạy), user
        if (isGVBM) {
          if (recipientType === 'all' || recipientType === 'role') {
            return res.status(403).json({ 
              error: 'Bạn không có quyền gửi thông báo toàn trường hoặc theo vai trò' 
            });
          }
          if (recipientType !== 'class' && recipientType !== 'user') {
            return res.status(400).json({ 
              error: 'Bạn chỉ được gửi thông báo cho lớp học hoặc người cụ thể' 
            });
          }
          return next();
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

