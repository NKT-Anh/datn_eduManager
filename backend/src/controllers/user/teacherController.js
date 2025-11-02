const Teacher = require('../../models/user/teacher');
const Class = require('../../models/class/class');

const populatedTeacher = (query) => {
  return query
    .populate('subjects.subjectId', 'name code')
    .populate('mainSubject', 'name code')
    .populate('classIds', 'className classCode grade year')
    .populate('homeroomClassIds', 'className classCode grade year');
};


// Lấy tất cả giáo viên
exports.getAllTeachers = async (req, res) => {
  try {
    const teachers = await populatedTeacher(Teacher.find());

    res.json(teachers);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách giáo viên', error });
  }
};

// Lấy 1 giáo viên theo id
exports.getTeacher = async (req, res) => {
  const { id } = req.params;
  try {
    const teacher = await populatedTeacher(Teacher.findById(id));

    if (!teacher) return res.status(404).json({ message: 'Không tìm thấy giáo viên' });

    res.json(teacher);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xem 1 giáo viên', error });
  }
};

// Tạo giáo viên mới
exports.createTeacher = async (req, res) => {
  try {
    const code = `gv${Date.now().toString().slice(-5)}`;
    const teacher = await Teacher.create({
      ...req.body,
      teacherCode: code,
      maxClasses: req.body.maxClasses || 3
    });

    // Populate dữ liệu ngay sau khi tạo
    const teacherPopulated = await populatedTeacher(Teacher.findById(teacher._id));

    res.status(201).json(teacherPopulated);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Không thể tạo giáo viên', error });
  }
};

// Cập nhật giáo viên
exports.updateTeacher = async (req, res) => {
  try {
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
exports.deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndDelete(req.params.id);
    if (!teacher) return res.status(404).json({ message: 'Không tìm thấy giáo viên' });

    res.json({ message: 'Xóa giáo viên thành công' });
  } catch (error) {
    res.status(400).json({ message: 'Không thể xóa giáo viên', error });
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

    if (classId) {
      query.classIds = classId; // các lớp phụ trách
    }

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