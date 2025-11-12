const User = require("../../models/user/user");
const Class = require("../../models/class/class");
const Student = require("../../models/user/student");
const Room = require("../../models/room/room");
const mongoose = require("mongoose");

/* =========================================================
   📘 LẤY TẤT CẢ LỚP
========================================================= */
exports.getAllClasses = async (req, res) => {
  try {
    const filter = {};

    if (req.query.year) filter.year = req.query.year;
    if (req.query.grade) filter.grade = req.query.grade;

    const cls = await Class.find(filter)
      .populate("teacherId", "name")
      .populate("students", "name studentCode grade classId")
      .populate("roomId", "roomCode name type status")
      .sort({ grade: 1, className: 1 });

    res.status(200).json(cls);
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách lớp:", error);
    res.status(500).json({ message: "Không thể tải danh sách lớp" });
  }
};

/* =========================================================
   📗 LẤY LỚP THEO ID
========================================================= */
exports.getClassById = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id)
      .populate("teacherId", "name")
      .populate("students", "name studentCode")
      .populate("roomId", "roomCode name");
    if (!cls) return res.status(404).json({ message: "Không tìm thấy lớp" });
    res.json(cls);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy lớp" });
  }
};

/* =========================================================
   ➕ TẠO LỚP HỌC (TỰ GẮN PHÒNG)
========================================================= */
exports.createClass = async (req, res) => {
  try {
    let { className, year, grade, capacity, teacherId } = req.body;

    if (!className || !year) {
      return res.status(400).json({ message: "Thiếu tên lớp hoặc năm học" });
    }

    // 🔹 Chuẩn hoá dữ liệu
    className = className.trim().toUpperCase();
    const classCode = `${year}-${className}`;

    // 🔹 Tự động phát hiện khối nếu chưa nhập
    if (!grade && /^10/.test(className)) grade = "10";
    if (!grade && /^11/.test(className)) grade = "11";
    if (!grade && /^12/.test(className)) grade = "12";

    // 🔹 Kiểm tra lớp trùng
    const existing = await Class.findOne({ classCode });
    if (existing)
      return res
        .status(400)
        .json({ message: `Đã tồn tại lớp ${className} (${year})` });

    // 🔹 Kiểm tra giáo viên GVCN trùng trong năm
    if (teacherId) {
      const teacherUsed = await Class.findOne({ teacherId, year });
      if (teacherUsed) {
        return res.status(400).json({
          message: `Giáo viên này đã là GVCN của lớp ${teacherUsed.className} (${teacherUsed.year})`,
        });
      }
    }

    // 🔹 Giới hạn sĩ số lớp
    if (capacity && (capacity < 20 || capacity > 60)) {
      return res.status(400).json({
        message: "Sĩ số lớp phải trong khoảng 20–60 học sinh",
      });
    }

    /* =========================================================
       🏫 Tự động tạo / gán phòng học tương ứng (VD: 10A1 → roomCode: 10A1)
    ========================================================= */
    let room = await Room.findOne({ roomCode: className });
    if (!room) {
      room = await Room.create({
        roomCode: className,
        name: `Phòng học ${className}`,
        capacity: capacity || 45,
        type: "normal",
        status: "available",
      });
      console.log(`🏫 Đã tạo phòng mới: ${room.roomCode}`);
    }

    // ✅ Tạo lớp và gán roomId
    const newClass = await Class.create({
      classCode,
      className,
      year,
      grade,
      capacity: capacity || room.capacity || 45,
      currentSize: 0,
      teacherId: teacherId || null,
      roomId: room._id,
    });

    console.log(`✅ Tạo lớp ${className} (${year}) thành công`);

    res.status(201).json(newClass);
  } catch (error) {
    console.error("[createClass]", error);
    res.status(500).json({
      message: "Không thể tạo lớp",
      error: error.message,
    });
  }
};

