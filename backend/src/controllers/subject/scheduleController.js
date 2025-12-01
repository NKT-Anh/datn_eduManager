const Schedule = require("../../models/subject/schedule");
const TeachingAssignment = require("../../models/subject/teachingAssignment");
const Class = require("../../models/class/class");
const { getCurrentSchoolYear } = require("../../utils/schoolYearHelper");
exports.getAllSchedules = async (req, res) => {
  try {
    // ✅ Kiểm tra quyền: Admin/BGH có thể xem tất cả, Student/Teacher chỉ xem lịch đã khóa
    const userRole = req.user?.role;
    const isAdmin = userRole === 'admin' || userRole === 'bgh';

    const query = {};

    // ✅ Soft Delete: Filter isDeleted != true mặc định (bao gồm false, null, không có trường)
    const { isDeleted = 'false' } = req.query;
    if (isDeleted !== 'true') {
      query.isDeleted = { $ne: true };
    }

    if (!isAdmin) {
      query.isLocked = true;
    }
    
    const schedules = await Schedule.find(query)
      .populate("classId", "className grade")
      .populate("timetable.periods.subject", "name")
      .populate("timetable.periods.teacher", "name");
    res.status(200).json(schedules);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🧩 Lấy thời khóa biểu theo lớp, năm và học kỳ
exports.getScheduleByClass = async (req, res) => {
  try {
    const { classId, year, semester } = req.params;
    
    // ✅ Validate input
    if (!classId || !year || !semester) {
      return res.status(400).json({ message: "Thiếu tham số: classId, year, semester là bắt buộc." });
    }
    
    // ✅ Kiểm tra quyền: Admin/BGH có thể xem tất cả (kể cả chưa khóa), Student/Teacher chỉ xem lịch đã khóa
    const userRole = req.user?.role;
    const isAdmin = userRole === 'admin' || userRole === 'bgh';
    
    const query = { 
      classId: classId,
      year: year,
      semester: semester 
    };
    
    // ✅ Nếu không phải Admin/BGH → chỉ lấy lịch đã khóa
    if (!isAdmin) {
      query.isLocked = true;
    }
    
    const schedule = await Schedule.findOne(query)
      .populate("classId", "className classCode grade")
      .populate("timetable.periods.subject", "name code")
      .populate("timetable.periods.teacher", "name");
    
    // ✅ Nếu không tìm thấy schedule
    if (!schedule) {
      // ✅ Nếu không phải Admin và không tìm thấy → có thể là lịch chưa khóa
      if (!isAdmin) {
        return res.status(404).json({ 
          message: "Thời khóa biểu chưa được công bố.",
          classId,
          year,
          semester,
          hint: "Lịch học của lớp này chưa được khóa và công bố. Vui lòng liên hệ quản trị viên."
        });
      }
      
      return res.status(404).json({ 
        message: "Không tìm thấy thời khóa biểu.",
        classId,
        year,
        semester,
        hint: "Có thể chưa tạo lịch cho lớp này. Vui lòng tạo lịch trước."
      });
    }
    
    res.status(200).json(schedule);
  } catch (err) {
    console.error("❌ Lỗi khi lấy thời khóa biểu:", err);
    res.status(500).json({ message: err.message || "Lỗi server khi lấy thời khóa biểu" });
  }
};

// 🧩 Tạo thời khóa biểu
exports.createSchedule = async (req, res) => {
  try {
    const { classId, timetable, year, semester } = req.body;

    if (!classId || !timetable || !year || !semester)
      return res.status(400).json({ message: "Thiếu dữ liệu bắt buộc." });

    // 🔒 Ràng buộc: Không được tạo thời khóa biểu nếu chưa có năm học active
    const SchoolYear = require('../../models/schoolYear');
    const activeYearCode = await getCurrentSchoolYear();
    
    if (!activeYearCode) {
      return res.status(400).json({ 
        message: "Không thể tạo thời khóa biểu. Vui lòng kích hoạt một năm học trước." 
      });
    }

    // ✅ Lấy thông tin năm học active để kiểm tra
    const activeYear = await SchoolYear.findOne({ isActive: true });
    if (!activeYear) {
      return res.status(400).json({ 
        message: "Không thể tạo thời khóa biểu. Vui lòng kích hoạt một năm học trước." 
      });
    }

    // Kiểm tra năm học được chọn có phải là năm học active không
    if (year !== activeYear.code) {
      return res.status(400).json({ 
        message: `Chỉ có thể tạo thời khóa biểu cho năm học đang hoạt động: ${activeYear.name} (${activeYear.code})` 
      });
    }

    // Lấy tên lớp để hiển thị (nếu có)
    const cls = await Class.findById(classId);
    const className = cls ? cls.className : undefined;

    const newSchedule = new Schedule({
      classId,
      className,
      timetable,
      year,
      semester,
    });

    await newSchedule.save();
    res.status(201).json(newSchedule);
  } catch (err) {
    console.error("❌ Lỗi khi tạo schedule:", err);
    res.status(500).json({ message: err.message });
  }
};

// 🧩 Cập nhật thời khóa biểu
exports.updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { timetable } = req.body;

    // ✅ Lấy schedule hiện tại để lấy classId, year, semester
    const existingSchedule = await Schedule.findById(id);
    if (!existingSchedule) {
      return res.status(404).json({ message: "Không tìm thấy thời khóa biểu." });
    }

    // ✅ Kiểm tra nếu schedule đã khóa thì không cho phép cập nhật
    if (existingSchedule.isLocked === true) {
      return res.status(403).json({ 
        message: "Thời khóa biểu đã được khóa. Không thể chỉnh sửa. Vui lòng mở khóa trước khi chỉnh sửa." 
      });
    }

    // ✅ Validate: Kiểm tra môn học và giáo viên phải khớp với TeachingAssignment
    const classId = existingSchedule.classId;
    const year = existingSchedule.year;
    const semester = existingSchedule.semester;

    // Lấy tất cả TeachingAssignment cho lớp này
    const assignments = await TeachingAssignment.find({
      classId: classId,
      year: year,
      semester: semester
    })
      .populate('teacherId', 'name')
      .populate('subjectId', 'name');

    // Tạo map để kiểm tra nhanh: subjectId -> teacherId
    const assignmentMap = new Map();
    assignments.forEach(a => {
      if (a.subjectId && a.teacherId) {
        const subjectId = a.subjectId._id ? a.subjectId._id.toString() : a.subjectId.toString();
        const teacherId = a.teacherId._id ? a.teacherId._id.toString() : a.teacherId.toString();
        assignmentMap.set(subjectId, teacherId);
      }
    });

    // ✅ Kiểm tra từng period trong timetable
    if (timetable && Array.isArray(timetable)) {
      for (const dayEntry of timetable) {
        if (!dayEntry.periods || !Array.isArray(dayEntry.periods)) continue;
        
        for (const period of dayEntry.periods) {
          // Bỏ qua nếu không có subject hoặc teacher
          if (!period.subject || !period.teacher) continue;
          
          // Bỏ qua các hoạt động chung (không có trong TeachingAssignment)
          const ignoreSubjects = ["Hoạt động", "Chào cờ", "Sinh hoạt", "Thể dục toàn trường"];
          if (ignoreSubjects.some(s => period.subject.includes(s))) continue;

          // Tìm subjectId từ tên môn học
          const assignment = assignments.find(a => {
            if (!a.subjectId) return false;
            const subjectName = a.subjectId.name || '';
            return subjectName === period.subject;
          });

          if (!assignment) {
            // Nếu không tìm thấy assignment, có thể là môn học không được phân công
            // Cho phép nhưng cảnh báo
            console.warn(`⚠️ Môn học "${period.subject}" không có trong bảng phân công cho lớp này`);
            continue;
          }

          // Kiểm tra giáo viên có khớp với assignment không
          const expectedTeacherId = assignment.teacherId._id 
            ? assignment.teacherId._id.toString() 
            : assignment.teacherId.toString();
          
          const actualTeacherId = period.teacherId 
            ? period.teacherId.toString() 
            : null;

          // Nếu có teacherId trong period, kiểm tra khớp
          if (actualTeacherId && actualTeacherId !== expectedTeacherId) {
            // Kiểm tra xem tên giáo viên có khớp không (fallback)
            const expectedTeacherName = assignment.teacherId.name || '';
            if (period.teacher !== expectedTeacherName) {
              return res.status(400).json({
                message: `Môn học "${period.subject}" phải được dạy bởi giáo viên "${expectedTeacherName}" theo bảng phân công, không được thay đổi.`,
                subject: period.subject,
                expectedTeacher: expectedTeacherName,
                actualTeacher: period.teacher
              });
            }
          } else if (!actualTeacherId) {
            // Nếu không có teacherId, kiểm tra tên giáo viên
            const expectedTeacherName = assignment.teacherId.name || '';
            if (period.teacher !== expectedTeacherName) {
              return res.status(400).json({
                message: `Môn học "${period.subject}" phải được dạy bởi giáo viên "${expectedTeacherName}" theo bảng phân công, không được thay đổi.`,
                subject: period.subject,
                expectedTeacher: expectedTeacherName,
                actualTeacher: period.teacher
              });
            }
          }
        }
      }
    }

    const updated = await Schedule.findByIdAndUpdate(
      id,
      { timetable },
      { new: true }
    );
    res.status(200).json(updated);
  } catch (err) {
    console.error("❌ Lỗi khi cập nhật thời khóa biểu:", err);
    res.status(500).json({ message: err.message });
  }
};

