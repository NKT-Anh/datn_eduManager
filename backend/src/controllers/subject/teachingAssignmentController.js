const TeachingAssignment = require('../../models/subject/teachingAssignment');
const Teacher = require('../../models/user/teacher');
const ClassPeriods = require('../../models/class/classPeriods');
const Class = require('../../models/class/class');
const Subject = require('../../models/subject/subject');
const ScheduleConfig = require('../../models/subject/scheduleConfig');

/**
 * ✅ Kiểm tra các ràng buộc khi phân công giảsng dạy
 * @param {string} teacherId - ID giáo viên
 * @param {string} subjectId - ID môn học
 * @param {string} classId - ID lớp học
 * @param {string} year - Năm học
 * @param {string} semester - Học kỳ
 * @param {string} excludeAssignmentId - ID phân công cần loại trừ (khi update)
 * @returns {object} { valid: boolean, error?: string }
 */
// ✅ Export function để dùng ở controller khác
async function validateTeachingAssignment(teacherId, subjectId, classId, year, semester, excludeAssignmentId = null) {
  if (!year) {
    return { valid: false, error: 'Vui lòng cung cấp năm học hợp lệ (year)' };
  }

  if (!semester) {
    return { valid: false, error: 'Vui lòng cung cấp học kỳ hợp lệ (semester)' };
  }

  // 1️⃣ Kiểm tra giáo viên có dạy môn học này không
  const teacher = await Teacher.findById(teacherId);
  if (!teacher) {
    return { valid: false, error: 'Không tìm thấy giáo viên' };
  }

  // ✅ Loại bỏ giáo viên BGH (Ban giám hiệu)
  if (teacher.isLeader) {
    return { 
      valid: false, 
      error: 'Giáo viên Ban giám hiệu không thể được phân công giảng dạy môn học' 
    };
  }

  // Kiểm tra giáo viên có dạy môn học này không
  const teachesSubject = teacher.subjects?.some(
    sub => sub.subjectId?.toString() === subjectId.toString()
  ) || teacher.mainSubject?.toString() === subjectId.toString();

  if (!teachesSubject) {
    return { 
      valid: false, 
      error: 'Giáo viên không dạy môn học này. Vui lòng kiểm tra lại môn học của giáo viên.' 
    };
  }

  // 2️⃣ Kiểm tra số lớp tối đa
  const currentAssignments = await TeachingAssignment.find({
    teacherId,
    year,
    semester,
    _id: excludeAssignmentId ? { $ne: excludeAssignmentId } : undefined,
  });

  const currentClassCount = currentAssignments.length;
  const maxClasses = teacher.maxClasses || 3;

  if (currentClassCount >= maxClasses) {
    return {
      valid: false,
      error: `Giáo viên đã đạt số lớp tối đa (${maxClasses} lớp). Hiện tại đang dạy ${currentClassCount} lớp.`
    };
  }

  // 3️⃣ Kiểm tra số tiết tối đa/tuần
  // Lấy thông tin lớp để biết khối
  const classInfo = await Class.findById(classId);
  if (!classInfo) {
    return { valid: false, error: 'Không tìm thấy lớp học' };
  }

  // Tính số tiết hiện tại của giáo viên
  let currentWeeklyLessons = 0;
  for (const assignment of currentAssignments) {
    const assignmentClass = await Class.findById(assignment.classId);
    if (!assignmentClass) continue;

    const classPeriods = await ClassPeriods.findOne({
      year,
      semester,
      grade: assignmentClass.grade,
      classId: assignment.classId,
    });

    if (classPeriods && classPeriods.subjectPeriods) {
      const periods = classPeriods.subjectPeriods.get(assignment.subjectId.toString());
      if (periods) {
        currentWeeklyLessons += periods;
      }
    }
  }

  // Tính số tiết của phân công mới
  const newClassPeriods = await ClassPeriods.findOne({
    year,
    semester,
    grade: classInfo.grade,
    classId,
  });

  let newWeeklyLessons = 0;
  if (newClassPeriods && newClassPeriods.subjectPeriods) {
    const periods = newClassPeriods.subjectPeriods.get(subjectId.toString());
    if (periods) {
      newWeeklyLessons = periods;
    }
  }

  const totalWeeklyLessons = currentWeeklyLessons + newWeeklyLessons;
  // ✅ Sử dụng effectiveWeeklyLessons (đã áp dụng cap limit từ weeklyLessons)
  // effectiveWeeklyLessons = base (17) - reduction + optional, và đã bị cap bởi weeklyLessons
  const maxWeeklyLessons = teacher.effectiveWeeklyLessons || 17;

  if (totalWeeklyLessons > maxWeeklyLessons) {
    return {
      valid: false,
      error: `Giáo viên sẽ vượt quá số tiết tối đa/tuần (${maxWeeklyLessons} tiết). Hiện tại: ${currentWeeklyLessons} tiết, thêm: ${newWeeklyLessons} tiết, tổng: ${totalWeeklyLessons} tiết.`
    };
  }

  // 4️⃣ Lịch rảnh giáo viên - Chỉ cảnh báo, không chặn
  // (Cần có schedule mới kiểm tra được, nên chỉ validate khi có schedule)

  return { valid: true };
}

