const Student = require('../../models/user/student');
const User = require('../../models/user/user');
const Parent = require('../../models/user/parent');
const Account = require('../../models/user/account');
const admin = require("firebase-admin");
const { initGradesForStudent } = require('../../services/gradeService');
const Setting = require('../../models/settings');
const Class = require('../../models/class/class');
const StudentYearRecord = require('../../models/user/studentYearRecord');
const GradeItem = require('../../models/grade/gradeItem');
const GradeSummary = require('../../models/grade/gradeSummary');
const Attendance = require('../../models/class/attendance');
const StudentTransferHistory = require('../../models/user/studentTransferHistory');
const mongoose = require('mongoose');

/* =========================================================
   📘 LẤY DANH SÁCH HỌC SINH
   ✅ Lọc theo classId, year, currentYear để đảm bảo học sinh của các niên khóa là độc lập
========================================================= */
exports.getStudents = async (req, res) => {
  try {
    const { classId, year, currentYear, status, grade } = req.query;
    
    // ✅ Xây dựng query filter
    const filter = {};
    
    // ✅ Lọc theo classId
    if (classId) {
      filter.classId = classId;
    }
    
    // ✅ Lọc theo currentYear (niên khóa) - QUAN TRỌNG: đảm bảo học sinh của các niên khóa là độc lập
    if (currentYear) {
      filter.currentYear = currentYear;
    }
    
    // ✅ Nếu có classId, cũng cần kiểm tra year của lớp để đảm bảo nhất quán
    if (classId && (year || currentYear)) {
      const Class = require('../../models/class/class');
      const classInfo = await Class.findById(classId).select('year').lean();
      if (classInfo) {
        const targetYear = year || currentYear;
        // ✅ Chỉ lấy học sinh nếu năm học của lớp khớp với filter
        if (targetYear && String(classInfo.year) !== String(targetYear)) {
          return res.json([]); // Trả về mảng rỗng nếu năm học không khớp
        }
        // ✅ Nếu không có year trong query nhưng có classId, dùng year của lớp
        if (!currentYear && classInfo.year) {
          filter.currentYear = classInfo.year;
        }
      }
    }
    
    // ✅ Lọc theo status
    if (status) {
      filter.status = status;
    } else {
      filter.status = 'active'; // Mặc định chỉ lấy học sinh active
    }
    
    // ✅ Lọc theo grade
    if (grade) {
      filter.grade = grade;
    }

    // ✅ Soft Delete: Filter isDeleted = false mặc định (bao gồm cả undefined/null cho dữ liệu cũ)
    const { isDeleted = 'false' } = req.query;
    if (isDeleted !== 'true') {
      // Lấy tất cả trừ isDeleted = true (bao gồm false, undefined, null)
      // Dùng $ne: true để lấy tất cả trừ true, bao gồm cả undefined
      filter.isDeleted = { $ne: true };
    }

    const permissionContext = req.permissionContext || null;
    const restrictToClasses = (allowedIds = []) => {
      const normalized = (allowedIds || [])
        .map((id) => (id ? String(id) : null))
        .filter(Boolean);

      if (!normalized.length) {
        return false;
      }

      if (!filter.classId) {
        filter.classId = normalized.length === 1 ? normalized[0] : { $in: normalized };
        return true;
      }

      const requested = [];
      if (typeof filter.classId === 'string') {
        requested.push(String(filter.classId));
      } else if (filter.classId && typeof filter.classId === 'object') {
        if (Array.isArray(filter.classId.$in)) {
          requested.push(...filter.classId.$in.map((id) => String(id)));
        } else if (filter.classId.$eq) {
          requested.push(String(filter.classId.$eq));
        } else {
          Object.values(filter.classId).forEach((value) => {
            if (value) {
              requested.push(String(value));
            }
          });
        }
      }

      if (!requested.length) {
        requested.push(...normalized);
      }

      const allowedSet = new Set(normalized);
      const intersection = requested.filter((id) => allowedSet.has(String(id)));

      if (!intersection.length) {
        return false;
      }

      filter.classId = intersection.length === 1 ? intersection[0] : { $in: intersection };
      return true;
    };

    if (permissionContext) {
      if (permissionContext.studentId) {
        filter._id = permissionContext.studentId;
      }

      const isAdminLike = permissionContext.role === 'admin' || permissionContext.isLeader;

      if (!isAdminLike) {
        if (permissionContext.isHomeroom) {
          const ok = restrictToClasses(permissionContext.homeroomClassIds || []);
          if (!ok) {
            return res.json([]);
          }
        } else if (Array.isArray(permissionContext.teachingClassIds) && permissionContext.teachingClassIds.length) {
          const ok = restrictToClasses(permissionContext.teachingClassIds);
          if (!ok) {
            return res.json([]);
          }
        }
      }
    }

    const students = await Student.find(filter)
      .populate({ 
        path: 'classId', 
        select: 'className classCode grade year',
        match: year ? { year } : {} // ✅ Đảm bảo lớp thuộc năm học được chỉ định
      })
      .populate({ path: 'accountId', select: 'email phone role' })
      .populate({ path: 'parentIds', select: 'name phone relation occupation' })
      .sort({ name: 1 })
      .lean();

    // ✅ Lọc lại để chỉ lấy học sinh có classId hợp lệ (nếu có filter year)
    const filteredStudents = students.filter(s => {
      if (!s.classId) return false; // Bỏ học sinh không có lớp
      if (year && s.classId.year && String(s.classId.year) !== String(year)) {
        return false; // Bỏ học sinh có lớp không thuộc năm học được chỉ định
      }
      return true;
    });

    const data = filteredStudents.map(s => {
      // ✅ Vì đã dùng .lean(), s đã là plain object, không cần .toObject()
      const obj = { ...s }; // Tạo copy của object
      obj.parents = obj.parentIds;
      delete obj.parentIds;
      return obj;
    });

    res.json(data);
  } catch (error) {
    console.error('❌ Lỗi getStudents:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/* =========================================================
   📘 LẤY CHI TIẾT HỌC SINH
========================================================= */
exports.getStudentById = async (req, res) => {
  try {
    // ✅ Admin có thể xem tất cả (bao gồm đã xóa), user thường chỉ xem chưa xóa
    const { isDeleted } = req.query;
    const query = { _id: req.params.id };

    if (isDeleted !== 'true') {
      query.isDeleted = { $ne: true }; // Lấy tất cả trừ true (false, null, undefined)
    }

    const student = await Student.findOne(query)
      .populate({ path: 'accountId', select: 'email phone role' })
      .populate({ path: 'classId', select: 'className grade' })
      .populate({ path: 'parentIds', select: 'name phone relation occupation' })
      .lean();

    if (!student) return res.status(404).json({ message: 'Student not found' });

    const permissionContext = req.permissionContext || null;
    if (permissionContext) {
      const isAdminLike = permissionContext.role === 'admin' || permissionContext.isLeader;
      if (!isAdminLike) {
        const studentIdMatches = permissionContext.studentId && String(permissionContext.studentId) === String(student._id);
        const studentClassId = student.classId ? String(student.classId._id || student.classId) : null;

        const homeroomMatch =
          permissionContext.isHomeroom &&
          studentClassId &&
          Array.isArray(permissionContext.homeroomClassIds) &&
          permissionContext.homeroomClassIds
            .map((id) => (id ? String(id) : null))
            .filter(Boolean)
            .includes(studentClassId);

        const teachingMatch =
          studentClassId &&
          Array.isArray(permissionContext.teachingClassIds) &&
          permissionContext.teachingClassIds
            .map((id) => (id ? String(id) : null))
            .filter(Boolean)
            .includes(studentClassId);

        if (!studentIdMatches && !homeroomMatch && !teachingMatch) {
          return res.status(403).json({ message: 'Không có quyền xem học sinh này.' });
        }
      }
    }

    // ✅ Vì đã dùng .lean(), student đã là plain object, không cần .toObject()
    const obj = { ...student }; // Tạo copy của object
    obj.parents = obj.parentIds;
    delete obj.parentIds;
    res.json(obj);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* =========================================================
   📘 LẤY THÔNG TIN CHI TIẾT HỌC SINH THEO NIÊN KHÓA
   - Bảng điểm chi tiết (điểm hệ số 1, 2, giữa kỳ, cuối kỳ)
   - Học lực HK1, HK2, cả năm
   - Hạnh kiểm HK1, HK2, cả năm
   - Thông tin lớp học theo năm (lớp, khối, GVCN)
   - Kết quả lên lớp
   - Thống kê chuyên cần
   - Nhận xét GVCN
   - Tổng kết và danh hiệu
========================================================= */
exports.getStudentYearDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const { year } = req.query; // Năm học: "2025-2026"

    if (!year) {
      return res.status(400).json({ message: 'Vui lòng cung cấp năm học' });
    }

    const StudentYearRecord = require('../../models/user/studentYearRecord');
    const GradeSummary = require('../../models/grade/gradeSummary');
    const GradeItem = require('../../models/grade/gradeItem');
    const Class = require('../../models/class/class');
    const Attendance = require('../../models/class/attendance');

    // 1. Lấy StudentYearRecord (HK1, HK2, CN)
    const yearRecords = await StudentYearRecord.find({
      studentId: id,
      year: year
    })
      .populate('classId', 'className classCode grade year homeroomTeacherId')
      .populate('homeroomTeacherId', 'name teacherCode')
      .populate({ 
        path: 'classId.homeroomTeacherId', 
        select: 'name teacherCode',
        populate: { path: 'accountId', select: 'email' }
      })
      .lean();

    const hk1Record = yearRecords.find(r => r.semester === 'HK1');
    const hk2Record = yearRecords.find(r => r.semester === 'HK2');
    const yearRecord = yearRecords.find(r => r.semester === 'CN');

    // 2. Lấy thông tin lớp học theo năm
    const classInfo = hk1Record?.classId || hk2Record?.classId || yearRecord?.classId;
    let classDetail = null;
    let homeroomTeacher = null;

    if (classInfo) {
      classDetail = {
        _id: classInfo._id,
        className: classInfo.className,
        classCode: classInfo.classCode,
        grade: classInfo.grade,
        year: classInfo.year
      };

      // Lấy GVCN từ class hoặc từ yearRecord
      if (classInfo.homeroomTeacherId) {
        const Teacher = require('../../models/user/teacher');
        const teacher = await Teacher.findById(classInfo.homeroomTeacherId)
          .populate('accountId', 'email')
          .select('name teacherCode accountId')
          .lean();
        if (teacher) {
          homeroomTeacher = {
            _id: teacher._id,
            name: teacher.name,
            teacherCode: teacher.teacherCode,
            email: teacher.accountId?.email
          };
        }
      } else if (yearRecord?.homeroomTeacherId) {
        homeroomTeacher = {
          _id: yearRecord.homeroomTeacherId._id,
          name: yearRecord.homeroomTeacherId.name,
          teacherCode: yearRecord.homeroomTeacherId.teacherCode
        };
      }
    }

    // 3. Lấy bảng điểm chi tiết (có điểm hệ số 1, 2, giữa kỳ, cuối kỳ)
    const gradeSummaries = await GradeSummary.find({
      studentId: id,
      schoolYear: year
    })
      .populate('subjectId', 'name code includeInAverage')
      .sort({ 'subjectId.name': 1 })
      .lean();

    // Lấy GradeItem để có điểm chi tiết
    const allGradeItems = await GradeItem.find({
      studentId: id,
      schoolYear: year
    })
      .sort({ subjectId: 1, semester: 1, component: 1, attempt: 1 })
      .lean();

    // Nhóm GradeSummary theo môn học
    const summariesBySubject = {};
    gradeSummaries.forEach(summary => {
      const subjectId = String(summary.subjectId._id);
      if (!summariesBySubject[subjectId]) {
        summariesBySubject[subjectId] = {
          subject: summary.subjectId,
          hk1: null,
          hk2: null
        };
      }
      if (summary.semester === '1') {
        summariesBySubject[subjectId].hk1 = summary;
      } else if (summary.semester === '2') {
        summariesBySubject[subjectId].hk2 = summary;
      }
    });

    // Nhóm điểm theo môn và học kỳ
    const detailedGrades = Object.values(summariesBySubject).map((subjectData) => {
      const subjectItems = allGradeItems.filter(
        item => String(item.subjectId) === String(subjectData.subject._id) &&
        item.schoolYear === year
      );

      // Nhóm theo học kỳ và component
      const hk1Items = subjectItems.filter(item => item.semester === '1');
      const hk2Items = subjectItems.filter(item => item.semester === '2');

      const getComponentScores = (items, component) => {
        return items
          .filter(item => item.component === component)
          .sort((a, b) => (a.attempt || 1) - (b.attempt || 1))
          .map(item => item.score);
      };

      const hk1Summary = subjectData.hk1;
      const hk2Summary = subjectData.hk2;

      return {
        subject: {
          _id: subjectData.subject._id,
          name: subjectData.subject.name,
          code: subjectData.subject.code,
          includeInAverage: subjectData.subject.includeInAverage
        },
        hk1: {
          // Điểm hệ số 1 (oral, quiz15)
          coefficient1: {
            oral: getComponentScores(hk1Items, 'oral'),
            quiz15: getComponentScores(hk1Items, 'quiz15')
          },
          // Điểm hệ số 2 (quiz45)
          coefficient2: {
            quiz45: getComponentScores(hk1Items, 'quiz45')
          },
          midterm: getComponentScores(hk1Items, 'midterm'),
          final: getComponentScores(hk1Items, 'final'),
          average: hk1Summary?.average || null,
          averages: hk1Summary?.averages || {},
          isOfficial: hk1Summary?.isOfficial === true,
          officialAt: hk1Summary?.officialAt || null,
          officialBy: hk1Summary?.officialBy || null
        },
        hk2: {
          coefficient1: {
            oral: getComponentScores(hk2Items, 'oral'),
            quiz15: getComponentScores(hk2Items, 'quiz15')
          },
          coefficient2: {
            quiz45: getComponentScores(hk2Items, 'quiz45')
          },
          midterm: getComponentScores(hk2Items, 'midterm'),
          final: getComponentScores(hk2Items, 'final'),
          average: hk2Summary?.average || null,
          averages: hk2Summary?.averages || {},
          isOfficial: hk2Summary?.isOfficial === true,
          officialAt: hk2Summary?.officialAt || null,
          officialBy: hk2Summary?.officialBy || null
        },
        yearAverage: null // Sẽ tính sau
      };
    });

    // Tính điểm TB cả năm cho từng môn
    detailedGrades.forEach(grade => {
      const hk1Avg = grade.hk1.average;
      const hk2Avg = grade.hk2.average;
      if (hk1Avg !== null && hk2Avg !== null) {
        grade.yearAverage = parseFloat(((hk1Avg + hk2Avg * 2) / 3).toFixed(1));
      } else if (hk1Avg !== null) {
        grade.yearAverage = parseFloat(hk1Avg.toFixed(1));
      } else if (hk2Avg !== null) {
        grade.yearAverage = parseFloat(hk2Avg.toFixed(1));
      }
    });

    // 4. Lấy thống kê chuyên cần
    const attendanceStats = {
      totalAbsent: yearRecord?.totalAbsent || 0,
      totalLate: yearRecord?.totalLate || 0,
      excusedAbsent: 0, // Sẽ tính từ Attendance records
      unexcusedAbsent: 0,
      earlyLeave: 0
    };

    // Tính chi tiết từ Attendance records
    const attendanceRecords = await Attendance.find({
      studentId: id,
      schoolYear: year
    }).lean();

    attendanceRecords.forEach(record => {
      if (record.status === 'absent') {
        if (record.excused) {
          attendanceStats.excusedAbsent++;
        } else {
          attendanceStats.unexcusedAbsent++;
        }
      }
      if (record.status === 'late') {
        attendanceStats.totalLate++;
      }
      if (record.status === 'early_leave') {
        attendanceStats.earlyLeave++;
      }
    });

    // 5. Tính kết quả lên lớp (từ promoteStudents logic)
    let promotionResult = null;
    if (yearRecord) {
      const gpa = yearRecord.gpa || 0;
      const academicLevel = yearRecord.academicLevel;
      const conduct = yearRecord.conduct;

      // Logic xác định kết quả
      if (classInfo?.grade === '12') {
        // Khối 12: Tốt nghiệp hoặc không tốt nghiệp
        promotionResult = (gpa >= 5.0 && academicLevel !== 'Yếu' && conduct !== 'Yếu') 
          ? 'Tốt nghiệp' 
          : 'Không tốt nghiệp';
      } else {
        // Khối 10, 11: Lên lớp hoặc ở lại
        if (gpa >= 5.0 && academicLevel !== 'Yếu' && conduct !== 'Yếu') {
          promotionResult = 'Lên lớp thẳng';
        } else if (gpa >= 3.5 && academicLevel !== 'Yếu') {
          promotionResult = 'Lên lớp có điều kiện';
        } else {
          promotionResult = 'Ở lại lớp';
        }
      }
    }

    // 6. Tính tổng kết và danh hiệu
    const allSubjectAverages = detailedGrades
      .filter(g => g.subject.includeInAverage && g.yearAverage)
      .map(g => parseFloat(g.yearAverage));

    const overallGPA = allSubjectAverages.length > 0
      ? (allSubjectAverages.reduce((a, b) => a + b, 0) / allSubjectAverages.length).toFixed(1)
      : null;

    // Xác định danh hiệu
    let title = null;
    if (overallGPA && parseFloat(overallGPA) >= 8.0 && 
        allSubjectAverages.every(avg => avg >= 6.5) &&
        yearRecord?.conduct === 'Tốt') {
      title = 'Học sinh Giỏi';
    } else if (overallGPA && parseFloat(overallGPA) >= 6.5 &&
               allSubjectAverages.every(avg => avg >= 5.0) &&
               (yearRecord?.conduct === 'Tốt' || yearRecord?.conduct === 'Khá')) {
      title = 'Học sinh Tiên tiến';
    }

    // 7. Xác định xếp loại chung
    let overallRank = '—';
    if (overallGPA) {
      const gpaNum = parseFloat(overallGPA);
      if (gpaNum >= 8.0 && allSubjectAverages.every(avg => avg >= 6.5)) {
        overallRank = 'Xuất sắc';
      } else if (gpaNum >= 6.5 && allSubjectAverages.every(avg => avg >= 5.0)) {
        overallRank = 'Giỏi';
      } else if (gpaNum >= 5.0) {
        overallRank = 'Khá';
      } else if (gpaNum >= 3.5) {
        overallRank = 'Trung bình';
      } else {
        overallRank = 'Yếu';
      }
    }

    res.json({
      success: true,
      data: {
        year,
        // Thông tin lớp học
        classInfo: classDetail,
        homeroomTeacher,
        // Bảng điểm chi tiết
        grades: detailedGrades,
        // Học lực
        academicLevel: {
          hk1: hk1Record?.academicLevel || null,
          hk2: hk2Record?.academicLevel || null,
          year: yearRecord?.academicLevel || null
        },
        // Hạnh kiểm
        conduct: {
          hk1: hk1Record?.conduct || null,
          hk2: hk2Record?.conduct || null,
          year: yearRecord?.conduct || null
        },
        // Điểm TB
        gpa: {
          hk1: hk1Record?.gpa || null,
          hk2: hk2Record?.gpa || null,
          year: yearRecord?.gpa || null
        },
        // Kết quả lên lớp
        promotionResult,
        // Thống kê chuyên cần
        attendance: attendanceStats,
        // Nhận xét GVCN (HK1, HK2, Cuối năm)
        homeroomTeacherNotes: {
          hk1: hk1Record?.note || null,
          hk2: hk2Record?.note || null,
          year: yearRecord?.note || null
        },
        // Tổng kết
        summary: {
          overallGPA,
          overallRank,
          title
        }
      }
    });
  } catch (error) {
    console.error('❌ Lỗi getStudentYearDetail:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/* =========================================================
   ➕ TẠO HỌC SINH MỚI
========================================================= */
exports.createStudent = async (req, res) => {
  try {
    const {
      name,
      dob,
      gender,
      address,
      phone,
      classId,
      admissionYear,
      grade,
      parents,
      status,
      accountId,

      // 🔹 Thông tin cá nhân mới
      ethnic,
      religion,
      idNumber,
      birthPlace,
      hometown,
      avatarUrl,
      note,
    } = req.body;

    // 1️⃣ Tạo Parents nếu có
    let parentIds = [];
    if (Array.isArray(parents) && parents.length > 0) {
      const createdParents = await Promise.all(
        parents.map(p =>
          Parent.create({
            name: p.name,
            phone: p.phone,
            relation: p.relation,
            occupation: p.occupation || "",
          })
        )
      );
      parentIds = createdParents.map(p => p._id);
    }

    // 2️⃣ Sinh mã học sinh tự động
// 🔹 Sinh mã học sinh tự động, đảm bảo không trùng
let count = await Student.countDocuments({ admissionYear });
let studentCode;
let isUnique = false;
    let attempts = 0;

while (!isUnique) {
  studentCode = `${admissionYear}${String(count + 1).padStart(4, "0")}`;
  const exists = await Student.findOne({ studentCode });
  if (!exists) {
    isUnique = true;
  } else {  
    count++; // nếu trùng -> tăng tiếp
  }
        attempts++;
}
    if (!isUnique) {
      return res.status(500).json({ message: "Không thể sinh mã học sinh duy nhất, vui lòng thử lại." });
    }

    // 3️⃣ Tạo học sinh
    const newStudent = await Student.create({
      name,
      dob,
      gender,
      address,
      phone,
      classId: classId || null,
      admissionYear,
      grade,
      parentIds,
      status: status || "active",
      accountId: accountId || null,
      studentCode,

      // ✅ Thông tin bổ sung
      ethnic,
      religion,
      idNumber,
      birthPlace,
      hometown,
      avatarUrl,
      note,
    });

    // 4️⃣ Nếu học sinh có classId → cập nhật vào lớp
    if (classId) {
      try {
        await Class.findByIdAndUpdate(classId, {
          $addToSet: { students: newStudent._id },
          $inc: { currentSize: 1 },
        });
      } catch (error) {
        console.error('[createStudent] Lỗi khi cập nhật lớp:', error);
      }

      // 5️⃣ Tự động tạo bảng điểm (nếu active)
      if (newStudent.status === 'active') {
        try {
          const settings = await Setting.findOne({}).lean();
          const currentSchoolYear = settings?.currentSchoolYear || '2024-2025';
          await initGradesForStudent({ studentId: newStudent._id, classId, schoolYear: currentSchoolYear, semester: '1' });
          await initGradesForStudent({ studentId: newStudent._id, classId, schoolYear: currentSchoolYear, semester: '2' });
        } catch (error) {
          console.error('[createStudent] Lỗi khi tạo bảng điểm:', error);
        }
      }
    }

    res.status(201).json(newStudent);
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(400).json({ message: "Error creating student", error: error.message });
  }
};

/* =========================================================
   ✏️ CẬP NHẬT HỌC SINH
========================================================= */
exports.updateStudent = async (req, res) => {
  try {
    const {
      name,
      dob,
      gender,
      address,
      phone,
      classId,
      admissionYear,
      grade,
      parents,
      status,

      // 🔹 Thông tin cá nhân mới
      ethnic,
      religion,
      idNumber,
      birthPlace,
      hometown,
      avatarUrl,
      note,
    } = req.body;

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const oldClassId = student.classId?.toString();

    // 🔹 Cập nhật các trường cơ bản
    if (name) student.name = name;
    if (dob) student.dob = dob;
    if (gender) student.gender = gender;
    if (address) student.address = address;
    if (phone) {
      student.phone = phone;
      
      // ✅ Đồng bộ số điện thoại mới vào Account và Firebase nếu có account
      if (student.accountId) {
        const Account = require('../../models/user/account');
        const admin = require('../../config/firebaseAdmin');
        const account = await Account.findById(student.accountId);
        
        if (account) {
          // Format phone number (đảm bảo có +84)
          let formattedPhone = phone.trim();
          if (!formattedPhone.startsWith('+')) {
            if (formattedPhone.startsWith('0')) {
              formattedPhone = '+84' + formattedPhone.substring(1);
            } else {
              formattedPhone = '+84' + formattedPhone;
            }
          }

          // Cập nhật trong Account model
          account.phone = formattedPhone;
          await account.save();

          // Cập nhật trong Firebase
          try {
            await admin.auth().updateUser(account.uid, {
              phoneNumber: formattedPhone,
            });
            console.log(`✅ Đã cập nhật số điện thoại học sinh trong Firebase: ${formattedPhone}`);
          } catch (firebaseError) {
            console.error('⚠️ Lỗi cập nhật số điện thoại trong Firebase:', firebaseError);
          }
        }
      }
    }
    if (classId !== undefined) student.classId = classId;
    if (admissionYear) student.admissionYear = admissionYear;
    if (grade) student.grade = grade;
    if (status) student.status = status;

    // 🔹 Cập nhật thông tin bổ sung
    if (ethnic) student.ethnic = ethnic;
    if (religion) student.religion = religion;
    if (idNumber) student.idNumber = idNumber;
    if (birthPlace) student.birthPlace = birthPlace;
    if (hometown) student.hometown = hometown;
    if (avatarUrl) student.avatarUrl = avatarUrl;
    if (note) student.note = note;

    // 🔹 Update parents
    if (Array.isArray(parents)) {
      const updatedParents = await Promise.all(
        parents.map(async (p) => {
          if (p._id) {
            return await Parent.findByIdAndUpdate(
              p._id,
              {
                ...(p.name && { name: p.name }),
                ...(p.phone && { phone: p.phone }),
                ...(p.relation && { relation: p.relation }),
                ...(p.occupation && { occupation: p.occupation }),
              },
              { new: true }
            );
          } else {
            return await Parent.create({
              name: p.name || "",
              phone: p.phone || "",
              relation: p.relation || "guardian",
            });
          }
        })
      );
      student.parentIds = updatedParents.map(p => p._id);
    }

    await student.save();

    const newClassId = student.classId?.toString();

    // 🔹 Cập nhật lớp học nếu thay đổi
    if (oldClassId && oldClassId !== newClassId) {
      await Class.findByIdAndUpdate(oldClassId, {
        $pull: { students: student._id },
        $inc: { currentSize: -1 },
      });
    }
    if (newClassId && oldClassId !== newClassId) {
      await Class.findByIdAndUpdate(newClassId, {
        $addToSet: { students: student._id },
        $inc: { currentSize: 1 },
      });
    }

    // 🔹 Tạo bảng điểm mới nếu chuyển lớp
    if (newClassId && oldClassId !== newClassId && student.status === 'active') {
      try {
        const settings = await Setting.findOne({}).lean();
        const currentSchoolYear = settings?.currentSchoolYear || '2024-2025';
        await initGradesForStudent({ studentId: student._id, classId: newClassId, schoolYear: currentSchoolYear, semester: '1' });
        await initGradesForStudent({ studentId: student._id, classId: newClassId, schoolYear: currentSchoolYear, semester: '2' });
      } catch (error) {
        console.error('[updateStudent] Lỗi khi tạo bảng điểm:', error);
      }
    }

    res.json(student);
  } catch (error) {
    console.error("Error updating student:", error);
    res.status(400).json({ message: "Error updating student", error: error.message });
  }
};

/* =========================================================
   📜 LỊCH SỬ CHUYỂN LỚP HỌC SINH
========================================================= */
exports.getStudentTransferHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID học sinh không hợp lệ.' });
    }

    const permissionContext = req.permissionContext || null;
    let studentDoc = null;

    const isAdminLike = permissionContext?.role === 'admin' || permissionContext?.isLeader;
    if (permissionContext && !isAdminLike) {
      studentDoc = await Student.findById(id).select('classId').lean();
      if (!studentDoc) {
        return res.status(404).json({ message: 'Không tìm thấy học sinh.' });
      }

      const studentIdMatches = permissionContext.studentId && String(permissionContext.studentId) === String(id);
      const studentClassId = studentDoc.classId ? String(studentDoc.classId) : null;

      const homeroomMatch =
        permissionContext.isHomeroom &&
        studentClassId &&
        Array.isArray(permissionContext.homeroomClassIds) &&
        permissionContext.homeroomClassIds
          .map((clsId) => (clsId ? String(clsId) : null))
          .filter(Boolean)
          .includes(studentClassId);

      const teachingMatch =
        studentClassId &&
        Array.isArray(permissionContext.teachingClassIds) &&
        permissionContext.teachingClassIds
          .map((clsId) => (clsId ? String(clsId) : null))
          .filter(Boolean)
          .includes(studentClassId);

      if (!studentIdMatches && !homeroomMatch && !teachingMatch) {
        return res.status(403).json({ message: 'Không có quyền xem lịch sử chuyển lớp của học sinh này.' });
      }
    }

    const rawLimit = req.query.limit;
    const rawPage = req.query.page;

    const parsedLimit = rawLimit === 'all'
      ? null
      : Math.min(Math.max(parseInt(rawLimit, 10) || 20, 1), 100);
    const parsedPage = Math.max(parseInt(rawPage, 10) || 1, 1);
    const skip = parsedLimit ? (parsedPage - 1) * parsedLimit : 0;

    const query = { studentId: id };

    const [historyDocs, total] = await Promise.all([
      StudentTransferHistory.find(query)
        .sort({ createdAt: -1 })
        .skip(parsedLimit ? skip : 0)
        .limit(parsedLimit ? parsedLimit : 0)
        .lean(),
      StudentTransferHistory.countDocuments(query),
    ]);

    const history = historyDocs.map((doc) => {
      const {
        _id,
        studentId,
        fromClassId,
        toClassId,
        performedBy,
        ...rest
      } = doc;
      return {
        id: String(_id),
        studentId: studentId ? String(studentId) : null,
        fromClassId: fromClassId ? String(fromClassId) : null,
        toClassId: toClassId ? String(toClassId) : null,
        ...rest,
        performedBy: performedBy
          ? {
              ...performedBy,
              accountId: performedBy.accountId ? String(performedBy.accountId) : null,
            }
          : null,
      };
    });

    return res.json({
      data: history,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit || total,
        pages: parsedLimit ? Math.ceil(total / parsedLimit) || 1 : 1,
      },
    });
  } catch (error) {
    console.error('[getStudentTransferHistory] Lỗi:', error);
    res.status(500).json({ message: 'Lỗi khi lấy lịch sử chuyển lớp học sinh.', error: error.message });
  }
};

/* =========================================================
   🔄 CHUYỂN LỚP CHO HỌC SINH
========================================================= */
exports.transferStudent = async (req, res) => {
  let session = null;
  let transactionsSupported = false;
  try {
    const { id } = req.params;
    const {
      targetClassId,
      effectiveDate,
      reason,
      keepOldYearRecords = true,
    } = req.body || {};

    const normalizedReason =
      typeof reason === 'string' && reason.trim() ? reason.trim() : null;

    let transferEffectiveDate = new Date();
    if (effectiveDate) {
      const parsedEffectiveDate = new Date(effectiveDate);
      if (!Number.isNaN(parsedEffectiveDate.getTime())) {
        transferEffectiveDate = parsedEffectiveDate;
      }
    }

    if (!targetClassId) {
      return res.status(400).json({ message: 'Vui lòng chọn lớp chuyển đến.' });
    }

    const mongoClient =
      typeof mongoose.connection.getClient === 'function'
        ? mongoose.connection.getClient()
        : mongoose.connection.client;
    const topology = mongoClient?.topology;
    transactionsSupported = !!(
      topology &&
      typeof topology.hasSessionSupport === 'function' &&
      topology.hasSessionSupport()
    );

    session = transactionsSupported ? await mongoose.startSession() : null;
    if (!transactionsSupported) {
      console.warn(
        '[transferStudent] Transactions not supported by MongoDB topology. Proceeding without transactional guarantees.'
      );
    }

    const withSession = (query) => (session ? query.session(session) : query);

    if (session) {
      await session.startTransaction();
    }

    const studentQuery = Student.findById(id).populate('classId', 'className year');
    const student = await withSession(studentQuery);

    if (!student || student.isDeleted) {
      if (session) {
        await session.abortTransaction();
      }
      return res.status(404).json({ message: 'Không tìm thấy học sinh.' });
    }

    const previousClassInfo = student.classId
      ? {
          id: student.classId._id,
          name: student.classId.className,
          year: student.classId.year,
        }
      : null;
    const previousYear = student.currentYear;
    const previousGrade = student.grade;

    const targetClassQuery = Class.findOne({ _id: targetClassId, isDeleted: { $ne: true } });
    const targetClass = await withSession(targetClassQuery);
    if (!targetClass) {
      if (session) {
        await session.abortTransaction();
      }
      return res.status(404).json({ message: 'Không tìm thấy lớp chuyển đến.' });
    }

    if (student.classId && String(student.classId._id) === String(targetClassId)) {
      if (session) {
        await session.abortTransaction();
      }
      return res.status(400).json({ message: 'Học sinh hiện đã thuộc lớp này.' });
    }

    if (targetClass.capacity && targetClass.currentSize >= targetClass.capacity) {
      if (session) {
        await session.abortTransaction();
      }
      return res.status(400).json({ message: 'Lớp đã đạt sĩ số tối đa.' });
    }

    const oldClassId = student.classId ? student.classId._id : null;
    const oldClass = oldClassId
      ? await withSession(Class.findById(oldClassId))
      : null;

    if (oldClass) {
      const oldClassStudents = Array.isArray(oldClass.students)
        ? [...oldClass.students]
        : [];
      oldClass.students = oldClassStudents.filter(
        (sid) => String(sid) !== String(student._id)
      );
      oldClass.currentSize = Math.max(0, oldClass.students.length);
      if (session) {
        await oldClass.save({ session });
      } else {
        await oldClass.save();
      }
    }

    const targetClassStudents = Array.isArray(targetClass.students)
      ? [...targetClass.students]
      : [];
    const alreadyInTarget = targetClassStudents.some(
      (sid) => String(sid) === String(student._id)
    );
    if (!alreadyInTarget) {
      targetClassStudents.push(student._id);
      targetClass.students = targetClassStudents;
      targetClass.currentSize = targetClassStudents.length;
    }
    if (session) {
      await targetClass.save({ session });
    } else {
      await targetClass.save();
    }

    student.classId = targetClass._id;
    student.grade = targetClass.grade;
    student.currentYear = targetClass.year;
    if (student.status !== 'active') {
      student.status = 'active';
    }

    if (session) {
      await student.save({ session });
    } else {
      await student.save();
    }

    const targetYear = targetClass.year || previousYear || student.currentYear || null;

    if (!keepOldYearRecords && oldClass) {
      await withSession(
        StudentYearRecord.deleteMany({
        studentId: student._id,
        year: oldClass.year,
      })
      );
    } else if (oldClass && oldClass.year !== targetYear) {
      await withSession(
        StudentYearRecord.updateMany(
        { studentId: student._id, year: oldClass.year },
        { $set: { classId: oldClass._id } }
      )
      );
    }

    const existingYearRecords = await withSession(
      StudentYearRecord.find({
      studentId: student._id,
      year: targetYear,
    })
    ).lean();

    if (existingYearRecords.length) {
      await withSession(
        StudentYearRecord.updateMany(
        { studentId: student._id, year: targetYear },
        { $set: { classId: targetClass._id } }
      )
      );
    } else {
      const records = ['HK1', 'HK2', 'CN'].map((semester) => ({
        studentId: student._id,
        classId: targetClass._id,
        year: targetYear,
        semester,
      }));
      await StudentYearRecord.insertMany(records, session ? { session } : undefined);
    }

    await withSession(
      GradeItem.updateMany(
      { studentId: student._id, schoolYear: targetYear },
      { $set: { classId: targetClass._id } }
    )
    );

    await withSession(
      GradeSummary.updateMany(
      { studentId: student._id, schoolYear: targetYear },
      { $set: { classId: targetClass._id } }
    )
    );

    await withSession(
      Attendance.updateMany(
      { studentId: student._id, schoolYear: targetYear },
      { $set: { classId: targetClass._id } }
    )
    );

    if (session) {
      await session.commitTransaction();
    }

    try {
      await initGradesForStudent({
        studentId: student._id,
        classId: targetClass._id,
        schoolYear: targetYear,
        semester: '1',
      });
      await initGradesForStudent({
        studentId: student._id,
        classId: targetClass._id,
        schoolYear: targetYear,
        semester: '2',
      });
    } catch (gradeError) {
      console.warn('[transferStudent] Lỗi khởi tạo bảng điểm:', gradeError.message);
    }

    const updatedStudent = await Student.findById(id)
      .populate({ path: 'classId', select: 'className classCode grade year' })
      .populate({ path: 'accountId', select: 'email phone role' })
      .populate({ path: 'parentIds', select: 'name phone relation occupation' })
      .lean();

    let historyPayload = null;
    try {
      const historyDoc = await StudentTransferHistory.create({
        studentId: student._id,
        fromClassId: previousClassInfo?.id || null,
        fromClassName: previousClassInfo?.name || null,
        fromGrade: previousGrade || null,
        fromYear: previousClassInfo?.year || previousYear || null,
        toClassId: targetClass._id,
        toClassName: targetClass.className,
        toGrade: targetClass.grade,
        toYear: targetYear || previousYear || null,
        effectiveDate: transferEffectiveDate,
        reason: normalizedReason,
        performedBy: {
          accountId: req.user?.accountId || null,
          role: req.user?.role || null,
          email: req.user?.email || null,
          name: req.user?.name || null,
          uid: req.user?.uid || null,
        },
        metadata: {
          keepOldYearRecords: !!keepOldYearRecords,
        },
      });

      const obj = historyDoc.toObject({ versionKey: false });
      const { _id, ...rest } = obj;
      historyPayload = { id: _id, ...rest };
    } catch (historyError) {
      console.warn('[transferStudent] Không thể lưu lịch sử chuyển lớp:', historyError.message);
    }

    return res.json({
      message: 'Chuyển lớp thành công.',
      data: {
        student: updatedStudent,
        fromClass: oldClass ? { id: oldClass._id, name: oldClass.className } : null,
        toClass: { id: targetClass._id, name: targetClass.className },
        effectiveDate: transferEffectiveDate,
        reason: normalizedReason,
        history: historyPayload,
      },
    });
  } catch (error) {
    console.error('[transferStudent] Lỗi chuyển lớp:', error);
    if (session) {
      await session.abortTransaction();
    }
    res.status(500).json({ message: 'Lỗi khi chuyển lớp học sinh.', error: error.message });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

/* =========================================================
   🗑️ XOÁ HỌC SINH
========================================================= */
// ✅ Soft Delete - Xóa mềm học sinh (chỉ đánh dấu, không xóa thật)
exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await Student.findById(id);
    
    if (!student) {
      return res.status(404).json({ message: 'Không tìm thấy học sinh' });
    }


    // Lưu classId trước khi xóa
    const classId = student.classId;

    // ✅ Đánh dấu isDeleted = true (soft delete)
    student.isDeleted = true;
    student.status = 'inactive'; // Đồng thời cập nhật status
    await student.save();

    // Giảm currentSize của lớp nếu có
    if (classId) {
      await require('../../models/class/class').findByIdAndUpdate(classId, {
        $pull: { students: student._id },
        $inc: { currentSize: -1 },
      });
    }

    res.json({ 
      message: 'Đã xóa học sinh thành công (soft delete)',
      student: student
    });
  } catch (error) {
    console.error('❌ Lỗi khi xóa học sinh:', error);
    res.status(500).json({ 
      message: 'Lỗi khi xóa học sinh', 
      error: error.message 
    });
  }
};

/* =========================================================
   🔐 TẠO ACCOUNT CHO HỌC SINH
========================================================= */
exports.createAccountForStudent = async (req, res) => {
  try {
    const { studentId } = req.body;

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: "Student không tồn tại" });
    if (!student.phone) return res.status(400).json({ message: "Student chưa có số điện thoại" });

    const userRecord = await admin.auth().createUser({
      phoneNumber: student.phone,
      displayName: student.name,
      password: "123456",
    });

    const account = await Account.create({
      uid: userRecord.uid,
      phone: student.phone,
      role: "student",
    });

    student.accountId = account._id;
    await student.save();

    res.status(201).json({ message: "Tạo tài khoản thành công", account });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi tạo tài khoản", error: error.message });
  }
};

