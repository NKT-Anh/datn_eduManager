const Attendance = require('../../models/class/attendance');
const Student = require('../../models/user/student');
const Class = require('../../models/class/class');
const Subject = require('../../models/subject/subject');
const TeachingAssignment = require('../../models/subject/teachingAssignment');
const Setting = require('../../models/settings');

/**
 * 📋 Điểm danh cho một lớp trong một tiết học cụ thể
 * POST /attendance/take
 * Body: { classId, subjectId, date, period, attendances: [{ studentId, status, notes }], schoolYear, semester }
 */
exports.takeAttendance = async (req, res) => {
  try {
    const { classId, subjectId, date, period, attendances, schoolYear, semester } = req.body;
    const { userId, role } = req.user;

    if (!classId || !subjectId || !date || !period || !Array.isArray(attendances)) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
    }

    // Kiểm tra giáo viên có được phân công dạy lớp này không
    if (role === 'teacher') {
      const assignment = await TeachingAssignment.findOne({
        teacherId: userId,
        classId,
        subjectId,
        year: schoolYear,
        semester,
      });
      if (!assignment) {
        return res.status(403).json({ success: false, message: 'Bạn không được phân công dạy lớp này' });
      }
    }

    // Lấy năm học hiện tại nếu không có
    let currentSchoolYear = schoolYear;
    if (!currentSchoolYear) {
      const settings = await Setting.findOne({}).lean();
      currentSchoolYear = settings?.currentSchoolYear || '2024-2025';
    }

    const results = [];
    const errors = [];

    for (const att of attendances) {
      try {
        const { studentId, status, notes } = att;

        // Kiểm tra học sinh có trong lớp không
        const student = await Student.findById(studentId);
        if (!student || student.classId?.toString() !== classId) {
          errors.push({ studentId, message: 'Học sinh không thuộc lớp này' });
          continue;
        }

        // Tạo hoặc cập nhật điểm danh
        const attendance = await Attendance.findOneAndUpdate(
          {
            studentId,
            classId,
            subjectId,
            date: new Date(date),
            period,
          },
          {
            studentId,
            classId,
            subjectId,
            teacherId: userId,
            date: new Date(date),
            period,
            status: status || 'present',
            notes: notes || null,
            schoolYear: currentSchoolYear,
            semester: semester || '1',
          },
          { new: true, upsert: true }
        );

        results.push(attendance);
      } catch (err) {
        errors.push({ studentId: att.studentId, message: err.message });
      }
    }

    res.json({
      success: true,
      message: `Đã điểm danh ${results.length} học sinh`,
      created: results.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('[takeAttendance]', err);
    res.status(500).json({ success: false, message: 'Lỗi khi điểm danh', error: err.message });
  }
};

/**
 * 📋 Lấy danh sách điểm danh
 * GET /attendance?classId=xxx&date=xxx&subjectId=xxx&studentId=xxx&schoolYear=xxx&semester=xxx
 */
exports.getAttendance = async (req, res) => {
  try {
    const { classId, date, subjectId, studentId, schoolYear, semester, period, teacherId } = req.query;
    const { userId, role } = req.user;

    const query = {};

    // Học sinh chỉ xem được điểm danh của mình
    if (role === 'student') {
      const student = await Student.findOne({ accountId: userId }).lean();
      if (!student) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy học sinh' });
      }
      query.studentId = student._id;
    } else if (studentId) {
      query.studentId = studentId;
    }

    // Giáo viên chỉ xem được lớp mình dạy
    if (role === 'teacher') {
      query.teacherId = userId;
    } else if (teacherId) {
      query.teacherId = teacherId;
    }

    if (classId) query.classId = classId;
    if (subjectId) query.subjectId = subjectId;
    if (schoolYear) query.schoolYear = schoolYear;
    if (semester) query.semester = semester;
    if (period) query.period = Number(period);
    if (date) {
      const dateObj = new Date(date);
      dateObj.setHours(0, 0, 0, 0);
      const nextDay = new Date(dateObj);
      nextDay.setDate(nextDay.getDate() + 1);
      query.date = { $gte: dateObj, $lt: nextDay };
    }

    const attendances = await Attendance.find(query)
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className classCode grade')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name')
      .sort({ date: -1, period: 1, 'studentId.name': 1 })
      .lean();

    res.json({
      success: true,
      count: attendances.length,
      data: attendances,
    });
  } catch (err) {
    console.error('[getAttendance]', err);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy điểm danh', error: err.message });
  }
};

