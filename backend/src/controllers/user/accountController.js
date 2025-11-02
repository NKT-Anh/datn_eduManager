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