// 🧩 Xóa thời khóa biểu
// ✅ Soft Delete - Xóa mềm thời khóa biểu (chỉ đánh dấu, không xóa thật)
exports.deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await Schedule.findById(id);
    
    if (!schedule) {
      return res.status(404).json({ message: "Không tìm thấy thời khóa biểu" });
    }

    // ✅ Đánh dấu isDeleted = true (soft delete)
    schedule.isDeleted = true;
    await schedule.save();

    res.status(200).json({ 
      message: "Đã xóa thời khóa biểu thành công (soft delete)",
      schedule: schedule
    });
  } catch (err) {
    console.error('❌ Lỗi khi xóa thời khóa biểu:', err);
    res.status(500).json({ message: err.message });
  }
};


// ✅ Soft Delete - Xóa mềm thời khóa biểu theo khối/năm học/học kỳ
exports.deleteScheduleByGradeYearSemester = async (req, res) => {
  try {
    const { year, semester, grade } = req.body;

    if (!year || !semester || !grade) {
      return res.status(400).json({ message: "Thiếu thông tin year/semester/grade" });
    }

    // Lấy tất cả lớp của khối
    const classes = await Class.find({ grade });
    const classIds = classes.map(c => c._id);

    // ✅ Soft Delete - Đánh dấu isDeleted = true (không xóa vĩnh viễn)
    const result = await Schedule.updateMany(
      {
        classId: { $in: classIds },
        year,
        semester,
        isDeleted: { $ne: true } // Chỉ cập nhật các bản ghi chưa bị xóa
      },
      {
        $set: { isDeleted: true }
      }
    );

    res.status(200).json({ 
      message: "Đã xóa TKB thành công (soft delete)", 
      deletedCount: result.modifiedCount 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi khi xóa TKB" });
  }
};

// 🧩 Lấy toàn bộ thời khóa biểu theo năm học (ví dụ: /api/schedules/year/2022-2023)
// 🧩 Lấy tất cả thời khóa biểu theo năm học và học kỳ (toàn trường)
// 🧩 Lấy TKB theo Năm + Học kỳ (toàn trường)
exports.getSchedulesByYearSemester = async (req, res) => {
  try {
    const { year, semester } = req.params;

    if (!year || !semester) {
      return res.status(400).json({ message: "Thiếu thông tin year/semester" });
    }

    // ✅ Kiểm tra quyền: Admin/BGH có thể xem tất cả, Student/Teacher chỉ xem lịch đã khóa
    const userRole = req.user?.role;
    const isAdmin = userRole === 'admin' || userRole === 'bgh';
    
    const query = { year, semester };
    if (!isAdmin) {
      query.isLocked = true;
    }

    const schedules = await Schedule.find(query)
      .populate("classId", "className grade")
      .populate("timetable.periods.subject", "name")
      .populate("timetable.periods.teacher", "name");

    res.status(200).json(schedules);
  } catch (err) {
    console.error("❌ Lỗi khi lấy TKB theo năm học & học kỳ:", err);
    res.status(500).json({ message: err.message });
  }
};

// 🧩 Lấy TKB theo Khối + Năm + Học kỳ  
exports.getSchedulesByGrade = async (req, res) => {
  try {
    const { grade, year, semester } = req.params;

    if (!grade || !year || !semester) {
      return res.status(400).json({ message: "Thiếu thông tin grade/year/semester" });
    }

    // Tìm tất cả lớp thuộc khối
    const classes = await Class.find({ grade });
    if (!classes.length)
      return res.status(404).json({ message: "Không tìm thấy lớp cho khối này." });

    const classIds = classes.map((c) => c._id);

    // ✅ Kiểm tra quyền: Admin/BGH có thể xem tất cả, Student/Teacher chỉ xem lịch đã khóa
    const userRole = req.user?.role;
    const isAdmin = userRole === 'admin' || userRole === 'bgh';
    
    const query = {
      classId: { $in: classIds },
      year,
      semester,
    };
    if (!isAdmin) {
      query.isLocked = true;
    }
    
    // Lấy tất cả TKB của các lớp thuộc khối đó
    const schedules = await Schedule.find(query)
      .populate("classId", "className grade")
      .populate("timetable.periods.subject", "name")
      .populate("timetable.periods.teacher", "name");

    res.status(200).json(schedules);
  } catch (err) {
    console.error("❌ Lỗi khi lấy TKB theo khối:", err);
    res.status(500).json({ message: err.message });
  }
};

// 🧩 Lấy TKB theo giáo viên (theo teacherId để tránh trùng tên)
exports.getScheduleByTeacher = async (req, res) => {
  try {
    const { teacherId, year, semester } = req.params;

    if (!teacherId || !year || !semester) {
      return res.status(400).json({ message: 'Thiếu thông tin teacherId/year/semester' });
    }

    // ✅ Kiểm tra quyền: Giáo viên chỉ xem lịch của mình, Admin/BGH xem tất cả
    const userRole = req.user?.role;
    const accountId = req.user?.accountId || req.user?._id;
    const isAdmin = userRole === 'admin' || userRole === 'bgh';
    
    // ✅ Nếu là giáo viên, kiểm tra teacherId có phải của mình không
    if (userRole === 'teacher' && !isAdmin) {
      const Teacher = require('../../models/user/teacher');
      const teacher = await Teacher.findOne({ accountId }).lean();
      if (!teacher || String(teacher._id) !== String(teacherId)) {
        return res.status(403).json({ message: 'Bạn chỉ có thể xem lịch giảng dạy của chính mình' });
      }
    }
    
    const query = { year, semester };
    if (!isAdmin) {
      query.isLocked = true;
    }
    
    // Lấy tên giáo viên từ teacherId (để fallback nếu period không có teacherId)
    const Teacher = require('../../models/user/teacher');
    const teacher = await Teacher.findById(teacherId).select('name').lean();
    const teacherName = teacher?.name || '';

    // Lấy tất cả TKB theo năm và học kỳ
    const allSchedules = await Schedule.find(query)
      .populate("classId", "className grade classCode")
      .lean();

    // Lọc các Schedule có chứa giáo viên này trong timetable (theo teacherId)
    const teacherSchedules = allSchedules
      .map(schedule => {
        // Tạo bảng TKB mới chỉ chứa các tiết của giáo viên này
        const filteredTimetable = schedule.timetable
          .map(dayEntry => {
            const filteredPeriods = dayEntry.periods
              .map((period, idx) => {
                // ✅ Kiểm tra theo teacherId (ưu tiên) hoặc teacher name (fallback)
                const periodTeacherId = period.teacherId?.toString();
                const periodTeacherName = period.teacher || '';
                
                // Ưu tiên kiểm tra theo teacherId
                if (periodTeacherId && periodTeacherId === String(teacherId)) {
                  return {
                    ...period,
                    periodIndex: idx + 1,
                  };
                }
                // Fallback: Nếu không có teacherId, kiểm tra theo tên (backward compatible)
                if (!periodTeacherId && periodTeacherName && teacherName && periodTeacherName.includes(teacherName)) {
                  return {
                    ...period,
                    periodIndex: idx + 1,
                  };
                }
                return null;
              })
              .filter(p => p !== null);

            return filteredPeriods.length > 0 ? {
              day: dayEntry.day,
              periods: filteredPeriods,
            } : null;
          })
          .filter(day => day !== null);

        return filteredTimetable.length > 0 ? {
          ...schedule,
          timetable: filteredTimetable,
        } : null;
      })
      .filter(s => s !== null);

    res.status(200).json(teacherSchedules);
  } catch (err) {
    console.error("❌ Lỗi khi lấy TKB theo giáo viên:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Khóa/Mở khóa thời khóa biểu - Chỉ Admin
exports.lockSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { isLocked } = req.body; // true = khóa, false = mở khóa
    
    const schedule = await Schedule.findById(id);
    if (!schedule) {
      return res.status(404).json({ message: "Không tìm thấy thời khóa biểu." });
    }
    
    schedule.isLocked = isLocked !== undefined ? isLocked : true;
    await schedule.save();
    
    res.status(200).json({
      message: isLocked ? "Đã khóa thời khóa biểu. Học sinh và giáo viên có thể xem." : "Đã mở khóa thời khóa biểu.",
      schedule
    });
  } catch (err) {
    console.error("❌ Lỗi khi khóa/mở khóa thời khóa biểu:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Khóa/Mở khóa tất cả lịch trong năm học + học kỳ - Chỉ Admin
exports.lockAllSchedules = async (req, res) => {
  try {
    const { year, semester, isLocked } = req.body;
    
    if (!year || !semester) {
      return res.status(400).json({ message: "Thiếu thông tin: year và semester là bắt buộc." });
    }

    const lockValue = typeof isLocked === "boolean" ? isLocked : true;
    
    const result = await Schedule.updateMany(
      { year, semester },
      { $set: { isLocked: lockValue } }
    );
    
    res.status(200).json({
      message: lockValue
        ? `Đã khóa ${result.modifiedCount} thời khóa biểu trong năm học ${year}, học kỳ ${semester}.`
        : `Đã mở khóa ${result.modifiedCount} thời khóa biểu trong năm học ${year}, học kỳ ${semester}.`,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
      isLocked: lockValue
    });
  } catch (err) {
    console.error("❌ Lỗi khi khóa/mở khóa tất cả lịch:", err);
    res.status(500).json({ message: err.message });
  }
};