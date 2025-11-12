// const { upsertGradeItem, getClassSubjectSummary, recomputeSummary } = require('../../services/gradeService');

//   // POST /grades/items
//   exports.upsertGradeItem = async (req, res) => {
//     try {
//       const item = await upsertGradeItem(req.body);
//       res.status(201).json(item);
//     } catch (err) {
//       console.error('[upsertGradeItem]', err);
//       res.status(400).json({ message: 'Không thể lưu điểm', error: err.message });
//     }
//   };

//   // GET /grades/summary?classId=&subjectId=&schoolYear=&semester=
//   exports.getClassSubjectSummary = async (req, res) => {
//     try {
//       const { classId, subjectId, schoolYear, semester } = req.query;
//       if (!classId || !subjectId || !schoolYear || !semester) {
//         return res.status(400).json({ message: 'Thiếu tham số classId/subjectId/schoolYear/semester' });
//       }
//       const data = await getClassSubjectSummary({ classId, subjectId, schoolYear, semester });
//       res.json({ count: data.length, data });
//     } catch (err) {
//       console.error('[getClassSubjectSummary]', err);
//       res.status(500).json({ message: 'Không thể lấy bảng điểm', error: err.message });
//     }
//   };

//   // POST /grades/recompute
//   // body: { studentId, subjectId, classId, schoolYear, semester }
//   exports.recomputeSummary = async (req, res) => {
//     try {
//       const summary = await recomputeSummary(req.body);
//       res.json(summary);
//     } catch (err) {
//       console.error('[recomputeSummary]', err);
//       res.status(400).json({ message: 'Không thể tính lại điểm tổng hợp', error: err.message });
//     }
//   };

const { upsertGradeItem, getClassSubjectSummary, recomputeSummary } = require('../../services/gradeService');
const Student = require('../../models/user/student');
const Class = require('../../models/class/class');
const Subject = require('../../models/subject/subject');
const GradeSummary = require('../../models/grade/gradeSummary');

// POST /grades/items
exports.upsertGradeItem = async (req, res) => {
  try {
    const { studentId, subjectId, component, score } = req.body;
    if (!studentId || !subjectId || !component || score == null) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }

    const item = await upsertGradeItem(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    console.error('[GradeController::upsertGradeItem]', err);
    res.status(400).json({ success: false, message: 'Không thể lưu điểm', error: err.message });
  }
};

// GET /grades/summary?classId=&subjectId=&schoolYear=&semester=
exports.getClassSubjectSummary = async (req, res) => {
  try {
    const { classId, subjectId, schoolYear, semester } = req.query;
    if (!classId || !subjectId || !schoolYear || !semester) {
      return res.status(400).json({ message: 'Thiếu tham số classId/subjectId/schoolYear/semester' });
    }

    const data = await getClassSubjectSummary({ classId, subjectId, schoolYear, semester });
    if (data.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy dữ liệu bảng điểm' });
    }

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[GradeController::getClassSubjectSummary]', err);
    res.status(500).json({ success: false, message: 'Không thể lấy bảng điểm', error: err.message });
  }
};

// POST /grades/recompute
exports.recomputeSummary = async (req, res) => {
  try {
    const { studentId, subjectId, schoolYear, semester } = req.body;
    if (!studentId || !subjectId || !schoolYear || !semester) {
      return res.status(400).json({ message: 'Thiếu thông tin tính điểm' });
    }

    const summary = await recomputeSummary(req.body);
    res.json({ success: true, data: summary });
  } catch (err) {
    console.error('[GradeController::recomputeSummary]', err);
    res.status(400).json({ success: false, message: 'Không thể tính lại điểm tổng hợp', error: err.message });
  }
};

