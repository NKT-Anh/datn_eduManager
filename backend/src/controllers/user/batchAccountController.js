const Setting = require('../../models/settings');
const Account = require('../../models/user/account');
const Student = require('../../models/user/student');
const Teacher = require('../../models/user/teacher');
const admin = require('../../config/firebaseAdmin');
const User = require('../../models/user/user');

const generatePassword = () => Math.random().toString(36).slice(-8); // random 8 ký tự

/**
 * 🧠 Lấy mật khẩu mặc định từ Setting (hoặc fallback)
 */
const getDefaultPassword = async () => {
  const setting = await Setting.findOne({});
  return setting?.defaultPassword || '12345678';
};

/**
 * 📦 Hàm dùng chung để tạo tài khoản Firebase + MongoDB
 */
const createAccountIfNotExists = async (email, role, phone, defaultPassword) => {
  try {
    // 🔹 Kiểm tra xem tài khoản này đã có trong Mongo chưa
    const existed = await Account.findOne({ email });
    if (existed) return { existed: true, email };

    // 🔹 Kiểm tra Firebase (nếu email đã tồn tại)
    try {
      const firebaseExisting = await admin.auth().getUserByEmail(email);
      if (firebaseExisting) return { existed: true, email };
    } catch (_) {
      // không có thì tiếp tục
    }

    // 🔹 Tạo tài khoản Firebase
    const firebaseUser = await admin.auth().createUser({
      email,
      password: defaultPassword,
    });

    // 🔹 Lưu vào Mongo
    const accountData = {
  uid: firebaseUser.uid,
  email,
  role,
};

if (phone && phone.trim() !== '') {
  accountData.phone = phone.trim();
}

const account = await Account.create(accountData);

 console.log('✅ Mongo Account created:', account);
    return {
      existed: false,
      email,
      uid: firebaseUser.uid,
      password: defaultPassword,
      accountId: account._id,
    };
  } catch (err) {
    console.error(`[ERROR] createAccountIfNotExists(${email}):`, err.message);
    return { error: err.message, email };
  }
};

/**
 * 📚 Tạo tài khoản học sinh hàng loạt
 */
const createBatchStudents = async (req, res) => {
  try {
    const { students } = req.body; // [{ _id, name, studentCode, phone }]
    if (!students?.length)
      return res.status(400).json({ message: 'Thiếu danh sách học sinh' });

    const setting = await Setting.findOne({});
    if (!setting)
      return res.status(500).json({ message: 'Setting chưa được cấu hình' });

    const domain = setting.studentEmailDomain || 'student.school.com';
    const defaultPassword = await getDefaultPassword();
    const createdAccounts = [];
    const existedAccounts = [];

    for (const s of students) {
      const studentCode =
        s.studentCode ||
        s.code ||
        s._id?.slice(-6) ||
        s.name.replace(/\s+/g, '').toLowerCase();
      const email = `${studentCode}@${domain}`;

      const result = await createAccountIfNotExists(
        email,
        'student',
        s.phone,
        defaultPassword
      );

      if (result.existed) {
  // 🔹 Nếu Account tồn tại, lấy nó ra và gắn lại vào Student
  const existedAcc = await Account.findOne({ email });
  if (existedAcc) {
    await Student.findByIdAndUpdate(s._id, { accountId: existedAcc._id });
    existedAccounts.push(result.email);
  }
}

      else if (result.error) existedAccounts.push(`${result.email} (lỗi: ${result.error})`);
      else {
        const updatedStudent = await User.findByIdAndUpdate(
  s._id,
  { accountId: result.accountId },
  { new: true }
);

if (updatedStudent)
  console.log(`✅ Gắn accountId cho ${updatedStudent.name}`);
else
  console.warn(`⚠️ Không tìm thấy học sinh có id ${s._id}`);

console.log(`✅ Gắn accountId cho ${updatedStudent.name}`);
        createdAccounts.push({
          email: result.email,
          password: result.password,
          uid: result.uid,
        });
      }
    }

    res.json({
      message: 'Tạo tài khoản học sinh hàng loạt hoàn tất',
      defaultPassword,
      createdAccounts,
      existedAccounts,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: 'Lỗi tạo tài khoản học sinh', error: err.message });
  }
};