/* =========================================================
   ✏️ CẬP NHẬT LỚP
========================================================= */
exports.updateClass = async (req, res) => {
  try {
    const { teacherId, year } = req.body;
    const classId = req.params.id;

    if (teacherId) {
      const teacherUsed = await Class.findOne({
        teacherId,
        year,
        _id: { $ne: classId },
      });
      if (teacherUsed) {
        return res.status(400).json({
          message: `Giáo viên này đã là GVCN của lớp ${teacherUsed.className} (${teacherUsed.year})`,
        });
      }
    }

    const cls = await Class.findByIdAndUpdate(classId, req.body, { new: true });
    if (!cls) return res.status(404).json({ message: "Không tìm thấy lớp" });

    res.json(cls);
  } catch (error) {
    console.error("[updateClass]", error);
    res.status(500).json({ message: "Lỗi khi cập nhật lớp" });
  }
};

/* =========================================================
   🗑️ XOÁ LỚP
========================================================= */
exports.deleteClass = async (req, res) => {
  const classId = req.params.id;
  try {
    const cls = await Class.findById(classId);
    if (!cls) return res.status(404).json({ message: "Không tìm thấy lớp" });

    // 🔹 Gỡ classId khỏi học sinh
    await Student.updateMany({ classId }, { $set: { classId: null } });

    await Class.findByIdAndDelete(classId);

    res.json({
      message: `Đã xoá lớp ${cls.className} thành công và cập nhật học sinh.`,
    });
  } catch (error) {
    console.error("[deleteClass]", error);
    res
      .status(500)
      .json({ message: "Lỗi khi xoá lớp", error: error.message });
  }
};