exports.getAllAssignments = async (req, res) => {
  try {
    // ✅ Lọc theo năm học nếu có query parameter
    const { year } = req.query;
    const query = {};
    
    if (year) {
      query.year = year;
    }
    
    const assignments = await TeachingAssignment.find(query)
      .populate('teacherId', 'name availableMatrix')
      .populate('subjectId', 'name')
      .populate('classId', 'className classCode grade year');
    
    res.status(200).json(assignments);
  }
  catch(err){
    res.status(400).json({ message:"Lỗi khi lấy danh sách", error: err.message });   
  }
}

// exports.getAssignmentsByTeacher = async (req, res) => {
//     try{
//         const { teacherId } = req.params;
//         const assignments = await TeachingAssignment.find({ teacherId })
//         .populate('teacherId', 'name availableMatrix')
//         .populate('subjectId', 'name')
//         .populate('classId', 'className classCode grade year');
//         if (!assignments) {
//         return res.status(404).json({ message: 'Không tìm thấy phân công' });
//     }
//         res.status(200).json(assignments);
//     }
//     catch(err){
//         res.status(400).json({ message:"Lỗi khi lấy danh sách", error: err.message });
//     }
// }
exports.createAssignment = async (req, res) => {
  try {
    const { teacherId, subjectId, classId, year, semester } = req.body;
    if (!teacherId || !subjectId || !classId || !year || !semester) {
      return res.status(400).json({ error: "Không được để trống" });
    }
    
    // ✅ Kiểm tra nếu là Trưởng bộ môn, chỉ có thể phân công cho giáo viên trong tổ
    if (req.user && req.user.role === 'teacher' && req.user.teacherFlags?.isDepartmentHead) {
      const Teacher = require('../../models/user/teacher');
      const currentTeacher = await Teacher.findOne({ accountId: req.user.accountId }).lean();
      const targetTeacher = await Teacher.findById(teacherId).lean();
      
      if (!currentTeacher || !targetTeacher) {
        return res.status(404).json({ error: "Không tìm thấy thông tin giáo viên" });
      }
      
      // Kiểm tra giáo viên được phân công có thuộc tổ không
      if (!currentTeacher.departmentId || !targetTeacher.departmentId) {
        return res.status(403).json({ 
          error: "Chỉ có thể phân công cho giáo viên trong tổ bộ môn của bạn" 
        });
      }
      
      const currentDeptId = String(currentTeacher.departmentId._id || currentTeacher.departmentId);
      const targetDeptId = String(targetTeacher.departmentId._id || targetTeacher.departmentId);
      
      if (currentDeptId !== targetDeptId) {
        return res.status(403).json({ 
          error: "Chỉ có thể phân công cho giáo viên trong tổ bộ môn của bạn" 
        });
      }
    }

    // ✅ Kiểm tra trùng
    const exists = await TeachingAssignment.findOne({ classId, subjectId, year, semester });
    if (exists) {
      return res.status(400).json({ error: "Lớp này đã được phân công cho môn học này trong năm học và học kỳ này!" });
    }

    // ✅ Kiểm tra các ràng buộc: môn học, số lớp tối đa, số tiết tối đa/tuần
    const validation = await validateTeachingAssignment(teacherId, subjectId, classId, year, semester);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // ✅ Tạo mới
    const newAssignment = await TeachingAssignment.create({
      teacherId,
      subjectId,
      classId,
      year,
      semester,
    });

    // ✅ Không cần cập nhật teacher.classIds nữa vì đã loại bỏ field này
    // Thông tin phân công lớp được quản lý qua TeachingAssignment

    // ✅ Populate trả về
    const populated = await TeachingAssignment.findById(newAssignment._id)
      .populate("teacherId", "name")
      .populate("subjectId", "name")
      .populate("classId", "className classCode grade year");

    res.status(201).json(populated);
    
  } catch (err) {
    console.error('❌ Lỗi khi tạo phân công:', err);
    if (err.code === 11000) {
      return res.status(400).json({ error: "Phân công này đã tồn tại (duplicate key)" });
    }
    res.status(400).json({ error: "Lỗi khi tạo phân công", details: err.message });
  }
}

