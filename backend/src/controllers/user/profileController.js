// src/controllers/user/profileController.js
const User = require('../../models/user/user');
const Account = require('../../models/user/account');
const admin = require('../../config/firebaseAdmin');

// 🧠 Lấy thông tin cá nhân
exports.getProfile = async (req, res) => {
  try {
    const { uid } = req.user;
    if (!uid) return res.status(401).json({ message: 'UID không tồn tại' });

    // Lấy account
    const account = await Account.findOne({ uid });
    if (!account) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });

    // Lấy user liên kết với account
    const user = await User.findOne({ accountId: account._id });

    // Xác định type và id
    let teacherId = null;
    let studentId = null;
    let adminId = null;
    if (user) {
      if (user.__t === 'Teacher') teacherId = user._id.toString();
      if (user.__t === 'Student') studentId = user._id.toString();
      if (user.__t === 'Admin') adminId = user._id.toString();
    }

    res.json({
      uid,
      accountId: account._id,
      email: account.email,
      role: account.role,
      name: user?.name || null,
      address: user?.address || null,
      phone: user?.phone || null,
      dob: user?.dob || null,
      gender: user?.gender || null,
      // admin info
      adminId,
      department: user?.department || null,
      position: user?.position || null,
      // student info
      studentId,
      class: user?.classId?.name || null,
      // teacher info
      teacherId,
      subjects: user?.subjects || [],
    });
  } catch (error) {
    console.error('getProfile error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✏️ Cập nhật thông tin cá nhân
exports.updateProfile = async (req, res) => {
  try {
    const { uid } = req.user;
    const { name, address, phone, dob, gender } = req.body;

    const account = await Account.findOne({ uid });
    if (!account) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });

    // Lấy user liên kết account
    const user = await User.findOneAndUpdate(
      { accountId: account._id },
      { name, address, phone, dob, gender },
      { new: true }
    );

    res.json({ message: 'Cập nhật thành công', user });
  } catch (error) {
    console.error('updateProfile error:', error);
    res.status(500).json({ message: error.message });
  }
};

// 🔑 Đổi mật khẩu
exports.changePassword = async (req, res) => {
  try {
    const { uid } = req.user;
    const { newPassword } = req.body;

    if (!newPassword) return res.status(400).json({ message: 'Mật khẩu mới không được để trống' });

    await admin.auth().updateUser(uid, { password: newPassword });

    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    console.error('changePassword error:', error);
    res.status(500).json({ message: error.message });
  }
};
