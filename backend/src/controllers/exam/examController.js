// controllers/exam/examController.js
const { Exam, ExamClass, ExamSchedule, ExamRoom, ExamGrade, ExamStudent, FixedExamRoom, RoomAssignment } = require('../../models/exam/examIndex');
const Student = require('../../models/user/student');
const mongoose = require('mongoose');

/* =========================================================
   🟢 TẠO KỲ THI MỚI
========================================================= */
exports.createExam = async (req, res) => {
  try {
    const { name, year, semester, type = "regular", startDate, endDate, grades } = req.body;

    // ✅ Kiểm tra dữ liệu bắt buộc
    if (!name || !year || !semester || !grades?.length) {
      return res
        .status(400)
        .json({ error: "Thiếu thông tin bắt buộc (name, year, semester, grades)." });
    }

    // 🔒 Ràng buộc: Không được tạo kỳ thi nếu chưa có năm học active
    const SchoolYear = require('../../models/schoolYear');
    const activeYear = await SchoolYear.findOne({ isActive: true });
    if (!activeYear) {
      return res.status(400).json({ 
        error: "Không thể tạo kỳ thi. Vui lòng kích hoạt một năm học trước." 
      });
    }

    // Kiểm tra năm học được chọn có phải là năm học active không
    if (year !== activeYear.code) {
      return res.status(400).json({ 
        error: `Chỉ có thể tạo kỳ thi cho năm học đang hoạt động: ${activeYear.name} (${activeYear.code})` 
      });
    }

    // ✅ Kiểm tra ngày hợp lệ
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ error: "Ngày bắt đầu phải nhỏ hơn ngày kết thúc." });
    }

    // ✅ Đảm bảo grades là String
    const stringGrades = grades.map((g) => String(g));

    // ✅ Kiểm tra trùng logic (năm + học kỳ + loại + tên)
    const exists = await Exam.findOne({
      year,
      semester,
      type,
      name: { $regex: new RegExp(`^${name}$`, "i") }, // so sánh không phân biệt hoa thường
    });

    if (exists) {
      return res.status(400).json({ error: "Kỳ thi này đã tồn tại trong cùng năm học và học kỳ." });
    }

    // ✅ Sinh examId dựa theo năm, học kỳ, loại + slug từ tên kỳ thi
    const slug = name
      .toLowerCase()
      .normalize("NFD") // bỏ dấu tiếng Việt
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .trim();

    const examId = `exam_${year}_hk${semester}_${slug}`;

    // ✅ Tạo kỳ thi mới
    const exam = await Exam.create({
      examId,
      name,
      year,
      semester,
      type,
      startDate,
      endDate,
      grades: stringGrades,
      createdBy: req.user?.uid || "admin",
    });

    // 🎓 TỰ ĐỘNG THÊM HỌC SINH VÀO KỲ THI
    // Lấy học sinh theo:
    // - Năm học (currentYear): trùng với year của kỳ thi (VD: "2025-2026")
    // - Khối (grade): trong danh sách grades của kỳ thi (VD: ["10", "11", "12"])
    // - Trạng thái: active
    // Lưu ý: Học kỳ (semester) không ảnh hưởng đến việc lấy học sinh, 
    // vì học sinh sẽ tham gia tất cả các kỳ thi trong năm học đó
    let studentsAdded = 0;
    try {
      const students = await Student.find({
        status: "active",
        currentYear: year, // ✅ Lọc theo năm học (VD: "2025-2026")
        grade: { $in: stringGrades }, // ✅ Lọc theo khối (VD: ["10", "11", "12"])
      })
        .populate("classId", "_id")
        .select("_id classId grade")
        .lean();

      if (students.length > 0) {
        // ✅ Lọc bỏ học sinh chưa có lớp (vì ExamStudent.class là required)
        const studentsWithClass = students.filter((s) => s.classId?._id);
        if (studentsWithClass.length < students.length) {
          const withoutClass = students.length - studentsWithClass.length;
          console.warn(`⚠️ Có ${withoutClass} học sinh chưa được gán vào lớp, sẽ bỏ qua.`);
        }

        if (studentsWithClass.length > 0) {
          const examStudents = studentsWithClass.map((s, i) => ({
            exam: exam._id,
            student: s._id,
            class: s.classId._id, // ✅ Lấy từ student.classId, đảm bảo không null
            grade: String(s.grade),
            sbd: `${String(s.grade)}${String(i + 1).padStart(4, "0")}`,
            status: "active",
          }));

          await ExamStudent.insertMany(examStudents, { ordered: false });
          studentsAdded = examStudents.length;
          console.log(`✅ Đã tự động thêm ${studentsAdded} học sinh vào kỳ thi ${exam.name}`);
        }
      }
    } catch (studentErr) {
      console.error("⚠️ Lỗi khi tự động thêm học sinh:", studentErr);
      // Không throw error, chỉ log để không làm gián đoạn việc tạo kỳ thi
    }

    res.status(201).json({
      message: `✅ Tạo kỳ thi thành công${studentsAdded > 0 ? ` và đã thêm ${studentsAdded} học sinh` : ""}`,
      exam,
      studentsAdded,
    });
  } catch (err) {
    console.error("❌ Lỗi tạo kỳ thi:", err);
    res.status(500).json({ error: err.message });
  }
};




