const Account = require('../../models/user/account')
const User = require("../../models/user/user");
const admin = require('../../config/firebaseAdmin');

// Admin tạo Account dựa trên User
// exports.createAccount = async (req, res) => {
//   try {
//     const { userId } = req.body;

//     const user = await User.findById(userId);
//     if (!user) return res.status(404).json({ message: "User không tồn tại" });
//     if (!user.phone) return res.status(400).json({ message: "User chưa có phone" });

//     // Tạo Firebase
//     const userRecord = await admin.auth().createUser({
//       phoneNumber: user.phone,
//       displayName: user.name,
//       email: user.email || undefined
//     });

//     // Tạo Account Mongo
//     const account = await Account.create({
//       uid: userRecord.uid,
//       phone: user.phone,
//       email: user.email || null,
//       role: user.role
//     });

//     // Liên kết accountId vào User
//     user.accountId = account._id;
//     await user.save();

//     res.status(201).json(account);
//   } catch (error) {
//     res.status(400).json({ message: "Lỗi tạo tài khoản", error });
//   }
// };
exports.updateEmailPassword = async (req, res) => {
    try {
      const { uid, email, password } = req.body;
  
      if (!uid || (!email && !password)) {
        return res.status(400).json({ message: "Thiếu thông tin cập nhật" });
      }
  
      // Cập nhật Firebase
      await admin.auth().updateUser(uid, { email, password });
  
      // Cập nhật Mongo
      const account = await Account.findOne({ uid });
      if (email) account.email = email;
      await account.save();
  
      res.json(account);
    } catch (error) {
      res.status(400).json({ message: "Lỗi cập nhật email/password", error });
    }
  };
  

// Lấy thông tin tài khoản hiện tại
exports.getMe = async (req, res) => {
  try {
    const { uid } = req.user; // lấy uid từ Firebase token
    const account = await Account.findOne({ uid });

    if (!account) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }

    res.json(account);
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy thông tin tài khoản", error });
  }
};
exports.getAccountByUid = async (uid) => {
    return await Account.findOne({ uid });
  };
exports.getMyAccount = async (req, res) => {
  try {
    const { uid } = req.user;
    const account = await Account.findOne({ uid });
    if (!account) return res.status(404).json({ message: "Account not found" });

    const user = await User.findOne({ accountId: account._id });

    let teacherId = null, studentId = null, adminId = null;
    if (user) {
      if (user.__t === 'Teacher') teacherId = user._id.toString();
      if (user.__t === 'Student') studentId = user._id.toString();
      if (user.__t === 'Admin') adminId = user._id.toString();
    }

    // Lấy thông tin flags nếu là teacher
    let teacherFlags = null;
    if (teacherId) {
      const Teacher = require('../../models/user/teacher');
      const teacher = await Teacher.findById(teacherId).select('isHomeroom isDepartmentHead isLeader permissions');
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
      _id: account._id,
      uid: account.uid,
      email: account.email,
      role: account.role,
      name: user?.name || null,
      phone: user?.phone || account.phone,
      teacherId,
      studentId,
      adminId,
      ...(teacherFlags && { teacherFlags }), // Thêm flags nếu là teacher
    });
  } catch (error) {
    console.error("getMyAccount error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};


exports.createAccount = async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User không tồn tại" });
    if (!user.phone) return res.status(400).json({ message: "User chưa có phone" });

    // Kiểm tra user đã có account chưa
    if (user.accountId) return res.status(400).json({ message: "User đã có account" });

    // Tạo Firebase
    const userRecord = await admin.auth().createUser({
      phoneNumber: user.phone,
      displayName: user.name,
      email: user.email || undefined
    });

    // Tạo Account Mongo
    const account = await Account.create({
      uid: userRecord.uid,
      phone: user.phone,
      email: user.email || null,
      role: user.role // role ở đây phải là 'teacher' hoặc 'student' hoặc 'admin'
    });

    // Liên kết accountId vào User
    user.accountId = account._id;
    await user.save();

    res.status(201).json(account);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: "Lỗi tạo tài khoản", error });
  }
};

/**
 * Tạo account cho Student (Admin tạo)
 */
