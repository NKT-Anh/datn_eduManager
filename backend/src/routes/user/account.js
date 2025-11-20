const express = require('express');
const router = express.Router();
const accountController = require('../../controllers/user/accountController');
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');
const User = require('../../models/user/user')
// Tạo tài khoản (Chỉ Admin)
router.post('/', authMiddleware, checkPermission(PERMISSIONS.USER_CREATE, { checkContext: false }), accountController.createAccount);

// Lấy thông tin tài khoản hiện tại
router.get('/me', authMiddleware, accountController.getMyAccount);

// Lấy danh sách tất cả tài khoản với thông tin phân quyền (chỉ admin)
router.get('/permissions', 
  authMiddleware, 
  checkPermission(PERMISSIONS.USER_VIEW, { checkContext: false }), 
  accountController.getAllAccountsWithPermissions
);

// Lấy role của user hiện tại
router.get('/check-role', authMiddleware, async (req, res) => {
  try {
    const account = await accountController.getAccountByUid(req.user.uid); // dùng helper trong controller

    if (!account) return res.status(404).json({ message: 'Account not found' });

    const user = await User.findOne({ accountId: account._id });
    
    // Lấy thông tin flags nếu là teacher
    let teacherFlags = null;
    if (account.role === 'teacher' && user && user.__t === 'Teacher') {
      const Teacher = require('../../models/user/teacher');
      const teacher = await Teacher.findById(user._id).select('isHomeroom isDepartmentHead isLeader permissions');
      if (teacher) {
        teacherFlags = {
          isHomeroom: teacher.isHomeroom || false,
          isDepartmentHead: teacher.isDepartmentHead || false,
          isLeader: teacher.isLeader || false,
          permissions: teacher.permissions || []
        };
      }
    }
    
    res.json({
      role: account.role,
      uid: account.uid,
      email: account.email,
      phone: user ? user.phone : account.phone,
      name: user ? user.name : null,
      ...(teacherFlags && { teacherFlags }), // Thêm flags nếu là teacher
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Cập nhật role của account
router.put('/:accountId/role', 
  authMiddleware, 
  checkPermission(PERMISSIONS.USER_UPDATE, { checkContext: false }), 
  accountController.updateAccountRole
);

// Cập nhật flags của teacher (isHomeroom, isDepartmentHead, isLeader, permissions)
// ⚠️ CHỈ ADMIN MỚI ĐƯỢC SỬA PERMISSIONS
// Lưu ý: teacherId là _id của Teacher document, không phải accountId
router.put('/teacher/:teacherId/flags', 
  authMiddleware, 
  checkPermission(PERMISSIONS.ROLE_MANAGE, { checkContext: false }), // Chỉ admin có quyền này
  accountController.updateTeacherFlags
);

module.exports = router;
