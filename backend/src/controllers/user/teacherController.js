const Teacher = require('../../models/user/teacher');
const Class = require('../../models/class/class');
const { getCurrentSchoolYear } = require('../../utils/schoolYearHelper');

const populatedTeacher = (query) => {
  return query
    .populate('subjects.subjectId', 'name code')
    .populate('mainSubject', 'name code')
    .populate('homeroomClassIds', 'className classCode grade year')
    .populate('currentHomeroomClassId', 'className classCode grade year')
    .populate('departmentId', 'name code');
};


// Lấy tất cả giáo viên
exports.getAllTeachers = async (req, res) => {
  try {
    // ✅ Filter isDeleted = false mặc định (bao gồm cả undefined/null cho dữ liệu cũ)
    const { isDeleted = 'false' } = req.query;
    const query = isDeleted === 'true' 
      ? { isDeleted: true }
      : { isDeleted: { $ne: true } }; // Lấy tất cả trừ true (false, null, undefined)

    const teachers = await populatedTeacher(Teacher.find(query));

    res.json(teachers);
  } catch (error) {
    console.error('❌ Lỗi khi lấy danh sách giáo viên:', error);
    res.status(500).json({
      message: 'Lỗi khi lấy danh sách giáo viên',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Lấy 1 giáo viên theo id
exports.getTeacher = async (req, res) => {
  const { id } = req.params;
  try {
    // ✅ Admin có thể xem tất cả (bao gồm đã xóa), user thường chỉ xem chưa xóa
    const { isDeleted } = req.query;
    const query = { _id: id };

    if (isDeleted !== 'true') {
      query.isDeleted = { $ne: true };
    }

    const teacher = await populatedTeacher(Teacher.findOne(query));

    if (!teacher) return res.status(404).json({ message: 'Không tìm thấy giáo viên' });

    res.json(teacher);
  } catch (error) {
    console.error('❌ Lỗi khi lấy giáo viên:', error);
    res.status(500).json({
      message: 'Lỗi khi xem 1 giáo viên',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Tạo giáo viên mới
// ✅ Helper function để tạo yearRoles cho giáo viên mới
async function initializeTeacherYearRole(teacherId, schoolYear = null) {
  try {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return;

    // ✅ Lấy năm học hiện tại nếu không được cung cấp
    let targetYear = schoolYear;
    if (!targetYear) {
      targetYear = await getCurrentSchoolYear();
    }

    if (!targetYear) {
      console.warn('Không tìm thấy năm học, bỏ qua tạo yearRoles cho giáo viên mới');
      return;
    }

    // Đảm bảo yearRoles là array
    if (!Array.isArray(teacher.yearRoles)) {
      teacher.yearRoles = [];
    }

    // Kiểm tra xem đã có yearRole cho năm học này chưa
    const hasYearRole = teacher.yearRoles.some(yr => String(yr.schoolYear) === String(targetYear));
    if (!hasYearRole) {
      // Tạo yearRole mới với giá trị mặc định
      teacher.yearRoles.push({
        schoolYear: targetYear,
        departmentId: null,
        isHomeroom: false,
        isDepartmentHead: false,
        permissions: [],
        currentHomeroomClassId: null
      });
      await teacher.save();
    }
  } catch (error) {
    console.error('Error initializing teacher yearRole:', error);
  }
}

exports.createTeacher = async (req, res) => {
  try {
    // ✅ Kiểm tra quyền: BGH không được thêm giáo viên
    const user = req.user;
    if (user?.role === 'teacher' && user?.teacherFlags?.isLeader) {
      return res.status(403).json({ 
        message: 'Ban Giám Hiệu không có quyền thêm giáo viên. Vui lòng liên hệ quản trị viên.' 
      });
    }

    const code = `gv${Date.now().toString().slice(-5)}`;
    const teacher = await Teacher.create({
      ...req.body,
      teacherCode: code,
      maxClasses: req.body.maxClasses || 3
    });

    // ✅ Tự động tạo yearRoles cho giáo viên mới dựa trên năm học hiện tại
    await initializeTeacherYearRole(teacher._id);

    // Populate dữ liệu ngay sau khi tạo
    const teacherPopulated = await populatedTeacher(Teacher.findById(teacher._id));

    res.status(201).json(teacherPopulated);
  } catch (error) {
    console.error('❌ Lỗi khi tạo giáo viên:', error);
    res.status(400).json({ 
      message: 'Không thể tạo giáo viên', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Cập nhật giáo viên
exports.updateTeacher = async (req, res) => {
  try {
    // ✅ Kiểm tra quyền: BGH không được sửa thông tin giáo viên
    const user = req.user;
    if (user?.role === 'teacher' && user?.teacherFlags?.isLeader) {
      return res.status(403).json({ 
        message: 'Ban Giám Hiệu không có quyền sửa thông tin giáo viên. Vui lòng liên hệ quản trị viên.' 
      });
    }

    const { phone, email } = req.body;
    
    // ✅ Không cho phép bất kỳ ai sửa email đăng nhập (chỉ Admin có thể qua route riêng)
    if (email) {
      return res.status(403).json({ 
        message: 'Không được phép thay đổi email đăng nhập. Vui lòng liên hệ quản trị viên.' 
      });
    }
    
    // ✅ Nếu có thay đổi số điện thoại, đồng bộ vào Account và Firebase (chỉ Admin)
    if (phone) {
      const teacher = await Teacher.findById(req.params.id);
      if (teacher && teacher.accountId) {
        const Account = require('../../models/user/account');
        const admin = require('../../config/firebaseAdmin');
        const account = await Account.findById(teacher.accountId);
        
        if (account) {
          // Format phone number (đảm bảo có +84)
          let formattedPhone = phone.trim();
          if (!formattedPhone.startsWith('+')) {
            if (formattedPhone.startsWith('0')) {
              formattedPhone = '+84' + formattedPhone.substring(1);
            } else {
              formattedPhone = '+84' + formattedPhone;
            }
          }

          // Cập nhật trong Account model
          account.phone = formattedPhone;
          await account.save();

          // Cập nhật trong Firebase
          try {
            await admin.auth().updateUser(account.uid, {
              phoneNumber: formattedPhone,
            });
            console.log(`✅ Đã cập nhật số điện thoại giáo viên trong Firebase: ${formattedPhone}`);
          } catch (firebaseError) {
            console.error('⚠️ Lỗi cập nhật số điện thoại trong Firebase:', firebaseError);
          }
        }
      }
    }

    const teacher = await populatedTeacher(Teacher.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ));

    if (!teacher) return res.status(404).json({ message: 'Không tìm thấy giáo viên' });

    res.json(teacher);
  } catch (error) {
    res.status(400).json({ message: 'Không thể cập nhật giáo viên', error });
  }
};

// Xóa giáo viên
// ✅ Soft Delete - Xóa mềm giáo viên (chỉ đánh dấu, không xóa thật)
exports.deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const teacher = await Teacher.findById(id);
    
    if (!teacher) {
      return res.status(404).json({ message: 'Không tìm thấy giáo viên' });
    }

    // ✅ Đánh dấu isDeleted = true (soft delete)
    teacher.isDeleted = true;
    teacher.status = 'inactive'; // Đồng thời cập nhật status
    await teacher.save();

    res.json({ 
      message: 'Đã xóa giáo viên thành công (soft delete)',
      teacher: teacher
    });
  } catch (error) {
    console.error('❌ Lỗi khi xóa giáo viên:', error);
    res.status(400).json({ 
      message: 'Không thể xóa giáo viên', 
      error: error.message 
    });
  }
};

// Phân công giáo viên chủ nhiệm
exports.assignHomeroom = async (req, res) => {
  try {
    const { teacherId, classId } = req.body;

    const teacher = await populatedTeacher(Teacher.findByIdAndUpdate(
      teacherId,
      { $addToSet: { homeroomClassIds: classId } },
      { new: true }
    )
    );

    if (!teacher) return res.status(404).json({ message: 'Không tìm thấy giáo viên' });

    const classObj = await Class.findByIdAndUpdate(
      classId,
      { homeRoomTeacher: teacherId },
      { new: true }
    );

    res.json({ teacher, class: classObj });
  } catch (error) {
    res.status(400).json({ message: 'Không thể phân công giáo viên chủ nhiệm', error });
  }
};
// Lấy danh sách giáo viên theo filter
exports.filterTeachers = async (req, res) => {
  try {
    const { subjectId, grade, classId, status } = req.query;

    // Tạo object query
    const query = {};

    if (status) {
      query.status = status; // active / inactive
    }

    if (subjectId) {
      query['subjects.subjectId'] = subjectId;
    }

    if (grade) {
      query['subjects.grades'] = grade; // kiểm tra trong mảng grades
    }

    // ✅ classIds đã bị loại bỏ, thông tin phân công lớp được quản lý qua TeachingAssignment
    // if (classId) {
    //   query.classIds = classId; // các lớp phụ trách
    // }

    const teachers = await populatedTeacher(Teacher.find(query));

    res.json(teachers);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lọc danh sách giáo viên', error });
  }
};

// Cập nhật lịch rảnh cho giáo viên
// exports.updateAvailability = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { availableMatrix } = req.body;

//     // Kiểm tra input
//     if (
//       !Array.isArray(availableMatrix) ||
//       availableMatrix.length !== 6 ||
//       !availableMatrix.every(row => Array.isArray(row) && row.length === 10)
//     ) {
//       return res.status(400).json({
//         message: 'Cấu trúc availableMatrix không hợp lệ. Phải là ma trận 6x10.'
//       });
//     }

//     const teacher = await populatedTeacher(Teacher.findByIdAndUpdate(
//       id,
//       { availableMatrix },
//       { new: true, runValidators: true }
//     ));

//     if (!teacher) {
//       return res.status(404).json({ message: 'Không tìm thấy giáo viên' });
//     }

//     res.json({
//       message: 'Cập nhật lịch rảnh thành công',
//       teacher
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({
//       message: 'Lỗi khi cập nhật lịch rảnh của giáo viên',
//       error: error.message
//     });
//   }
// };

exports.updateAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { availableMatrix } = req.body;
    const userInfo = req.user;

    // ✅ Kiểm tra nếu giáo viên đang cập nhật lịch rảnh của chính mình
    // Nếu không phải admin và id không khớp với teacherId của user, kiểm tra quyền
    if (userInfo.role !== 'admin') {
      const Teacher = require('../models/user/teacher');
      const teacher = await Teacher.findOne({ accountId: userInfo.accountId });
      
      if (!teacher) {
        return res.status(403).json({ 
          message: 'Bạn không phải giáo viên hoặc không có quyền cập nhật lịch rảnh.' 
        });
      }

      // Kiểm tra nếu giáo viên đang cập nhật lịch rảnh của chính mình
      if (String(teacher._id) !== String(id)) {
        return res.status(403).json({ 
          message: 'Bạn chỉ có thể cập nhật lịch rảnh của chính mình.' 
        });
      }
    }

    // 🔍 Kiểm tra dữ liệu hợp lệ (6 ngày × 10 tiết)
    if (
      !Array.isArray(availableMatrix) ||
      availableMatrix.length !== 6 ||
      !availableMatrix.every(
        (row) => Array.isArray(row) && row.length === 10 && row.every(v => typeof v === 'boolean')
      )
    ) {
      return res.status(400).json({
        message: 'Cấu trúc availableMatrix không hợp lệ. Phải là ma trận 6x10 kiểu boolean.'
      });
    }

    // 🧠 Cập nhật dữ liệu
    const teacher = await populatedTeacher(
      Teacher.findByIdAndUpdate(
        id,
        { availableMatrix },
        { new: true, runValidators: true }
      )
    );

    if (!teacher) {
      return res.status(404).json({ message: 'Không tìm thấy giáo viên để cập nhật.' });
    }

    res.json({
      message: '✅ Cập nhật lịch rảnh thành công.',
      teacher
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật lịch rảnh:', error);
    res.status(500).json({
      message: '❌ Đã xảy ra lỗi khi cập nhật lịch rảnh của giáo viên.',
      error: error.message
    });
  }
};

// ✅ Lấy lịch rảnh của chính mình - Giáo viên
exports.getMyAvailability = async (req, res) => {
  try {
    const userInfo = req.user;

    // ✅ Kiểm tra user có phải giáo viên không
    if (!['teacher', 'gvcn', 'gvbm', 'qlbm', 'bgh'].includes(userInfo.role)) {
      return res.status(403).json({ 
        message: 'Chỉ giáo viên mới có thể xem lịch rảnh.' 
      });
    }

    // ✅ Tìm teacher theo accountId
    const teacher = await Teacher.findOne({ accountId: userInfo.accountId });
    
    if (!teacher) {
      return res.status(404).json({ 
        message: 'Không tìm thấy thông tin giáo viên.' 
      });
    }

    res.json({ 
      availableMatrix: teacher.availableMatrix || [],
      teacherId: teacher._id
    });
  } catch (error) {
    console.error('Lỗi khi lấy lịch rảnh:', error);
    res.status(500).json({
      message: '❌ Đã xảy ra lỗi khi lấy lịch rảnh.',
      error: error.message
    });
  }
};

// ✅ Cập nhật lịch rảnh của chính mình - Giáo viên
exports.updateMyAvailability = async (req, res) => {
  try {
    const { availableMatrix } = req.body;
    const userInfo = req.user;

    // ✅ Kiểm tra user có phải giáo viên không
    if (!['teacher', 'gvcn', 'gvbm', 'qlbm', 'bgh'].includes(userInfo.role)) {
      return res.status(403).json({ 
        message: 'Chỉ giáo viên mới có thể cập nhật lịch rảnh.' 
      });
    }

    // ✅ Tìm teacher theo accountId
    const teacher = await Teacher.findOne({ accountId: userInfo.accountId });
    
    if (!teacher) {
      return res.status(404).json({ 
        message: 'Không tìm thấy thông tin giáo viên.' 
      });
    }

    // 🔍 Kiểm tra dữ liệu hợp lệ (6 ngày × 10 tiết)
    if (
      !Array.isArray(availableMatrix) ||
      availableMatrix.length !== 6 ||
      !availableMatrix.every(
        (row) => Array.isArray(row) && row.length === 10 && row.every(v => typeof v === 'boolean')
      )
    ) {
      return res.status(400).json({
        message: 'Cấu trúc availableMatrix không hợp lệ. Phải là ma trận 6x10 kiểu boolean.'
      });
    }

    // 🧠 Cập nhật lịch rảnh
    const updatedTeacher = await populatedTeacher(
      Teacher.findByIdAndUpdate(
        teacher._id,
        { availableMatrix },
        { new: true, runValidators: true }
      )
    );

    if (!updatedTeacher) {
      return res.status(404).json({ message: 'Không tìm thấy giáo viên để cập nhật.' });
    }

    res.json({
      message: '✅ Cập nhật lịch rảnh thành công.',
      teacher: updatedTeacher
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật lịch rảnh:', error);
    res.status(500).json({
      message: '❌ Đã xảy ra lỗi khi cập nhật lịch rảnh.',
      error: error.message
    });
  }
};

exports.getAvailability = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ message: "Không tìm thấy giáo viên" });
    res.json({ availableMatrix: teacher.availableMatrix || [] });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};
exports.updateMaxClasses = async (req, res) => {
  try {
    const { id } = req.params;
    const { maxClasses } = req.body;

    if (typeof maxClasses !== "number" || maxClasses < 1) {
      return res.status(400).json({ message: "maxClasses phải là số nguyên >= 1" });
    }

    const teacher = await populatedTeacher(
      Teacher.findByIdAndUpdate(
        id,
        { maxClasses },
        { new: true, runValidators: true }
      )
    );

    if (!teacher) return res.status(404).json({ message: "Không tìm thấy giáo viên" });

    res.json({ message: "✅ Cập nhật maxClasses thành công", teacher });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi cập nhật maxClasses", error });
  }
};
exports.getMaxClasses = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id).select("maxClasses");
    if (!teacher) return res.status(404).json({ message: "Không tìm thấy giáo viên" });
    res.json({ maxClasses: teacher.maxClasses });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

const normalizeMaxClassPerGrade = (map = {}) => {
  if (!map) return {};
  if (typeof map.toObject === 'function') return map.toObject();
  if (map instanceof Map) return Object.fromEntries(map);
  return map;
};

exports.updateMaxClassPerGrade = async (req, res) => {
  try {
    const { id } = req.params;
    const { maxClassPerGrade } = req.body || {};

    if (!maxClassPerGrade || typeof maxClassPerGrade !== 'object') {
      return res.status(400).json({ message: "maxClassPerGrade phải là một object hợp lệ" });
    }

    const teacher = await Teacher.findById(id);
    if (!teacher) {
      return res.status(404).json({ message: "Không tìm thấy giáo viên" });
    }

    if (req.user.role === 'teacher') {
      const currentTeacher = await Teacher.findOne({ accountId: req.user.accountId })
        .select('isDepartmentHead departmentId')
        .lean();
      if (!currentTeacher || !currentTeacher.isDepartmentHead) {
        return res.status(403).json({ message: "Chỉ trưởng bộ môn mới được cập nhật giới hạn lớp" });
      }
      if (!teacher.departmentId || teacher.departmentId.toString() !== currentTeacher.departmentId?.toString()) {
        return res.status(403).json({ message: "Chỉ được cập nhật giáo viên thuộc tổ bộ môn của bạn" });
      }
    }

    if (!teacher.maxClassPerGrade || !(teacher.maxClassPerGrade instanceof Map)) {
      teacher.maxClassPerGrade = new Map();
    }

    for (const [grade, value] of Object.entries(maxClassPerGrade)) {
      if (!['10', '11', '12'].includes(grade)) continue;
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue) || numericValue < 0) {
        return res.status(400).json({ message: `Giá trị không hợp lệ cho khối ${grade}` });
      }
      teacher.maxClassPerGrade.set(grade, numericValue);
    }

    await teacher.save();

    const updatedTeacher = await Teacher.findById(id)
      .select('name teacherCode maxClassPerGrade departmentId')
      .populate('departmentId', 'name code')
      .lean();

    res.json({
      message: "Đã cập nhật giới hạn số lớp theo khối",
      teacher: {
        ...updatedTeacher,
        maxClassPerGrade: normalizeMaxClassPerGrade(updatedTeacher?.maxClassPerGrade),
      },
    });
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật maxClassPerGrade:", error);
    res.status(500).json({ message: "Không thể cập nhật giới hạn số lớp theo khối", error: error.message });
  }
};

/**
 * ✅ API: Kiểm tra tự động tình trạng giáo viên
 * - Check đủ giáo viên hay không
 * - Gợi ý cần tuyển thêm bao nhiêu giáo viên
 * - Báo giáo viên nào quá tải
 * - Tự tính tổng tiết / giáo viên / tuần
 * 
 * Query params: year (optional, mặc định lấy từ settings)
 */
exports.checkTeacherStatus = async (req, res) => {
  try {
    const Setting = require('../../models/settings');
    const TeachingAssignment = require('../../models/subject/teachingAssignment');
    const ClassPeriods = require('../../models/class/classPeriods');
    const Class = require('../../models/class/class');
    
    // ✅ Lấy năm học & học kỳ từ query hoặc settings
    const { year, semester } = req.query;
    const settings = await Setting.findOne().lean();
    
    // Decode year nếu có ký tự đặc biệt
    let decodedYear = year;
    if (decodedYear) {
      try {
        decodedYear = decodeURIComponent(decodedYear);
      } catch (e) {
        // Nếu decode fail, giữ nguyên
      }
    }
    
    const currentYear = decodedYear || settings?.currentSchoolYear || new Date().getFullYear().toString();
    const currentSemester = semester || settings?.currentSemester || null;
    
    let departmentFilter = null;
    if (req.user?.role === 'teacher' && req.user.accountId) {
      // Prefer teacherFlags populated by authMiddleware (year-aware)
      const teacherFlags = req.user.teacherFlags || null;
      // Still need departmentId from DB
      const currentTeacherDoc = await Teacher.findOne({ 
        accountId: req.user.accountId,
        isDeleted: { $ne: true } // ✅ Chỉ lấy giáo viên chưa bị xóa
      })
        .select('departmentId isDepartmentHead yearRoles')
        .lean();
      const isDeptHead = teacherFlags?.isDepartmentHead ?? Boolean(currentTeacherDoc?.isDepartmentHead);
      
      // ✅ Lấy departmentId từ yearRoles theo năm học hiện tại
      if (isDeptHead && currentTeacherDoc) {
        const roleForYear = Array.isArray(currentTeacherDoc.yearRoles) 
          ? currentTeacherDoc.yearRoles.find(r => String(r.schoolYear) === String(currentYear))
          : null;
        
        const deptId = roleForYear?.departmentId 
          ? (roleForYear.departmentId._id?.toString() || roleForYear.departmentId.toString())
          : (currentTeacherDoc.departmentId?._id?.toString() || currentTeacherDoc.departmentId?.toString());
        
        if (deptId) {
          departmentFilter = deptId;
        }
      }
    }

    // ✅ Lấy tất cả giáo viên active (chưa bị xóa)
    let teachers = await Teacher.find({ 
      status: 'active',
      isDeleted: { $ne: true } // ✅ Chỉ lấy giáo viên chưa bị xóa
    })
      .select('-availableMatrix')
      .populate('subjects.subjectId', 'name code')
      .populate('mainSubject', 'name code')
      .populate('departmentId', 'name code')
      .lean();
    // Compute effective flags per teacher for the currentYear (prefer yearRoles)
    teachers = teachers.map(t => {
      const roleForYear = Array.isArray(t.yearRoles) ? t.yearRoles.find(r => String(r.schoolYear) === String(currentYear)) : null;
      const eff = {
        isHomeroom: roleForYear ? Boolean(roleForYear.isHomeroom) : Boolean(t.isHomeroom) || Boolean(t.currentHomeroomClassId),
        isDepartmentHead: roleForYear ? Boolean(roleForYear.isDepartmentHead) : Boolean(t.isDepartmentHead),
        isLeader: roleForYear ? Boolean(roleForYear.isLeader) : Boolean(t.isLeader),
        permissions: roleForYear ? (roleForYear.permissions || []) : (t.permissions || []),
        currentHomeroomClassId: roleForYear ? (roleForYear.currentHomeroomClassId || null) : (t.currentHomeroomClassId || null)
      };
      return Object.assign({}, t, { _effectiveFlags: eff });
    });
    // ✅ Filter theo department - lấy từ yearRoles theo năm học hiện tại
    if (departmentFilter) {
      teachers = teachers.filter(teacher => {
        // ✅ Ưu tiên lấy departmentId từ yearRoles của năm học hiện tại
        const roleForYear = Array.isArray(teacher.yearRoles) 
          ? teacher.yearRoles.find(r => String(r.schoolYear) === String(currentYear))
          : null;
        const deptId = roleForYear?.departmentId 
          ? roleForYear.departmentId.toString()
          : (teacher.departmentId?._id?.toString() || teacher.departmentId?.toString());
        return deptId && deptId === departmentFilter;
      });
    }
    
    // ✅ Lấy tất cả phân công giảng dạy cho năm học (và học kỳ nếu có)
    const assignmentQuery = { year: currentYear };
    if (currentSemester) assignmentQuery.semester = currentSemester;
    
    let assignments = await TeachingAssignment.find(assignmentQuery)
      .populate('subjectId', 'name code')
      .populate('classId', 'className classCode grade')
      .populate('teacherId', 'name teacherCode')
      .lean();
    if (departmentFilter) {
      const teacherIdsInDepartment = new Set(teachers.map(t => t._id.toString()));
      assignments = assignments.filter(assignment => {
        const teacherId = assignment.teacherId?._id?.toString() || assignment.teacherId?.toString();
        return teacherIdsInDepartment.has(teacherId);
      });
    }
    
    // ✅ Lấy ClassPeriods để tính số tiết cần thiết
    const classPeriodsQuery = { year: currentYear };
    if (currentSemester) classPeriodsQuery.semester = currentSemester;
    
    let classPeriods = [];
    try {
      classPeriods = await ClassPeriods.find(classPeriodsQuery)
        .populate('subjectId', 'name code')
        .populate('classId', 'className classCode grade')
        .lean();
    } catch (err) {
      console.error('❌ Lỗi khi lấy ClassPeriods:', err);
      classPeriods = [];
    }
    
    // ✅ Tính số tiết mỗi giáo viên đang dạy
    const teacherWeeklyLessonsMap = new Map(); // teacherId -> số tiết/tuần
    const teacherAssignmentsMap = new Map(); // teacherId -> [assignments]
    
    assignments.forEach(assignment => {
      if (!assignment.teacherId || !assignment.classId || !assignment.subjectId) return;
      
      const teacherId = assignment.teacherId._id?.toString() || assignment.teacherId.toString();
      const classGrade = assignment.classId.grade;
      const classId = assignment.classId._id?.toString() || assignment.classId.toString();
      const subjectId = assignment.subjectId._id?.toString() || assignment.subjectId.toString();
      
      // ✅ Tìm số tiết/tuần của môn học từ ClassPeriods theo lớp cụ thể
      let periodsPerWeek = 2; // Default 2 tiết/tuần
      
      // Tìm ClassPeriods của lớp này
      const classPeriod = classPeriods.find(cp => {
        const cpClassId = cp.classId?._id?.toString() || cp.classId?.toString() || cp.classId;
        return cpClassId === classId && cp.grade === classGrade;
      });
      
      if (classPeriod && classPeriod.subjectPeriods) {
        // Lấy số tiết từ Map subjectPeriods
        let subjectPeriodsObj = {};
        if (classPeriod.subjectPeriods instanceof Map) {
          for (const [sid, periods] of classPeriod.subjectPeriods.entries()) {
            subjectPeriodsObj[sid.toString()] = periods;
          }
        } else if (typeof classPeriod.subjectPeriods === 'object') {
          subjectPeriodsObj = classPeriod.subjectPeriods;
        }
        
        periodsPerWeek = subjectPeriodsObj[subjectId] || periodsPerWeek;
      } else {
        // Fallback: Tìm theo khối và môn học (không theo lớp cụ thể)
        const gradeClassPeriod = classPeriods.find(cp => 
          cp.grade === classGrade && 
          cp.subjectId && 
          (cp.subjectId._id?.toString() === subjectId || 
           cp.subjectId.toString() === subjectId)
        );
        
        if (gradeClassPeriod && gradeClassPeriod.subjectPeriods) {
          let subjectPeriodsObj = {};
          if (gradeClassPeriod.subjectPeriods instanceof Map) {
            for (const [sid, periods] of gradeClassPeriod.subjectPeriods.entries()) {
              subjectPeriodsObj[sid.toString()] = periods;
            }
          } else if (typeof gradeClassPeriod.subjectPeriods === 'object') {
            subjectPeriodsObj = gradeClassPeriod.subjectPeriods;
          }
          
          periodsPerWeek = subjectPeriodsObj[subjectId] || periodsPerWeek;
        }
      }
      
      // Cập nhật số tiết của giáo viên
      const currentLessons = teacherWeeklyLessonsMap.get(teacherId) || 0;
      teacherWeeklyLessonsMap.set(teacherId, currentLessons + periodsPerWeek);
      
      // Lưu assignment
      if (!teacherAssignmentsMap.has(teacherId)) {
        teacherAssignmentsMap.set(teacherId, []);
      }
      teacherAssignmentsMap.get(teacherId).push(assignment);
    });
    
    // ✅ Phân tích từng giáo viên
    const teacherAnalysis = teachers.map(teacher => {
      const teacherId = teacher._id.toString();
      const currentWeeklyLessons = teacherWeeklyLessonsMap.get(teacherId) || 0;
      
      // ✅ Tính effectiveWeeklyLessons (base 17 - reduction + optional, bị cap bởi weeklyLessons)
      const baseWeeklyLessons = 17;
      let reduction = 0;
      
      if (teacher._effectiveFlags?.isHomeroom || teacher._effectiveFlags?.currentHomeroomClassId) {
        reduction = Math.max(reduction, 3);
      }

      if (teacher._effectiveFlags?.isDepartmentHead) {
        reduction = Math.max(reduction, 3);
      }
      
      const baseAfterReduction = Math.max(0, baseWeeklyLessons - reduction);
      const optionalLessons = teacher.optionalWeeklyLessons || 0;
      const calculatedEffective = baseAfterReduction + optionalLessons;
      const capLimit = teacher.weeklyLessons || null;
      const effectiveWeeklyLessons = capLimit !== null 
        ? Math.min(calculatedEffective, capLimit) 
        : calculatedEffective;
      const remainingWeeklyLessons = Math.max(0, effectiveWeeklyLessons - currentWeeklyLessons);
      
      // ✅ Kiểm tra quá tải
      const isOverloaded = currentWeeklyLessons > effectiveWeeklyLessons;
      const overloadPercentage = effectiveWeeklyLessons > 0 
        ? ((currentWeeklyLessons / effectiveWeeklyLessons) * 100).toFixed(1)
        : 0;
      
      const assignments = teacherAssignmentsMap.get(teacherId) || [];
      
      return {
        teacherId: teacher._id,
        name: teacher.name,
        teacherCode: teacher.teacherCode,
        currentWeeklyLessons,
        effectiveWeeklyLessons,
        weeklyLessons: teacher.weeklyLessons || 17,
        optionalWeeklyLessons: teacher.optionalWeeklyLessons || 0,
        isOverloaded,
        overloadPercentage: parseFloat(overloadPercentage),
        remainingWeeklyLessons,
        assignmentsCount: assignments.length,
        assignments: assignments.map(a => ({
          subject: a.subjectId?.name || 'N/A',
          class: a.classId?.className || 'N/A',
          grade: a.classId?.grade || 'N/A'
        }))
      };
    });
    
    // ✅ Tính số giáo viên cần thiết dựa trên ClassPeriods
    const subjectGradeNeeds = new Map(); // "subjectId-grade" -> { totalPeriods, classesCount }
    
    // Lấy tất cả lớp trong năm học
    let classes = [];
    try {
      classes = await Class.find({ year: currentYear }).lean();
    } catch (err) {
      console.error('❌ Lỗi khi lấy Class:', err);
      classes = [];
    }
    
    classPeriods.forEach(cp => {
      if (!cp.subjectId || !cp.grade) return;
      
      const subjectId = cp.subjectId._id?.toString() || cp.subjectId.toString();
      const key = `${subjectId}-${cp.grade}`;
      const periodsPerWeek = cp.periodsPerWeek || 2;
      
      // Đếm số lớp trong khối này
      const classesInGrade = classes.filter(c => c.grade === cp.grade).length;
      const totalPeriodsNeeded = periodsPerWeek * classesInGrade;
      
      if (!subjectGradeNeeds.has(key)) {
        subjectGradeNeeds.set(key, {
          subjectId,
          subjectName: cp.subjectId?.name || 'N/A',
          grade: cp.grade,
          periodsPerWeek,
          classesCount: classesInGrade,
          totalPeriodsNeeded: 0,
          assignedPeriods: 0
        });
      }
      
      const need = subjectGradeNeeds.get(key);
      need.totalPeriodsNeeded += totalPeriodsNeeded;
    });
    
    // ✅ Tính số tiết đã được phân công
    assignments.forEach(assignment => {
      if (!assignment.subjectId || !assignment.classId) return;
      
      const subjectId = assignment.subjectId._id?.toString() || assignment.subjectId.toString();
      const grade = assignment.classId.grade;
      const classId = assignment.classId._id?.toString() || assignment.classId.toString();
      const key = `${subjectId}-${grade}`;
      
      // ✅ Tìm số tiết từ ClassPeriods theo lớp cụ thể
      let periodsPerWeek = 2; // Default
      
      const classPeriod = classPeriods.find(cp => {
        const cpClassId = cp.classId?._id?.toString() || cp.classId?.toString() || cp.classId;
        return cpClassId === classId && cp.grade === grade;
      });
      
      if (classPeriod && classPeriod.subjectPeriods) {
        let subjectPeriodsObj = {};
        if (classPeriod.subjectPeriods instanceof Map) {
          for (const [sid, periods] of classPeriod.subjectPeriods.entries()) {
            subjectPeriodsObj[sid.toString()] = periods;
          }
        } else if (typeof classPeriod.subjectPeriods === 'object') {
          subjectPeriodsObj = classPeriod.subjectPeriods;
        }
        periodsPerWeek = subjectPeriodsObj[subjectId] || periodsPerWeek;
      } else {
        // Fallback: Tìm theo khối
        const gradeClassPeriod = classPeriods.find(cp => 
          cp.grade === grade && 
          cp.subjectId && 
          (cp.subjectId._id?.toString() === subjectId || cp.subjectId.toString() === subjectId)
        );
        
        if (gradeClassPeriod && gradeClassPeriod.subjectPeriods) {
          let subjectPeriodsObj = {};
          if (gradeClassPeriod.subjectPeriods instanceof Map) {
            for (const [sid, periods] of gradeClassPeriod.subjectPeriods.entries()) {
              subjectPeriodsObj[sid.toString()] = periods;
            }
          } else if (typeof gradeClassPeriod.subjectPeriods === 'object') {
            subjectPeriodsObj = gradeClassPeriod.subjectPeriods;
          }
          periodsPerWeek = subjectPeriodsObj[subjectId] || periodsPerWeek;
        }
      }
      
      if (subjectGradeNeeds.has(key)) {
        const need = subjectGradeNeeds.get(key);
        need.assignedPeriods += periodsPerWeek;
      }
    });
    
    // ✅ Tính số giáo viên cần thiết cho mỗi môn-khối
    const subjectGradeTeacherNeeds = Array.from(subjectGradeNeeds.values()).map(need => {
      // Tìm giáo viên dạy môn này
        const teachersForSubject = teachers.filter(t => {
        const teachesSubject = t.subjects?.some(s => {
          const subId = s.subjectId?._id?.toString() || s.subjectId?.toString();
          return subId === need.subjectId;
        }) || t.mainSubject?.toString() === need.subjectId;
        
        const teachesGrade = t.subjects?.some(s => {
          const subId = s.subjectId?._id?.toString() || s.subjectId?.toString();
          return subId === need.subjectId && s.grades?.includes(need.grade);
        });
        
        return teachesSubject && teachesGrade;
      });
      
      // Tính tổng số tiết mà các giáo viên này có thể dạy
      let totalAvailableLessons = 0;
        teachersForSubject.forEach(t => {
        const teacherId = t._id.toString();
        const currentLessons = teacherWeeklyLessonsMap.get(teacherId) || 0;
        
        // Tính effectiveWeeklyLessons
        const baseWeeklyLessons = 17;
        let reduction = 0;
        if (t._effectiveFlags?.isHomeroom || t._effectiveFlags?.currentHomeroomClassId) reduction = Math.max(reduction, 3);
        if (t._effectiveFlags?.isDepartmentHead) reduction = Math.max(reduction, 3);
        const baseAfterReduction = Math.max(0, baseWeeklyLessons - reduction);
        const optionalLessons = t.optionalWeeklyLessons || 0;
        const calculatedEffective = baseAfterReduction + optionalLessons;
        const capLimit = t.weeklyLessons || null;
        const effectiveWeeklyLessons = capLimit !== null 
          ? Math.min(calculatedEffective, capLimit) 
          : calculatedEffective;
        
        const availableLessons = Math.max(0, effectiveWeeklyLessons - currentLessons);
        totalAvailableLessons += availableLessons;
      });
      
      const missingPeriods = Math.max(0, need.totalPeriodsNeeded - need.assignedPeriods);
      const estimatedTeachersNeeded = totalAvailableLessons > 0 && teachersForSubject.length > 0
        ? Math.ceil(missingPeriods / (totalAvailableLessons / teachersForSubject.length))
        : Math.ceil(missingPeriods / 17); // Fallback: giả sử mỗi giáo viên dạy 17 tiết/tuần
      
      return {
        ...need,
        teachersCount: teachersForSubject.length,
        totalAvailableLessons,
        missingPeriods,
        estimatedTeachersNeeded: Math.max(0, estimatedTeachersNeeded - teachersForSubject.length)
      };
    });
    
    // ✅ Tổng hợp kết quả
    const overloadedTeachers = teacherAnalysis.filter(t => t.isOverloaded);
    const totalTeachersNeeded = subjectGradeTeacherNeeds.reduce((sum, need) => sum + need.estimatedTeachersNeeded, 0);
    const isSufficient = totalTeachersNeeded === 0 && overloadedTeachers.length === 0;
    
    res.json({
      filters: {
        year: currentYear,
        semester: currentSemester || 'all',
        departmentId: departmentFilter,
      },
      summary: {
        year: currentYear,
        semester: currentSemester || 'all',
        departmentId: departmentFilter,
        totalTeachers: teachers.length,
        totalAssignments: assignments.length,
        overloadedTeachersCount: overloadedTeachers.length,
        estimatedTeachersNeeded: totalTeachersNeeded,
        isSufficient
      },
      teacherAnalysis,
      overloadedTeachers,
      subjectGradeNeeds: subjectGradeTeacherNeeds.filter(need => need.missingPeriods > 0 || need.estimatedTeachersNeeded > 0),
      recommendations: [
        ...(overloadedTeachers.length > 0 ? [
          `Có ${overloadedTeachers.length} giáo viên đang quá tải. Cần giảm tải hoặc tuyển thêm giáo viên.`
        ] : []),
        ...(totalTeachersNeeded > 0 ? [
          `Ước tính cần tuyển thêm khoảng ${totalTeachersNeeded} giáo viên để đáp ứng đủ nhu cầu giảng dạy.`
        ] : []),
        ...(isSufficient ? [
          'Hệ thống có đủ giáo viên và không có giáo viên nào quá tải.'
        ] : [])
      ]
    });
  } catch (error) {
    console.error('❌ Lỗi khi kiểm tra tình trạng giáo viên:', error);
    res.status(500).json({
      message: 'Không thể kiểm tra tình trạng giáo viên',
      error: error.message
    });
  }
};

// ✅ Soft Delete - Xóa mềm giáo viên (chỉ đánh dấu, không xóa thật)
exports.softDeleteTeacher = async (req, res) => {
  try {
    // ✅ Kiểm tra quyền: BGH không được xóa giáo viên
    const user = req.user;
    if (user?.role === 'teacher' && user?.teacherFlags?.isLeader) {
      return res.status(403).json({ 
        message: 'Ban Giám Hiệu không có quyền xóa giáo viên. Vui lòng liên hệ quản trị viên.' 
      });
    }

    const { id } = req.params;

    const teacher = await Teacher.findById(id);
    if (!teacher) {
      return res.status(404).json({ message: 'Không tìm thấy giáo viên' });
    }

    // ✅ Đánh dấu isDeleted = true
    teacher.isDeleted = true;
    teacher.status = 'inactive'; // Đồng thời cập nhật status
    await teacher.save();

    res.json({
      message: 'Đã xóa mềm giáo viên thành công',
      teacher: teacher
    });
  } catch (error) {
    console.error('❌ Lỗi khi xóa mềm giáo viên:', error);
    res.status(500).json({
      message: 'Lỗi khi xóa mềm giáo viên',
      error: error.message
    });
  }
};

// ✅ Restore - Khôi phục giáo viên đã xóa mềm
exports.restoreTeacher = async (req, res) => {
  try {
    // ✅ Kiểm tra quyền: BGH không được khôi phục giáo viên
    const user = req.user;
    if (user?.role === 'teacher' && user?.teacherFlags?.isLeader) {
      return res.status(403).json({ 
        message: 'Ban Giám Hiệu không có quyền khôi phục giáo viên. Vui lòng liên hệ quản trị viên.' 
      });
    }

    const { id } = req.params;

    const teacher = await Teacher.findById(id);
    if (!teacher) {
      return res.status(404).json({ message: 'Không tìm thấy giáo viên' });
    }

    // ✅ Khôi phục isDeleted = false
    teacher.isDeleted = false;
    teacher.status = 'active'; // Khôi phục status
    await teacher.save();

    const restoredTeacher = await populatedTeacher(Teacher.findById(id));

    res.json({
      message: 'Đã khôi phục giáo viên thành công',
      teacher: restoredTeacher
    });
  } catch (error) {
    console.error('❌ Lỗi khi khôi phục giáo viên:', error);
    res.status(500).json({
      message: 'Lỗi khi khôi phục giáo viên',
      error: error.message
    });
  }
};

// ✅ Force Delete - Xóa vĩnh viễn (chỉ Admin)
exports.forceDeleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Kiểm tra quyền Admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Chỉ Admin mới có quyền xóa vĩnh viễn' });
    }

    const teacher = await Teacher.findByIdAndDelete(id);
    if (!teacher) {
      return res.status(404).json({ message: 'Không tìm thấy giáo viên' });
    }

    res.json({
      message: 'Đã xóa vĩnh viễn giáo viên thành công',
      teacher: teacher
    });
  } catch (error) {
    console.error('❌ Lỗi khi xóa vĩnh viễn giáo viên:', error);
    res.status(500).json({
      message: 'Lỗi khi xóa vĩnh viễn giáo viên',
      error: error.message
    });
  }
};