exports.createStudentAccount = async (req, res) => {
  try {
    const { studentId } = req.body;

    const student = await User.findById(studentId);
    if (!student) return res.status(404).json({ message: "Student không tồn tại" });

    if (student.accountId) return res.status(400).json({ message: "Student đã có account" });

    const userRecord = await admin.auth().createUser({
      phoneNumber: student.phone,
      displayName: student.name,
      email: student.email || undefined
    });

    const account = await Account.create({
      uid: userRecord.uid,
      phone: student.phone,
      email: student.email || null,
      role: 'student'
    });

    student.accountId = account._id;
    await student.save();

    res.status(201).json(account);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: "Lỗi tạo tài khoản Student", error });
  }
};

/**
 * Tạo account cho Teacher (Admin tạo)
 */
exports.createTeacherAccount = async (req, res) => {
  try {
    const { teacherId } = req.body;

    const teacher = await User.findById(teacherId);
    if (!teacher) return res.status(404).json({ message: "Teacher không tồn tại" });

    if (teacher.accountId) return res.status(400).json({ message: "Teacher đã có account" });

    const userRecord = await admin.auth().createUser({
      phoneNumber: teacher.phone,
      displayName: teacher.name,
      email: teacher.email || undefined
    });

    const account = await Account.create({
      uid: userRecord.uid,
      phone: teacher.phone,
      email: teacher.email || null,
      role: 'teacher'
    });

    teacher.accountId = account._id;
    await teacher.save();

    res.status(201).json(account);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: "Lỗi tạo tài khoản Teacher", error });
  }
};

/**
 * 🔄 Đổi role của account mà không đổi email (để tránh mất dữ liệu)
 * Chỉ dùng cho các role giáo viên: teacher, gvcn, gvbm, qlbm
 */
exports.updateAccountRole = async (req, res) => {
  try {
    const { accountId } = req.params; // Lấy từ URL params
    const { newRole } = req.body;

    if (!accountId || !newRole) {
      return res.status(400).json({ message: 'Thiếu accountId hoặc newRole' });
    }

    // Chỉ cho phép đổi giữa các role giáo viên
    const allowedRoles = ['teacher', 'gvcn', 'gvbm', 'qlbm', 'bgh'];
    if (!allowedRoles.includes(newRole)) {
      return res.status(400).json({ 
        message: `Role không hợp lệ. Chỉ cho phép: ${allowedRoles.join(', ')}` 
      });
    }

    const account = await Account.findById(accountId);
    if (!account) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    }

    // Kiểm tra role hiện tại có phải là giáo viên không
    const teacherRoles = ['teacher', 'gvcn', 'gvbm', 'qlbm', 'bgh'];
    if (!teacherRoles.includes(account.role)) {
      return res.status(400).json({ 
        message: 'Chỉ có thể đổi role cho các tài khoản giáo viên' 
      });
    }

    // Lưu email cũ để đảm bảo không mất
    const oldEmail = account.email;
    const oldRole = account.role;

    // Cập nhật role (giữ nguyên email)
    account.role = newRole;
    await account.save();

    res.json({
      message: `Đã đổi role từ ${oldRole} sang ${newRole}`,
      account: {
        _id: account._id,
        email: account.email, // Email không đổi
        role: account.role,
        uid: account.uid
      }
    });
  } catch (error) {
    console.error('Error updating account role:', error);
    res.status(500).json({ message: 'Lỗi khi đổi role', error: error.message });
  }
};

/**
 * ✅ Lấy danh sách tất cả tài khoản với thông tin phân quyền đầy đủ
 */
