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
//       console.error('[recomputeSummary]', err);s
//       res.status(400).json({ message: 'Không thể tính lại điểm tổng hợp', error: err.message });
//     }
//   };

const { upsertGradeItem, getClassSubjectSummary, recomputeSummary, computeAndSaveYearGPA } = require('../../services/gradeService');
const Student = require('../../models/user/student');
const Class = require('../../models/class/class');
const Subject = require('../../models/subject/subject');
const GradeSummary = require('../../models/grade/gradeSummary');
const GradeItem = require('../../models/grade/gradeItem');
const StudentYearRecord = require('../../models/user/studentYearRecord');
const Teacher = require('../../models/user/teacher');
const { calculateAcademicLevel } = require('../../services/academicLevelService');

// POST /grades/items
exports.upsertGradeItem = async (req, res) => {
  try {
    const { studentId, subjectId, component, score, classId, schoolYear, semester } = req.body;
    
    console.log(`[upsertGradeItem] Request body:`, {
      studentId,
      subjectId,
      component,
      score,
      classId,
      schoolYear,
      semester
    });
    
    if (!studentId || !subjectId || !component || score == null) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }

    const { role, accountId } = req.user;
    console.log(`[upsertGradeItem] User:`, { role, accountId });

    // ✅ Kiểm tra quyền: Giáo viên chỉ nhập điểm môn mình được phân công dạy
    // Kiểm tra trực tiếp TeachingAssignment thay vì dựa vào permissionContext
    if (role === 'teacher') {
      const Teacher = require('../../models/user/teacher');
      const currentTeacher = await Teacher.findOne({ accountId }).lean();
      if (!currentTeacher) {
        console.log(`[upsertGradeItem] Teacher not found for accountId:`, accountId);
        return res.status(404).json({ 
          success: false, 
          message: 'Không tìm thấy thông tin giáo viên' 
        });
      }

      console.log(`[upsertGradeItem] Found teacher:`, currentTeacher._id);

      const TeachingAssignment = require('../../models/subject/teachingAssignment');
      
      // Nếu có classId, schoolYear, semester thì check cụ thể
      if (classId && schoolYear && semester) {
        const assignment = await TeachingAssignment.findOne({
          teacherId: currentTeacher._id,
          subjectId,
          classId,
          year: String(schoolYear),
          semester: String(semester),
        }).lean();

        console.log(`[upsertGradeItem] TeachingAssignment check:`, {
          teacherId: currentTeacher._id,
          subjectId,
          classId,
          year: String(schoolYear),
          semester: String(semester),
          found: !!assignment
        });

        if (!assignment) {
          // Kiểm tra xem có assignment nào cho giáo viên này không (để debug)
          const anyAssign = await TeachingAssignment.findOne({
            teacherId: currentTeacher._id,
            year: String(schoolYear),
            semester: String(semester),
          }).lean();
          console.log(`[upsertGradeItem] Any assignment for this teacher/year/semester:`, anyAssign ? 'Yes' : 'No');
          
          return res.status(403).json({ 
            success: false, 
            message: 'Bạn không được phân công dạy lớp/môn này trong năm/học kỳ đã chọn' 
          });
        }
      } else {
        // Nếu không có đủ thông tin, chỉ check subjectId
        console.log(`[upsertGradeItem] Missing classId/schoolYear/semester, checking by subjectId only`);
        const anyAssign = await TeachingAssignment.findOne({
          teacherId: currentTeacher._id,
          subjectId,
        }).lean();

        console.log(`[upsertGradeItem] Any assignment for this teacher/subject:`, anyAssign ? 'Yes' : 'No');

        if (!anyAssign) {
          return res.status(403).json({ 
            success: false, 
            message: 'Bạn không được phân công dạy môn này' 
          });
        }
      }
    }

    console.log(`[upsertGradeItem] Permission check passed, calling upsertGradeItem service`);

    const item = await upsertGradeItem(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    console.error('[GradeController::upsertGradeItem]', err);
    res.status(400).json({ success: false, message: 'Không thể lưu điểm', error: err.message });
  }
};

