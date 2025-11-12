// controllers/exam/examStudentController.js
const { ExamStudent } = require("../../models/exam/examIndex");
const Student = require("../../models/user/student");
const Class = require("../../models/class/class");
const mongoose = require("mongoose");
const xlsx = require("xlsx");

/* =========================================================
   ➕ GÁN HỌC SINH VÀO KỲ THI (TỰ ĐỘNG THEO LỚP / KHỐI)
========================================================= */
exports.addStudentsToExam = async (req, res) => {
  try {
    const { examId, grade, classIds } = req.body;
    if (!examId)
      return res.status(400).json({ error: "Thiếu examId." });

    // 🔍 Lấy danh sách học sinh theo lớp hoặc khối
    const query = classIds?.length ? { class: { $in: classIds } } : { grade };
    const students = await Student.find(query).select("_id class grade");

    if (!students.length)
      return res.status(404).json({ error: "Không tìm thấy học sinh phù hợp." });

    // 🚫 Bỏ trùng (đã có trong kỳ thi)
    const existing = await ExamStudent.find({
      exam: examId,
      student: { $in: students.map((s) => s._id) },
    }).distinct("student");

    const newStudents = students.filter(
      (s) => !existing.includes(String(s._id))
    );

    if (!newStudents.length)
      return res.status(400).json({
        error: "Tất cả học sinh đã được gán vào kỳ thi này.",
      });

    // 🔢 Sinh SBD duy nhất (prefix theo khối)
    const prefix = grade || newStudents[0].grade;
    const startNumber =
      (await ExamStudent.countDocuments({ exam: examId })) + 1;

    const examStudents = newStudents.map((s, i) => ({
      exam: examId,
      student: s._id,
      class: s.class,
      grade: s.grade,
      sbd: `${prefix}${String(startNumber + i).padStart(4, "0")}`,
      status: "active",
    }));

    await ExamStudent.insertMany(examStudents, { ordered: false });
    res.json({
      message: `✅ Đã thêm ${examStudents.length} học sinh vào kỳ thi.`,
      total: examStudents.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📄 LẤY DANH SÁCH HỌC SINH THEO KỲ THI (CÓ PHÂN TRANG)
========================================================= */
exports.getStudentsByExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const { grade, page = 1, limit = 50 } = req.query;

    const filter = { exam: examId };
    if (grade) filter.grade = Number(grade);

    const data = await ExamStudent.find(filter)
      .populate("student", "name className gender studentCode")
      .populate("class", "name grade")
      .sort({ grade: 1, "student.name": 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await ExamStudent.countDocuments(filter);
    res.json({
      total,
      totalPages: Math.ceil(total / limit),
      page: parseInt(page),
      data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🔍 LẤY CHI TIẾT 1 HỌC SINH DỰ THI
========================================================= */
exports.getExamStudentById = async (req, res) => {
  try {
    const student = await ExamStudent.findById(req.params.id)
      .populate("student", "name className gender studentCode")
      .populate("class", "name grade");
    if (!student)
      return res.status(404).json({ error: "Không tìm thấy học sinh dự thi." });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   ✏️ CẬP NHẬT HỌC SINH DỰ THI
========================================================= */
exports.updateExamStudent = async (req, res) => {
  try {
    const updated = await ExamStudent.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated)
      return res
        .status(404)
        .json({ error: "Không tìm thấy học sinh để cập nhật." });
    res.json({ message: "✅ Cập nhật học sinh thành công.", student: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🗑️ RESET DANH SÁCH HỌC SINH CỦA KỲ THI
========================================================= */
exports.resetExamStudents = async (req, res) => {
  try {
    const { examId } = req.params;
    const deleted = await ExamStudent.deleteMany({ exam: examId });
    res.json({
      message: `🗑️ Đã xóa ${deleted.deletedCount} học sinh khỏi kỳ thi.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📊 THỐNG KÊ SỐ LƯỢNG HỌC SINH THEO KHỐI
========================================================= */
exports.countStudentsByGrade = async (req, res) => {
  try {
    const examId = req.params.examId;
    if (!mongoose.Types.ObjectId.isValid(examId))
      return res.status(400).json({ error: "ID kỳ thi không hợp lệ." });

    const stats = await ExamStudent.aggregate([
      { $match: { exam: new mongoose.Types.ObjectId(examId) } },
      { $group: { _id: "$grade", totalStudents: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📥 IMPORT DANH SÁCH HỌC SINH TỪ EXCEL
========================================================= */
exports.importStudentsFromExcel = async (req, res) => {
  try {
    const { examId, grade } = req.body;
    if (!req.file)
      return res.status(400).json({ error: "Chưa tải file Excel." });

    const workbook = xlsx.readFile(req.file.path);
    const sheet = xlsx.utils.sheet_to_json(
      workbook.Sheets[workbook.SheetNames[0]]
    );
    if (!sheet.length)
      return res.status(400).json({ error: "File Excel trống." });

    const studentsData = [];
    for (const row of sheet) {
      const student = await Student.findOne({ studentCode: row.studentCode });
      if (!student) continue;
      const classObj = await Class.findOne({ name: row.className });
      if (!classObj) continue;

      studentsData.push({
        exam: examId,
        grade: grade || student.grade,
        student: student._id,
        class: classObj._id,
        sbd: `${grade}${String(studentsData.length + 1).padStart(4, "0")}`,
        status: "active",
      });
    }

    if (!studentsData.length)
      return res.status(400).json({ error: "Không có học sinh hợp lệ." });

    await ExamStudent.insertMany(studentsData);
    res.json({
      message: "✅ Import danh sách học sinh thành công.",
      total: studentsData.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
exports.deleteExamStudent = async (req, res) => {
  try {
    const deleted = await ExamStudent.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res
        .status(404)
        .json({ error: "Không tìm thấy học sinh để xóa." });

    res.json({ message: "🗑️ Đã xóa học sinh khỏi kỳ thi." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAvailableExams = async (req, res) => {
  try {
    // ✅ Lấy thông tin học sinh từ token hoặc query
    const student = req.user?.student || null;
    const grade = student?.grade || req.query.grade;

    if (!grade) {
      return res.status(400).json({ error: "Không xác định được khối của học sinh." });
    }

    // Lọc kỳ thi theo khối & trạng thái được phép
    const today = dayjs().startOf("day");

    const exams = await Exam.find({
      grades: grade,
      status: { $in: ["published", "locked"] },
      endDate: { $gte: today.toDate() }, // chỉ lấy kỳ thi chưa kết thúc
    })
      .select("name year semester type startDate endDate status grades")
      .sort({ startDate: 1 })
      .lean();

    res.json(exams);
  } catch (err) {
    console.error("❌ Lỗi getAvailableExams:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🗓️ LẤY LỊCH THI CỦA HỌC SINH TRONG KỲ THI
========================================================= */
exports.getExamScheduleForStudent = async (req, res) => {
  try {
    const { examId } = req.params;
    const student = req.user?.student || null;
    const grade = student?.grade || req.query.grade;

    if (!examId || !grade) {
      return res.status(400).json({ error: "Thiếu examId hoặc grade." });
    }

    const schedules = await ExamSchedule.find({
      exam: examId,
      grade: Number(grade),
    })
      .populate("subject", "name code")
      .sort({ date: 1, startTime: 1 })
      .lean();

    if (!schedules.length)
      return res.status(404).json({ error: "Không có lịch thi cho khối này." });

    res.json(schedules);
  } catch (err) {
    console.error("❌ Lỗi getExamScheduleForStudent:", err);
    res.status(500).json({ error: err.message });
  }
}