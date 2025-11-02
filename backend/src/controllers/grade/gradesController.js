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

// POST /grades/save-scores
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
exports.initGradeTable = async (req, res) => {
  try {
    const { gradeLevel, schoolYear, semester } = req.body;

    if (!schoolYear || !semester) {
      return res.status(400).json({ message: 'Thiếu năm học hoặc học kỳ' });
    }

    // Lọc học sinh theo khối
    const query = { __t: 'Student' };
    if (gradeLevel !== 'all') {
      query.grade = gradeLevel; // field grade trong User
    }

    const students = await User.find(query);

    // Tạo bảng điểm rỗng
    const gradeItems = [];
    for (const student of students) {
      // check xem đã có bảng điểm rỗng chưa
      const exists = await GradeItem.findOne({
        studentId: student._id,
        schoolYear,
        semester,
      });
      if (!exists) {
        gradeItems.push({
          studentId: student._id,
          schoolYear,
          semester,
          subjects: [], // sẽ thêm sau
        });
      }
    }

    if (gradeItems.length > 0) {
      await GradeItem.insertMany(gradeItems);
    }

    res.json({ success: true, createdCount: gradeItems.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};