// POST /grades/items/bulk - Lưu mảng điểm cho một component
exports.upsertGradeItems = async (req, res) => {
  try {
    const { studentId, subjectId, component, scores, classId, schoolYear, semester } = req.body;
    
    console.log(`[upsertGradeItems] Request body:`, {
      studentId,
      subjectId,
      component,
      scores,
      classId,
      schoolYear,
      semester
    });
    
    // ✅ Validate đầy đủ thông tin bắt buộc
    if (!studentId || !subjectId || !component || !Array.isArray(scores)) {
      return res.status(400).json({ 
        success: false,
        message: 'Thiếu thông tin bắt buộc: studentId, subjectId, component, scores (array)' 
      });
    }

    if (!schoolYear || !semester) {
      return res.status(400).json({ 
        success: false,
        message: 'Thiếu thông tin bắt buộc: schoolYear, semester' 
      });
    }

    if (scores.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Mảng điểm không được rỗng' 
      });
    }

    const { role, accountId } = req.user;

    // ✅ Kiểm tra quyền tương tự như upsertGradeItem
    if (role === 'teacher') {
      const Teacher = require('../../models/user/teacher');
      const currentTeacher = await Teacher.findOne({ accountId }).lean();
      if (!currentTeacher) {
        return res.status(404).json({ 
          success: false, 
          message: 'Không tìm thấy thông tin giáo viên' 
        });
      }

      const TeachingAssignment = require('../../models/subject/teachingAssignment');
      
      if (classId && schoolYear && semester) {
        const assignment = await TeachingAssignment.findOne({
          teacherId: currentTeacher._id,
          subjectId,
          classId,
          year: String(schoolYear),
          semester: String(semester),
        }).lean();

        if (!assignment) {
          return res.status(403).json({ 
            success: false, 
            message: 'Bạn không được phân công dạy lớp/môn này trong năm/học kỳ đã chọn' 
          });
        }
      } else {
        const anyAssign = await TeachingAssignment.findOne({
          teacherId: currentTeacher._id,
          subjectId,
        }).lean();

        if (!anyAssign) {
          return res.status(403).json({ 
            success: false, 
            message: 'Bạn không được phân công dạy môn này' 
          });
        }
      }
    }

    // ✅ Xóa tất cả điểm cũ của component này (đảm bảo đúng học sinh, năm học, học kỳ)
    const deleteResult = await GradeItem.deleteMany({
      studentId: String(studentId),
      subjectId: String(subjectId),
      schoolYear: String(schoolYear),
      semester: String(semester),
      component: String(component),
    });
    
    console.log(`[upsertGradeItems] Đã xóa ${deleteResult.deletedCount} điểm cũ cho component ${component}`);

    // ✅ Lưu mảng điểm mới với attempt tăng dần (đảm bảo đúng học sinh, năm học, học kỳ)
    const items = scores
      .filter(score => score != null && !isNaN(score) && score >= 0 && score <= 10)
      .map((score, index) => ({
        studentId: String(studentId),
        subjectId: String(subjectId),
        classId: classId ? String(classId) : undefined,
        schoolYear: String(schoolYear),
        semester: String(semester),
        component: String(component),
        score: Number(score),
        attempt: index + 1,
        teacherId: req.user.teacherId || req.user._id,
        date: new Date(),
      }));
    
    console.log(`[upsertGradeItems] Sẽ lưu ${items.length} điểm mới cho học sinh ${studentId}, năm học ${schoolYear}, học kỳ ${semester}`);

    if (items.length === 0) {
      return res.status(400).json({ message: 'Không có điểm hợp lệ nào để lưu' });
    }

    const savedItems = await GradeItem.insertMany(items);
    
    console.log(`[upsertGradeItems] Đã lưu ${savedItems.length} điểm thành công cho học sinh ${studentId}, năm học ${schoolYear}, học kỳ ${semester}`);

    // ✅ Tính lại summary (đảm bảo đúng học sinh, năm học, học kỳ)
    try {
      const summary = await recomputeSummary({
        studentId: String(studentId),
        subjectId: String(subjectId),
        classId: classId ? String(classId) : undefined,
        schoolYear: String(schoolYear),
        semester: String(semester),
      });
      console.log(`[upsertGradeItems] Đã tính lại summary cho học sinh ${studentId}, năm học ${schoolYear}, học kỳ ${semester}`, {
        average: summary?.average,
        averages: summary?.averages,
        summaryId: summary?._id,
      });
      
      if (!summary || summary.average === null || summary.average === undefined) {
        console.warn(`[upsertGradeItems] ⚠️ Cảnh báo: Điểm trung bình chưa được tính hoặc bằng null cho học sinh ${studentId}, môn ${subjectId}`);
      }
    } catch (recomputeError) {
      console.error('⚠️ Lỗi khi tính lại summary:', recomputeError);
      console.error('⚠️ Chi tiết lỗi:', {
        message: recomputeError.message,
        stack: recomputeError.stack,
        studentId,
        subjectId,
        schoolYear,
        semester,
      });
      // Vẫn trả về success vì đã lưu điểm thành công, nhưng log lỗi để debug
    }

    // ✅ Tính lại điểm TB cả năm
    if (classId) {
      try {
        await computeAndSaveYearGPA({
          studentId: String(studentId),
          classId: String(classId),
          schoolYear: String(schoolYear),
        });
        console.log(`[upsertGradeItems] Đã tính lại điểm TB cả năm cho học sinh ${studentId}, năm học ${schoolYear}`);
      } catch (yearGPAError) {
        console.error('⚠️ Lỗi khi tính điểm TB cả năm:', yearGPAError);
      }
    }

    res.status(201).json({ 
      success: true, 
      data: savedItems, 
      count: savedItems.length,
      message: `Đã lưu ${savedItems.length} điểm cho học sinh, năm học ${schoolYear}, học kỳ ${semester}`
    });
  } catch (err) {
    console.error('[GradeController::upsertGradeItems]', err);
    res.status(400).json({ success: false, message: 'Không thể lưu điểm', error: err.message });
  }
};