/* =========================================================
   🧹 XOÁ PHỤ HUYNH
========================================================= */
exports.deleteParent = async (req, res) => {
  try {
    const parent = await Parent.findByIdAndDelete(req.params.id);
    if (!parent) return res.status(404).json({ message: 'Parent not found' });
    res.json({ message: 'Parent deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting parent', error: error.message });
  }
};

/* =========================================================
   🧮 PHÂN LỚP TỰ ĐỘNG (theo tên + chia đều)
========================================================= */
// exports.autoAssignToClasses = async (req, res) => {
//   try {


//         const config = await Setting.findOne();
//     const currentYear = config?.currentSchoolYear;

//     if (!currentYear) {
//       return res.status(400).json({ message: "Không tìm thấy năm học hiện tại trong cấu hình." });
//     }
//     // 🔹 Lấy học sinh chưa có lớp
//     const students = await Student.find({
//       classId: null,
//       $or: [{ currentYear }, { currentYear: { $exists: false } }],
//     }).sort({ grade: 1, name: 1 });

//     if (!students.length) {
//       return res.status(200).json({ message: "Không có học sinh cần gán lớp." });
//     }

//     // 🔹 Gom học sinh theo khối
//     const groupedByGrade = students.reduce((acc, s) => {
//       if (!acc[s.grade]) acc[s.grade] = [];
//       acc[s.grade].push(s);
//       return acc;
//     }, {});

