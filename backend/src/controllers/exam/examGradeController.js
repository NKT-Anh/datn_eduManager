const { ExamGrade, ExamStudent } = require("../../models/exam/examIndex");
const Exam = require("../../models/exam/exam");
const Subject = require("../../models/subject/subject");
const GradeItem = require("../../models/grade/gradeItem");
const mongoose = require("mongoose");
const xlsx = require("xlsx");

const SYNCABLE_EXAM_TYPES = ["midterm", "final"];

const isSyncableExamType = (examData) => {
  if (!examData) return false;
  return SYNCABLE_EXAM_TYPES.includes(String(examData.type || "").toLowerCase());
};

const shouldAutoSyncExam = (examData) => {
  return Boolean(isSyncableExamType(examData) && examData.gradesPublished);
};

const buildGradeItemPayload = ({
  studentId,
  subjectId,
  classId,
  gradeValue,
  teacherId,
  note,
  examData,
}) => {
  if (!studentId || !subjectId || gradeValue == null || !isSyncableExamType(examData)) {
    return null;
  }

  return {
    filter: {
      studentId,
      subjectId,
      schoolYear: examData.year,
      semester: examData.semester,
      component: examData.type,
    },
    update: {
      score: gradeValue,
      teacherId: teacherId || null,
      classId: classId || null,
      date: new Date(),
      notes: note || `Điểm từ kỳ thi: ${examData.name || examData._id}`,
    },
  };
};