// DELETE /grades/items - Xóa tất cả điểm của một component cho học sinh
exports.deleteGradeItems = async (req, res) => {
  try {
    const { studentId, subjectId, component, classId, schoolYear, semester } = req.query;
    
    if (!studentId || !subjectId || !component || !schoolYear || !semester) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }

    const { role, accountId } = req.user;

    // ✅ Kiểm tra quyền tương tự như upsertGradeItem
    if (role === 'teacher') {
      const Teacher = require('../../models/user/teacher');
      const currentTeacher = await Teacher.findOne({ accountId }).lean();
      if (!currentTeacher) {
        return res.status(404).json({ 
          success: false, 
          message: 'Không tìm thấy thông tin giáo viên' 
        });
      }

      const TeachingAssignment = require('../../models/subject/teachingAssignment');
      
      if (classId && schoolYear && semester) {
        const assignment = await TeachingAssignment.findOne({
          teacherId: currentTeacher._id,
          subjectId,
          classId,
          year: String(schoolYear),
          semester: String(semester),
        }).lean();

        if (!assignment) {
          return res.status(403).json({ 
            success: false, 
            message: 'Bạn không được phân công dạy lớp/môn này trong năm/học kỳ đã chọn' 
          });
        }
      } else {
        const anyAssign = await TeachingAssignment.findOne({
          teacherId: currentTeacher._id,
          subjectId,
        }).lean();

        if (!anyAssign) {
          return res.status(403).json({ 
            success: false, 
            message: 'Bạn không được phân công dạy môn này' 
          });
        }
      }
    }

    // ✅ Xóa tất cả điểm của component này
    const result = await GradeItem.deleteMany({
      studentId,
      subjectId,
      schoolYear,
      semester,
      component,
    });

    // ✅ Tính lại summary sau khi xóa
    if (result.deletedCount > 0) {
      await recomputeSummary({
        studentId,
        subjectId,
        classId,
        schoolYear,
        semester,
      });
    }

    res.json({ success: true, deletedCount: result.deletedCount });
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

    // ✅ Middleware đã kiểm tra role và permission cơ bản
    // Frontend đã filter lớp/môn theo TeachingAssignment, nên không cần check lại ở đây
    // Cho phép tất cả giáo viên truy cập (frontend sẽ chỉ hiển thị lớp/môn được phân công)

    const data = await getClassSubjectSummary({ classId, subjectId, schoolYear, semester });
    
    // ✅ Trả về mảng rỗng thay vì 404 khi không có dữ liệu (có thể chưa khởi tạo bảng điểm)
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

    const { role, accountId } = req.user;

    // ✅ Kiểm tra quyền: Giáo viên chỉ nhập điểm môn mình được phân công dạy
    // Kiểm tra trực tiếp TeachingAssignment thay vì dựa vào permissionContext
    if (role === 'teacher') {
      const Teacher = require('../../models/user/teacher');
      const currentTeacher = await Teacher.findOne({ accountId }).lean();
      if (!currentTeacher) {
        return res.status(404).json({ 
          success: false, 
          message: 'Không tìm thấy thông tin giáo viên' 
        });
      }

      const TeachingAssignment = require('../../models/subject/teachingAssignment');
      const assignment = await TeachingAssignment.findOne({
        teacherId: currentTeacher._id,
        subjectId,
        classId,
        year: String(schoolYear),
        semester: String(semester),
      }).lean();

      if (!assignment) {
        return res.status(403).json({ 
          success: false, 
          message: 'Bạn không được phân công dạy lớp/môn này trong năm/học kỳ đã chọn' 
        });
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
      const classYear = classItem.year; // ✅ Năm học của lớp

      // ✅ Lấy tất cả học sinh trong lớp - CHỈ lấy học sinh của niên khóa tương ứng
      const students = await Student.find({ 
        classId, 
        status: 'active',
        currentYear: classYear // ✅ CHỈ lấy học sinh có currentYear trùng với năm học của lớp
      }).lean();
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

    // Lấy tất cả GradeItem để hiển thị các điểm riêng lẻ
    const GradeItem = require('../../models/grade/gradeItem');
    const allGradeItems = await GradeItem.find(query)
      .select('subjectId component score semester schoolYear')
      .sort({ date: 1 })
      .lean();

    // Format dữ liệu trả về
    const formattedGrades = summaries.map(summary => {
      // Lấy các điểm riêng lẻ cho môn học này
      const subjectItems = allGradeItems.filter(
        item => String(item.subjectId) === String(summary.subjectId._id) &&
        item.semester === summary.semester &&
        item.schoolYear === summary.schoolYear
      );

      // Nhóm điểm theo component
      const gradeItemsByComponent = {
        oral: subjectItems.filter(item => item.component === 'oral').map(item => item.score),
        quiz15: subjectItems.filter(item => item.component === 'quiz15').map(item => item.score),
        quiz45: subjectItems.filter(item => item.component === 'quiz45').map(item => item.score),
        midterm: subjectItems.filter(item => item.component === 'midterm').map(item => item.score),
        final: subjectItems.filter(item => item.component === 'final').map(item => item.score),
      };

      return {
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
        averages: summary.averages, // Điểm TB của từng component
        gradeItems: gradeItemsByComponent, // Các điểm riêng lẻ
        average: summary.average, // Chỉ có nếu môn tính điểm TB
        result: summary.result, // "D" hoặc "K" nếu môn không tính điểm TB
        computedAt: summary.computedAt,
      };
    });

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

// GET /grades/admin/all - Admin/BGH xem tất cả điểm của tất cả học sinh
exports.getAllStudentsGrades = async (req, res) => {
  try {
    const { schoolYear, semester, classId, subjectId, grade, keyword } = req.query;
    
    // Build query
    let studentQuery = {};
    if (classId) {
      studentQuery.classId = classId;
    } else if (grade) {
      const classes = await Class.find({ grade: String(grade) }).select('_id').lean();
      studentQuery.classId = { $in: classes.map(c => c._id) };
    }
    if (keyword) {
      studentQuery.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { studentCode: { $regex: keyword, $options: 'i' } }
      ];
    }

    // ✅ Get students - Filter by currentYear if schoolYear is provided
    if (schoolYear && studentQuery.classId) {
      // Nếu có classId, lấy năm học của lớp và filter theo currentYear
      const classInfo = await Class.findById(studentQuery.classId).select('year').lean();
      if (classInfo) {
        studentQuery.currentYear = classInfo.year;
      }
    } else if (schoolYear && studentQuery.classId && studentQuery.classId.$in) {
      // Nếu có nhiều classId, lấy năm học của các lớp và filter
      const classes = await Class.find({ _id: { $in: studentQuery.classId.$in } }).select('year').lean();
      const classYears = [...new Set(classes.map(c => c.year).filter(Boolean))];
      if (classYears.length === 1) {
        studentQuery.currentYear = classYears[0];
      }
    }
    
    const students = await Student.find(studentQuery)
      .populate({
        path: 'classId',
        select: 'className classCode grade year',
        match: schoolYear ? { year: schoolYear } : {}
      })
      .lean();
    
    // ✅ Lọc lại để chỉ lấy học sinh có classId hợp lệ và đúng năm học (nếu có schoolYear)
    const validStudents = students.filter(s => {
      if (!s.classId) return false;
      if (schoolYear && s.classId.year && String(s.classId.year) !== String(schoolYear)) {
        return false;
      }
      return true;
    });
    const studentIds = students.map(s => s._id);

    // Build summary query
    let summaryQuery = { studentId: { $in: studentIds } };
    if (schoolYear) summaryQuery.schoolYear = schoolYear;
    if (semester) summaryQuery.semester = semester;
    if (subjectId) summaryQuery.subjectId = subjectId;

    // Get grade summaries
    const summaries = await GradeSummary.find(summaryQuery)
      .populate('subjectId', 'name code includeInAverage')
      .populate('classId', 'className classCode grade')
      .lean();

    // Get student year records for conduct and academic level
    let yearRecordQuery = { studentId: { $in: studentIds } };
    if (schoolYear) yearRecordQuery.year = schoolYear;
    if (semester) {
      if (semester === '1') yearRecordQuery.semester = 'HK1';
      else if (semester === '2') yearRecordQuery.semester = 'HK2';
    }
    const yearRecords = await StudentYearRecord.find(yearRecordQuery)
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className grade')
      .lean();

    // Group by student
    const studentMap = new Map();
    validStudents.forEach(s => {
      studentMap.set(String(s._id), {
        _id: s._id,
        name: s.name,
        studentCode: s.studentCode,
        class: s.classId ? {
          _id: s.classId._id,
          className: s.classId.className,
          classCode: s.classId.classCode,
          grade: s.classId.grade
        } : null
      });
    });

    // Add summaries to students
    summaries.forEach(summary => {
      const studentId = String(summary.studentId);
      if (!studentMap.has(studentId)) return;
      
      const student = studentMap.get(studentId);
      if (!student.subjects) student.subjects = [];
      
      const yearRecord = yearRecords.find(yr => 
        String(yr.studentId) === studentId &&
        (!schoolYear || yr.year === schoolYear) &&
        (!semester || (semester === '1' && yr.semester === 'HK1') || (semester === '2' && yr.semester === 'HK2'))
      );

      student.subjects.push({
        _id: summary._id,
        subject: {
          _id: summary.subjectId._id,
          name: summary.subjectId.name,
          code: summary.subjectId.code
        },
        averages: summary.averages || {},
        average: summary.average,
        result: summary.result,
        semester: summary.semester,
        schoolYear: summary.schoolYear
      });

      // Add year record data if available
      if (yearRecord) {
        student.gpa = yearRecord.gpa;
        student.conduct = yearRecord.conduct;
        student.academicLevel = yearRecord.academicLevel || null;
        student.rank = yearRecord.rank;
      }
    });

    // Calculate semester/year averages
    const result = Array.from(studentMap.values()).map(student => {
      if (student.subjects && student.subjects.length > 0) {
        const validAverages = student.subjects
          .filter(s => s.average !== null && s.average !== undefined)
          .map(s => s.average);
        if (validAverages.length > 0) {
          student.semesterAverage = validAverages.reduce((a, b) => a + b, 0) / validAverages.length;
        }
      }
      return student;
    });

    res.json({
      success: true,
      count: result.length,
      data: result,
      filters: { schoolYear, semester, classId, subjectId, grade, keyword }
    });
  } catch (err) {
    console.error('[GradeController::getAllStudentsGrades]', err);
    res.status(500).json({ success: false, message: 'Không thể lấy điểm', error: err.message });
  }
};

// GET /grades/admin/statistics - Thống kê điểm theo lớp/khối/năm học
exports.getStatistics = async (req, res) => {
  try {
    const { schoolYear, semester, classId, grade } = req.query;

    // Build query
    let classQuery = {};
    if (classId) {
      classQuery._id = classId;
    } else if (grade) {
      classQuery.grade = String(grade);
    }

    const classes = await Class.find(classQuery).lean();
    const classIds = classes.map(c => c._id);

    // ✅ Get students in these classes - Filter by currentYear if schoolYear is provided
    let studentQuery = { classId: { $in: classIds } };
    if (schoolYear) {
      // Lấy năm học của các lớp
      const classYears = [...new Set(classes.map(c => c.year).filter(Boolean))];
      if (classYears.length === 1) {
        studentQuery.currentYear = classYears[0];
      }
    }
    
    const students = await Student.find(studentQuery)
      .populate({
        path: 'classId',
        select: 'className classCode grade year',
        match: schoolYear ? { year: schoolYear } : {}
      })
      .lean();
    
    // ✅ Lọc lại để chỉ lấy học sinh có classId hợp lệ và đúng năm học (nếu có schoolYear)
    const validStudents2 = students.filter(s => {
      if (!s.classId) return false;
      if (schoolYear && s.classId.year && String(s.classId.year) !== String(schoolYear)) {
        return false;
      }
      return true;
    });
    const studentIds = validStudents2.map(s => s._id);

    // Get grade summaries
    let summaryQuery = { studentId: { $in: studentIds } };
    if (schoolYear) summaryQuery.schoolYear = schoolYear;
    if (semester) summaryQuery.semester = semester;

    const summaries = await GradeSummary.find(summaryQuery)
      .populate('subjectId', 'name')
      .populate('classId', 'className grade')
      .lean();

    // Get year records for academic level
    let yearRecordQuery = { studentId: { $in: studentIds } };
    if (schoolYear) yearRecordQuery.year = schoolYear;
    if (semester) {
      if (semester === '1') yearRecordQuery.semester = 'HK1';
      else if (semester === '2') yearRecordQuery.semester = 'HK2';
      else if (semester === 'CN') yearRecordQuery.semester = 'CN';
    }
    const yearRecords = await StudentYearRecord.find(yearRecordQuery).lean();

    // Calculate statistics
    const stats = {
      byClass: {},
      byGrade: {},
      overall: {
        excellent: 0,
        good: 0,
        average: 0,
        weak: 0,
        total: validStudents.length
      }
    };

    // Group by class
    classes.forEach(cls => {
      const clsStudents = students.filter(s => String(s.classId) === String(cls._id));
      const clsStudentIds = clsStudents.map(s => String(s._id));
      const clsYearRecords = yearRecords.filter(yr => clsStudentIds.includes(String(yr.studentId)));

      const excellent = clsYearRecords.filter(yr => yr.academicLevel === 'Giỏi').length;
      const good = clsYearRecords.filter(yr => yr.academicLevel === 'Khá').length;
      const average = clsYearRecords.filter(yr => yr.academicLevel === 'Trung bình').length;
      const weak = clsYearRecords.filter(yr => yr.academicLevel === 'Yếu').length;

      stats.byClass[cls.className] = {
        className: cls.className,
        classCode: cls.classCode,
        grade: cls.grade,
        total: clsStudents.length,
        excellent,
        good,
        average,
        weak
      };

      // Aggregate by grade
      if (!stats.byGrade[cls.grade]) {
        stats.byGrade[cls.grade] = {
          grade: cls.grade,
          total: 0,
          excellent: 0,
          good: 0,
          average: 0,
          weak: 0
        };
      }
      stats.byGrade[cls.grade].total += clsStudents.length;
      stats.byGrade[cls.grade].excellent += excellent;
      stats.byGrade[cls.grade].good += good;
      stats.byGrade[cls.grade].average += average;
      stats.byGrade[cls.grade].weak += weak;
    });

    // Calculate overall
    const excellent = yearRecords.filter(yr => yr.academicLevel === 'Giỏi').length;
    const good = yearRecords.filter(yr => yr.academicLevel === 'Khá').length;
    const average = yearRecords.filter(yr => yr.academicLevel === 'Trung bình').length;
    const weak = yearRecords.filter(yr => yr.academicLevel === 'Yếu').length;

    stats.overall = {
      excellent,
      good,
      average,
      weak,
      total: students.length
    };

    res.json({
      success: true,
      data: stats,
      filters: { schoolYear, semester, classId, grade }
    });
  } catch (err) {
    console.error('[GradeController::getStatistics]', err);
    res.status(500).json({ success: false, message: 'Không thể lấy thống kê', error: err.message });
  }
};

// GET /grades/admin/audit-log - Lịch sử nhập/sửa điểm
exports.getAuditLog = async (req, res) => {
  try {
    const { studentId, subjectId, classId, schoolYear, semester, limit = 100 } = req.query;

    let query = {};
    if (studentId) query.studentId = studentId;
    if (subjectId) query.subjectId = subjectId;
    if (classId) query.classId = classId;
    if (schoolYear) query.schoolYear = schoolYear;
    if (semester) query.semester = semester;

    const gradeItems = await GradeItem.find(query)
      .populate('studentId', 'name studentCode')
      .populate('subjectId', 'name code')
      .populate('classId', 'className')
      .populate('teacherId', 'name teacherCode')
      .sort({ updatedAt: -1 })
      .limit(Number(limit))
      .lean();

    const auditLog = gradeItems.map(item => ({
      _id: item._id,
      student: item.studentId ? {
        _id: item.studentId._id,
        name: item.studentId.name,
        studentCode: item.studentId.studentCode
      } : null,
      subject: item.subjectId ? {
        _id: item.subjectId._id,
        name: item.subjectId.name,
        code: item.subjectId.code
      } : null,
      class: item.classId ? {
        _id: item.classId._id,
        className: item.classId.className
      } : null,
      component: item.component,
      score: item.score,
      teacher: item.teacherId ? {
        _id: item.teacherId._id,
        name: item.teacherId.name,
        teacherCode: item.teacherId.teacherCode
      } : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      schoolYear: item.schoolYear,
      semester: item.semester
    }));

    res.json({
      success: true,
      count: auditLog.length,
      data: auditLog
    });
  } catch (err) {
    console.error('[GradeController::getAuditLog]', err);
    res.status(500).json({ success: false, message: 'Không thể lấy lịch sử', error: err.message });
  }
};

// PUT /grades/admin/item/:id - Admin cập nhật điểm
exports.updateGradeItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { score, notes } = req.body;

    if (score === undefined && !notes) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin cập nhật' });
    }

    const updateData = {};
    if (score !== undefined) {
      if (score < 0 || score > 10) {
        return res.status(400).json({ success: false, message: 'Điểm phải từ 0 đến 10' });
      }
      updateData.score = score;
    }
    if (notes !== undefined) updateData.notes = notes;
    updateData.teacherId = req.user.accountId; // Track who updated

    const updatedItem = await GradeItem.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    )
      .populate('studentId', 'name studentCode')
      .populate('subjectId', 'name')
      .populate('teacherId', 'name');

    if (!updatedItem) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy điểm cần cập nhật' });
    }

    // Recompute summary
    await recomputeSummary({
      studentId: updatedItem.studentId,
      subjectId: updatedItem.subjectId,
      schoolYear: updatedItem.schoolYear,
      semester: updatedItem.semester
    });

    res.json({
      success: true,
      message: 'Đã cập nhật điểm thành công',
      data: updatedItem
    });
  } catch (err) {
    console.error('[GradeController::updateGradeItem]', err);
    res.status(500).json({ success: false, message: 'Không thể cập nhật điểm', error: err.message });
  }
};