//     let totalAssigned = 0;
//     const gradeLogs = [];

//     // 🔹 Lặp qua từng khối (10, 11, 12)
//     for (const grade of Object.keys(groupedByGrade)) {
//       const gradeStudents = groupedByGrade[grade];
//       const classes = await Class.find({ year: currentYear, grade });

//       if (!classes.length) {
//         console.warn(`⚠️ Không có lớp cho khối ${grade}, bỏ qua.`);
//         continue;
//       }

//       let i = 0; // ✅ Reset tại đây để tránh lệch lớp giữa các khối
//       const perClassCount = Math.ceil(gradeStudents.length / classes.length);

//       for (const student of gradeStudents) {
//         const targetClass = classes[i % classes.length];
//         student.classId = targetClass._id;
//         student.currentYear = currentYear;
//         await student.save();

//         // Cập nhật vào lớp
//         await Class.findByIdAndUpdate(targetClass._id, {
//           $addToSet: { students: student._id },
//           $inc: { currentSize: 1 },
//         });

//         // Tạo bảng điểm nếu có
//         if (typeof initGradesForStudent === "function") {
//           try {
//             await initGradesForStudent({
//               studentId: student._id,
//               classId: targetClass._id,
//               schoolYear: currentYear,
//               semester: "1",
//             });
//             await initGradesForStudent({
//               studentId: student._id,
//               classId: targetClass._id,
//               schoolYear: currentYear,
//               semester: "2",
//             });
//           } catch (err) {
//             console.warn(`[autoAssignToClasses] ⚠️ Lỗi tạo bảng điểm cho ${student.name}:`, err.message);
//           }
//         }