exports.getAllAccountsWithPermissions = async (req, res) => {
  try {
    const Account = require('../../models/user/account');
    const User = require('../../models/user/user');
    const Teacher = require('../../models/user/teacher');
    const Student = require('../../models/user/student');
    const Admin = require('../../models/user/admin');

    // Lấy tất cả accounts
    const accounts = await Account.find({}).lean();

    // Lấy tất cả users
    const students = await Student.find({}).lean();
    const teachers = await Teacher.find({}).lean();
    const admins = await Admin.find({}).lean();

    // Tạo maps để tra cứu nhanh
    const studentMap = new Map(
      students.filter(s => s.accountId).map(s => [s.accountId.toString(), s])
    );
    const teacherMap = new Map(
      teachers.filter(t => t.accountId).map(t => [t.accountId.toString(), t])
    );
    const adminMap = new Map(
      admins.filter(a => a.accountId).map(a => [a.accountId.toString(), a])
    );

    // Gắn thông tin chi tiết vào từng account
    const accountsWithPermissions = accounts.map(acc => {
      const accIdStr = acc._id.toString();
      let userInfo = null;
      let teacherFlags = null;

      if (acc.role === 'student' && studentMap.has(accIdStr)) {
        const student = studentMap.get(accIdStr);
        userInfo = {
          _id: student._id,
          name: student.name,
          code: student.studentCode,
          type: 'student'
        };
      } else if (acc.role === 'teacher' && teacherMap.has(accIdStr)) {
        const teacher = teacherMap.get(accIdStr);
        userInfo = {
          _id: teacher._id,
          name: teacher.name,
          code: teacher.teacherCode,
          type: 'teacher'
        };
        teacherFlags = {
          isHomeroom: teacher.isHomeroom || false,
          isDepartmentHead: teacher.isDepartmentHead || false,
          isLeader: teacher.isLeader || false,
          permissions: teacher.permissions || []
        };
      } else if (acc.role === 'admin' && adminMap.has(accIdStr)) {
        const admin = adminMap.get(accIdStr);
        userInfo = {
          _id: admin._id,
          name: admin.name,
          code: null,
          type: 'admin'
        };
      }

      return {
        ...acc,
        userInfo,
        teacherFlags
      };
    });

    res.json({
      message: 'Lấy danh sách tài khoản thành công',
      count: accountsWithPermissions.length,
      data: accountsWithPermissions
    });
  } catch (error) {
    console.error('Error getting accounts with permissions:', error);
    res.status(500).json({ 
      message: 'Lỗi khi lấy danh sách tài khoản', 
      error: error.message 
    });
  }
};

/**
 * ✅ Cập nhật role của account
 */
exports.updateAccountRole = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { role } = req.body;

    if (!role || !['admin', 'student', 'teacher'].includes(role)) {
      return res.status(400).json({ 
        message: 'Role không hợp lệ. Chỉ chấp nhận: admin, student, teacher' 
      });
    }

    const account = await Account.findById(accountId);
    if (!account) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    }

    account.role = role;
    await account.save();

    res.json({
      message: 'Đã cập nhật role thành công',
      account: {
        _id: account._id,
        email: account.email,
        role: account.role
      }
    });
  } catch (error) {
    console.error('Error updating account role:', error);
    res.status(500).json({ 
      message: 'Lỗi khi cập nhật role', 
      error: error.message 
    });
  }
};

/**
 * ✅ Cập nhật flags của teacher (isHomeroom, isDepartmentHead, isLeader, permissions)
 * ⚠️ CHỈ ADMIN MỚI ĐƯỢC SỬA PERMISSIONS
 * ⚠️ GIÁO VIÊN KHÔNG ĐƯỢC SỬA QUYỀN CỦA MÌNH
 */
exports.updateTeacherFlags = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { isHomeroom, isDepartmentHead, isLeader, permissions } = req.body;
    const account = await Account.findOne({ uid: req.user.uid });
    
    if (!account) {
      return res.status(401).json({ message: 'Không tìm thấy tài khoản' });
    }

    // ✅ CHỈ ADMIN MỚI ĐƯỢC SỬA PERMISSIONS
    if (account.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Chỉ admin mới được sửa permissions' 
      });
    }

    const Teacher = require('../../models/user/teacher');
    const teacher = await Teacher.findById(teacherId).populate('accountId');
    
    if (!teacher) {
      return res.status(404).json({ message: 'Không tìm thấy giáo viên' });
    }

    // ✅ GIÁO VIÊN KHÔNG ĐƯỢC SỬA QUYỀN CỦA MÌNH
    if (teacher.accountId && teacher.accountId.uid === req.user.uid) {
      return res.status(403).json({ 
        message: 'Giáo viên không được sửa quyền của mình' 
      });
    }

    // Cập nhật flags
    if (typeof isHomeroom === 'boolean') {
      teacher.isHomeroom = isHomeroom;
    }
    if (typeof isDepartmentHead === 'boolean') {
      teacher.isDepartmentHead = isDepartmentHead;
    }
    if (typeof isLeader === 'boolean') {
      teacher.isLeader = isLeader;
    }
    if (Array.isArray(permissions)) {
      teacher.permissions = permissions;
    }

    await teacher.save();

    res.json({
      message: 'Đã cập nhật quyền giáo viên thành công',
      teacher: {
        _id: teacher._id,
        name: teacher.name,
        isHomeroom: teacher.isHomeroom,
        isDepartmentHead: teacher.isDepartmentHead,
        isLeader: teacher.isLeader,
        permissions: teacher.permissions
      }
    });
  } catch (error) {
    console.error('Error updating teacher flags:', error);
    res.status(500).json({ message: 'Lỗi khi cập nhật quyền giáo viên', error: error.message });
  }
};