// DELETE /grades/admin/item/:id - Admin xóa điểm
exports.deleteGradeItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await GradeItem.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy điểm cần xóa' });
    }

    const { studentId, subjectId, schoolYear, semester } = item;

    await GradeItem.findByIdAndDelete(id);

    // Recompute summary
    await recomputeSummary({
      studentId,
      subjectId,
      schoolYear,
      semester
    });

    res.json({
      success: true,
      message: 'Đã xóa điểm thành công'
    });
  } catch (err) {
    console.error('[GradeController::deleteGradeItem]', err);
    res.status(500).json({ success: false, message: 'Không thể xóa điểm', error: err.message });
  }
};

/**
 * GET /grades/homeroom/all - GVCN xem tất cả điểm của lớp chủ nhiệm (tất cả môn)
 * Query: classId, schoolYear, semester
 */
exports.getHomeroomClassAllGrades = async (req, res) => {
  try {
    const { classId, schoolYear, semester } = req.query;
    const { role, accountId } = req.user;

    if (!classId || !schoolYear || !semester) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu tham số classId/schoolYear/semester' 
      });
    }

    // Kiểm tra quyền truy cập (đã được kiểm tra bởi middleware)
    const permissionContext = req.permissionContext || {};
    const isHomeroom = permissionContext.isHomeroom || false;
    const homeroomClassIds = permissionContext.homeroomClassIds || [];

    if (role === 'teacher' && isHomeroom) {
      if (!homeroomClassIds.includes(String(classId))) {
        return res.status(403).json({ 
          success: false, 
          message: 'Không phải lớp chủ nhiệm của bạn' 
        });
      }
    } else if (role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Không có quyền truy cập' 
      });
    }

    // ✅ Lấy thông tin lớp để lấy năm học
    const classInfo = await Class.findById(classId).select('year').lean();
    if (!classInfo) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học' });
    }
    
    // ✅ Lấy tất cả học sinh trong lớp - CHỈ lấy học sinh của niên khóa tương ứng
    const students = await Student.find({ 
      classId, 
      status: 'active',
      currentYear: classInfo.year // ✅ CHỈ lấy học sinh có currentYear trùng với năm học của lớp
    })
      .populate({
        path: 'classId',
        select: 'className classCode grade year',
        match: { year: classInfo.year } // ✅ Đảm bảo lớp thuộc năm học đúng
      })
      .lean();
    
    // ✅ Lọc lại để chỉ lấy học sinh có classId hợp lệ và đúng năm học
    const validStudents = students.filter(s => {
      if (!s.classId) return false;
      return String(s.classId.year || classInfo.year) === String(classInfo.year);
    });

    if (validStudents.length === 0) {
      return res.json({ 
        success: true, 
        count: 0, 
        data: [],
        message: 'Lớp không có học sinh nào' 
      });
    }

    const studentIds = validStudents.map(s => s._id);

    // Lấy tất cả điểm của học sinh trong lớp (tất cả môn)
    const gradeSummaries = await GradeSummary.find({
      studentId: { $in: studentIds },
      schoolYear,
      semester
    })
      .populate('subjectId', 'name code includeInAverage')
      .populate('classId', 'className classCode grade')
      .lean();

    // Lấy hạnh kiểm và học lực
    const yearRecords = await StudentYearRecord.find({
      studentId: { $in: studentIds },
      year: schoolYear,
      semester: semester === '1' ? 'HK1' : semester === '2' ? 'HK2' : semester
    })
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className grade')
      .lean();

    // Nhóm điểm theo học sinh
    const studentMap = new Map();
    validStudents.forEach(student => {
      studentMap.set(String(student._id), {
        _id: student._id,
        name: student.name,
        studentCode: student.studentCode,
        class: student.classId ? {
          _id: student.classId._id,
          className: student.classId.className,
          classCode: student.classId.classCode,
          grade: student.classId.grade
        } : null,
        subjects: [],
        conduct: null,
        academicLevel: null,
        gpa: null
      });
    });

    // Thêm điểm từng môn vào học sinh
    gradeSummaries.forEach(summary => {
      const studentId = String(summary.studentId);
      if (!studentMap.has(studentId)) return;

      const student = studentMap.get(studentId);
      student.subjects.push({
        _id: summary._id,
        subject: {
          _id: summary.subjectId._id,
          name: summary.subjectId.name,
          code: summary.subjectId.code,
          includeInAverage: summary.subjectId.includeInAverage
        },
        averages: summary.averages || {},
        average: summary.average,
        result: summary.result,
        semester: summary.semester,
        schoolYear: summary.schoolYear
      });
    });

    // Thêm hạnh kiểm và học lực
    yearRecords.forEach(record => {
      const studentId = String(record.studentId);
      if (!studentMap.has(studentId)) return;

      const student = studentMap.get(studentId);
      student.conduct = record.conduct;
      student.academicLevel = record.academicLevel;
      student.gpa = record.gpa;
    });

    // Tính điểm trung bình học kỳ cho từng học sinh
    const result = Array.from(studentMap.values()).map(student => {
      if (student.subjects && student.subjects.length > 0) {
        const validAverages = student.subjects
          .filter(s => s.average !== null && s.average !== undefined)
          .map(s => s.average);
        if (validAverages.length > 0) {
          student.semesterAverage = validAverages.reduce((a, b) => a + b, 0) / validAverages.length;
        }
      }
      return student;
    });

    res.json({
      success: true,
      count: result.length,
      data: result,
      filters: { classId, schoolYear, semester }
    });
  } catch (err) {
    console.error('[GradeController::getHomeroomClassAllGrades]', err);
    res.status(500).json({ 
      success: false, 
      message: 'Không thể lấy bảng điểm lớp chủ nhiệm', 
      error: err.message 
    });
  }
};