exports.validateTeachingAssignment = validateTeachingAssignment;


exports.updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { teacherId, subjectId, classId, year, semester } = req.body;

    if (!teacherId || !subjectId || !classId || !year || !semester) {
      return res.status(400).json({ error: "Không được để trống" });
    }

    // 🔎 Lấy assignment cũ để so sánh
    const oldAssignment = await TeachingAssignment.findById(id);
    if (!oldAssignment) {
      return res.status(404).json({ error: "Không tìm thấy phân công" });
    }
    
    // 🔒 Kiểm tra xem đã có điểm nào được nhập cho phân công cũ chưa
    const GradeItem = require('../../models/grade/gradeItem');
    const gradeCount = await GradeItem.countDocuments({
      subjectId: oldAssignment.subjectId,
      classId: oldAssignment.classId,
      schoolYear: oldAssignment.year,
      semester: oldAssignment.semester,
    });
    
    // Nếu có điểm và thông tin phân công thay đổi (giáo viên, lớp, môn, năm, kỳ) thì không cho phép
    const isChanged = 
      String(oldAssignment.teacherId) !== String(teacherId) ||
      String(oldAssignment.subjectId) !== String(subjectId) ||
      String(oldAssignment.classId) !== String(classId) ||
      String(oldAssignment.year) !== String(year) ||
      String(oldAssignment.semester) !== String(semester);
    
    if (gradeCount > 0 && isChanged) {
      return res.status(403).json({ 
        error: `Không thể thay đổi phân công này vì đã có ${gradeCount} điểm được nhập. Vui lòng xóa tất cả điểm trước khi thay đổi phân công.`,
        gradeCount,
        locked: true
      });
    }
    
    // ✅ Kiểm tra nếu là Trưởng bộ môn, chỉ có thể cập nhật phân công cho giáo viên trong tổ
    if (req.user && req.user.role === 'teacher' && req.user.teacherFlags?.isDepartmentHead) {
      const Teacher = require('../../models/user/teacher');
      const currentTeacher = await Teacher.findOne({ accountId: req.user.accountId }).lean();
      const targetTeacher = await Teacher.findById(teacherId).lean();
      
      if (!currentTeacher || !targetTeacher) {
        return res.status(404).json({ error: "Không tìm thấy thông tin giáo viên" });
      }
      
      // Kiểm tra giáo viên được phân công có thuộc tổ không
      if (!currentTeacher.departmentId || !targetTeacher.departmentId) {
        return res.status(403).json({ 
          error: "Chỉ có thể cập nhật phân công cho giáo viên trong tổ bộ môn của bạn" 
        });
      }
      
      const currentDeptId = String(currentTeacher.departmentId._id || currentTeacher.departmentId);
      const targetDeptId = String(targetTeacher.departmentId._id || targetTeacher.departmentId);
      
      if (currentDeptId !== targetDeptId) {
        return res.status(403).json({ 
          error: "Chỉ có thể cập nhật phân công cho giáo viên trong tổ bộ môn của bạn" 
        });
      }
    }

    // 🔍 Check trùng (ngoại trừ chính nó)
    const exists = await TeachingAssignment.findOne({
      _id: { $ne: id },
      classId,
      subjectId,
      year,
      semester,
    });
    if (exists) {
      return res.status(400).json({
        error: "Lớp này đã được phân công cho môn học này trong năm học và học kỳ này!",
      });
    }

    // ✅ Kiểm tra các ràng buộc: môn học, số lớp tối đa, số tiết tối đa/tuần
    // Loại trừ assignment hiện tại khi tính toán
    const validation = await validateTeachingAssignment(teacherId, subjectId, classId, year, semester, id);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // 🔄 Cập nhật assignment
    const updatedAssignment = await TeachingAssignment.findByIdAndUpdate(
      id,
      { teacherId, subjectId, classId, year, semester },
      { new: true }
    )
      .populate("teacherId", "name")
      .populate("subjectId", "name")
      .populate("classId", "className classCode grade year");

    // ✅ Không cần cập nhật teacher.classIds nữa vì đã loại bỏ field này
    // Thông tin phân công lớp được quản lý qua TeachingAssignment

    res.status(200).json(updatedAssignment);
  } catch (err) {
    console.error('❌ Lỗi khi cập nhật phân công:', err);
    res.status(400).json({
      error: "Lỗi khi cập nhật phân công",
      details: err.message,
    });
  }
};