/**
 * 👩‍🏫 Tạo tài khoản giáo viên hàng loạt
 */
const createBatchTeachers = async (req, res) => {
  try {
    const { teachers } = req.body; // [{ _id, name, teacherCode, phone }]
    if (!teachers?.length)
      return res.status(400).json({ message: 'Thiếu danh sách giáo viên' });

    const setting = await Setting.findOne({});
    if (!setting)
      return res.status(500).json({ message: 'Setting chưa được cấu hình' });

    const domain = setting.teacherEmailDomain || 'teacher.school.com';
    const defaultPassword = await getDefaultPassword();
    const createdAccounts = [];
    const existedAccounts = [];

    for (const t of teachers) {
      const teacherCode =
        t.teacherCode ||
        t.code ||
        t._id?.slice(-6) ||
        t.name.replace(/\s+/g, '').toLowerCase();
      const email = `${teacherCode}@${domain}`;

      const result = await createAccountIfNotExists(
        email,
        'teacher',
        t.phone,
        defaultPassword
      );

      if (result.existed) existedAccounts.push(result.email);
      else if (result.error) existedAccounts.push(`${result.email} (lỗi: ${result.error})`);
      else {
        await Teacher.findByIdAndUpdate(t._id, { accountId: result.accountId }, { new: true });

        createdAccounts.push({
          email: result.email,
          password: result.password,
          uid: result.uid,
        });
      }
    }

    res.json({
      message: 'Tạo tài khoản giáo viên hàng loạt hoàn tất',
      defaultPassword,
      createdAccounts,
      existedAccounts,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: 'Lỗi tạo tài khoản giáo viên', error: err.message });
  }
};

/**
 * 📦 Tạo tài khoản hàng loạt cho các role khác (admin, bgh, qlbm, gvcn, gvbm)
 */
const createBatchAccounts = async (req, res) => {
  try {
    const { users, role } = req.body; // [{ _id, name, code, phone, email? }], role: 'admin' | 'bgh' | 'qlbm' | 'gvcn' | 'gvbm'
    
    if (!users?.length)
      return res.status(400).json({ message: 'Thiếu danh sách người dùng' });
    
    if (!role || !['admin', 'bgh', 'qlbm', 'gvcn', 'gvbm'].includes(role))
      return res.status(400).json({ message: 'Role không hợp lệ. Chỉ chấp nhận: admin, bgh, qlbm, gvcn, gvbm' });

    const setting = await Setting.findOne({});
    if (!setting)
      return res.status(500).json({ message: 'Setting chưa được cấu hình' });

    // Domain theo role
    // Lưu ý: GVCN, GVBM, QLBM đều dùng chung domain giáo viên để tránh mất dữ liệu khi đổi role
    const domainMap = {
      admin: setting.adminEmailDomain || 'admin.school.com',
      bgh: setting.bghEmailDomain || 'bgh.school.com',
      qlbm: setting.teacherEmailDomain || 'teacher.school.com', // Dùng chung domain giáo viên
      gvcn: setting.teacherEmailDomain || 'teacher.school.com',
      gvbm: setting.teacherEmailDomain || 'teacher.school.com',
    };
    
    const domain = domainMap[role];
    const defaultPassword = await getDefaultPassword();
    const createdAccounts = [];
    const existedAccounts = [];
    const Admin = require('../../models/user/admin');

    for (const user of users) {
      // Tạo email từ code hoặc name
      const code = user.code || user.teacherCode || user.adminCode || 
                   user._id?.slice(-6) || 
                   user.name.replace(/\s+/g, '').toLowerCase();
      const email = user.email || `${code}@${domain}`;

      const result = await createAccountIfNotExists(
        email,
        role,
        user.phone,
        defaultPassword
      );

      if (result.existed) {
        existedAccounts.push(result.email);
        // Nếu Account tồn tại, gắn lại vào User nếu có _id
        if (user._id) {
          const existedAcc = await Account.findOne({ email });
          if (existedAcc) {
            // Cập nhật User model tương ứng
            if (role === 'admin') {
              await Admin.findByIdAndUpdate(user._id, { accountId: existedAcc._id });
            } else if (['bgh', 'qlbm', 'gvcn', 'gvbm'].includes(role)) {
              // Các role này đều là Teacher với role khác nhau
              await Teacher.findByIdAndUpdate(user._id, { accountId: existedAcc._id });
            }
          }
        }
      } else if (result.error) {
        existedAccounts.push(`${result.email} (lỗi: ${result.error})`);
      } else {
        // Gắn accountId vào User model
        if (user._id) {
          if (role === 'admin') {
            await Admin.findByIdAndUpdate(user._id, { accountId: result.accountId });
          } else if (['bgh', 'qlbm', 'gvcn', 'gvbm'].includes(role)) {
            // Các role này đều là Teacher
            await Teacher.findByIdAndUpdate(user._id, { accountId: result.accountId });
          }
        }

        createdAccounts.push({
          email: result.email,
          password: result.password,
          uid: result.uid,
        });
      }
    }

    res.json({
      message: `Tạo tài khoản ${role} hàng loạt hoàn tất`,
      defaultPassword,
      createdAccounts,
      existedAccounts,
      role,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: `Lỗi tạo tài khoản ${req.body.role}`, error: err.message });
  }
};