/**
 * GET /grades/homeroom/averages - GVCN xem điểm trung bình từng môn, điểm TB học kỳ/năm của học sinh
 * Query: classId, schoolYear, studentId (optional)
 */
exports.getHomeroomClassAverages = async (req, res) => {
  try {
    const { classId, schoolYear, studentId } = req.query;
    const { role, accountId } = req.user;

    if (!classId || !schoolYear) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu tham số classId/schoolYear' 
      });
    }

    // Kiểm tra quyền truy cập
    const permissionContext = req.permissionContext || {};
    const isHomeroom = permissionContext.isHomeroom || false;
    const homeroomClassIds = permissionContext.homeroomClassIds || [];

    if (role === 'teacher' && isHomeroom) {
      if (!homeroomClassIds.includes(String(classId))) {
        return res.status(403).json({ 
          success: false, 
          message: 'Không phải lớp chủ nhiệm của bạn' 
        });
      }
    } else if (role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Không có quyền truy cập' 
      });
    }

    // Lấy học sinh trong lớp
    let studentQuery = { classId, status: 'active' };
    if (studentId) {
      studentQuery._id = studentId;
    }
    const students = await Student.find(studentQuery)
      .populate('classId', 'className classCode grade')
      .lean();

    if (students.length === 0) {
      return res.json({ 
        success: true, 
        count: 0, 
        data: [] 
      });
    }

    const studentIds = students.map(s => s._id);

    // Lấy điểm tất cả môn học của học sinh (cả 2 học kỳ)
    const gradeSummaries = await GradeSummary.find({
      studentId: { $in: studentIds },
      schoolYear
    })
      .populate('subjectId', 'name code includeInAverage')
      .lean();

    // Lấy hạnh kiểm và học lực
    const yearRecords = await StudentYearRecord.find({
      studentId: { $in: studentIds },
      year: schoolYear
    })
      .lean();

    // Nhóm điểm theo học sinh và môn học
    const result = students.map(student => {
      const studentId = String(student._id);
      
      // Lấy điểm học kỳ 1 và 2
      const hk1Summaries = gradeSummaries.filter(
        g => String(g.studentId) === studentId && g.semester === '1'
      );
      const hk2Summaries = gradeSummaries.filter(
        g => String(g.studentId) === studentId && g.semester === '2'
      );

      // Tính điểm trung bình từng môn
      const subjectAverages = {};
      const allSubjects = new Set([
        ...hk1Summaries.map(g => String(g.subjectId._id)),
        ...hk2Summaries.map(g => String(g.subjectId._id))
      ]);

      allSubjects.forEach(subjectIdStr => {
        const hk1Grade = hk1Summaries.find(
          g => String(g.subjectId._id) === subjectIdStr
        );
        const hk2Grade = hk2Summaries.find(
          g => String(g.subjectId._id) === subjectIdStr
        );

        const hk1Avg = hk1Grade?.average ?? null;
        const hk2Avg = hk2Grade?.average ?? null;
        const yearAvg = (hk1Avg !== null && hk2Avg !== null) 
          ? (hk1Avg + hk2Avg) / 2 
          : null;

        const subject = hk1Grade?.subjectId || hk2Grade?.subjectId;
        subjectAverages[subjectIdStr] = {
          subject: {
            _id: subject._id,
            name: subject.name,
            code: subject.code
          },
          hk1: hk1Avg,
          hk2: hk2Avg,
          year: yearAvg
        };
      });

      // Tính điểm trung bình học kỳ
      const hk1Averages = Object.values(subjectAverages)
        .map(s => s.hk1)
        .filter(avg => avg !== null);
      const hk2Averages = Object.values(subjectAverages)
        .map(s => s.hk2)
        .filter(avg => avg !== null);
      const yearAverages = Object.values(subjectAverages)
        .map(s => s.year)
        .filter(avg => avg !== null);

      const hk1Average = hk1Averages.length > 0
        ? hk1Averages.reduce((a, b) => a + b, 0) / hk1Averages.length
        : null;
      const hk2Average = hk2Averages.length > 0
        ? hk2Averages.reduce((a, b) => a + b, 0) / hk2Averages.length
        : null;
      const yearAverage = yearAverages.length > 0
        ? yearAverages.reduce((a, b) => a + b, 0) / yearAverages.length
        : null;

      // Lấy hạnh kiểm và học lực
      const hk1Record = yearRecords.find(
        r => String(r.studentId) === studentId && r.semester === 'HK1'
      );
      const hk2Record = yearRecords.find(
        r => String(r.studentId) === studentId && r.semester === 'HK2'
      );
      const yearRecord = yearRecords.find(
        r => String(r.studentId) === studentId && r.semester === 'CN'
      );

      return {
        _id: student._id,
        name: student.name,
        studentCode: student.studentCode,
        class: student.classId ? {
          _id: student.classId._id,
          className: student.classId.className,
          classCode: student.classId.classCode,
          grade: student.classId.grade
        } : null,
        subjectAverages: Object.values(subjectAverages),
        averages: {
          hk1: hk1Average,
          hk2: hk2Average,
          year: yearAverage
        },
        conduct: {
          hk1: hk1Record?.conduct || null,
          hk2: hk2Record?.conduct || null,
          year: yearRecord?.conduct || null
        },
        academicLevel: {
          hk1: hk1Record?.academicLevel || null,
          hk2: hk2Record?.academicLevel || null,
          year: yearRecord?.academicLevel || null
        },
        gpa: {
          hk1: hk1Record?.gpa || null,
          hk2: hk2Record?.gpa || null,
          year: yearRecord?.gpa || null
        }
      };
    });

    res.json({
      success: true,
      count: result.length,
      data: result,
      filters: { classId, schoolYear, studentId }
    });
  } catch (err) {
    console.error('[GradeController::getHomeroomClassAverages]', err);
    res.status(500).json({ 
      success: false, 
      message: 'Không thể lấy điểm trung bình', 
      error: err.message 
    });
  }
};

