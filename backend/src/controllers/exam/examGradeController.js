const { ExamGrade, ExamStudent } = require("../../models/exam/examIndex");
const Exam = require("../../models/exam/exam");
const Subject = require("../../models/subject/subject");
const GradeItem = require("../../models/grade/gradeItem");
const mongoose = require("mongoose");
const xlsx = require("xlsx");

/* =========================================================
   ➕ NHẬP / CẬP NHẬT ĐIỂM CHO HỌC SINH DỰ THI
========================================================= */
exports.addOrUpdateGrade = async (req, res) => {
  try {
    const { exam, examStudent, subject, gradeValue, examSchedule, teacher, note } = req.body;

    if (!exam || !examStudent || !subject)
      return res.status(400).json({ error: "Thiếu dữ liệu bắt buộc (exam, examStudent, subject)." });

    if (gradeValue != null && (gradeValue < 0 || gradeValue > 10))
      return res.status(400).json({ error: "Giá trị điểm phải nằm trong khoảng 0–10." });

    // ✅ Kiểm tra exam tồn tại và có year
    const examData = await Exam.findById(exam).select("year semester type").lean();
    if (!examData) {
      return res.status(404).json({ error: "Không tìm thấy kỳ thi." });
    }
    if (!examData.year) {
      return res.status(400).json({ error: "Kỳ thi chưa có năm học." });
    }
    if (!examData.semester) {
      return res.status(400).json({ error: "Kỳ thi chưa có học kỳ." });
    }

    // Lấy thông tin học sinh từ ExamStudent (để cache vào bản điểm)
    const es = await ExamStudent.findById(examStudent).populate("class student").lean();
    if (!es) return res.status(404).json({ error: "Không tìm thấy học sinh dự thi." });

    // ✅ Kiểm tra examStudent thuộc về exam này
    if (String(es.exam) !== String(exam)) {
      return res.status(400).json({ error: "Học sinh dự thi không thuộc về kỳ thi này." });
    }

    // ✅ Nếu có examSchedule, kiểm tra schedule thuộc về exam này
    if (examSchedule) {
      const ExamSchedule = require("../../models/exam/examSchedule");
      const scheduleData = await ExamSchedule.findById(examSchedule).select("exam");
      if (!scheduleData) {
        return res.status(404).json({ error: "Không tìm thấy lịch thi." });
      }
      if (String(scheduleData.exam) !== String(exam)) {
        return res.status(400).json({ error: "Lịch thi không thuộc về kỳ thi này." });
      }
    }

    const grade = await ExamGrade.findOneAndUpdate(
      { exam, examStudent, subject },
      {
        examSchedule,
        gradeValue,
        teacher,
        note,
        class: es.class?._id || null,
        grade: es.grade || null,
        room: es.room || null,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // ✅ Đồng bộ điểm vào GradeItem nếu exam.type là 'midterm' hoặc 'final'
    if (gradeValue != null && (examData.type === 'midterm' || examData.type === 'final')) {
      try {
        const studentId = es.student?._id || es.student;
        const subjectId = subject;
        const classId = es.class?._id || es.class || null;
        const component = examData.type; // 'midterm' hoặc 'final'
        const schoolYear = examData.year;
        const semester = examData.semester;

        if (studentId && subjectId) {
          // Tìm hoặc tạo GradeItem
          await GradeItem.findOneAndUpdate(
            {
              studentId,
              subjectId,
              schoolYear,
              semester,
              component,
            },
            {
              score: gradeValue,
              teacherId: teacher || null,
              classId,
              date: new Date(),
              notes: note || `Điểm từ kỳ thi: ${examData.name || exam}`,
            },
            { upsert: true, new: true }
          );
          console.log(`✅ Đã đồng bộ điểm ${component} cho học sinh ${studentId} môn ${subjectId} (${schoolYear} - HK${semester}): ${gradeValue}`);
        }
      } catch (syncError) {
        console.error('⚠️ Lỗi đồng bộ điểm vào GradeItem:', syncError);
        // Không throw error để không ảnh hưởng đến việc lưu ExamGrade
      }
    }

    res.json({ message: "✅ Đã lưu điểm thành công.", grade });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📄 LẤY DANH SÁCH ĐIỂM THEO KỲ THI
========================================================= */
exports.getGradesByExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const { subjectId, classId, teacherId, page = 1, limit = 50 } = req.query;

    // ✅ Kiểm tra exam tồn tại và có year
    const exam = await Exam.findById(examId).select("year");
    if (!exam) {
      return res.status(404).json({ error: "Không tìm thấy kỳ thi." });
    }
    if (!exam.year) {
      return res.status(400).json({ error: "Kỳ thi chưa có năm học." });
    }

    const filter = { exam: examId };
    if (subjectId) filter.subject = subjectId;
    if (teacherId) filter.teacher = teacherId;

    const data = await ExamGrade.find(filter)
      .populate("exam", "name year semester") // ✅ Populate exam để có year
      .populate({
        path: "examStudent",
        populate: {
          path: "student",
          select: "name studentCode gender className",
          match: classId ? { classId: new mongoose.Types.ObjectId(classId) } : {},
        },
      })
      .populate("subject", "name subjectCode")
      .populate("teacher", "name teacherCode")
      .populate("examSchedule", "subject date startTime")
      .sort({ "examStudent.student.name": 1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const total = await ExamGrade.countDocuments(filter);

    res.json({
      total,
      totalPages: Math.ceil(total / limit),
      page: parseInt(page),
      data,
      examYear: exam.year, // ✅ Trả về năm học
    });
  } catch (err) {
    console.error("❌ Lỗi getGradesByExam:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🔍 LẤY CHI TIẾT MỘT BẢN GHI ĐIỂM
========================================================= */
exports.getGradeById = async (req, res) => {
  try {
    const grade = await ExamGrade.findById(req.params.id)
      .populate({
        path: "examStudent",
        populate: { path: "student", select: "name className studentCode gender" },
      })
      .populate("subject", "name subjectCode")
      .populate("teacher", "name teacherCode")
      .populate("verifiedBy", "name role");

    if (!grade) return res.status(404).json({ error: "Không tìm thấy điểm." });
    res.json(grade);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   ✏️ CẬP NHẬT ĐIỂM
========================================================= */
exports.updateGrade = async (req, res) => {
  try {
    if (req.body.gradeValue != null && (req.body.gradeValue < 0 || req.body.gradeValue > 10))
      return res.status(400).json({ error: "Giá trị điểm phải nằm trong khoảng 0–10." });

    // ✅ Lấy ExamGrade hiện tại để lấy thông tin exam và student
    const currentGrade = await ExamGrade.findById(req.params.id)
      .populate({
        path: "examStudent",
        populate: { path: "student class" }
      })
      .lean();
    
    if (!currentGrade) {
      return res.status(404).json({ error: "Không tìm thấy bản ghi điểm để cập nhật." });
    }

    const updated = await ExamGrade.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: "Không tìm thấy bản ghi điểm để cập nhật." });

    // ✅ Đồng bộ điểm vào GradeItem nếu exam.type là 'midterm' hoặc 'final'
    if (req.body.gradeValue != null) {
      try {
        const examData = await Exam.findById(currentGrade.exam).select("year semester type name").lean();
        if (examData && (examData.type === 'midterm' || examData.type === 'final')) {
          const es = currentGrade.examStudent;
          const studentId = es?.student?._id || es?.student;
          const subjectId = currentGrade.subject;
          const classId = es?.class?._id || es?.class || currentGrade.class || null;
          const component = examData.type; // 'midterm' hoặc 'final'
          const schoolYear = examData.year;
          const semester = examData.semester;
          const gradeValue = req.body.gradeValue;

          if (studentId && subjectId) {
            // Tìm hoặc cập nhật GradeItem
            await GradeItem.findOneAndUpdate(
              {
                studentId,
                subjectId,
                schoolYear,
                semester,
                component,
              },
              {
                score: gradeValue,
                teacherId: req.body.teacher || currentGrade.teacher || null,
                classId,
                date: new Date(),
                notes: req.body.note || currentGrade.note || `Điểm từ kỳ thi: ${examData.name || currentGrade.exam}`,
              },
              { upsert: true, new: true }
            );
            console.log(`✅ Đã đồng bộ điểm ${component} cho học sinh ${studentId} môn ${subjectId} (${schoolYear} - HK${semester}): ${gradeValue}`);
          }
        }
      } catch (syncError) {
        console.error('⚠️ Lỗi đồng bộ điểm vào GradeItem:', syncError);
        // Không throw error để không ảnh hưởng đến việc cập nhật ExamGrade
      }
    }

    res.json({ message: "✅ Cập nhật điểm thành công.", grade: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🗑️ XÓA BẢN GHI ĐIỂM
========================================================= */
exports.deleteGrade = async (req, res) => {
  try {
    const deleted = await ExamGrade.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Không tìm thấy điểm để xóa." });
    res.json({ message: "🗑️ Đã xóa điểm thành công." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📥 IMPORT ĐIỂM TỪ EXCEL
========================================================= */
exports.importGradesFromExcel = async (req, res) => {
  try {
    const { examId, subjectId, teacherId } = req.body;
    if (!req.file) return res.status(400).json({ error: "Vui lòng tải file Excel." });

    // ✅ Lấy thông tin exam để kiểm tra type
    const examData = await Exam.findById(examId).select("year semester type name").lean();
    if (!examData) {
      return res.status(404).json({ error: "Không tìm thấy kỳ thi." });
    }
    const shouldSyncGrades = examData.type === 'midterm' || examData.type === 'final';

    const workbook = xlsx.readFile(req.file.path);
    const sheet = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    if (!sheet.length) return res.status(400).json({ error: "File Excel trống." });

    const operations = [];
    const gradeItemsToSync = []; // Để đồng bộ vào GradeItem sau

    for (const row of sheet) {
      const examStudent = await ExamStudent.findOne({
        exam: examId,
        "student.studentCode": row.studentCode,
      }).populate("student class");
      if (!examStudent) continue;

      const gradeValue = Number(row.gradeValue) || 0;
      operations.push({
        updateOne: {
          filter: { exam: examId, examStudent: examStudent._id, subject: subjectId },
          update: { gradeValue, teacher: teacherId },
          upsert: true,
        },
      });

      // ✅ Nếu cần đồng bộ, thêm vào danh sách
      if (shouldSyncGrades && gradeValue != null) {
        const studentId = examStudent.student?._id || examStudent.student;
        const classId = examStudent.class?._id || examStudent.class || null;
        if (studentId && subjectId) {
          gradeItemsToSync.push({
            studentId,
            subjectId,
            classId,
            schoolYear: examData.year,
            semester: examData.semester,
            component: examData.type, // 'midterm' hoặc 'final'
            score: gradeValue,
            teacherId: teacherId || null,
            date: new Date(),
            notes: `Điểm từ kỳ thi: ${examData.name || examId}`,
          });
        }
      }
    }

    if (operations.length) {
      await ExamGrade.bulkWrite(operations);
      
      // ✅ Đồng bộ điểm vào GradeItem
      if (shouldSyncGrades && gradeItemsToSync.length > 0) {
        const gradeItemOperations = gradeItemsToSync.map(item => ({
          updateOne: {
            filter: {
              studentId: item.studentId,
              subjectId: item.subjectId,
              schoolYear: item.schoolYear,
              semester: item.semester,
              component: item.component,
            },
            update: {
              $set: {
                score: item.score,
                teacherId: item.teacherId,
                classId: item.classId,
                date: item.date,
                notes: item.notes,
              },
            },
            upsert: true,
          },
        }));
        await GradeItem.bulkWrite(gradeItemOperations);
        console.log(`✅ Đã đồng bộ ${gradeItemsToSync.length} điểm ${examData.type} vào GradeItem`);
      }
    }
    
    res.json({ message: `✅ Import ${operations.length} điểm thi thành công.` });
  } catch (err) {
    console.error("❌ Lỗi importGradesFromExcel:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📤 EXPORT ĐIỂM RA EXCEL
========================================================= */
exports.exportGradesToExcel = async (req, res) => {
  try {
    const { examId } = req.params;
    const data = await ExamGrade.find({ exam: examId })
      .populate({
        path: "examStudent",
        populate: { path: "student", select: "name className gender studentCode" },
      })
      .populate("subject", "name subjectCode")
      .populate("teacher", "name teacherCode")
      .lean();

    if (!data.length) return res.status(404).json({ error: "Không có dữ liệu để xuất." });

    const rows = data.map((g, i) => ({
      STT: i + 1,
      Mã_HS: g.examStudent?.student?.studentCode || "",
      Họ_tên: g.examStudent?.student?.name || "",
      Lớp: g.examStudent?.student?.className || "",
      Giới_tính: g.examStudent?.student?.gender || "",
      Môn: g.subject?.name || "",
      Điểm: g.gradeValue,
      GV_Chấm: g.teacher?.name || "",
    }));

    const ws = xlsx.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 5 },
      { wch: 12 },
      { wch: 25 },
      { wch: 10 },
      { wch: 10 },
      { wch: 20 },
      { wch: 10 },
      { wch: 20 },
    ];

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Điểm thi");
    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", `attachment; filename="grades_${examId}.xlsx"`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🔒 KHÓA TOÀN BỘ ĐIỂM
========================================================= */
exports.lockGrades = async (req, res) => {
  try {
    const updated = await ExamGrade.updateMany(
      { exam: req.params.examId, isLocked: { $ne: true } },
      { isLocked: true }
    );
    res.json({ message: `🔒 Đã khóa ${updated.modifiedCount} bản ghi điểm.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🗑️ RESET TOÀN BỘ ĐIỂM CỦA KỲ THI
========================================================= */
exports.resetGrades = async (req, res) => {
  try {
    const { examId } = req.params;
    const deleted = await ExamGrade.deleteMany({ exam: examId });
    res.json({ message: `🗑️ Đã xóa ${deleted.deletedCount} bản ghi điểm của kỳ thi.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📊 THỐNG KÊ ĐIỂM THEO MÔN
========================================================= */
exports.getStats = async (req, res) => {
  try {
    const examId = req.params.examId;
    if (!mongoose.Types.ObjectId.isValid(examId))
      return res.status(400).json({ error: "ID kỳ thi không hợp lệ." });

    const stats = await ExamGrade.aggregate([
      { $match: { exam: new mongoose.Types.ObjectId(examId) } },
      {
        $group: {
          _id: "$subject",
          avg: { $avg: "$gradeValue" },
          max: { $max: "$gradeValue" },
          min: { $min: "$gradeValue" },
          totalStudents: { $sum: 1 },
          pass: { $sum: { $cond: [{ $gte: ["$gradeValue", 5] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const populatedStats = await Promise.all(
      stats.map(async (item) => {
        const subj = await Subject.findById(item._id).select("name");
        const avg = Number(item.avg.toFixed(2));
        const passRate = ((item.pass / item.totalStudents) * 100).toFixed(1) + "%";
        return { ...item, subjectName: subj?.name || "N/A", avg, passRate };
      })
    );

    res.json(populatedStats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