//         i++;
//         totalAssigned++;
//       }

//       gradeLogs.push(`Khối ${grade}: ${gradeStudents.length} học sinh → ${classes.length} lớp`);
//     }

//     res.status(200).json({
//       message: `✅ Đã phân lớp thành công cho ${totalAssigned} học sinh.`,
//       detail: gradeLogs,
//     });
//   } catch (error) {
//     console.error("[autoAssignToClasses] ❌", error);
//     res.status(500).json({
//       message: "Lỗi khi phân lớp tự động.",
//       error: error.message,
//     });
//   }
// };
exports.autoAssignToClasses = async (req, res) => {
  try {
    console.log("🚀 [autoAssignToClasses] Bắt đầu phân lớp...");

    const config = await Setting.findOne();
    const currentYear = config?.currentSchoolYear;

    if (!currentYear) {
      return res.status(400).json({ message: "Không tìm thấy năm học hiện tại trong cấu hình." });
    }

    // 🔹 Lấy học sinh chưa có lớp
    const students = await Student.find({
      classId: null,
      $or: [{ currentYear }, { currentYear: { $exists: false } }],
    }).sort({ grade: 1, name: 1 });

    if (!students.length) {
      return res.status(200).json({ message: "Không có học sinh cần gán lớp." });
    }

    console.log(`📘 Tổng học sinh cần gán: ${students.length}`);

    // 🔹 Gom học sinh theo khối
    const groupedByGrade = students.reduce((acc, s) => {
      if (!acc[s.grade]) acc[s.grade] = [];
      acc[s.grade].push(s);
      return acc;
    }, {});

    let totalAssigned = 0;
    const gradeLogs = [];

    // 🔹 Lặp qua từng khối (10, 11, 12)
    for (const grade of Object.keys(groupedByGrade)) {
      console.log(`\n🔸 Bắt đầu xử lý khối ${grade}...`);
      const gradeStudents = groupedByGrade[grade].sort((a, b) =>
        a.name.localeCompare(b.name, "vi", { sensitivity: "base" })
      );

      const classes = await Class.find({ year: currentYear, grade });

      if (!classes.length) {
        console.warn(`⚠️ Không có lớp cho khối ${grade}, bỏ qua.`);
        continue;
      }

      console.log(`📗 Khối ${grade}: ${gradeStudents.length} HS, ${classes.length} lớp`);

      // 🔹 Kiểm tra và lọc lớp còn chỗ trống
      const availableClasses = classes.filter(c => !c.capacity || c.currentSize < c.capacity);

      if (!availableClasses.length) {
        console.warn(`⚠️ Tất cả lớp khối ${grade} đều đầy, bỏ qua.`);
        continue;
      }

      // 👉 Gán từng học sinh vào lớp có sĩ số nhỏ nhất
      for (const student of gradeStudents) {
        // ✅ Tìm lớp có sĩ số nhỏ nhất (ưu tiên lớp còn trống)
        availableClasses.sort((a, b) => (a.currentSize || 0) - (b.currentSize || 0));
        const targetClass = availableClasses[0];

        if (!targetClass) {
          console.warn(`⚠️ Không còn lớp trống cho khối ${grade}`);
          break;
        }

        // 🧠 Đảm bảo dữ liệu hợp lệ trước khi lưu
        if (!student.admissionYear) {
          const [startYear] = currentYear.split("-");
          student.admissionYear = Number(startYear);
        }

        if (!student.studentCode) {
          const shortId = student._id.toString().slice(-4).toUpperCase();
          student.studentCode = `${student.admissionYear}${shortId}`;
        }

        student.classId = targetClass._id;
        student.currentYear = currentYear;

        await student.save();

        // 🔹 Cập nhật vào lớp
        await Class.findByIdAndUpdate(targetClass._id, {
          $addToSet: { students: student._id },
          $inc: { currentSize: 1 },
        });

        // Cập nhật cache tạm để lần sau sort chính xác
        targetClass.currentSize = (targetClass.currentSize || 0) + 1;

        // 🧮 Tạo bảng điểm nếu có
        if (typeof initGradesForStudent === "function") {
          try {
            await initGradesForStudent({
              studentId: student._id,
              classId: targetClass._id,
              schoolYear: currentYear,
              semester: "1",
            });
            await initGradesForStudent({
              studentId: student._id,
              classId: targetClass._id,
              schoolYear: currentYear,
              semester: "2",
            });
          } catch (err) {
            console.warn(`[autoAssignToClasses] ⚠️ Lỗi tạo bảng điểm cho ${student.name}:`, err.message);
          }
        }

        totalAssigned++;
      }

      gradeLogs.push(`Khối ${grade}: ${gradeStudents.length} học sinh → ${availableClasses.length} lớp`);
    }

    console.log(`\n✅ Hoàn tất phân lớp: ${totalAssigned} học sinh.`);
    res.status(200).json({
      message: `✅ Đã phân lớp thành công cho ${totalAssigned} học sinh.`,
      detail: gradeLogs,
    });
  } catch (error) {
    console.error("[autoAssignToClasses] ❌ LỖI CHÍNH:", error);
    res.status(500).json({
      message: "Lỗi khi phân lớp tự động.",
      error: error.message,
    });
  }
};

