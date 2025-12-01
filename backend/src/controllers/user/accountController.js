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

    // Helper: resolve effective school year (request -> active SchoolYear -> settings -> env)
    // ✅ Sử dụng utility function để xác định năm học hiện tại
    const { getEffectiveSchoolYear } = require('../../utils/schoolYearHelper');

    // ✅ Lấy thông tin flags nếu là teacher
    let teacherFlags = null;
    if (teacherId) {
      const Teacher = require('../../models/user/teacher');
      // ✅ QUAN TRỌNG: CHỈ select yearRoles và isLeader (top-level), KHÔNG select top-level isHomeroom/isDepartmentHead/departmentId/currentHomeroomClassId
      const teacher = await Teacher.findById(teacherId).select('isLeader permissions yearRoles');
      if (teacher) {
          // ✅ QUAN TRỌNG: Chỉ lấy flags theo năm học hiện tại (currentYear)
          // Nếu không có yearRoleEntry cho năm hiện tại → không có flag đó trong năm này
          // Role gốc (teacher) giữ nguyên, nhưng flags thay đổi theo năm học
          let roleForYear = null;
          const currentYear = await getEffectiveSchoolYear(req);

          if (currentYear && Array.isArray(teacher.yearRoles) && teacher.yearRoles.length > 0) {
            roleForYear = teacher.yearRoles.find(r => String(r.schoolYear) === String(currentYear)) || null;
          }

        if (currentYear && roleForYear) {
          // ✅ Có yearRoleEntry cho năm hiện tại → dùng flags từ đó (trừ isLeader)
          teacherFlags = {
            isHomeroom: Boolean(roleForYear.isHomeroom),
            isDepartmentHead: Boolean(roleForYear.isDepartmentHead),
            isLeader: Boolean(teacher.isLeader), // ✅ CHỈ lấy từ top-level - BGH được set cứng
            permissions: Array.isArray(roleForYear.permissions) ? roleForYear.permissions : (roleForYear.permissions ? [roleForYear.permissions] : []),
            // ✅ Lấy departmentId và currentHomeroomClassId từ yearRoles
            departmentId: roleForYear.departmentId || null,
            currentHomeroomClassId: roleForYear.currentHomeroomClassId || null
          };
        } else {
          // ✅ Không có yearRoleEntry cho năm hiện tại HOẶC không có currentYear
          // → không có flags trong năm này (trừ isLeader)
          // ✅ QUAN TRỌNG: Không fallback về top-level fields, chỉ sử dụng yearRoles
          teacherFlags = {
            isHomeroom: false,
            isDepartmentHead: false,
            isLeader: Boolean(teacher.isLeader), // ✅ CHỈ lấy từ top-level - BGH được set cứng
            permissions: [],
            departmentId: null,
            currentHomeroomClassId: null
          };
        }
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

    // ✅ Tự động tạo yearRoles cho giáo viên mới dựa trên năm học hiện tại
    const Setting = require('../../models/settings');
    const settings = await Setting.findOne().lean();
    const currentSchoolYear = settings?.currentSchoolYear;
    
    if (currentSchoolYear) {
      // Đảm bảo yearRoles là array
      if (!Array.isArray(teacher.yearRoles)) {
        teacher.yearRoles = [];
      }
      
      // Kiểm tra xem đã có yearRole cho năm học này chưa
      const hasYearRole = teacher.yearRoles.some(yr => String(yr.schoolYear) === String(currentSchoolYear));
      if (!hasYearRole) {
        // Tạo yearRole mới với giá trị mặc định
        teacher.yearRoles.push({
          schoolYear: currentSchoolYear,
          departmentId: null,
          isHomeroom: false,
          isDepartmentHead: false,
          permissions: [],
          currentHomeroomClassId: null
        });
        await teacher.save();
      }
    }

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
    // ✅ Kiểm tra quyền: BGH không được sửa role tài khoản
    const user = req.user;
    if (user?.role === 'teacher' && user?.teacherFlags?.isLeader) {
      return res.status(403).json({ 
        message: 'Ban Giám Hiệu không có quyền sửa role tài khoản. Vui lòng liên hệ quản trị viên.' 
      });
    }

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
      // ✅ Sử dụng utility function để xác định năm học hiện tại
      const { getEffectiveSchoolYear } = require('../../utils/schoolYearHelper');
      const currentYear = await getEffectiveSchoolYear(req);

    const accountsWithPermissions = accounts.map(acc => {
      const accIdStr = acc._id.toString();
      let userInfo = null;
      let teacherFlags = null;
      let yearRoles = null;

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
        // ✅ QUAN TRỌNG: Chỉ lấy flags theo năm học hiện tại (currentYear)
        // Nếu không có yearRoleEntry cho năm hiện tại → không có flag đó trong năm này
        // Role gốc (teacher) giữ nguyên, nhưng flags thay đổi theo năm học
        let roleForYear = null;
        if (currentYear && Array.isArray(teacher.yearRoles) && teacher.yearRoles.length > 0) {
          roleForYear = teacher.yearRoles.find(r => String(r.schoolYear) === String(currentYear)) || null;
        }
        
        if (currentYear && roleForYear) {
          // ✅ Có yearRoleEntry cho năm hiện tại → dùng flags từ đó (trừ isLeader)
          teacherFlags = {
            isHomeroom: Boolean(roleForYear.isHomeroom),
            isDepartmentHead: Boolean(roleForYear.isDepartmentHead),
            isLeader: Boolean(teacher.isLeader), // ✅ CHỈ lấy từ top-level - BGH được set cứng
            permissions: Array.isArray(roleForYear.permissions) ? roleForYear.permissions : (roleForYear.permissions ? [roleForYear.permissions] : []),
            // ✅ Lấy departmentId và currentHomeroomClassId từ yearRoles
            departmentId: roleForYear.departmentId || null,
            currentHomeroomClassId: roleForYear.currentHomeroomClassId || null
          };
        } else if (currentYear && !roleForYear) {
          // ✅ Không có yearRoleEntry cho năm hiện tại → không có flags trong năm này (trừ isLeader)
          teacherFlags = {
            isHomeroom: false,
            isDepartmentHead: false,
            isLeader: Boolean(teacher.isLeader), // ✅ CHỈ lấy từ top-level - BGH được set cứng
            permissions: [],
            departmentId: null,
            currentHomeroomClassId: null
          };
        } else {
          // ✅ Nếu không có currentYear → fallback về legacy (chỉ khi không có năm học)
          // Điều này chỉ xảy ra khi hệ thống chưa có cấu hình năm học
          teacherFlags = {
            isHomeroom: teacher.isHomeroom || false,
            isDepartmentHead: teacher.isDepartmentHead || false,
            isLeader: Boolean(teacher.isLeader), // ✅ CHỈ lấy từ top-level - BGH được set cứng
            permissions: teacher.permissions || [],
            // ✅ Fallback về top-level nếu không có yearRoles
            departmentId: teacher.departmentId || null,
            currentHomeroomClassId: teacher.currentHomeroomClassId || null
          };
        }
        // ✅ Trả về cả yearRoles để frontend có thể hiển thị quyền theo năm
        yearRoles = Array.isArray(teacher.yearRoles) ? teacher.yearRoles.map(yr => ({
          schoolYear: yr.schoolYear,
          isHomeroom: Boolean(yr.isHomeroom),
          isDepartmentHead: Boolean(yr.isDepartmentHead),
          isLeader: Boolean(yr.isLeader),
          permissions: Array.isArray(yr.permissions) ? yr.permissions : (yr.permissions ? [yr.permissions] : []),
          // ✅ Thêm departmentId và currentHomeroomClassId vào yearRoles response
          departmentId: yr.departmentId || null,
          currentHomeroomClassId: yr.currentHomeroomClassId || null
        })) : [];
      } else if (acc.role === 'admin' && adminMap.has(accIdStr)) {
        const admin = adminMap.get(accIdStr);
        userInfo = {
          _id: admin._id,
          name: admin.name,
          code: null,
          type: 'admin'
        };
      }

      const result = {
        ...acc,
        userInfo,
        teacherFlags
      };
      
      // ✅ Chỉ thêm yearRoles nếu là teacher
      if (yearRoles !== null) {
        result.yearRoles = yearRoles;
      }
      
      return result;
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
 * 🔒 Khóa tài khoản (không cho đăng nhập)
 * Chỉ Admin mới có quyền khóa tài khoản
 */
exports.lockAccount = async (req, res) => {
  try {
    // ✅ Kiểm tra quyền: BGH không được khóa tài khoản
    const user = req.user;
    if (user?.role === 'teacher' && user?.teacherFlags?.isLeader) {
      return res.status(403).json({ 
        message: 'Ban Giám Hiệu không có quyền khóa tài khoản. Vui lòng liên hệ quản trị viên.' 
      });
    }

    const { accountId } = req.params;
    const { reason } = req.body;
    const adminAccountId = req.user?.accountId; // Admin đang thực hiện khóa

    if (!accountId) {
      return res.status(400).json({ message: 'Thiếu accountId' });
    }

    const account = await Account.findById(accountId);
    if (!account) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    }

    // ✅ Không cho phép khóa chính mình
    if (String(account._id) === String(adminAccountId)) {
      return res.status(400).json({ message: 'Không thể khóa chính tài khoản của bạn' });
    }

    // ✅ Khóa tài khoản
    account.isLocked = true;
    account.lockedAt = new Date();
    account.lockedBy = adminAccountId;
    account.lockReason = reason || 'Tài khoản bị khóa bởi quản trị viên';
    await account.save();

    // ✅ Vô hiệu hóa tài khoản trên Firebase
    try {
      if (account.uid) {
        await admin.auth().updateUser(account.uid, { disabled: true });
      }
    } catch (firebaseError) {
      console.error('❌ Lỗi khi vô hiệu hóa tài khoản trên Firebase:', firebaseError);
      // Không throw error, chỉ log vì đã khóa trong DB
    }

    res.json({
      message: 'Đã khóa tài khoản thành công',
      account: {
        _id: account._id,
        email: account.email,
        phone: account.phone,
        role: account.role,
        isLocked: account.isLocked,
        lockedAt: account.lockedAt,
        lockReason: account.lockReason
      }
    });
  } catch (error) {
    console.error('Error locking account:', error);
    res.status(500).json({ 
      message: 'Lỗi khi khóa tài khoản', 
      error: error.message 
    });
  }
};

/**
 * 🔓 Mở khóa tài khoản (cho phép đăng nhập lại)
 * Chỉ Admin mới có quyền mở khóa tài khoản
 */
exports.unlockAccount = async (req, res) => {
  try {
    // ✅ Kiểm tra quyền: BGH không được mở khóa tài khoản
    const user = req.user;
    if (user?.role === 'teacher' && user?.teacherFlags?.isLeader) {
      return res.status(403).json({ 
        message: 'Ban Giám Hiệu không có quyền mở khóa tài khoản. Vui lòng liên hệ quản trị viên.' 
      });
    }

    const { accountId } = req.params;

    if (!accountId) {
      return res.status(400).json({ message: 'Thiếu accountId' });
    }

    const account = await Account.findById(accountId);
    if (!account) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    }

    // ✅ Mở khóa tài khoản
    account.isLocked = false;
    account.lockedAt = undefined;
    account.lockedBy = undefined;
    account.lockReason = undefined;
    await account.save();

    // ✅ Kích hoạt lại tài khoản trên Firebase
    try {
      if (account.uid) {
        await admin.auth().updateUser(account.uid, { disabled: false });
      }
    } catch (firebaseError) {
      console.error('❌ Lỗi khi kích hoạt lại tài khoản trên Firebase:', firebaseError);
      // Không throw error, chỉ log vì đã mở khóa trong DB
    }

    res.json({
      message: 'Đã mở khóa tài khoản thành công',
      account: {
        _id: account._id,
        email: account.email,
        phone: account.phone,
        role: account.role,
        isLocked: account.isLocked
      }
    });
  } catch (error) {
    console.error('Error unlocking account:', error);
    res.status(500).json({ 
      message: 'Lỗi khi mở khóa tài khoản', 
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
    const { 
      isHomeroom, 
      isDepartmentHead, 
      isLeader, 
      permissions, 
      year: targetYear,
      currentHomeroomClassId, // ✅ Cho phép admin set trực tiếp lớp chủ nhiệm
      departmentId // ✅ Cho phép admin set trực tiếp tổ bộ môn
    } = req.body;
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

    // ✅ CHỈ cho phép cập nhật isLeader (BGH) từ trang permissions
    // isHomeroom và isDepartmentHead được tự động quản lý khi gán lớp chủ nhiệm/tổ bộ môn
    if (typeof isLeader === 'boolean') {
      teacher.isLeader = isLeader;
    }
    // ✅ Bỏ qua isHomeroom và isDepartmentHead từ request body
    // (chỉ cho phép set qua gán lớp chủ nhiệm/tổ bộ môn)
    if (Array.isArray(permissions)) {
      if (targetYear) {
        // Cập nhật hoặc tạo entry trong yearRoles
        if (!Array.isArray(teacher.yearRoles)) teacher.yearRoles = [];
        let yr = teacher.yearRoles.find(r => String(r.schoolYear) === String(targetYear));
        if (!yr) {
          yr = { schoolYear: targetYear };
          teacher.yearRoles.push(yr);
        }
        yr.permissions = permissions;
      } else {
        teacher.permissions = permissions;
      }
    }

    // ✅ CHỈ cập nhật permissions vào yearRoles (nếu có targetYear)
    // ✅ isHomeroom và isDepartmentHead được tự động quản lý khi gán lớp chủ nhiệm/tổ bộ môn
    // ✅ KHÔNG cho phép admin chỉnh isHomeroom và isDepartmentHead từ trang permissions
    if (targetYear) {
      if (!Array.isArray(teacher.yearRoles)) teacher.yearRoles = [];
      let yr = teacher.yearRoles.find(r => String(r.schoolYear) === String(targetYear));
      if (!yr) {
        yr = { schoolYear: targetYear };
        teacher.yearRoles.push(yr);
      }
      
      // ✅ CHỈ cập nhật permissions, KHÔNG cập nhật isHomeroom và isDepartmentHead
      // (các quyền này được tự động set khi gán lớp chủ nhiệm/tổ bộ môn)
      
      // ✅ KHÔNG cho phép set currentHomeroomClassId và departmentId từ trang permissions
      // (chỉ cho phép set qua gán lớp chủ nhiệm/tổ bộ môn)
      // Nếu admin cần set, phải làm từ trang "Quản lý lớp học" hoặc "Quản lý tổ bộ môn"
      
      // ✅ Bỏ qua isHomeroom, isDepartmentHead, currentHomeroomClassId và departmentId từ request body
      // (chỉ cho phép set qua gán lớp chủ nhiệm/tổ bộ môn)
    } else {
      // ✅ Legacy mode (không có targetYear) - CHỈ cập nhật permissions ở top-level
      // KHÔNG cập nhật isHomeroom và isDepartmentHead từ trang permissions
    }
    
    // ✅ isLeader CHỈ được cập nhật ở top-level (không phụ thuộc vào targetYear)
    if (typeof isLeader === 'boolean') {
      teacher.isLeader = isLeader;
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
        permissions: (targetYear && Array.isArray(teacher.yearRoles))
          ? (teacher.yearRoles.find(r => String(r.schoolYear) === String(targetYear))?.permissions || teacher.permissions)
          : teacher.permissions
      }
    });
  } catch (error) {
    console.error('Error updating teacher flags:', error);
    res.status(500).json({ message: 'Lỗi khi cập nhật quyền giáo viên', error: error.message });
  }
};