/* =========================================================
   🟡 LẤY DANH SÁCH KỲ THI (lọc + phân trang)
========================================================= */
exports.getExams = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      year,
      semester,
      type,
      keyword,
      grade,
      status,
    } = req.query;

    const filter = {};

    // Lọc các trường đơn giản
    if (year && year !== "Tất cả") filter.year = year;
    if (semester && semester !== "Tất cả") filter.semester = semester;
    if (type) filter.type = type;
    if (status && status !== "Tất cả") filter.status = status;

    // Xử lý grade: grade=10 → tìm tài liệu có 10 trong mảng grades
    if (grade && grade !== "Tất cả") {
      let gradesArray = [];

      if (Array.isArray(grade)) {
        // Trường hợp: ?grade=10&grade=11
        gradesArray = grade.map(g => String(g)).filter(g => ['10', '11', '12'].includes(g));
      } else if (typeof grade === "string") {
        // Trường hợp: ?grade=10 hoặc ?grade=10,11
        gradesArray = grade
          .split(",")
          .map(g => String(g.trim()))
          .filter(g => ['10', '11', '12'].includes(g));
      }

      if (gradesArray.length > 0) {
        filter.grades = { $in: gradesArray };
      }
    }

    // Tìm kiếm từ khóa
    if (keyword && keyword.trim()) {
      filter.name = { $regex: keyword.trim(), $options: "i" };
    }

    // Phân trang
    const exams = await Exam.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Exam.countDocuments(filter);

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
      data: exams,
    });
  } catch (err) {
    console.error("Lỗi getExams:", err);
    res.status(500).json({ error: err.message });
  }
};





/* =========================================================
   🔍 LẤY CHI TIẾT KỲ THI
========================================================= */
exports.getExamById = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ error: 'Không tìm thấy kỳ thi.' });
    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   ✏️ CẬP NHẬT KỲ THI
========================================================= */
exports.updateExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ error: 'Không tìm thấy kỳ thi để cập nhật.' });
    if (exam.status === 'locked' || exam.status === 'archived') {
      return res.status(403).json({ error: 'Kỳ thi đã bị khóa hoặc lưu trữ, không thể chỉnh sửa.' });
    }

    // ✅ Đảm bảo grades là String nếu có
    if (req.body.grades && Array.isArray(req.body.grades)) {
      req.body.grades = req.body.grades.map((g) => String(g));
    }

    const updated = await Exam.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: '✅ Cập nhật thành công', exam: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🗑️ XÓA KỲ THI
========================================================= */
exports.deleteExam = async (req, res) => {
  try {
    const deleted = await Exam.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Không tìm thấy kỳ thi để xóa.' });

    // ✅ Xóa tất cả dữ liệu liên quan đến kỳ thi
    await Promise.all([
      ExamClass.deleteMany({ exam: req.params.id }),
      ExamSchedule.deleteMany({ exam: req.params.id }),
      ExamRoom.deleteMany({ exam: req.params.id }),
      ExamGrade.deleteMany({ exam: req.params.id }),
      ExamStudent.deleteMany({ exam: req.params.id }),
      FixedExamRoom.deleteMany({ exam: req.params.id }),
      RoomAssignment.deleteMany({ exam: req.params.id }),
    ]);
    res.json({ message: '🗑️ Đã xóa kỳ thi thành công.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🔒 KHÓA KỲ THI
========================================================= */
exports.lockExam = async (req, res) => {
  try {
    const updated = await Exam.findByIdAndUpdate(req.params.id, { status: 'locked' }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy kỳ thi để khóa.' });
    res.json({ message: '🔒 Đã khóa kỳ thi.', exam: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🗂️ LƯU TRỮ / MỞ LẠI KỲ THI
========================================================= */
exports.archiveExam = async (req, res) => {
  try {
    const { isArchived = true } = req.body;
    // ✅ Sử dụng status: 'archived' thay vì isArchived (field đã bị comment trong model)
    const updated = await Exam.findByIdAndUpdate(
      req.params.id, 
      { status: isArchived ? 'archived' : 'draft' }, 
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy kỳ thi để lưu trữ.' });
    res.json({
      message: isArchived ? '📦 Đã lưu trữ kỳ thi.' : '📂 Đã mở lại kỳ thi.',
      exam: updated,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   ♻️ NHÂN BẢN KỲ THI
========================================================= */
exports.cloneExam = async (req, res) => {
  try {
    const oldExam = await Exam.findById(req.params.id);
    if (!oldExam) return res.status(404).json({ error: 'Kỳ thi không tồn tại.' });

    const examData = oldExam.toObject();
    delete examData._id;
    delete examData.createdAt;
    delete examData.updatedAt;
    
    const newExam = await Exam.create({
      ...examData,
      examId: `${oldExam.examId}_copy_${Date.now()}`,
      name: `${oldExam.name} (Bản sao)`,
      status: 'draft',
    });

    res.json({ message: '✅ Nhân bản kỳ thi thành công.', exam: newExam });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📊 THỐNG KÊ TỔNG QUAN
========================================================= */
exports.getExamStats = async (req, res) => {
  try {
    const examId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(examId)) {
      return res.status(400).json({ error: 'ID kỳ thi không hợp lệ.' });
    }

    const [classes, schedules, rooms, grades, students, fixedRooms] = await Promise.all([
      ExamClass.countDocuments({ exam: examId }),
      ExamSchedule.countDocuments({ exam: examId }),
      ExamRoom.countDocuments({ exam: examId }),
      ExamGrade.countDocuments({ exam: examId }),
      ExamStudent.countDocuments({ exam: examId }),
      FixedExamRoom.countDocuments({ exam: examId }),
    ]);

    res.json({ classes, schedules, rooms, grades, students, fixedRooms });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📈 THỐNG KÊ NÂNG CAO
========================================================= */
// Tổng hợp số lượng kỳ thi theo trạng thái
exports.getExamSummary = async (req, res) => {
  try {
    const summary = await Exam.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Thống kê số kỳ thi theo năm
exports.getYearlyStats = async (req, res) => {
  try {
    const data = await Exam.aggregate([
      { $group: { _id: '$year', totalExams: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