/**
 * GET /grades/homeroom/classification - GVCN xem hạnh kiểm và kết quả xếp loại học tập của lớp
 * Query: classId, schoolYear, semester
 */
exports.getHomeroomClassClassification = async (req, res) => {
  try {
    const { classId, schoolYear, semester } = req.query;
    const { role, accountId } = req.user;

    if (!classId || !schoolYear) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu tham số classId/schoolYear' 
      });
    }

    // Kiểm tra quyền truy cập
    const permissionContext = req.permissionContext || {};
    const isHomeroom = permissionContext.isHomeroom || false;
    const homeroomClassIds = permissionContext.homeroomClassIds || [];

    if (role === 'teacher' && isHomeroom) {
      if (!homeroomClassIds.includes(String(classId))) {
        return res.status(403).json({ 
          success: false, 
          message: 'Không phải lớp chủ nhiệm của bạn' 
        });
      }
    } else if (role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Không có quyền truy cập' 
      });
    }

    // Lấy tất cả học sinh trong lớp
    const students = await Student.find({ classId, status: 'active' })
      .populate('classId', 'className classCode grade')
      .lean();

    if (students.length === 0) {
      return res.json({ 
        success: true, 
        count: 0, 
        data: [],
        statistics: {
          conduct: { Tốt: 0, Khá: 0, 'Trung bình': 0, Yếu: 0 },
          academicLevel: { Giỏi: 0, Khá: 0, 'Trung bình': 0, Yếu: 0 }
        }
      });
    }

    const studentIds = students.map(s => s._id);

    // Lấy hạnh kiểm và học lực
    let yearRecordQuery = { studentId: { $in: studentIds }, year: schoolYear };
    if (semester) {
      if (semester === '1') yearRecordQuery.semester = 'HK1';
      else if (semester === '2') yearRecordQuery.semester = 'HK2';
      else if (semester === 'CN') yearRecordQuery.semester = 'CN';
    }
    const yearRecords = await StudentYearRecord.find(yearRecordQuery)
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className grade')
      .populate('homeroomTeacherId', 'name teacherCode')
      .lean();

    // Lấy điểm trung bình để tính học lực nếu chưa có
    const gradeSummaries = await GradeSummary.find({
      studentId: { $in: studentIds },
      schoolYear
    })
      .populate('subjectId', 'name code includeInAverage')
      .lean();

    // Tính điểm trung bình và học lực cho từng học sinh
    const result = validStudents2.map(student => {
      const studentId = String(student._id);
      
      // Tìm record tương ứng
      let record = null;
      if (semester) {
        record = yearRecords.find(r => String(r.studentId) === studentId);
      } else {
        // Nếu không có semester, lấy record cả năm
        record = yearRecords.find(
          r => String(r.studentId) === studentId && r.semester === 'CN'
        );
      }

      // Tính điểm trung bình nếu chưa có
      let gpa = record?.gpa || null;
      if (!gpa && !semester) {
        // Tính điểm TB cả năm
        const hk1Summaries = gradeSummaries.filter(
          g => String(g.studentId) === studentId && g.semester === '1'
        );
        const hk2Summaries = gradeSummaries.filter(
          g => String(g.studentId) === studentId && g.semester === '2'
        );

        const allYearAverages = [];
        const allSubjects = new Set([
          ...hk1Summaries.map(g => String(g.subjectId._id)),
          ...hk2Summaries.map(g => String(g.subjectId._id))
        ]);

        allSubjects.forEach(subjectIdStr => {
          const hk1Grade = hk1Summaries.find(
            g => String(g.subjectId._id) === subjectIdStr
          );
          const hk2Grade = hk2Summaries.find(
            g => String(g.subjectId._id) === subjectIdStr
          );

          const hk1Avg = hk1Grade?.average ?? null;
          const hk2Avg = hk2Grade?.average ?? null;
          if (hk1Avg !== null && hk2Avg !== null) {
            allYearAverages.push((hk1Avg + hk2Avg) / 2);
          }
        });

        if (allYearAverages.length > 0) {
          gpa = allYearAverages.reduce((a, b) => a + b, 0) / allYearAverages.length;
        }
      }

      return {
        _id: student._id,
        name: student.name,
        studentCode: student.studentCode,
        class: student.classId ? {
          _id: student.classId._id,
          className: student.classId.className,
          classCode: student.classId.classCode,
          grade: student.classId.grade
        } : null,
        conduct: record?.conduct || null,
        academicLevel: record?.academicLevel || null,
        gpa: gpa,
        rank: record?.rank || null,
        semester: record?.semester || semester || null,
        year: schoolYear
      };
    });

    // Thống kê
    const statistics = {
      conduct: { Tốt: 0, Khá: 0, 'Trung bình': 0, Yếu: 0 },
      academicLevel: { Giỏi: 0, Khá: 0, 'Trung bình': 0, Yếu: 0 }
    };

    result.forEach(student => {
      if (student.conduct) {
        statistics.conduct[student.conduct] = (statistics.conduct[student.conduct] || 0) + 1;
      }
      if (student.academicLevel) {
        statistics.academicLevel[student.academicLevel] = 
          (statistics.academicLevel[student.academicLevel] || 0) + 1;
      }
    });

    res.json({
      success: true,
      count: result.length,
      data: result,
      statistics,
      filters: { classId, schoolYear, semester }
    });
  } catch (err) {
    console.error('[GradeController::getHomeroomClassClassification]', err);
    res.status(500).json({ 
      success: false, 
      message: 'Không thể lấy kết quả xếp loại', 
      error: err.message 
    });
  }
};