const canPublishGrades = (user) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "teacher") {
    const flags = user.teacherFlags || {};
    if (flags.isLeader || flags.isDepartmentHead) {
      return true;
    }
  }
  return false;
};

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
    const examData = await Exam.findById(exam)
      .select("year semester type name gradesPublished")
      .lean();
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

    // ✅ Đảm bảo examStudent là ObjectId
    const examStudentId = mongoose.Types.ObjectId.isValid(examStudent) 
      ? new mongoose.Types.ObjectId(examStudent)
      : examStudent;

    // ✅ Đảm bảo subject là ObjectId
    const subjectId = mongoose.Types.ObjectId.isValid(subject)
      ? new mongoose.Types.ObjectId(subject)
      : subject;

    // ✅ Model ExamGrade dùng field "student" (ref ExamStudent), không phải "examStudent"
    const grade = await ExamGrade.findOneAndUpdate(
      { exam, student: examStudentId, subject: subjectId },
      {
        examSchedule,
        gradeValue,
        teacher,
        note,
        class: es.class?._id || es.class || null,
        grade: es.grade || null,
        room: es.room || null,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    )
      .populate({
        path: "student", // ✅ Field "student" trong ExamGrade là ref đến ExamStudent
        populate: {
          path: "student", // ✅ Field "student" trong ExamStudent là ref đến Student
          select: "name studentCode gender",
          populate: {
            path: "classId",
            select: "className classCode grade year"
          }
        }
      })
      .populate("subject", "name subjectCode")
      .populate("teacher", "name teacherCode");

    // ✅ KHÔNG đồng bộ điểm vào GradeItem khi lưu điểm
    // Điểm chỉ được đồng bộ khi BGH/QLBM công bố qua publishExamGrades
    // Điều này đảm bảo điểm thi chỉ được đồng bộ vào bảng điểm học sinh sau khi được xác nhận công bố

    res.json({ message: "✅ Đã lưu điểm thành công.", grade });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📄 LẤY DANH SÁCH ĐIỂM THEO KỲ THI
   ✅ Logic hiển thị điểm:
   - Nếu điểm đã công bố (gradesPublished = true): tất cả có quyền xem đều xem được
   - Nếu điểm chưa công bố (gradesPublished = false):
     * Admin/BGH: xem tất cả
     * QLBM: chỉ xem điểm của môn mình quản lý (subject.departmentId = teacher.departmentId)
     * Giáo viên: không xem được
========================================================= */
exports.getGradesByExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const { subjectId, classId, teacherId, page = 1, limit = 50 } = req.query;
    const { role, accountId } = req.user || {};

    // ✅ Kiểm tra exam tồn tại và có year
    const exam = await Exam.findById(examId).select("year gradesPublished").lean();
    if (!exam) {
      return res.status(404).json({ error: "Không tìm thấy kỳ thi." });
    }
    if (!exam.year) {
      return res.status(400).json({ error: "Kỳ thi chưa có năm học." });
    }

    const filter = { exam: examId };
    if (subjectId) filter.subject = subjectId;
    if (teacherId) filter.teacher = teacherId;

    // ✅ Kiểm tra quyền xem điểm chưa công bố
    const isAdmin = role === 'admin';
    const isBGH = role === 'teacher' && req.user?.teacherFlags?.isLeader;
    const isQLBM = role === 'teacher' && req.user?.teacherFlags?.isDepartmentHead;
    const isRegularTeacher = role === 'teacher' && !isBGH && !isQLBM;

    // ✅ Logic mới: Admin/BGH vẫn thấy danh sách học sinh (tên, lớp, môn) ngay cả khi điểm chưa công bố
    // Chỉ ẩn giá trị điểm nếu chưa có điểm
    const ExamStudent = require("../../models/exam/examStudent");
    let departmentSubjectIds = null;

    // ✅ Logic mới: 
    // - Giáo viên bộ môn có thể xem và nhập điểm của môn mình dạy ngay cả khi chưa công bố
    // - Học sinh có thể xem điểm của mình ngay cả khi chưa công bố (để phúc khảo)
    // - Chỉ khi công bố thì điểm mới được đồng bộ vào bảng điểm học sinh
    if (!exam.gradesPublished && !isAdmin && !isBGH) {
      if (isRegularTeacher) {
        // ✅ Giáo viên bộ môn vẫn có thể xem và nhập điểm của môn mình dạy
        // Logic này sẽ được xử lý ở phần sau khi lấy danh sách điểm
        // Không chặn ở đây, để giáo viên có thể nhập điểm
      }

      // QLBM: chỉ xem điểm của môn mình quản lý
      if (isQLBM) {
        const Teacher = require("../../models/user/teacher");
        const Department = require("../../models/subject/department");
        
        const teacher = await Teacher.findOne({ accountId }).select("departmentId").lean();
        if (!teacher || !teacher.departmentId) {
          return res.json({
            total: 0,
            totalPages: 0,
            page: parseInt(page),
            data: [],
            examYear: exam.year,
            message: "Bạn không quản lý tổ bộ môn nào.",
          });
        }

        const department = await Department.findById(teacher.departmentId)
          .select("subjectIds")
          .lean();
        
        if (!department || !department.subjectIds || department.subjectIds.length === 0) {
          return res.json({
            total: 0,
            totalPages: 0,
            page: parseInt(page),
            data: [],
            examYear: exam.year,
            message: "Tổ bộ môn của bạn chưa có môn học nào.",
          });
        }

        departmentSubjectIds = department.subjectIds;
        
        if (subjectId && !departmentSubjectIds.some(id => String(id) === String(subjectId))) {
          return res.json({
            total: 0,
            totalPages: 0,
            page: parseInt(page),
            data: [],
            examYear: exam.year,
            message: "Bạn chỉ có thể xem điểm của các môn học thuộc tổ bộ môn mình quản lý.",
          });
        }
      }
    }

    // ✅ Admin/BGH: Lấy tất cả ExamStudent, sau đó left join với ExamGrade
    // ✅ QLBM: Lấy ExamStudent của môn mình quản lý, sau đó left join với ExamGrade
    // ✅ Giáo viên thường: Chỉ lấy ExamGrade khi điểm đã công bố
    if ((isAdmin || isBGH) || (isQLBM && !exam.gradesPublished)) {
      const ExamStudent = require("../../models/exam/examStudent");
      const ExamSchedule = require("../../models/exam/examSchedule");
      
      // Lấy tất cả ExamStudent
      let examStudentFilter = { exam: examId };
      let examStudents = await ExamStudent.find(examStudentFilter)
        .populate({
          path: "student",
          select: "name studentCode gender",
          populate: {
            path: "classId",
            select: "className classCode grade year"
          }
        })
        .populate("class", "className classCode grade year")
        .populate("subjects.subject", "name code")
        .lean();

      // Lọc theo classId nếu có
      if (classId) {
        examStudents = examStudents.filter(es => {
          const studentClassId = es.student?.classId?._id || es.student?.classId;
          return String(studentClassId) === String(classId);
        });
      }

      // Lấy tất cả ExamSchedule để biết môn nào thi
      const allSchedules = await ExamSchedule.find({ exam: examId })
        .populate("subject", "name subjectCode")
        .lean();

      // Lấy điểm đã có
      let gradeFilter = { exam: examId };
      if (subjectId) gradeFilter.subject = subjectId;
      if (departmentSubjectIds) gradeFilter.subject = { $in: departmentSubjectIds };

      const grades = await ExamGrade.find(gradeFilter)
        .populate("subject", "name subjectCode departmentId")
        .populate("teacher", "name teacherCode")
        .lean();

      // Tạo map điểm theo student (ExamStudent) và subject
      const gradeMap = new Map();
      grades.forEach(g => {
        const esId = String(g.student?._id || g.student); // ✅ Field "student" trong ExamGrade là ref đến ExamStudent
        const subjId = String(g.subject?._id || g.subject);
        gradeMap.set(`${esId}_${subjId}`, g);
      });

      // ✅ Đảm bảo lấy tất cả môn thi từ ExamSchedule (nếu ExamStudent không có subjects)
      // Lấy danh sách môn thi từ ExamSchedule (tất cả môn của kỳ thi)
      const allExamSubjects = allSchedules
        .map(s => s.subject)
        .filter(s => s && s._id)
        .reduce((acc, subj) => {
          const subjId = String(subj._id);
          if (!acc.find(s => String(s._id) === subjId)) {
            acc.push(subj);
          }
          return acc;
        }, []);

      // Kết hợp ExamStudent với ExamGrade
      const result = [];
      examStudents.forEach(es => {
        // ✅ Luôn lấy tất cả môn thi từ ExamSchedule để đảm bảo hiển thị đầy đủ
        // Nếu ExamStudent có subjects riêng, vẫn dùng, nhưng fallback về allExamSubjects
        let studentSubjects = [];
        if (es.subjects && es.subjects.length > 0) {
          // Dùng subjects từ ExamStudent nếu có
          studentSubjects = es.subjects.map(s => s.subject).filter(s => s && s._id);
        }
        
        // ✅ Nếu không có subjects từ ExamStudent hoặc rỗng, dùng tất cả môn từ ExamSchedule
        if (studentSubjects.length === 0) {
          studentSubjects = [...allExamSubjects];
        }

        // Lọc theo subjectId nếu có
        if (subjectId) {
          studentSubjects = studentSubjects.filter(s => String(s._id || s) === String(subjectId));
        }

        // Lọc theo departmentSubjectIds nếu là QLBM
        if (isQLBM && departmentSubjectIds) {
          studentSubjects = studentSubjects.filter(s => 
            departmentSubjectIds.some(dsId => String(s._id || s) === String(dsId))
          );
        }

        // ✅ Tạo record cho mỗi môn (đảm bảo tất cả học sinh dự thi đều có record cho tất cả môn)
        studentSubjects.forEach(subj => {
          const subjId = String(subj._id || subj);
          const grade = gradeMap.get(`${es._id}_${subjId}`);
          const schedule = allSchedules.find(s => String(s.subject?._id || s.subject) === subjId);
          
          // ✅ Flatten cấu trúc để frontend dễ sử dụng
          const studentInfo = es.student || {};
          const classInfo = studentInfo.classId || es.class || {};
          
          result.push({
            _id: grade?._id || `temp_${es._id}_${subjId}`,
            exam: examId,
            examStudent: es, // ✅ Giữ lại để frontend dùng
            student: {
              _id: studentInfo._id,
              name: studentInfo.name || "",
              studentCode: studentInfo.studentCode || "",
              className: classInfo.className || classInfo.name || "",
              classCode: classInfo.classCode || "",
              grade: classInfo.grade || es.grade || "",
              classId: classInfo._id || classInfo
            },
            subject: {
              _id: subj._id || subj,
              name: subj.name || "",
              subjectCode: subj.subjectCode || subj.code || ""
            },
            gradeValue: grade?.gradeValue || null, // ✅ Ẩn điểm nếu chưa có
            teacher: grade?.teacher || null,
            examSchedule: schedule || null,
            class: classInfo
          });
        });
      });

      // Sắp xếp và phân trang
      result.sort((a, b) => {
        const nameA = a.student?.name || a.student?.student?.name || "";
        const nameB = b.student?.name || b.student?.student?.name || "";
        return nameA.localeCompare(nameB);
      });

      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const data = result.slice(startIndex, endIndex);

      return res.json({
        total: result.length,
        totalPages: Math.ceil(result.length / limit),
        page: parseInt(page),
        data,
        examYear: exam.year,
        gradesPublished: exam.gradesPublished,
      });
    }

    // ✅ Giáo viên thường: Chỉ lấy ExamGrade khi điểm đã công bố
    const gradesData = await ExamGrade.find(filter)
      .populate("exam", "name year semester gradesPublished")
      .populate({
        path: "student", // ✅ Field "student" trong ExamGrade là ref đến ExamStudent
        populate: {
          path: "student", // ✅ Field "student" trong ExamStudent là ref đến Student
          select: "name studentCode gender",
          populate: {
            path: "classId",
            select: "className classCode grade year"
          },
          match: classId ? { classId: new mongoose.Types.ObjectId(classId) } : {},
        },
      })
      .populate("subject", "name subjectCode departmentId")
      .populate("teacher", "name teacherCode")
      .populate("examSchedule", "subject date startTime")
      .sort({ "student.student.name": 1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    // ✅ Flatten cấu trúc để nhất quán với Admin/BGH
    const data = gradesData.map(g => {
      const studentInfo = g.student?.student || {};
      const classInfo = studentInfo.classId || g.class || {};
      
      return {
        ...g,
        student: {
          _id: studentInfo._id,
          name: studentInfo.name || "",
          studentCode: studentInfo.studentCode || "",
          className: classInfo.className || classInfo.name || "",
          classCode: classInfo.classCode || "",
          grade: classInfo.grade || "",
          classId: classInfo._id || classInfo
        },
        subject: {
          _id: g.subject?._id || g.subject,
          name: g.subject?.name || "",
          subjectCode: g.subject?.subjectCode || ""
        }
      };
    });

    const total = await ExamGrade.countDocuments(filter);

    res.json({
      total,
      totalPages: Math.ceil(total / limit),
      page: parseInt(page),
      data,
      examYear: exam.year, // ✅ Trả về năm học
      gradesPublished: exam.gradesPublished, // ✅ Trả về trạng thái công bố
    });
  } catch (err) {
    console.error("❌ Lỗi getGradesByExam:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🔍 LẤY CHI TIẾT MỘT BẢN GHI ĐIỂM
   ✅ Áp dụng logic quyền tương tự getGradesByExam
========================================================= */
exports.getGradeById = async (req, res) => {
  try {
    const { role, accountId } = req.user || {};
    const isAdmin = role === 'admin';
    const isBGH = role === 'teacher' && req.user?.teacherFlags?.isLeader;
    const isQLBM = role === 'teacher' && req.user?.teacherFlags?.isDepartmentHead;
    const isRegularTeacher = role === 'teacher' && !isBGH && !isQLBM;

    const grade = await ExamGrade.findById(req.params.id)
      .populate("exam", "name year semester gradesPublished")
      .populate("subject", "name subjectCode departmentId")
      .lean();
    
    if (!grade) {
      return res.status(404).json({ error: "Không tìm thấy bản ghi điểm." });
    }

    // ✅ Kiểm tra quyền xem điểm chưa công bố
    const exam = grade.exam;
    if (!exam.gradesPublished && !isAdmin && !isBGH) {
      if (isRegularTeacher) {
        return res.status(403).json({ 
          error: "Điểm thi chưa được công bố. Vui lòng đợi Trưởng bộ môn hoặc Ban giám hiệu công bố." 
        });
      }

      // QLBM: chỉ xem điểm của môn mình quản lý
      if (isQLBM) {
        const Teacher = require("../../models/user/teacher");
        const Department = require("../../models/subject/department");
        
        const teacher = await Teacher.findOne({ accountId }).select("departmentId").lean();
        if (!teacher || !teacher.departmentId) {
          return res.status(403).json({ error: "Bạn không quản lý tổ bộ môn nào." });
        }

        const department = await Department.findById(teacher.departmentId)
          .select("subjectIds")
          .lean();
        
        if (!department || !department.subjectIds || department.subjectIds.length === 0) {
          return res.status(403).json({ error: "Tổ bộ môn của bạn chưa có môn học nào." });
        }

        const subjectId = grade.subject?._id || grade.subject;
        if (!department.subjectIds.some(id => String(id) === String(subjectId))) {
          return res.status(403).json({ 
            error: "Bạn chỉ có thể xem điểm của các môn học thuộc tổ bộ môn mình quản lý." 
          });
        }
      }
    }

    const fullGrade = await ExamGrade.findById(req.params.id)
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
        path: "student", // ✅ Field "student" trong ExamGrade là ref đến ExamStudent
        populate: [
          { path: "student", select: "_id classId" }, // ✅ Field "student" trong ExamStudent là ref đến Student
          { path: "class", select: "_id" },
        ],
      })
      .lean();
    
    if (!currentGrade) {
      return res.status(404).json({ error: "Không tìm thấy bản ghi điểm để cập nhật." });
    }

    const updated = await ExamGrade.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: "Không tìm thấy bản ghi điểm để cập nhật." });

    // ✅ Đồng bộ điểm vào GradeItem nếu kỳ thi cho phép và đã công bố
    if (req.body.gradeValue != null) {
      try {
        const examData = await Exam.findById(currentGrade.exam)
          .select("year semester type name gradesPublished")
          .lean();
        if (examData && shouldAutoSyncExam(examData)) {
          const es = currentGrade.student; // ✅ Field "student" trong ExamGrade là ExamStudent
          const studentId = es?.student?._id || es?.student;
          const subjectId = currentGrade.subject?._id || currentGrade.subject;
          const classId = es?.class?._id || es?.class || currentGrade.class || null;
          const payload = buildGradeItemPayload({
            studentId,
            subjectId,
            classId,
            gradeValue: req.body.gradeValue,
            teacherId: req.body.teacher || currentGrade.teacher,
            note: req.body.note || currentGrade.note,
            examData,
          });

          if (payload) {
            await GradeItem.findOneAndUpdate(payload.filter, payload.update, {
              upsert: true,
              new: true,
            });
            console.log(
              `✅ Đã đồng bộ điểm ${examData.type} cho học sinh ${studentId} môn ${subjectId} (${examData.year} - HK${examData.semester}): ${req.body.gradeValue}`
            );
            
            // ✅ Tính lại điểm TB học kỳ cho môn học này
            try {
              const { recomputeSummary } = require('../../services/gradeService');
              await recomputeSummary({
                studentId,
                subjectId,
                classId,
                schoolYear: examData.year,
                semester: examData.semester,
              });
              console.log(`✅ Đã tính lại điểm TB cho học sinh ${studentId} môn ${subjectId}`);
            } catch (recomputeError) {
              console.error(`⚠️ Lỗi tính lại điểm TB cho học sinh ${studentId} môn ${subjectId}:`, recomputeError.message);
            }
            
            // ✅ Tính lại điểm TB cả năm
            try {
              const { computeAndSaveYearGPA } = require('../../services/gradeService');
              await computeAndSaveYearGPA({
                studentId,
                classId,
                schoolYear: examData.year,
              });
              console.log(`✅ Đã tính lại điểm TB cả năm cho học sinh ${studentId}`);
            } catch (yearGPAError) {
              console.error(`⚠️ Lỗi tính điểm TB cả năm cho học sinh ${studentId}:`, yearGPAError.message);
            }
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

    // ✅ Lấy thông tin exam để kiểm tra type & trạng thái công bố
    const examData = await Exam.findById(examId)
      .select("year semester type name gradesPublished")
      .lean();
    if (!examData) {
      return res.status(404).json({ error: "Không tìm thấy kỳ thi." });
    }
    const shouldSyncGrades = shouldAutoSyncExam(examData);

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
          filter: { exam: examId, student: examStudent._id, subject: subjectId }, // ✅ Field "student" trong ExamGrade là ref đến ExamStudent
          update: { gradeValue, teacher: teacherId },
          upsert: true,
        },
      });

      // ✅ Nếu cần đồng bộ, thêm vào danh sách
      if (shouldSyncGrades && gradeValue != null) {
        const studentId = examStudent.student?._id || examStudent.student;
        const classId = examStudent.class?._id || examStudent.class || null;
        const payload = buildGradeItemPayload({
          studentId,
          subjectId,
          classId,
          gradeValue,
          teacherId,
          note: `Điểm từ kỳ thi: ${examData.name || examId}`,
          examData,
        });
        if (payload) {
          gradeItemsToSync.push(payload);
        }
      }
    }

    if (operations.length) {
      await ExamGrade.bulkWrite(operations);
      
      // ✅ Đồng bộ điểm vào GradeItem
      if (shouldSyncGrades && gradeItemsToSync.length > 0) {
        const gradeItemOperations = gradeItemsToSync.map(item => ({
          updateOne: {
            filter: item.filter,
            update: { $set: item.update },
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
   🚀 CÔNG BỐ / ĐỒNG BỘ ĐIỂM THI VÀO BẢNG ĐIỂM CHÍNH
========================================================= */
exports.publishExamGrades = async (req, res) => {
  try {
    const { examId } = req.params;

    if (!canPublishGrades(req.user)) {
      return res.status(403).json({ error: "Bạn không có quyền công bố điểm kỳ thi này." });
    }

    const examData = await Exam.findById(examId)
      .select("name type year semester gradesPublished")
      .lean();
    if (!examData) {
      return res.status(404).json({ error: "Không tìm thấy kỳ thi." });
    }

    if (!isSyncableExamType(examData)) {
      return res.status(400).json({ error: "Chỉ kỳ thi giữa kỳ hoặc cuối kỳ mới có thể đồng bộ điểm." });
    }

    const grades = await ExamGrade.find({
      exam: examId,
      gradeValue: { $ne: null },
    })
      .populate({
        path: "student", // ✅ Field "student" trong ExamGrade là ref đến ExamStudent
        populate: [
          { path: "student", select: "_id classId" }, // ✅ Field "student" trong ExamStudent là ref đến Student
          { path: "class", select: "_id" },
        ],
      })
      .lean();

    if (!grades.length) {
      return res.status(400).json({ error: "Chưa có bản ghi điểm nào để công bố." });
    }

    const operations = [];
    for (const grade of grades) {
      const examStudent = grade.student; // ✅ Field "student" trong ExamGrade là ExamStudent
      const studentId =
        examStudent?.student?._id ||
        examStudent?.student ||
        null;
      const classId =
        examStudent?.class?._id ||
        examStudent?.class ||
        grade.class ||
        null;
      const subjectId = grade.subject?._id || grade.subject;

      const payload = buildGradeItemPayload({
        studentId,
        subjectId,
        classId,
        gradeValue: grade.gradeValue,
        teacherId: grade.teacher,
        note: grade.note || `Điểm từ kỳ thi: ${examData.name || examId}`,
        examData,
      });

      if (payload) {
        operations.push({
          updateOne: {
            filter: payload.filter,
            update: { $set: payload.update },
            upsert: true,
          },
        });
      }
    }

    if (!operations.length) {
      return res.status(400).json({ error: "Không tìm thấy bản ghi hợp lệ để đồng bộ." });
    }

    await GradeItem.bulkWrite(operations, { ordered: false });

    // ✅ Sau khi đồng bộ điểm, tính lại điểm TB học kỳ cho tất cả học sinh đã được đồng bộ
    const { recomputeSummary } = require('../../services/gradeService');
    const recomputePromises = [];
    
    // Lấy danh sách unique (studentId, subjectId, schoolYear, semester) từ operations
    const uniqueCombinations = new Set();
    for (const op of operations) {
      const filter = op.updateOne.filter;
      const key = `${filter.studentId}_${filter.subjectId}_${filter.schoolYear}_${filter.semester}`;
      if (!uniqueCombinations.has(key)) {
        uniqueCombinations.add(key);
        recomputePromises.push(
          recomputeSummary({
            studentId: filter.studentId,
            subjectId: filter.subjectId,
            schoolYear: filter.schoolYear,
            semester: filter.semester,
          }).catch(err => {
            console.error(`⚠️ Lỗi tính lại điểm TB cho học sinh ${filter.studentId} môn ${filter.subjectId}:`, err.message);
            // Không throw để không ảnh hưởng đến các học sinh khác
          })
        );
      }
    }
    
    // ✅ Tính lại điểm TB cả năm cho các học sinh đã được đồng bộ
    const { computeAndSaveYearGPA } = require('../../services/gradeService');
    const yearGPAPromises = [];
    const uniqueStudents = new Set();
    for (const grade of grades) {
      const examStudent = grade.student;
      const studentId = examStudent?.student?._id || examStudent?.student;
      const classId = examStudent?.class?._id || examStudent?.class || grade.class;
      
      if (studentId && classId && !uniqueStudents.has(String(studentId))) {
        uniqueStudents.add(String(studentId));
        yearGPAPromises.push(
          computeAndSaveYearGPA({
            studentId,
            classId,
            schoolYear: examData.year,
          }).catch(err => {
            console.error(`⚠️ Lỗi tính điểm TB cả năm cho học sinh ${studentId}:`, err.message);
            // Không throw để không ảnh hưởng đến các học sinh khác
          })
        );
      }
    }
    
    // Chờ tất cả các promise hoàn thành (không cần đợi, chạy song song)
    await Promise.allSettled([...recomputePromises, ...yearGPAPromises]);

    await Exam.findByIdAndUpdate(examId, {
      gradesPublished: true,
      gradesPublishedAt: new Date(),
      gradesPublishedBy: req.user?.accountId || null,
    });

    res.json({
      message: examData.gradesPublished
        ? "✅ Đã đồng bộ lại điểm thi với bảng điểm học sinh và tính lại điểm trung bình."
        : "✅ Đã công bố và đồng bộ điểm thi với bảng điểm học sinh. Điểm trung bình đã được tính lại tự động.",
      syncedCount: operations.length,
    });
  } catch (err) {
    console.error("❌ publishExamGrades error:", err);
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
      Mã_HS: g.student?.student?.studentCode || "", // ✅ Field "student" trong ExamGrade là ExamStudent
      Họ_tên: g.student?.student?.name || "",
      Lớp: g.student?.student?.classId?.className || g.student?.class?.className || "",
      Giới_tính: g.student?.student?.gender || "",
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

/* =========================================================
   📊 THỐNG KÊ ĐIỂM CHO TRƯỞNG BỘ MÔN (QLBM)
   - Điểm trung bình theo lớp cho môn thuộc bộ môn quản lý
   - Tỉ lệ Giỏi – Khá – TB – Yếu – Kém theo lớp
   - Kết quả theo kỳ thi (Giữa kỳ, Cuối kỳ)
   - So sánh giữa các lớp cùng môn
========================================================= */
exports.getDepartmentHeadStats = async (req, res) => {
  try {
    const { role, accountId } = req.user || {};
    const { schoolYear, semester, subjectId, examType } = req.query;

    // ✅ Chỉ QLBM mới được xem
    const isQLBM = role === 'teacher' && req.user?.teacherFlags?.isDepartmentHead;
    if (!isQLBM) {
      return res.status(403).json({ error: "Chỉ Trưởng bộ môn mới được xem thống kê này." });
    }

    // Lấy thông tin giáo viên và tổ bộ môn
    const Teacher = require("../../models/user/teacher");
    const Department = require("../../models/subject/department");
    const Class = require("../../models/class/class");
    const Student = require("../../models/user/student");
    const GradeSummary = require("../../models/grade/gradeSummary");
    const StudentYearRecord = require("../../models/grade/studentYearRecord");
    const { calculateAcademicLevel } = require("../../services/academicLevelService");

    const teacher = await Teacher.findOne({ accountId }).select("departmentId").lean();
    if (!teacher || !teacher.departmentId) {
      return res.status(403).json({ error: "Bạn không quản lý tổ bộ môn nào." });
    }

    const department = await Department.findById(teacher.departmentId)
      .select("subjectIds")
      .populate("subjectIds", "name code")
      .lean();
    
    if (!department || !department.subjectIds || department.subjectIds.length === 0) {
      return res.status(403).json({ error: "Tổ bộ môn của bạn chưa có môn học nào." });
    }

    const departmentSubjectIds = department.subjectIds.map(s => s._id);
    
    // Nếu có subjectId, kiểm tra xem có thuộc tổ bộ môn không
    let targetSubjectIds = departmentSubjectIds;
    if (subjectId) {
      if (!departmentSubjectIds.some(id => String(id) === String(subjectId))) {
        return res.status(403).json({ error: "Bạn chỉ có thể xem thống kê của các môn học thuộc tổ bộ môn mình quản lý." });
      }
      targetSubjectIds = [subjectId];
    }

    // Lấy tất cả lớp
    const classes = await Class.find({}).select("_id className classCode grade year").lean();
    const classIds = classes.map(c => c._id);

    // Lấy học sinh
    const students = await Student.find({ classId: { $in: classIds } }).lean();
    const studentIds = students.map(s => s._id);

    // Lấy điểm từ GradeSummary
    let summaryQuery = { 
      studentId: { $in: studentIds },
      subjectId: { $in: targetSubjectIds }
    };
    if (schoolYear) summaryQuery.schoolYear = schoolYear;
    if (semester) summaryQuery.semester = semester;

    const summaries = await GradeSummary.find(summaryQuery)
      .populate('subjectId', 'name code')
      .populate('classId', 'className classCode grade')
      .lean();

    // Lấy điểm từ kỳ thi (nếu có examType)
    let examStats = null;
    if (examType && (examType === 'midterm' || examType === 'final')) {
      const Exam = require("../../models/exam/exam");
      const exams = await Exam.find({
        type: examType,
        ...(schoolYear ? { year: schoolYear } : {}),
        ...(semester ? { semester } : {}),
        gradesPublished: true // Chỉ lấy điểm đã công bố
      }).select("_id name type year semester").lean();

      if (exams.length > 0) {
        const examIds = exams.map(e => e._id);
        const examGrades = await ExamGrade.find({
          exam: { $in: examIds },
          subject: { $in: targetSubjectIds },
          gradeValue: { $ne: null }
        })
          .populate({
            path: "examStudent",
            populate: {
              path: "student",
              select: "_id classId"
            }
          })
          .populate("subject", "name code")
          .lean();

        // Nhóm điểm theo lớp và môn
        examStats = {};
        classes.forEach(cls => {
          const clsStudents = students.filter(s => String(s.classId) === String(cls._id));
          const clsStudentIds = clsStudents.map(s => String(s._id));
          
          targetSubjectIds.forEach(subjId => {
            const key = `${cls._id}_${subjId}`;
            const grades = examGrades.filter(eg => {
              const studentId = eg.student?.student?._id || eg.student?.student; // ✅ Field "student" trong ExamGrade là ExamStudent
              return clsStudentIds.includes(String(studentId)) && 
                     String(eg.subject?._id || eg.subject) === String(subjId);
            }).map(eg => eg.gradeValue).filter(v => v != null);

            if (grades.length > 0) {
              const avg = grades.reduce((a, b) => a + b, 0) / grades.length;
              examStats[key] = {
                className: cls.className,
                subjectId: subjId,
                average: Number(avg.toFixed(2)),
                totalStudents: grades.length,
                max: Math.max(...grades),
                min: Math.min(...grades)
              };
            }
          });
        });
      }
    }

    // Tính thống kê theo lớp và môn
    const statsByClassAndSubject = {};
    const academicLevelCounts = {}; // { className_subjectId: { excellent, good, average, weak, poor } }

    classes.forEach(cls => {
      const clsStudents = students.filter(s => String(s.classId) === String(cls._id));
      const clsStudentIds = clsStudents.map(s => String(s._id));

      targetSubjectIds.forEach(subjId => {
        const key = `${cls._id}_${subjId}`;
        const subjectSummaries = summaries.filter(s => 
          clsStudentIds.includes(String(s.studentId)) &&
          String(s.subjectId?._id || s.subjectId) === String(subjId)
        );

        if (subjectSummaries.length > 0) {
          const averages = subjectSummaries
            .map(s => s.average)
            .filter(avg => avg != null && avg !== undefined);

          if (averages.length > 0) {
            const avg = averages.reduce((a, b) => a + b, 0) / averages.length;
            
            statsByClassAndSubject[key] = {
              className: cls.className,
              classCode: cls.classCode,
              grade: cls.grade,
              subject: {
                _id: subjId,
                name: department.subjectIds.find(s => String(s._id) === String(subjId))?.name || "N/A"
              },
              average: Number(avg.toFixed(2)),
              totalStudents: averages.length,
              max: Math.max(...averages),
              min: Math.min(...averages)
            };

            // Tính tỉ lệ học lực cho môn này
            const academicLevels = [];
            subjectSummaries.forEach(summary => {
              if (summary.average != null) {
                // Sử dụng logic đơn giản để xác định học lực theo điểm môn
                let level = 'Kém';
                if (summary.average >= 8.0) level = 'Giỏi';
                else if (summary.average >= 6.5) level = 'Khá';
                else if (summary.average >= 5.0) level = 'Trung bình';
                else if (summary.average >= 3.5) level = 'Yếu';
                academicLevels.push(level);
              }
            });

            academicLevelCounts[key] = {
              excellent: academicLevels.filter(l => l === 'Giỏi').length,
              good: academicLevels.filter(l => l === 'Khá').length,
              average: academicLevels.filter(l => l === 'Trung bình').length,
              weak: academicLevels.filter(l => l === 'Yếu').length,
              poor: academicLevels.filter(l => l === 'Kém').length,
              total: academicLevels.length
            };
          }
        }
      });
    });

    // So sánh giữa các lớp cùng môn
    const comparisonBySubject = {};
    targetSubjectIds.forEach(subjId => {
      const subjectName = department.subjectIds.find(s => String(s._id) === String(subjId))?.name || "N/A";
      const classStats = Object.entries(statsByClassAndSubject)
        .filter(([key, s]) => String(s.subject._id) === String(subjId))
        .map(([key, s]) => ({
          className: s.className,
          classCode: s.classCode,
          grade: s.grade,
          average: s.average,
          totalStudents: s.totalStudents,
          academicLevels: academicLevelCounts[key] || {}
        }))
        .sort((a, b) => b.average - a.average); // Sắp xếp theo điểm TB giảm dần

      if (classStats.length > 0) {
        comparisonBySubject[subjectName] = classStats;
      }
    });

    res.json({
      success: true,
      data: {
        department: {
          _id: department._id,
          name: department.name,
          subjects: department.subjectIds
        },
        statsByClassAndSubject: Object.values(statsByClassAndSubject),
        academicLevelCounts,
        examStats: examStats ? Object.values(examStats) : null,
        comparisonBySubject,
        filters: { schoolYear, semester, subjectId, examType }
      }
    });
  } catch (err) {
    console.error("❌ Lỗi getDepartmentHeadStats:", err);
    res.status(500).json({ error: err.message });
  }
};