/**
 * 📋 Cập nhật điểm danh (admin hoặc giáo viên đã điểm danh)
 * PUT /attendance/:id
 */
exports.updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const { userId, role } = req.user;

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi điểm danh' });
    }

    // Giáo viên chỉ sửa được điểm danh do mình tạo, admin có thể sửa tất cả
    if (role === 'teacher' && attendance.teacherId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Không có quyền sửa điểm danh này' });
    }

    if (status) attendance.status = status;
    if (notes !== undefined) attendance.notes = notes;

    await attendance.save();

    const updated = await Attendance.findById(id)
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className classCode grade')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name')
      .lean();

    res.json({
      success: true,
      message: 'Cập nhật điểm danh thành công',
      data: updated,
    });
  } catch (err) {
    console.error('[updateAttendance]', err);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật điểm danh', error: err.message });
  }
};

/**
 * 📋 Lấy thống kê điểm danh
 * GET /attendance/stats?studentId=xxx&classId=xxx&schoolYear=xxx&semester=xxx&startDate=xxx&endDate=xxx
 */
exports.getAttendanceStats = async (req, res) => {
  try {
    const { studentId, classId, schoolYear, semester, startDate, endDate } = req.query;
    const { userId, role } = req.user;

    const query = {};
    if (schoolYear) query.schoolYear = schoolYear;
    if (semester) query.semester = semester;

    // Học sinh chỉ xem được thống kê của mình
    if (role === 'student') {
      const student = await Student.findOne({ accountId: userId }).lean();
      if (!student) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy học sinh' });
      }
      query.studentId = student._id;
    } else if (studentId) {
      query.studentId = studentId;
    }

    if (classId) query.classId = classId;

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    const attendances = await Attendance.find(query).lean();

    const stats = {
      total: attendances.length,
      present: attendances.filter(a => a.status === 'present').length,
      absent: attendances.filter(a => a.status === 'absent').length,
      excused: attendances.filter(a => a.status === 'excused').length,
      late: attendances.filter(a => a.status === 'late').length,
      attendanceRate: attendances.length > 0
        ? ((attendances.filter(a => a.status === 'present' || a.status === 'late').length / attendances.length) * 100).toFixed(1)
        : 0,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    console.error('[getAttendanceStats]', err);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy thống kê', error: err.message });
  }
};

/**
 * 📋 Lấy danh sách học sinh trong lớp để điểm danh
 * GET /attendance/class/:classId/students
 */
exports.getStudentsForAttendance = async (req, res) => {
  try {
    const { classId } = req.params;
    const { userId, role } = req.user;

    const classItem = await Class.findById(classId);
    if (!classItem) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học' });
    }

    // Kiểm tra quyền (giáo viên phải được phân công dạy lớp này)
    if (role === 'teacher') {
      const assignment = await TeachingAssignment.findOne({
        teacherId: userId,
        classId,
      });
      if (!assignment && classItem.teacherId?.toString() !== userId) {
        return res.status(403).json({ success: false, message: 'Không có quyền truy cập lớp này' });
      }
    }

    const students = await Student.find({ classId, status: 'active' })
      .select('name studentCode')
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      count: students.length,
      data: students,
    });
  } catch (err) {
    console.error('[getStudentsForAttendance]', err);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách học sinh', error: err.message });
  }
};