/* =========================================================
   📈 XÉT HỌC SINH LÊN LỚP VÀ CẬP NHẬT NĂM HỌC
========================================================= */
exports.promoteStudents = async (req, res) => {
  try {
    const { 
      currentYear, // Năm học hiện tại cần xét (VD: "2024-2025")
      newYear, // Năm học mới (VD: "2025-2026")
      minGPA = 5.0, // Điểm TB tối thiểu để lên lớp
      minAcademicLevel = 'Yếu', // Học lực tối thiểu (Yếu, Trung bình, Khá, Giỏi) - mặc định: không được Yếu
      minConduct = 'Yếu', // Hạnh kiểm tối thiểu (Yếu, Trung bình, Khá, Tốt) - mặc định: không được Yếu
      grade = null, // Khối cụ thể cần xét (10, 11, 12) - null = xét tất cả
      classId = null, // Lớp cụ thể cần xét - null = xét tất cả
      autoAssignClass = false // Tự động phân lớp cho học sinh lên lớp
    } = req.body;

    // Validate input
    if (!currentYear || !newYear) {
      return res.status(400).json({ 
        message: "Vui lòng cung cấp currentYear và newYear (định dạng: YYYY-YYYY)" 
      });
    }

    // Validate format năm học
    const yearPattern = /^\d{4}-\d{4}$/;
    if (!yearPattern.test(currentYear) || !yearPattern.test(newYear)) {
      return res.status(400).json({ 
        message: "Định dạng năm học không hợp lệ. Vui lòng sử dụng định dạng: YYYY-YYYY (VD: 2024-2025)" 
      });
    }

    console.log(`🚀 [promoteStudents] Bắt đầu xét học sinh lên lớp từ ${currentYear} → ${newYear}`);

    // ✅ Lấy học sinh cần xét: filter theo currentYear, status, grade (nếu có), classId (nếu có)
    const studentFilter = {
      currentYear: currentYear,
      status: 'active'
    };
    
    if (grade) {
      studentFilter.grade = String(grade);
    }
    
    if (classId) {
      studentFilter.classId = classId;
    }
    
    const students = await Student.find(studentFilter).populate('classId', 'className classCode grade year');

    if (students.length === 0) {
      return res.status(200).json({
        message: `Không có học sinh nào trong năm học ${currentYear} để xét lên lớp.`,
        stats: {
          total: 0,
          promoted: 0,
          retained: 0,
          graduated: 0,
          noRecord: 0
        }
      });
    }

    console.log(`📘 Tổng số học sinh cần xét: ${students.length}`);

    const stats = {
      total: students.length,
      promoted: 0, // Lên lớp
      retained: 0, // Ở lại lớp
      graduated: 0, // Tốt nghiệp (lớp 12)
      noRecord: 0, // Không có bảng điểm
      errors: []
    };

    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        for (const student of students) {
          try {
            // Lấy bảng điểm cả năm của học sinh
            const yearRecord = await StudentYearRecord.findOne({
              studentId: student._id,
              year: currentYear,
              semester: 'CN'
            }).session(session);

            if (!yearRecord) {
              console.warn(`⚠️ Học sinh ${student.name} (${student.studentCode}) không có bảng điểm cả năm ${currentYear}`);
              stats.noRecord++;
              // Vẫn cập nhật currentYear nhưng không thay đổi grade
              student.currentYear = newYear;
              await student.save({ session });
              continue;
            }

            const gpa = yearRecord.gpa || 0;
            const academicLevel = yearRecord.academicLevel;
            const conduct = yearRecord.conduct; // ✅ Hạnh kiểm

            // ✅ Điều kiện lên lớp (có thể tùy chỉnh qua req.body):
            // 1. GPA >= minGPA (mặc định 5.0)
            // 2. Học lực không phải "Yếu" (hoặc theo yêu cầu)
            // 3. Hạnh kiểm không phải "Yếu" (hoặc theo yêu cầu)
            const minAcademicLevel = req.body.minAcademicLevel || 'Yếu'; // Mặc định: không được Yếu
            const minConduct = req.body.minConduct || 'Yếu'; // Mặc định: không được Yếu
            
            // ✅ Kiểm tra học lực: không được thấp hơn minAcademicLevel
            const academicLevels = ['Yếu', 'Trung bình', 'Khá', 'Giỏi'];
            const academicLevelIndex = academicLevels.indexOf(academicLevel || 'Yếu');
            const minAcademicLevelIndex = academicLevels.indexOf(minAcademicLevel);
            const academicLevelPass = academicLevelIndex >= minAcademicLevelIndex;
            
            // ✅ Kiểm tra hạnh kiểm: không được thấp hơn minConduct
            const conducts = ['Yếu', 'Trung bình', 'Khá', 'Tốt'];
            const conductIndex = conducts.indexOf(conduct || 'Yếu');
            const minConductIndex = conducts.indexOf(minConduct);
            const conductPass = conductIndex >= minConductIndex;
            
            // ✅ Điều kiện lên lớp: GPA đạt + Học lực đạt + Hạnh kiểm đạt
            const canPromote = gpa >= minGPA && academicLevelPass && conductPass;

            if (canPromote) {
              // Lên lớp
              if (student.grade === '12') {
                // Học sinh lớp 12 → tốt nghiệp
                student.grade = '12'; // Giữ nguyên
                student.status = 'graduated';
                student.currentYear = newYear;
                stats.graduated++;
                console.log(`✅ ${student.name} (${student.studentCode}) - Lớp 12, GPA: ${gpa.toFixed(2)}, Học lực: ${academicLevel} → Tốt nghiệp`);
              } else {
                // Lên lớp (10→11, 11→12)
                const currentGrade = parseInt(student.grade);
                const newGrade = String(currentGrade + 1);
                
                student.grade = newGrade;
                student.currentYear = newYear;
                student.classId = null; // Xóa lớp cũ để phân lớp mới
                stats.promoted++;
                console.log(`✅ ${student.name} (${student.studentCode}) - Lớp ${currentGrade} → ${newGrade}, GPA: ${gpa.toFixed(2)}, Học lực: ${academicLevel}, Hạnh kiểm: ${conduct} → Lên lớp`);
              }
            } else {
              // Ở lại lớp
              student.currentYear = newYear;
              stats.retained++;
              const reasons = [];
              if (gpa < minGPA) reasons.push(`GPA ${gpa.toFixed(2)} < ${minGPA}`);
              if (!academicLevelPass) reasons.push(`Học lực: ${academicLevel}`);
              if (!conductPass) reasons.push(`Hạnh kiểm: ${conduct}`);
              console.log(`⚠️ ${student.name} (${student.studentCode}) - Lớp ${student.grade}, GPA: ${gpa.toFixed(2)}, Học lực: ${academicLevel}, Hạnh kiểm: ${conduct} → Ở lại lớp (Lý do: ${reasons.join(', ')})`);
            }

            await student.save({ session });

            // Nếu học sinh lên lớp và có yêu cầu tự động phân lớp
            if (canPromote && student.grade !== '12' && autoAssignClass) {
              // Tìm lớp mới cho học sinh
              const newGrade = student.grade;
              const availableClasses = await Class.find({
                year: newYear,
                grade: newGrade,
                $or: [
                  { capacity: { $exists: false } },
                  { $expr: { $lt: ['$currentSize', '$capacity'] } }
                ]
              })
                .sort({ currentSize: 1 })
                .limit(1)
                .session(session);

              if (availableClasses.length > 0) {
                const targetClass = availableClasses[0];
                student.classId = targetClass._id;
                await student.save({ session });

                // Cập nhật lớp
                await Class.findByIdAndUpdate(
                  targetClass._id,
                  {
                    $addToSet: { students: student._id },
                    $inc: { currentSize: 1 }
                  },
                  { session }
                );

                // Tạo bảng điểm mới
                try {
                  await initGradesForStudent({
                    studentId: student._id,
                    classId: targetClass._id,
                    schoolYear: newYear,
                    semester: '1'
                  });
                  await initGradesForStudent({
                    studentId: student._id,
                    classId: targetClass._id,
                    schoolYear: newYear,
                    semester: '2'
                  });
                } catch (err) {
                  console.warn(`⚠️ Lỗi tạo bảng điểm cho ${student.name}:`, err.message);
                }
              }
            }

          } catch (error) {
            console.error(`❌ Lỗi khi xử lý học sinh ${student.name}:`, error);
            stats.errors.push({
              studentId: student._id,
              studentName: student.name,
              error: error.message
            });
          }
        }
      });
    } finally {
      await session.endSession();
    }

    // Cập nhật currentSchoolYear trong Settings nếu cần
    const settings = await Setting.findOne();
    if (settings && settings.currentSchoolYear === currentYear) {
      settings.currentSchoolYear = newYear;
      await settings.save();
      console.log(`✅ Đã cập nhật currentSchoolYear trong Settings: ${newYear}`);
    }

    console.log(`\n✅ Hoàn tất xét lên lớp:`);
    console.log(`   - Tổng: ${stats.total}`);
    console.log(`   - Lên lớp: ${stats.promoted}`);
    console.log(`   - Ở lại lớp: ${stats.retained}`);
    console.log(`   - Tốt nghiệp: ${stats.graduated}`);
    console.log(`   - Không có bảng điểm: ${stats.noRecord}`);

    res.status(200).json({
      success: true,
      message: `Đã xét lên lớp thành công cho ${stats.total} học sinh.`,
      stats,
      currentYear,
      newYear
    });

  } catch (error) {
    console.error("[promoteStudents] ❌ LỖI CHÍNH:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xét học sinh lên lớp.",
      error: error.message,
    });
  }
};