// POST /grades/save - Lưu điểm nhiều học sinh
// body: { classId, subjectId, schoolYear, semester, scores: [{ studentId, components: [{ component, score }] }] }
exports.saveScores = async (req, res) => {
  try {
    const { classId, subjectId, schoolYear, semester, scores } = req.body || {};

    if (!classId || !subjectId || !schoolYear || !semester || !Array.isArray(scores)) {
      return res.status(400).json({ success: false, message: 'Thiếu tham số classId/subjectId/schoolYear/semester hoặc danh sách điểm' });
    }

    if (scores.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách điểm trống' });
    }

    for (const s of scores) {
      if (!s.studentId || !Array.isArray(s.components)) {
        return res.status(400).json({ success: false, message: 'Sai định dạng dữ liệu mỗi học sinh' });
      }
      for (const c of s.components) {
        if (!c.component || c.score == null) {
          return res.status(400).json({ success: false, message: 'Thiếu component/score trong components' });
        }
      }
    }

    const { saveScores } = require('../../services/gradeService');
    const result = await saveScores({ classId, subjectId, schoolYear, semester, scores });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    console.error('[GradeController::saveScores]', err);
    res.status(400).json({ success: false, message: 'Không thể lưu điểm hàng loạt', error: err.message });
  }
};
// POST /grades/init - Khởi tạo bảng điểm cho lớp (hoặc tất cả lớp nếu không có classId)
exports.initGradeTable = async (req, res) => {
  try {
    const { schoolYear, semester, classId } = req.body;

    if (!schoolYear || !semester) {
      return res.status(400).json({ success: false, message: 'Thiếu năm học hoặc học kỳ' });
    }

    // Nếu có classId, chỉ khởi tạo cho lớp đó
    let classes;
    if (classId) {
      const classItem = await Class.findById(classId).lean();
      if (!classItem) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học' });
      }
      classes = [classItem];
    } else {
      // Lấy tất cả lớp học
      classes = await Class.find({}).lean();
    }
    if (classes.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học nào' });
    }

    let totalCreated = 0;
    let totalSkipped = 0;

    // Duyệt qua từng lớp
    for (const classItem of classes) {
      const classId = classItem._id;
      const grade = classItem.grade;

      // Lấy tất cả học sinh trong lớp
      const students = await Student.find({ classId, status: 'active' }).lean();
      if (students.length === 0) {
        continue;
      }

      // Lấy tất cả môn học phù hợp với khối
      const subjects = await Subject.find({ grades: grade }).lean();
      if (subjects.length === 0) {
        continue;
      }

      // Tạo GradeSummary cho mỗi cặp (học sinh, môn học)
      const summariesToCreate = [];
      for (const student of students) {
        for (const subject of subjects) {
          // Kiểm tra xem đã có GradeSummary chưa
          const exists = await GradeSummary.findOne({
            studentId: student._id,
            subjectId: subject._id,
            schoolYear,
            semester,
          });

          if (!exists) {
            summariesToCreate.push({
              studentId: student._id,
              subjectId: subject._id,
              classId,
              schoolYear,
              semester,
              averages: {},
              average: null,
              result: null, // Chưa có điểm, sẽ được cập nhật khi giáo viên nhập điểm
              computedAt: new Date(),
              version: 'v1',
            });
          } else {
            totalSkipped++;
          }
        }
      }

      // Insert nhiều GradeSummary cùng lúc
      if (summariesToCreate.length > 0) {
        await GradeSummary.insertMany(summariesToCreate);
        totalCreated += summariesToCreate.length;
      }
    }

    res.json({
      success: true,
      message: `Khởi tạo bảng điểm thành công`,
      createdCount: totalCreated,
      skippedCount: totalSkipped,
      totalCount: totalCreated + totalSkipped,
      data: {
        created: totalCreated,
        skipped: totalSkipped,
        total: totalCreated + totalSkipped,
      },
    });
  } catch (err) {
    console.error('[GradeController::initGradeTable]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /grades/student - Học sinh xem điểm của bản thân
exports.getStudentGrades = async (req, res) => {
  try {
    const { studentId, schoolYear, semester } = req.query;
    const { role, accountId } = req.user || {};

    let targetStudentId = studentId;

    // Nếu là học sinh, tự động lấy studentId từ accountId của họ
    if (role === 'student') {
      const student = await Student.findOne({ accountId }).lean();
      if (!student) {
        return res.status(404).json({ 
          success: false, 
          message: 'Không tìm thấy thông tin học sinh của bạn' 
        });
      }
      targetStudentId = student._id.toString();
    } else if (!targetStudentId) {
      // Admin/teacher có thể truyền studentId, nhưng phải có
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu studentId' 
      });
    }

    // Kiểm tra học sinh có tồn tại không
    const student = await Student.findById(targetStudentId).lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học sinh' });
    }

    // Kiểm tra quyền truy cập (học sinh chỉ xem điểm của mình)
    if (role === 'student' && targetStudentId !== student._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Bạn chỉ được xem điểm của chính mình' 
      });
    }

    // Xây dựng query
    const query = { studentId: targetStudentId };
    if (schoolYear) query.schoolYear = schoolYear;
    if (semester) query.semester = semester;

    // Lấy tất cả GradeSummary của học sinh
    const summaries = await GradeSummary.find(query)
      .populate('subjectId', 'name code includeInAverage')
      .populate('classId', 'className classCode grade')
      .sort({ schoolYear: -1, semester: -1, 'subjectId.name': 1 })
      .lean();

    // Format dữ liệu trả về
    const formattedGrades = summaries.map(summary => ({
      _id: summary._id,
      subject: {
        _id: summary.subjectId._id,
        name: summary.subjectId.name,
        code: summary.subjectId.code,
        includeInAverage: summary.subjectId.includeInAverage,
      },
      class: summary.classId ? {
        _id: summary.classId._id,
        className: summary.classId.className,
        classCode: summary.classId.classCode,
        grade: summary.classId.grade,
      } : null,
      schoolYear: summary.schoolYear,
      semester: summary.semester,
      averages: summary.averages,
      average: summary.average, // Chỉ có nếu môn tính điểm TB
      result: summary.result, // "D" hoặc "K" nếu môn không tính điểm TB
      computedAt: summary.computedAt,
    }));

    res.json({
      success: true,
      count: formattedGrades.length,
      data: formattedGrades,
    });
  } catch (err) {
    console.error('[GradeController::getStudentGrades]', err);
    res.status(500).json({ success: false, message: 'Không thể lấy điểm của học sinh', error: err.message });
  }
};