// GET /teachingAssignments/:id/grade-count - Kiểm tra số lượng điểm của phân công
exports.getGradeCount = async (req, res) => {
  try {
    const { id } = req.params;
    
    const assignment = await TeachingAssignment.findById(id).lean();
    if (!assignment) {
      return res.status(404).json({ error: "Không tìm thấy phân công" });
    }
    
    const GradeItem = require('../../models/grade/gradeItem');
    const gradeCount = await GradeItem.countDocuments({
      subjectId: assignment.subjectId,
      classId: assignment.classId,
      schoolYear: assignment.year,
      semester: assignment.semester,
    });
    
    res.status(200).json({ 
      gradeCount,
      locked: gradeCount > 0 
    });
  } catch (err) {
    res.status(400).json({ 
      error: "Lỗi khi kiểm tra số lượng điểm", 
      details: err.message 
    });
  }
};

exports.deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    
    // ✅ Lấy assignment trước khi xóa để kiểm tra quyền
    const assignment = await TeachingAssignment.findById(id).populate('teacherId').lean();
    if (!assignment) {
      return res.status(404).json({ message: "Không tìm thấy phân công" });
    }
    
    // 🔒 Kiểm tra xem đã có điểm nào được nhập cho phân công này chưa
    const GradeItem = require('../../models/grade/gradeItem');
    const gradeCount = await GradeItem.countDocuments({
      subjectId: assignment.subjectId,
      classId: assignment.classId,
      schoolYear: assignment.year,
      semester: assignment.semester,
    });
    
    if (gradeCount > 0) {
      return res.status(403).json({ 
        error: `Không thể xóa phân công này vì đã có ${gradeCount} điểm được nhập. Vui lòng xóa tất cả điểm trước khi xóa phân công.`,
        gradeCount,
        locked: true
      });
    }
    
    // ✅ Kiểm tra nếu là Trưởng bộ môn, chỉ có thể xóa phân công cho giáo viên trong tổ
    if (req.user && req.user.role === 'teacher' && req.user.teacherFlags?.isDepartmentHead) {
      const Teacher = require('../../models/user/teacher');
      const currentTeacher = await Teacher.findOne({ accountId: req.user.accountId }).lean();
      const targetTeacherId = assignment.teacherId?._id?.toString() || assignment.teacherId?.toString();
      const targetTeacher = await Teacher.findById(targetTeacherId).lean();
      
      if (!currentTeacher || !targetTeacher) {
        return res.status(404).json({ error: "Không tìm thấy thông tin giáo viên" });
      }
      
      // Kiểm tra giáo viên được phân công có thuộc tổ không
      if (!currentTeacher.departmentId || !targetTeacher.departmentId) {
        return res.status(403).json({ 
          error: "Chỉ có thể xóa phân công cho giáo viên trong tổ bộ môn của bạn" 
        });
      }
      
      const currentDeptId = String(currentTeacher.departmentId._id || currentTeacher.departmentId);
      const targetDeptId = String(targetTeacher.departmentId._id || targetTeacher.departmentId);
      
      if (currentDeptId !== targetDeptId) {
        return res.status(403).json({ 
          error: "Chỉ có thể xóa phân công cho giáo viên trong tổ bộ môn của bạn" 
        });
      }
    }
    
    const deletedAssignment = await TeachingAssignment.findByIdAndDelete(id);

    if (!deletedAssignment) {
      return res.status(404).json({ message: "Không tìm thấy phân công" });
    }

    // ✅ Không cần cập nhật teacher.classIds nữa vì đã loại bỏ field này
    // Thông tin phân công lớp được quản lý qua TeachingAssignment

    res.status(200).json({ message: "Xóa phân công thành công" });
  } catch (err) {
    res
      .status(400)
      .json({ message: "Lỗi khi xóa phân công", error: err.message });
  }
};
exports.createBulkAssignments = async (req, res) => {
  try {
    const payloads = req.body; // mảng TeachingAssignmentPayload
    if (!Array.isArray(payloads) || payloads.length === 0) {
      return res.status(400).json({ message: "Dữ liệu phải là mảng và không rỗng" });
    }

    // ✅ Validate duplicate - Tối ưu: Query một lần thay vì loop
    const existingKeys = new Set();
    if (payloads.length > 0) {
      const existing = await TeachingAssignment.find({
        $or: payloads.map(p => ({
          classId: p.classId,
          subjectId: p.subjectId,
          year: p.year,
          semester: p.semester,
        }))
      });
      
      existing.forEach(e => {
        const key = `${e.classId}-${e.subjectId}-${e.year}-${e.semester}`;
        existingKeys.add(key);
      });
    }

    // ✅ Lọc các payload chưa tồn tại và validate từng assignment
    const validAssignments = [];
    const errors = [];

    for (const p of payloads) {
      const key = `${p.classId}-${p.subjectId}-${p.year}-${p.semester}`;
      
      // Kiểm tra trùng
      if (existingKeys.has(key)) {
        errors.push({
          assignment: p,
          error: "Phân công này đã tồn tại"
        });
        continue;
      }

      // Kiểm tra các ràng buộc
      if (!p.teacherId || !p.subjectId || !p.classId || !p.year || !p.semester) {
        errors.push({
          assignment: p,
          error: "Thiếu thông tin bắt buộc"
        });
        continue;
      }

      const validation = await validateTeachingAssignment(
        p.teacherId, 
        p.subjectId, 
        p.classId, 
        p.year, 
        p.semester
      );

      if (!validation.valid) {
        errors.push({
          assignment: p,
          error: validation.error
        });
        continue;
      }

      validAssignments.push(p);
    }

    if (validAssignments.length === 0) {
      return res.status(400).json({ 
        message: "Không có phân công nào hợp lệ", 
        errors: errors,
        assignments: [] 
      });
    }

    // ✅ Insert nhiều phân công
    const assignments = await TeachingAssignment.insertMany(validAssignments);

    // ✅ Không cần cập nhật teacher.classIds nữa vì đã loại bỏ field này
    // Thông tin phân công lớp được quản lý qua TeachingAssignment

    // ✅ Populate và trả về kết quả đầy đủ
    const populated = await TeachingAssignment.find({
      _id: { $in: assignments.map(a => a._id) }
    })
      .populate("teacherId", "name availableMatrix")
      .populate("subjectId", "name")
      .populate("classId", "className classCode grade year");

    res.status(201).json({
      message: `Đã tạo ${populated.length} phân công thành công${errors.length > 0 ? `, ${errors.length} phân công không hợp lệ` : ''}`,
      assignments: populated,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error("❌ Lỗi bulk insert:", error);
    res.status(500).json({ 
      message: "Lỗi bulk insert", 
      error: error.message 
    });
  }
};
exports.getAssignmentsByTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;
    let { year, semester } = req.query; // lấy query params

    console.log(`[getAssignmentsByTeacher] Request params:`, {
      teacherId,
      year,
      semester,
      query: req.query
    });

    // ✅ Decode year nếu có ký tự đặc biệt
    if (year) {
      year = decodeURIComponent(year);
    }
    
    // ✅ Decode semester nếu có ký tự đặc biệt
    if (semester) {
      semester = decodeURIComponent(semester);
    }

    // ✅ Kiểm tra quyền truy cập
    const user = req.user;
    const userRole = user?.role;
    
    // Nếu là giáo viên thông thường (không phải admin/BGH/QLBM), chỉ cho phép xem của chính mình
    if (userRole === 'teacher' && !user?.teacherFlags?.isDepartmentHead && !user?.teacherFlags?.isLeader) {
      // Lấy teacherId của user hiện tại
      const currentTeacher = await Teacher.findOne({ accountId: user.accountId }).lean();
      if (!currentTeacher) {
        return res.status(404).json({ message: 'Không tìm thấy thông tin giáo viên' });
      }
      
      const currentTeacherId = currentTeacher._id.toString();
      const requestedTeacherId = teacherId.toString();
      
      // Chỉ cho phép xem assignments của chính mình
      if (currentTeacherId !== requestedTeacherId) {
        return res.status(403).json({ 
          message: 'Bạn chỉ có quyền xem phân công giảng dạy của chính mình' 
        });
      }
    }
    
    // Nếu là QLBM, cho phép xem assignments của giáo viên trong tổ
    if (userRole === 'teacher' && user?.teacherFlags?.isDepartmentHead && !user?.teacherFlags?.isLeader) {
      const currentTeacher = await Teacher.findOne({ accountId: user.accountId }).lean();
      const targetTeacher = await Teacher.findById(teacherId).lean();
      
      if (!currentTeacher || !targetTeacher) {
        return res.status(404).json({ message: 'Không tìm thấy thông tin giáo viên' });
      }
      
      // Nếu không phải chính mình, kiểm tra xem có cùng tổ không
      const currentTeacherId = currentTeacher._id.toString();
      const requestedTeacherId = teacherId.toString();
      
      if (currentTeacherId !== requestedTeacherId) {
        // Kiểm tra cùng tổ bộ môn
        const currentDeptId = currentTeacher.departmentId?._id?.toString() || currentTeacher.departmentId?.toString();
        const targetDeptId = targetTeacher.departmentId?._id?.toString() || targetTeacher.departmentId?.toString();
        
        if (!currentDeptId || !targetDeptId || currentDeptId !== targetDeptId) {
          return res.status(403).json({ 
            message: 'Bạn chỉ có quyền xem phân công giảng dạy của giáo viên trong tổ bộ môn của bạn' 
          });
        }
      }
    }

    // Build filter
    const filter = { teacherId };
    if (year) filter.year = year;
    if (semester) filter.semester = semester;

    console.log(`[getAssignmentsByTeacher] Filter:`, filter);

    const assignments = await TeachingAssignment.find(filter)
      .populate('teacherId', 'name availableMatrix')
      .populate('subjectId', 'name')
      .populate('classId', 'className classCode grade year');

    console.log(`[getAssignmentsByTeacher] Found ${assignments?.length || 0} assignments`);

    // ✅ Trả về mảng rỗng thay vì 404 khi không có assignments
    res.status(200).json(assignments || []);
  } catch (err) {
    res.status(400).json({ message:"Lỗi khi lấy danh sách", error: err.message });
  }
};