/* =========================================================
   🔄 CẬP NHẬT NĂM HỌC CHO TẤT CẢ HỌC SINH
========================================================= */
exports.updateAllStudentsYear = async (req, res) => {
  try {
    const { newYear } = req.body;

    // Validate input
    if (!newYear) {
      return res.status(400).json({ 
        message: "Vui lòng cung cấp newYear (định dạng: YYYY-YYYY)" 
      });
    }

    // Validate format năm học
    const yearPattern = /^\d{4}-\d{4}$/;
    if (!yearPattern.test(newYear)) {
      return res.status(400).json({ 
        message: "Định dạng năm học không hợp lệ. Vui lòng sử dụng định dạng: YYYY-YYYY (VD: 2024-2025)" 
      });
    }

    console.log(`🚀 [updateAllStudentsYear] Bắt đầu cập nhật năm học cho tất cả học sinh → ${newYear}`);

    // Cập nhật currentYear cho tất cả học sinh active
    const result = await Student.updateMany(
      { status: 'active' },
      { $set: { currentYear: newYear } }
    );

    // Cập nhật currentSchoolYear trong Settings
    const settings = await Setting.findOne();
    if (settings) {
      settings.currentSchoolYear = newYear;
      await settings.save();
      console.log(`✅ Đã cập nhật currentSchoolYear trong Settings: ${newYear}`);
    }

    console.log(`✅ Đã cập nhật năm học cho ${result.modifiedCount} học sinh.`);

    res.status(200).json({
      success: true,
      message: `Đã cập nhật năm học thành công cho ${result.modifiedCount} học sinh.`,
      modifiedCount: result.modifiedCount,
      newYear
    });

  } catch (error) {
    console.error("[updateAllStudentsYear] ❌ LỖI CHÍNH:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật năm học cho học sinh.",
      error: error.message,
    });
  }
};