/**
 * 🔁 Reset mật khẩu hàng loạt
 */
const resetAccountsPassword = async (req, res) => {
  try {
    const { accountIds } = req.body;
    if (!accountIds?.length)
      return res.status(400).json({ message: 'Thiếu danh sách accountIds' });

    const defaultPassword = await getDefaultPassword();
    const accounts = await Account.find({ _id: { $in: accountIds } });

    const results = [];
    for (const acc of accounts) {
      try {
        await admin.auth().updateUser(acc.uid, { password: defaultPassword });
        results.push({ email: acc.email, uid: acc.uid });
      } catch (err) {
        console.warn(
          `[WARN] Reset password lỗi cho ${acc.email}: ${err.message}`
        );
      }
    }

    res.json({
      message: 'Đặt lại mật khẩu thành công',
      defaultPassword,
      count: results.length,
      results,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: 'Lỗi khi đặt lại mật khẩu', error: err.message });
  }
};

/**
 * 📋 Lấy danh sách toàn bộ tài khoản (học sinh + giáo viên + admin nếu có)
 */
const getAllAccounts = async (req, res) => {
  try {
    // 🔹 Lấy tất cả tài khoản
    const accounts = await Account.find({}).lean();

    // 🔹 Lấy toàn bộ học sinh, giáo viên và admin (chỉ lấy các trường cần)
    const students = await Student.find({}, 'name studentCode accountId').lean();
    const teachers = await Teacher.find({}, 'name teacherCode accountId').lean();
    const Admin = require('../../models/user/admin');
    const admins = await Admin.find({}, 'name accountId').lean();

    // 🔹 Tạo map để tra cứu nhanh bằng accountId
    const studentMap = new Map(
      students
        .filter((s) => s.accountId)
        .map((s) => [s.accountId.toString(), s])
    );
    const teacherMap = new Map(
      teachers
        .filter((t) => t.accountId)
        .map((t) => [t.accountId.toString(), t])
    );
    const adminMap = new Map(
      admins
        .filter((a) => a.accountId)
        .map((a) => [a.accountId.toString(), a])
    );

    // 🔹 Gắn thêm thông tin liên kết vào từng account
    const fullAccounts = accounts.map((acc) => {
      const accIdStr = acc._id.toString();
      let linked = null;

      if (acc.role === 'student' && studentMap.has(accIdStr)) {
        const s = studentMap.get(accIdStr);
        linked = {
          linkedId: s._id,
          linkedName: s.name,
          linkedCode: s.studentCode,
        };
      } else if (['teacher', 'bgh', 'qlbm', 'gvcn', 'gvbm'].includes(acc.role) && teacherMap.has(accIdStr)) {
        const t = teacherMap.get(accIdStr);
        linked = {
          linkedId: t._id,
          linkedName: t.name,
          linkedCode: t.teacherCode,
        };
      } else if (acc.role === 'admin' && adminMap.has(accIdStr)) {
        const a = adminMap.get(accIdStr);
        linked = {
          linkedId: a._id,
          linkedName: a.name,
          linkedCode: null,
        };
      }

      return {
        ...acc,
        linkedId: linked?.linkedId || null,
        linkedName: linked?.linkedName || null,
        linkedCode: linked?.linkedCode || null,
      };
    });

    // 🔹 Trả kết quả
    res.json({
      message: 'Lấy danh sách tài khoản thành công',
      count: fullAccounts.length,
      data: fullAccounts,
    });
  } catch (err) {
    console.error('[getAllAccounts]', err);
    res.status(500).json({
      message: 'Lỗi khi lấy danh sách tài khoản',
      error: err.message,
    });
  }
};