/**
 * ✅ Kiểm tra môn học thiếu giáo viên
 * So sánh ClassPeriods với TeachingAssignment để phát hiện các lớp/môn chưa có giáo viên
 */
exports.checkMissingTeachers = async (req, res) => {
  try {
    const { year, semester, grade } = req.query;

    if (!year || !semester) {
      return res.status(400).json({ 
        error: 'Thiếu thông tin: year và semester là bắt buộc' 
      });
    }

    // 1️⃣ Lấy tất cả lớp theo grade và year
    const classFilter = { year };
    if (grade) classFilter.grade = grade;

    const classes = await Class.find(classFilter)
      .select('_id className classCode grade year')
      .lean();

    if (classes.length === 0) {
      return res.status(200).json({
        message: 'Không có lớp học nào',
        missingAssignments: [],
        summary: {
          totalClasses: 0,
          totalMissing: 0,
          bySubject: {}
        }
      });
    }

    const classIds = classes.map(c => c._id);
    const classMap = new Map(classes.map(c => [c._id.toString(), c]));

    // 2️⃣ Lấy ClassPeriods để biết số tiết cần dạy
    const classPeriodsList = await ClassPeriods.find({
      classId: { $in: classIds },
      year,
      semester,
    }).lean();

    // 3️⃣ Lấy TeachingAssignment để biết giáo viên đã được phân công
    const assignments = await TeachingAssignment.find({
      classId: { $in: classIds },
      year,
      semester,
    })
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name teacherCode')
      .lean();

    // 4️⃣ Tạo map để tra cứu nhanh: classId + subjectId -> assignment
    const assignmentMap = new Map();
    assignments.forEach(a => {
      const classIdStr = a.classId?._id ? a.classId._id.toString() : a.classId.toString();
      const subjectIdStr = a.subjectId?._id ? a.subjectId._id.toString() : a.subjectId.toString();
      const key = `${classIdStr}-${subjectIdStr}`;
      assignmentMap.set(key, a);
    });

    // 5️⃣ So sánh và phát hiện môn thiếu giáo viên
    const missingAssignments = [];
    const subjectStats = new Map(); // Thống kê theo môn

    for (const classPeriods of classPeriodsList) {
      const classInfo = classMap.get(classPeriods.classId.toString());
      if (!classInfo) continue;

      // Duyệt qua tất cả môn học trong ClassPeriods
      if (classPeriods.subjectPeriods) {
        let subjectPeriodsEntries = [];
        
        // Xử lý cả Map và Object
        if (classPeriods.subjectPeriods instanceof Map) {
          subjectPeriodsEntries = Array.from(classPeriods.subjectPeriods.entries());
        } else if (typeof classPeriods.subjectPeriods === 'object') {
          subjectPeriodsEntries = Object.entries(classPeriods.subjectPeriods);
        }

        for (const [subjectId, requiredPeriods] of subjectPeriodsEntries) {
          if (!requiredPeriods || requiredPeriods === 0) continue;

          const key = `${classPeriods.classId.toString()}-${subjectId}`;
          const assignment = assignmentMap.get(key);

          if (!assignment) {
            // Thiếu giáo viên hoàn toàn
            missingAssignments.push({
              classId: classPeriods.classId,
              className: classInfo.className,
              classCode: classInfo.classCode,
              grade: classInfo.grade,
              subjectId: subjectId,
              requiredPeriods: requiredPeriods,
              assignedPeriods: 0,
              status: 'missing', // Hoàn toàn thiếu
              teacherId: null,
              teacherName: null,
            });

            // Cập nhật thống kê
            if (!subjectStats.has(subjectId)) {
              subjectStats.set(subjectId, {
                subjectId,
                totalRequiredPeriods: 0,
                totalAssignedPeriods: 0,
                missingClasses: [],
              });
            }
            const stats = subjectStats.get(subjectId);
            stats.totalRequiredPeriods += requiredPeriods;
            stats.missingClasses.push({
              classId: classPeriods.classId,
              className: classInfo.className,
              requiredPeriods,
            });
          } else {
            // Có giáo viên - cập nhật thống kê
            if (!subjectStats.has(subjectId)) {
              subjectStats.set(subjectId, {
                subjectId,
                totalRequiredPeriods: 0,
                totalAssignedPeriods: 0,
                missingClasses: [],
              });
            }
            const stats = subjectStats.get(subjectId);
            stats.totalRequiredPeriods += requiredPeriods;
            stats.totalAssignedPeriods += requiredPeriods;
          }
        }
      }
    }

    // 6️⃣ Lấy thông tin môn học để populate tên môn
    const Subject = require('../../models/subject/subject');
    const subjectIds = Array.from(new Set(missingAssignments.map(m => m.subjectId)));
    const subjects = await Subject.find({ _id: { $in: subjectIds } })
      .select('_id name code')
      .lean();

    const subjectMap = new Map(subjects.map(s => [s._id.toString(), s]));

    // Populate tên môn vào missingAssignments
    const missingWithSubjectInfo = missingAssignments.map(m => {
      const subject = subjectMap.get(m.subjectId.toString());
      return {
        ...m,
        subjectName: subject?.name || 'Chưa xác định',
        subjectCode: subject?.code || '',
      };
    });

    // 7️⃣ Tạo summary
    const summary = {
      totalClasses: classes.length,
      totalMissing: missingAssignments.length,
      bySubject: Array.from(subjectStats.entries()).map(([subjectId, stats]) => {
        const subject = subjectMap.get(subjectId.toString());
        return {
          subjectId,
          subjectName: subject?.name || 'Chưa xác định',
          subjectCode: subject?.code || '',
          totalRequiredPeriods: stats.totalRequiredPeriods,
          totalAssignedPeriods: stats.totalAssignedPeriods,
          missingClassesCount: stats.missingClasses.length,
          missingClasses: stats.missingClasses,
        };
      }),
    };

    res.status(200).json({
      message: `Phát hiện ${missingAssignments.length} lớp/môn thiếu giáo viên`,
      missingAssignments: missingWithSubjectInfo,
      summary,
      filters: { year, semester, grade: grade || 'Tất cả' },
    });

  } catch (err) {
    console.error('❌ Lỗi khi kiểm tra môn thiếu giáo viên:', err);
    res.status(500).json({
      error: 'Lỗi khi kiểm tra môn thiếu giáo viên',
      details: err.message,
    });
  }
};