// ✅ Soft Delete - Xóa mềm học sinh (chỉ đánh dấu, không xóa thật)
exports.softDeleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ message: 'Không tìm thấy học sinh' });
    }


    // Lưu classId trước khi xóa
    const classId = student.classId;

    // ✅ Đánh dấu isDeleted = true
    student.isDeleted = true;
    student.status = 'inactive'; // Đồng thời cập nhật status
    await student.save();

    // Giảm currentSize của lớp nếu có
    if (classId) {
      await require('../../models/class/class').findByIdAndUpdate(classId, {
        $pull: { students: student._id },
        $inc: { currentSize: -1 },
      });
    }

    res.json({
      message: 'Đã xóa mềm học sinh thành công',
      student: student
    });
  } catch (error) {
    console.error('❌ Lỗi khi xóa mềm học sinh:', error);
    res.status(500).json({
      message: 'Lỗi khi xóa mềm học sinh',
      error: error.message
    });
  }
};

// ✅ Restore - Khôi phục học sinh đã xóa mềm
exports.restoreStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ message: 'Không tìm thấy học sinh' });
    }

    // ✅ Khôi phục isDeleted = false
    student.isDeleted = false;
    student.status = 'active'; // Khôi phục status
    await student.save();

    res.json({
      message: 'Đã khôi phục học sinh thành công',
      student: student
    });
  } catch (error) {
    console.error('❌ Lỗi khi khôi phục học sinh:', error);
    res.status(500).json({
      message: 'Lỗi khi khôi phục học sinh',
      error: error.message
    });
  }
};

// ✅ Force Delete - Xóa vĩnh viễn học sinh (chỉ Admin)
exports.forceDeleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Kiểm tra quyền Admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Chỉ Admin mới có quyền xóa vĩnh viễn' });
    }

    const student = await Student.findByIdAndDelete(id);
    if (!student) {
      return res.status(404).json({ message: 'Không tìm thấy học sinh' });
    }

    res.json({
      message: 'Đã xóa vĩnh viễn học sinh thành công',
      student: student
    });
  } catch (error) {
    console.error('❌ Lỗi khi xóa vĩnh viễn học sinh:', error);
    res.status(500).json({
      message: 'Lỗi khi xóa vĩnh viễn học sinh',
      error: error.message
    });
  }
};

