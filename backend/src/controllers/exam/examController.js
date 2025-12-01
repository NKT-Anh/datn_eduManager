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

    // 🔒 Ràng buộc: Không được tạo kỳ thi nếu chưa có năm học active
    const { getCurrentSchoolYear } = require('../../utils/schoolYearHelper');
    const SchoolYear = require('../../models/schoolYear');
    const activeYearCode = await getCurrentSchoolYear();
    
    if (!activeYearCode) {
      return res.status(400).json({ 
        error: "Không thể tạo kỳ thi. Vui lòng kích hoạt một năm học trước." 
      });
    }

    // ✅ Lấy thông tin năm học active để kiểm tra
    const activeYear = await SchoolYear.findOne({ isActive: true });
    if (!activeYear) {
      return res.status(400).json({ 
        error: "Không thể tạo kỳ thi. Vui lòng kích hoạt một năm học trước." 
      });
    }

    // ✅ Tự động lấy năm học hiện tại đang active
    const examYear = year || activeYear.code;

    // Kiểm tra năm học được chọn có phải là năm học active không
    if (examYear !== activeYear.code) {
      return res.status(400).json({ 
        error: `Chỉ có thể tạo kỳ thi cho năm học đang hoạt động: ${activeYear.name} (${activeYear.code})` 
      });
    }

    // ✅ Kiểm tra dữ liệu bắt buộc
    if (!name || !semester || !grades?.length) {
      return res
        .status(400)
        .json({ error: "Thiếu thông tin bắt buộc (name, semester, grades)." });
    }

    // ✅ Kiểm tra ngày hợp lệ
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ error: "Ngày bắt đầu phải nhỏ hơn ngày kết thúc." });
    }

    // ✅ Đảm bảo grades là String
    const stringGrades = grades.map((g) => String(g));

    // ✅ Kiểm tra trùng logic (năm + học kỳ + loại + tên)
    const exists = await Exam.findOne({
      year: examYear,
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

    const examId = `exam_${examYear}_hk${semester}_${slug}`;

    // ✅ Tạo kỳ thi mới
    const exam = await Exam.create({
      examId,
      name,
      year: examYear, // ✅ Dùng năm học active
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
    // - Lớp (classId.year): phải thuộc năm học hiện tại
    // - Trạng thái: active
    // ✅ Tránh lấy học sinh của các khóa trước
    let studentsAdded = 0;
    try {
      const Class = require('../../models/class/class');
      
      // ✅ Lấy tất cả lớp thuộc năm học hiện tại
      const classesInCurrentYear = await Class.find({
        year: examYear // ✅ Chỉ lấy lớp của năm học hiện tại
      }).select("_id").lean();
      
      const classIdsInCurrentYear = classesInCurrentYear.map(c => c._id);

      // ✅ Lấy học sinh theo năm học hiện tại và lớp hiện tại
      const students = await Student.find({
        status: "active",
        currentYear: examYear, // ✅ Lọc theo năm học (VD: "2025-2026")
        grade: { $in: stringGrades }, // ✅ Lọc theo khối (VD: ["10", "11", "12"])
        classId: { $in: classIdsInCurrentYear }, // ✅ Chỉ lấy học sinh ở lớp của năm học hiện tại
        isDeleted: { $ne: true } // ✅ Không lấy học sinh đã bị xóa mềm
      })
        .populate({
          path: "classId",
          select: "_id year className", // ✅ Populate để kiểm tra year
          match: { year: examYear } // ✅ Đảm bảo lớp thuộc năm học hiện tại
        })
        .select("_id classId grade")
        .lean();

      // ✅ Lọc lại để chỉ lấy học sinh có classId hợp lệ (thuộc năm học hiện tại)
      const studentsWithValidClass = students.filter((s) => {
        return s.classId && s.classId._id && s.classId.year === examYear;
      });

      if (studentsWithValidClass.length > 0) {
        const examStudents = studentsWithValidClass.map((s, i) => ({
          exam: exam._id,
          student: s._id,
          class: s.classId._id, // ✅ Lấy từ student.classId, đảm bảo không null và thuộc năm học hiện tại
          grade: String(s.grade),
          sbd: `${String(s.grade)}${String(i + 1).padStart(4, "0")}`,
          status: "active",
        }));

        await ExamStudent.insertMany(examStudents, { ordered: false });
        studentsAdded = examStudents.length;
        console.log(`✅ Đã tự động thêm ${studentsAdded} học sinh vào kỳ thi ${exam.name} (năm học ${examYear})`);
      } else {
        console.warn(`⚠️ Không tìm thấy học sinh nào thuộc năm học ${examYear} và khối ${stringGrades.join(', ')}`);
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

/* =========================================================
   📊 PHÂN TÍCH ĐIỂM THI VÀ SO SÁNH VỚI NĂM TRƯỚC
   - Phân tích chi tiết điểm thi của kỳ thi hiện tại
   - So sánh với cùng loại kỳ thi năm trước
   - Xu hướng tăng/giảm điểm
========================================================= */
exports.getExamGradeAnalysis = async (req, res) => {
  try {
    const { id } = req.params; // Exam ID
    const { compareWithPreviousYear = true } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID kỳ thi không hợp lệ.' });
    }

    // ✅ Lấy thông tin kỳ thi hiện tại
    const currentExam = await Exam.findById(id)
      .populate('grades', 'name')
      .lean();

    if (!currentExam) {
      return res.status(404).json({ error: 'Không tìm thấy kỳ thi.' });
    }

    const ExamGrade = require('../../models/exam/examIndex').ExamGrade;
    const ExamStudent = require('../../models/exam/examIndex').ExamStudent;
    const Subject = require('../../models/subject/subject');

    // ✅ Phân tích điểm thi hiện tại
    const currentGrades = await ExamGrade.find({ exam: id })
      .populate('subject', 'name code')
      .populate('student', 'student')
      .lean();

    // ✅ Tính toán thống kê theo môn
    const subjectStats = {};
    const gradeDistribution = {
      excellent: 0, // 9-10
      good: 0,      // 7-8.9
      average: 0,   // 5-6.9
      weak: 0,      // <5
    };

    currentGrades.forEach((grade) => {
      if (grade.gradeValue == null) return;

      const subjectId = String(grade.subject?._id || grade.subject);
      const subjectName = grade.subject?.name || 'Unknown';

      if (!subjectStats[subjectId]) {
        subjectStats[subjectId] = {
          subjectId,
          subjectName,
          totalStudents: 0,
          gradedStudents: 0,
          sum: 0,
          min: 10,
          max: 0,
          scores: [],
        };
      }

      const stats = subjectStats[subjectId];
      stats.totalStudents++;
      
      if (grade.gradeValue != null) {
        stats.gradedStudents++;
        stats.sum += grade.gradeValue;
        stats.scores.push(grade.gradeValue);
        stats.min = Math.min(stats.min, grade.gradeValue);
        stats.max = Math.max(stats.max, grade.gradeValue);

        // Phân loại điểm
        if (grade.gradeValue >= 9) gradeDistribution.excellent++;
        else if (grade.gradeValue >= 7) gradeDistribution.good++;
        else if (grade.gradeValue >= 5) gradeDistribution.average++;
        else gradeDistribution.weak++;
      }
    });

    // ✅ Tính toán trung bình và các chỉ số thống kê
    const subjectAnalytics = Object.values(subjectStats).map((stats) => {
      const average = stats.gradedStudents > 0 ? stats.sum / stats.gradedStudents : 0;
      const sortedScores = [...stats.scores].sort((a, b) => a - b);
      const median = sortedScores.length > 0
        ? sortedScores.length % 2 === 0
          ? (sortedScores[sortedScores.length / 2 - 1] + sortedScores[sortedScores.length / 2]) / 2
          : sortedScores[Math.floor(sortedScores.length / 2)]
        : 0;

      // Tính độ lệch chuẩn
      const variance = stats.scores.length > 0
        ? stats.scores.reduce((sum, score) => sum + Math.pow(score - average, 2), 0) / stats.scores.length
        : 0;
      const standardDeviation = Math.sqrt(variance);

      return {
        ...stats,
        average: Number(average.toFixed(2)),
        median: Number(median.toFixed(2)),
        standardDeviation: Number(standardDeviation.toFixed(2)),
        passRate: stats.gradedStudents > 0
          ? Number(((stats.scores.filter(s => s >= 5).length / stats.gradedStudents) * 100).toFixed(2))
          : 0,
      };
    });

    // ✅ So sánh với năm trước (nếu có)
    let previousYearComparison = null;
    if (compareWithPreviousYear === 'true' || compareWithPreviousYear === true) {
      // Tính năm học trước
      const currentYearParts = currentExam.year.split('-');
      const previousYearStart = parseInt(currentYearParts[0]) - 1;
      const previousYearEnd = parseInt(currentYearParts[1]) - 1;
      const previousYear = `${previousYearStart}-${previousYearEnd}`;

      // Tìm kỳ thi cùng loại, cùng học kỳ, cùng khối năm trước
      const previousExam = await Exam.findOne({
        year: previousYear,
        semester: currentExam.semester,
        type: currentExam.type,
        grades: { $in: currentExam.grades },
        status: { $in: ['published', 'locked'] },
      }).lean();

      if (previousExam) {
        const previousGrades = await ExamGrade.find({ exam: previousExam._id })
          .populate('subject', 'name code')
          .lean();

        const previousSubjectStats = {};
        previousGrades.forEach((grade) => {
          if (grade.gradeValue == null) return;
          const subjectId = String(grade.subject?._id || grade.subject);
          if (!previousSubjectStats[subjectId]) {
            previousSubjectStats[subjectId] = {
              totalStudents: 0,
              gradedStudents: 0,
              sum: 0,
              scores: [],
            };
          }
          const stats = previousSubjectStats[subjectId];
          stats.totalStudents++;
          if (grade.gradeValue != null) {
            stats.gradedStudents++;
            stats.sum += grade.gradeValue;
            stats.scores.push(grade.gradeValue);
          }
        });

        // Tính toán so sánh
        const comparison = subjectAnalytics.map((current) => {
          const previous = previousSubjectStats[current.subjectId];
          if (!previous || previous.gradedStudents === 0) {
            return {
              ...current,
              previousYear: {
                average: null,
                totalStudents: 0,
                gradedStudents: 0,
                trend: null,
                trendPercentage: null,
              },
            };
          }

          const previousAverage = previous.sum / previous.gradedStudents;
          const trend = current.average - previousAverage;
          const trendPercentage = previousAverage > 0
            ? ((trend / previousAverage) * 100).toFixed(2)
            : null;

          return {
            ...current,
            previousYear: {
              average: Number(previousAverage.toFixed(2)),
              totalStudents: previous.totalStudents,
              gradedStudents: previous.gradedStudents,
              trend: Number(trend.toFixed(2)),
              trendPercentage: trendPercentage ? Number(trendPercentage) : null,
            },
          };
        });

        previousYearComparison = {
          examId: previousExam._id,
          examName: previousExam.name,
          year: previousYear,
          semester: previousExam.semester,
          comparison,
        };
      }
    }

    // ✅ Tổng hợp thống kê tổng thể
    const totalGraded = currentGrades.filter(g => g.gradeValue != null).length;
    const totalStudents = currentGrades.length;
    const overallAverage = totalGraded > 0
      ? currentGrades
          .filter(g => g.gradeValue != null)
          .reduce((sum, g) => sum + g.gradeValue, 0) / totalGraded
      : 0;

    res.json({
      currentExam: {
        _id: currentExam._id,
        name: currentExam.name,
        year: currentExam.year,
        semester: currentExam.semester,
        type: currentExam.type,
        grades: currentExam.grades,
      },
      overall: {
        totalStudents,
        totalGraded,
        overallAverage: Number(overallAverage.toFixed(2)),
        completionRate: totalStudents > 0
          ? Number(((totalGraded / totalStudents) * 100).toFixed(2))
          : 0,
        gradeDistribution,
      },
      bySubject: subjectAnalytics,
      previousYearComparison,
    });
  } catch (error) {
    console.error('❌ Lỗi khi phân tích điểm thi:', error);
    res.status(500).json({ error: error.message });
  }
};