/* =========================================================
   🔗 JOIN CLASS (học sinh vào lớp)
========================================================= */
exports.joinClass = async (req, res) => {
  const { userId, classCode } = req.body;
  try {
    const classObj = await Class.findOne({ classCode });
    if (!classObj)
      return res.status(404).json({ message: "Class code not found" });

    const student = await Student.findById(userId);
    const oldClassId = student?.classId?.toString();

    await User.findByIdAndUpdate(userId, { classId: classObj._id });
    if (!classObj.students.includes(userId)) {
      classObj.students.push(userId);
      await classObj.save();
    }

    // 🧾 Tạo bảng điểm nếu cần
    if (
      student &&
      oldClassId !== classObj._id.toString() &&
      student.status === "active"
    ) {
      try {
        const { initGradesForStudent } = require("../../services/gradeService");
        const Setting = require("../../models/settings");
        const settings = await Setting.findOne({}).lean();
        const currentSchoolYear = settings?.currentSchoolYear || "2024-2025";

        initGradesForStudent({
          studentId: userId,
          classId: classObj._id,
          schoolYear: currentSchoolYear,
          semester: "1",
        }).catch((err) =>
          console.error("[joinClass] Lỗi tạo bảng điểm HK1:", err)
        );
        initGradesForStudent({
          studentId: userId,
          classId: classObj._id,
          schoolYear: currentSchoolYear,
          semester: "2",
        }).catch((err) =>
          console.error("[joinClass] Lỗi tạo bảng điểm HK2:", err)
        );
      } catch (error) {
        console.error("[joinClass] Lỗi khi tạo bảng điểm:", error);
      }
    }

    res.json({ message: "Joined class successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.autoAssignGrade = async (req, res) => {
  const year = Number(req.query.year || new Date().getFullYear());
  const grade = String(req.query.grade || '10');
  const minScore = Number(req.query.minScore || 0);

  if (!year || !['10', '11', '12'].includes(grade)) {
    return res.status(400).json({ message: 'Invalid year or grade' });
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const classes = await Class.find({ year, grade }).session(session);
      if (classes.length === 0) {
        return res.status(400).json({ message: 'No classes configured for this year/grade' });
      }

      const caps = classes.map(c => ({
        id: c._id,
        name: c.className,
        left: c.capacity - c.currentSize,
      }));
      const students = await Student.find({
        grade,
        admissionYear: year,
        entranceScore: { $gte: minScore },
        classId: null,
      })
        .sort({ entranceScore: -1, name: 1 })
        .session(session);

      let ci = 0;
      let assigned = 0;
      const assignedStudents = []; // Lưu danh sách học sinh đã được gán để tạo bảng điểm sau
      
      for (const s of students) {
        if (caps.every(c => c.left <= 0)) break;
        let spin = 0;
        while (caps[ci].left <= 0 && spin < caps.length) {
          ci = (ci + 1) % caps.length;
          spin++;
        }
        if (spin >= caps.length) break;
        const cls = caps[ci];
        await Student.updateOne({ _id: s._id }, { $set: { classId: cls.id } }, { session });
        await Class.updateOne(
          { _id: cls.id },
          { $inc: { currentSize: 1 }, $addToSet: { students: s._id } },
          { session }
        );
        cls.left -= 1;
        assigned += 1;
        assignedStudents.push({ studentId: s._id, classId: cls.id });
        ci = (ci + 1) % caps.length;
      }

      const unassigned = students.length - assigned;
      
      // Tạo bảng điểm cho các học sinh đã được gán (sau khi transaction commit)
      if (assignedStudents.length > 0) {
        // Chạy async sau khi transaction commit
        setImmediate(async () => {
          try {
            const { initGradesForStudent } = require('../../services/gradeService');
            const Setting = require('../../models/settings');
            const settings = await Setting.findOne({}).lean();
            const currentSchoolYear = settings?.currentSchoolYear || '2024-2025';
            
            for (const { studentId, classId } of assignedStudents) {
              await initGradesForStudent({ studentId, classId, schoolYear: currentSchoolYear, semester: '1' });
              await initGradesForStudent({ studentId, classId, schoolYear: currentSchoolYear, semester: '2' });
            }
          } catch (error) {
            console.error('[autoAssignGrade] Lỗi khi tạo bảng điểm:', error);
          }
        });
      }
      
      return res.json({
        assigned,
        unassigned,
        classes: caps.map(c => ({ name: c.name, remaining: c.left })),
      });
    });
  } catch (err) {
    console.error('[autoAssignGrade]', err);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    session.endSession();
  }
};

exports.setupYearClasses = async (req, res) => {
  const year = Number(req.body.year || req.query.year || new Date().getFullYear());
  const grade = String(req.body.grade || req.query.grade || '10');
  const count = Number(req.body.count || req.query.count || 8);
  const capacity = Number(req.body.capacity || req.query.capacity || 45);

  if (!['10', '11', '12'].includes(grade))
    return res.status(400).json({ message: 'Invalid grade' });
  if (count <= 0 || capacity <= 0)
    return res.status(400).json({ message: 'Invalid count/capacity' });

  try {
    const created = [];
    for (let i = 1; i <= count; i++) {
      const className = `${grade}A${i}`;
      const classCode = `${year}-${className}`;
      const existing = await Class.findOne({ classCode });
      if (existing) continue;
      const doc = await Class.create({
        classCode,
        className,
        year,
        grade,
        capacity,
        currentSize: 0,
      });
      created.push({ id: doc._id, className });
    }
    return res.json({ year, grade, createdCount: created.length, created });
  } catch (err) {
    console.error('[setupYearClasses]', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
exports.getGradesAndClassesByYear = async (req, res) => {
  try {
    const { year } = req.query;

    if (!year) {
      return res.status(400).json({ message: "Thiếu tham số year" });
    }

    // 🔍 Lấy tất cả lớp theo niên khóa
    const classes = await Class.find({ year })
      .populate("teacherId", "name")
      .populate("students", "name studentCode grade")
      .sort({ grade: 1, className: 1 });

    // 🔹 Gom nhóm theo khối
    const grouped = {};
    classes.forEach((cls) => {
      if (!grouped[cls.grade]) grouped[cls.grade] = [];
      grouped[cls.grade].push(cls);
    });

    // 🔹 Chuyển về dạng [{ grade, classes }]
    const result = Object.entries(grouped).map(([grade, classes]) => ({
      grade,
      classes,
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách lớp theo niên khóa:", error);
    res.status(500).json({ message: "Không thể tải danh sách lớp theo niên khóa" });
  }
};