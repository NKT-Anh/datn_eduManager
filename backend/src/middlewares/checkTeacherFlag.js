const Account = require('../models/user/account');
const Teacher = require('../models/user/teacher');

/**
 * Middleware kiểm tra teacher flags (isLeader, isHomeroom, isDepartmentHead)
 * @param {Object} flags - Object chứa các flags cần kiểm tra
 * @param {boolean} flags.isLeader - Yêu cầu là BGH
 * @param {boolean} flags.isHomeroom - Yêu cầu là GVCN
 * @param {boolean} flags.isDepartmentHead - Yêu cầu là QLBM
 */
module.exports = (flags = {}) => {
  return async (req, res, next) => {
    try {
      // Lấy account từ req.user (đã được set bởi authMiddleware)
      const accountId = req.user?.accountId;
      if (!accountId) {
        return res.status(401).json({ message: 'Không tìm thấy thông tin tài khoản' });
      }

      const account = await Account.findById(accountId);
      if (!account) {
        return res.status(401).json({ message: 'Tài khoản không tồn tại' });
      }

      // ✅ Admin được truy cập mọi nơi (bỏ flag check)
      if (account.role === 'admin') {
        req.currentUser = account;
        return next();
      }

      // Chỉ kiểm tra flags nếu là teacher
      if (account.role !== 'teacher') {
        return res.status(403).json({ message: 'Chỉ giáo viên mới có thể truy cập' });
      }

      // Lấy teacher từ linkedId
      const teacher = await Teacher.findById(account.linkedId);
      if (!teacher) {
        return res.status(404).json({ message: 'Không tìm thấy thông tin giáo viên' });
      }

      // ✅ BGH (isLeader) được truy cập mọi nơi
      if (teacher.isLeader) {
        req.teacher = teacher;
        req.currentUser = account;
        return next();
      }

      // Kiểm tra từng flag yêu cầu cho teacher khác
      if (flags.isLeader && !teacher.isLeader) {
        return res.status(403).json({ message: 'Chỉ Ban Giám Hiệu mới có thể truy cập' });
      }

      if (flags.isHomeroom && !teacher.isHomeroom) {
        return res.status(403).json({ message: 'Chỉ Giáo viên chủ nhiệm mới có thể truy cập' });
      }

      if (flags.isDepartmentHead && !teacher.isDepartmentHead) {
        return res.status(403).json({ message: 'Chỉ Trưởng bộ môn mới có thể truy cập' });
      }

      // ✅ User có quyền truy cập
      req.teacher = teacher;
      req.currentUser = account;
      next();
    } catch (error) {
      console.error('[Lỗi kiểm tra teacher flags]', error);
      return res.status(500).json({ message: 'Lỗi server' });
    }
  };
};