// 🧩 Xóa nhiều tài khoản: xóa Firebase + Account + gỡ liên kết Student/Teacher
const deleteAccounts = async (req, res) => {
  try {
    const { accountIds } = req.body;
    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return res
        .status(400)
        .json({ message: 'Danh sách tài khoản không hợp lệ' });
    }

    // Lấy các account theo ids
    const accounts = await Account.find({ _id: { $in: accountIds } }).lean();
    if (!accounts.length) {
      return res.json({
        success: true,
        deletedCount: 0,
        details: [],
        warnings: ['Không tìm thấy tài khoản nào phù hợp'],
      });
    }

    const details = [];
    const firebaseErrors = [];
    const unlinkErrors = [];
    const notFoundOnFirebase = [];

    // Xóa trên Firebase trước (best-effort)
    for (const acc of accounts) {
      if (!acc.uid) {
        notFoundOnFirebase.push(acc.email);
        continue;
      }
      try {
        await admin.auth().deleteUser(acc.uid);
        details.push({ email: acc.email, step: 'firebaseDeleted' });
      } catch (e) {
        // Không chặn toàn batch, ghi nhận lỗi
        firebaseErrors.push({ email: acc.email, error: e.message });
      }
    }

    // Gỡ liên kết ở Student/Teacher/Admin theo role và accountId
    const Admin = require('../../models/user/admin');
    for (const acc of accounts) {
      try {
        if (acc.role === 'student') {
          await Student.updateMany(
            { accountId: acc._id },
            { $unset: { accountId: '' } }
          );
        } else if (['teacher', 'bgh', 'qlbm', 'gvcn', 'gvbm'].includes(acc.role)) {
          await Teacher.updateMany(
            { accountId: acc._id },
            { $unset: { accountId: '' } }
          );
        } else if (acc.role === 'admin') {
          await Admin.updateMany(
            { accountId: acc._id },
            { $unset: { accountId: '' } }
          );
        }
        details.push({ email: acc.email, step: 'unlinked' });
      } catch (e) {
        unlinkErrors.push({ email: acc.email, error: e.message });
      }
    }

    // Xóa bản ghi Account trong Mongo
    const mongoDeleteResult = await Account.deleteMany({
      _id: { $in: accounts.map((a) => a._id) },
    });

    res.json({
      success: true,
      deletedCount: mongoDeleteResult.deletedCount,
      details,
      warnings: [
        ...(firebaseErrors.length
          ? [`Firebase errors: ${firebaseErrors.length}`]
          : []),
        ...(unlinkErrors.length
          ? [`Unlink errors: ${unlinkErrors.length}`]
          : []),
        ...(notFoundOnFirebase.length
          ? [
              `Missing uid or not in Firebase: ${notFoundOnFirebase.length}`,
            ]
          : []),
      ],
      firebaseErrors,
      unlinkErrors,
      missingFirebase: notFoundOnFirebase,
    });
  } catch (error) {
    console.error('[deleteAccounts]', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createBatchStudents,
  createBatchTeachers,
  createBatchAccounts,
  resetAccountsPassword,
  getAllAccounts,
  deleteAccounts,
};