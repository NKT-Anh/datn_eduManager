const Attendance = require('../../models/class/attendance');
const Student = require('../../models/user/student');
const Class = require('../../models/class/class');
const Subject = require('../../models/subject/subject');
const TeachingAssignment = require('../../models/subject/teachingAssignment');
const Setting = require('../../models/settings');

/**
 * 📋 Điểm danh vắng cho lớp chủ nhiệm theo buổi học (sáng/chiều)
 * POST /attendance/take
 * Body: { classId, date, session ('morning' | 'afternoon'), absentStudents: [{ studentId, status, notes }], schoolYear, semester }
 * - GVCN chỉ cần nhập danh sách học sinh VẮNG MẶT
 * - Học sinh không có trong danh sách vắng mặt = có mặt (present)
 * - Admin có thể điểm danh cho bất kỳ lớp nào
 */
exports.takeAttendance = async (req, res) => {
  try {
    const { classId, date, session, absentStudents, schoolYear, semester } = req.body;
    const { role, accountId } = req.user;
    const permissionContext = req.permissionContext || {};

    if (!classId || !date || !session) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc: classId, date, session' });
    }

    if (!['morning', 'afternoon'].includes(session)) {
      return res.status(400).json({ success: false, message: 'Session phải là "morning" hoặc "afternoon"' });
    }

    // ✅ Kiểm tra quyền: GVCN chỉ điểm danh lớp chủ nhiệm
    if (role === 'teacher') {
      const isHomeroom = permissionContext.isHomeroom || false;
      const homeroomClassIds = permissionContext.homeroomClassIds || [];

      if (isHomeroom) {
        // GVCN: Kiểm tra có phải lớp chủ nhiệm không
        if (!homeroomClassIds.includes(String(classId))) {
          return res.status(403).json({ 
            success: false, 
            message: 'Bạn chỉ có thể điểm danh cho lớp chủ nhiệm của mình' 
          });
        }
      } else {
        // Giáo viên bộ môn không được điểm danh (chỉ GVCN)
        return res.status(403).json({ 
          success: false, 
          message: 'Chỉ giáo viên chủ nhiệm mới được điểm danh. Giáo viên bộ môn không cần điểm danh.' 
        });
      }
    }

    // Lấy teacherId từ accountId
    const Teacher = require('../../models/user/teacher');
    const teacher = await Teacher.findOne({ accountId }).lean();
    if (!teacher && role === 'teacher') {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin giáo viên' });
    }
    const teacherId = role === 'admin' ? null : teacher._id;

    // Lấy năm học hiện tại nếu không có
    let currentSchoolYear = schoolYear;
    if (!currentSchoolYear) {
      const settings = await Setting.findOne({}).lean();
      currentSchoolYear = settings?.currentSchoolYear || '2024-2025';
    }

    // ✅ Lấy thông tin lớp để lấy năm học
    const classInfo = await Class.findById(classId).select('year').lean();
    if (!classInfo) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học' });
    }
    
    // ✅ Lấy tất cả học sinh trong lớp - CHỈ lấy học sinh của niên khóa tương ứng
    const allStudents = await Student.find({ 
      classId, 
      status: 'active',
      currentYear: classInfo.year // ✅ CHỈ lấy học sinh có currentYear trùng với năm học của lớp
    }).lean();
    const allStudentIds = allStudents.map(s => String(s._id));

    // Danh sách học sinh vắng mặt (từ request)
    const absentStudentIds = Array.isArray(absentStudents) 
      ? absentStudents.map(a => String(a.studentId || a))
      : [];

    // Danh sách học sinh có mặt = tất cả học sinh - học sinh vắng mặt
    const presentStudentIds = allStudentIds.filter(id => !absentStudentIds.includes(id));

    const results = [];
    const errors = [];
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    // ✅ Lấy danh sách bản ghi cũ để kiểm tra editHistory
    const existingRecords = await Attendance.find({
      classId,
      date: dateObj,
      session,
    }).lean();

    // ✅ Xóa các bản ghi cũ KHÔNG có editHistory (để giữ lại editHistory)
    // Chỉ xóa các bản ghi chưa từng được chỉnh sửa
    const recordsToDelete = existingRecords.filter(rec => 
      !rec.editHistory || rec.editHistory.length === 0
    );
    
    if (recordsToDelete.length > 0) {
      await Attendance.deleteMany({
        _id: { $in: recordsToDelete.map(r => r._id) },
      });
    }

    // ✅ Cập nhật các bản ghi có editHistory (nếu có trong danh sách mới)
    const recordsToUpdate = existingRecords.filter(rec => 
      rec.editHistory && rec.editHistory.length > 0
    );

    for (const existingRecord of recordsToUpdate) {
      const studentId = String(existingRecord.studentId);
      const newRecord = absentStudents.find(a => String(a.studentId || a) === studentId);
      
      if (newRecord) {
        // Cập nhật bản ghi đã có editHistory
        try {
          const updated = await Attendance.findByIdAndUpdate(
            existingRecord._id,
            {
              status: newRecord.status || 'absent',
              notes: newRecord.notes || null,
            },
            { new: true }
          );
          results.push(updated);
        } catch (err) {
          errors.push({ studentId, message: err.message });
        }
      } else {
        // Học sinh đã có mặt → xóa bản ghi (nhưng giữ editHistory trong log)
        await Attendance.findByIdAndDelete(existingRecord._id);
      }
    }

    // ✅ Tạo bản ghi điểm danh cho học sinh VẮNG MẶT (chỉ những học sinh chưa có bản ghi)
    const existingStudentIds = new Set(recordsToUpdate.map(r => String(r.studentId)));
    
    for (const absentItem of absentStudents || []) {
      try {
        const studentId = String(absentItem.studentId || absentItem);
        
        // Bỏ qua nếu đã được cập nhật ở trên
        if (existingStudentIds.has(studentId)) {
          continue;
        }

        const status = absentItem.status || 'absent'; // absent, excused, late
        const notes = absentItem.notes || null;

        // Kiểm tra học sinh có trong lớp không
        if (!allStudentIds.includes(studentId)) {
          errors.push({ studentId, message: 'Học sinh không thuộc lớp này' });
          continue;
        }

        // Tạo bản ghi điểm danh vắng mặt mới
        const attendance = await Attendance.create({
          studentId,
          classId,
          teacherId,
          date: dateObj,
          session,
          status,
          notes,
          schoolYear: currentSchoolYear,
          semester: semester || '1',
        });

        results.push(attendance);
      } catch (err) {
        const studentId = absentItem.studentId || absentItem;
        errors.push({ studentId, message: err.message });
      }
    }

    // ✅ Học sinh có mặt không cần tạo bản ghi (mặc định là prsesent)
    // Nếu cần thống kê, có thể query: học sinh không có bản ghi = present

    res.json({
      success: true,
      message: `Đã điểm danh vắng ${results.length} học sinh cho buổi ${session === 'morning' ? 'sáng' : 'chiều'}. ${presentStudentIds.length} học sinh có mặt.`,
      absentCount: results.length,
      presentCount: presentStudentIds.length,
      totalStudents: allStudents.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('[takeAttendance]', err);
    res.status(500).json({ success: false, message: 'Lỗi khi điểm danh', error: err.message });
  }
};

/**
 * 📋 Lấy danh sách điểm danh
 * GET /attendance?classId=xxx&date=xxx&session=xxx&studentId=xxx&schoolYear=xxx&semester=xxx
 * - Học sinh: Xem điểm danh của mình
 * - GVCN: Xem điểm danh lớp chủ nhiệm
 * - Admin/BGH: Xem tất cả
 */
exports.getAttendance = async (req, res) => {
  try {
    const { classId, date, session, studentId, schoolYear, semester, period, subjectId, teacherId } = req.query;
    const { role, accountId } = req.user;
    const permissionContext = req.permissionContext || {};

    const query = {};

    // ✅ Học sinh chỉ xem được điểm danh của mình
    if (role === 'student') {
      const student = await Student.findOne({ accountId }).lean();
      if (!student) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy học sinh' });
      }
      query.studentId = student._id;
    } else if (studentId) {
      query.studentId = studentId;
    }

    // ✅ GVCN chỉ xem được điểm danh lớp chủ nhiệm
    if (role === 'teacher') {
      const isHomeroom = permissionContext.isHomeroom || false;
      const homeroomClassIds = permissionContext.homeroomClassIds || [];

      if (isHomeroom) {
        // GVCN: Chỉ xem lớp chủ nhiệm
        if (classId && !homeroomClassIds.includes(String(classId))) {
          return res.status(403).json({ 
            success: false, 
            message: 'Bạn chỉ có thể xem điểm danh lớp chủ nhiệm' 
          });
        }
        // Nếu không có classId, lọc theo tất cả lớp chủ nhiệm
        if (!classId && homeroomClassIds.length > 0) {
          query.classId = { $in: homeroomClassIds };
        }
      } else {
        // Giáo viên bộ môn không có quyền xem điểm danh (chỉ GVCN)
        return res.status(403).json({ 
          success: false, 
          message: 'Chỉ giáo viên chủ nhiệm mới được xem điểm danh' 
        });
      }
    }

    // Admin/BGH có thể xem tất cả, không cần filter

    if (classId && role !== 'teacher') query.classId = classId;
    if (session) query.session = session;
    if (subjectId) query.subjectId = subjectId; // Optional - backward compatible
    if (period) query.period = Number(period); // Optional - backward compatible
    if (schoolYear) query.schoolYear = schoolYear;
    if (semester) query.semester = semester;
    if (teacherId) query.teacherId = teacherId;
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
      .populate('teacherId', 'name teacherCode')
      .sort({ date: -1, session: 1, 'studentId.name': 1 })
      .lean();

    // ✅ Lấy danh sách học sinh có mặt (không có trong danh sách vắng mặt)
    let presentStudents = [];
    if (classId && date && session) {
      // ✅ Lấy thông tin lớp để lấy năm học
      const classInfo2 = await Class.findById(classId).select('year').lean();
      
      // ✅ Lấy tất cả học sinh trong lớp - CHỈ lấy học sinh của niên khóa tương ứng
      const allStudents = await Student.find({ 
        classId, 
        status: 'active',
        currentYear: classInfo2?.year // ✅ CHỈ lấy học sinh có currentYear trùng với năm học của lớp
      })
        .select('name studentCode')
        .sort({ name: 1 })
        .lean();
      
      // Học sinh vắng mặt (có bản ghi điểm danh)
      const absentStudentIds = new Set(attendances.map(a => String(a.studentId._id || a.studentId)));
      
      // Học sinh có mặt = tất cả học sinh - học sinh vắng mặt
      presentStudents = allStudents
        .filter(s => !absentStudentIds.has(String(s._id)))
        .map(s => ({
          _id: s._id,
          name: s.name,
          studentCode: s.studentCode,
          status: 'present', // Mặc định có mặt
          date: new Date(date),
          session,
        }));
    }

    res.json({
      success: true,
      count: attendances.length, // Số học sinh vắng mặt
      presentCount: presentStudents.length, // Số học sinh có mặt
      absentData: attendances, // Danh sách học sinh vắng mặt
      presentData: presentStudents, // Danh sách học sinh có mặt (nếu có classId, date, session)
      data: attendances, // Backward compatible
    });
  } catch (err) {
    console.error('[getAttendance]', err);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy điểm danh', error: err.message });
  }
};

/**
 * 📋 Cập nhật điểm danh (GVCN hoặc Admin)
 * PUT /attendance/:id
 * Body: { status?, notes?, reason? } - reason bắt buộc nếu chỉnh sửa điểm danh của ngày trước đó
 */
exports.updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, reason } = req.body;
    const { role, accountId } = req.user;
    const permissionContext = req.permissionContext || {};

    const attendance = await Attendance.findById(id)
      .populate('classId', 'teacherId')
      .lean();
    
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi điểm danh' });
    }

    // ✅ Kiểm tra quyền: GVCN chỉ sửa điểm danh lớp chủ nhiệm
    if (role === 'teacher') {
      const isHomeroom = permissionContext.isHomeroom || false;
      const homeroomClassIds = permissionContext.homeroomClassIds || [];
      const classId = String(attendance.classId?._id || attendance.classId);

      if (!isHomeroom) {
        return res.status(403).json({ 
          success: false, 
          message: 'Chỉ giáo viên chủ nhiệm mới được cập nhật điểm danh' 
        });
      }

      if (!homeroomClassIds.includes(classId)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Bạn chỉ có thể cập nhật điểm danh lớp chủ nhiệm' 
        });
      }
    }

    // ✅ Lấy teacherId từ accountId
    const Teacher = require('../../models/user/teacher');
    const teacher = await Teacher.findOne({ accountId }).lean();
    if (!teacher && role === 'teacher') {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin giáo viên' });
    }
    const editedBy = role === 'admin' ? null : teacher._id;

    // ✅ Kiểm tra nếu chỉnh sửa điểm danh của ngày trước đó → yêu cầu lý do
    const attendanceDate = new Date(attendance.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    attendanceDate.setHours(0, 0, 0, 0);
    const isPastDate = attendanceDate < today;

    if (isPastDate && !reason) {
      return res.status(400).json({ 
        success: false, 
        message: 'Khi chỉnh sửa điểm danh của ngày trước đó, vui lòng cung cấp lý do chỉnh sửa' 
      });
    }

    // ✅ Lưu thông tin cũ để ghi vào editHistory
    const oldStatus = attendance.status;
    const oldNotes = attendance.notes || '';
    const newStatus = status || oldStatus;
    const newNotes = notes !== undefined ? notes : oldNotes;

    // ✅ Kiểm tra có thay đổi không
    const hasChanges = (status && status !== oldStatus) || (notes !== undefined && notes !== oldNotes);

    // ✅ Tạo log chỉnh sửa
    const editLog = {
      editedBy: editedBy,
      editedAt: new Date(),
      reason: reason || (isPastDate ? 'Chỉnh sửa điểm danh ngày trước' : 'Cập nhật điểm danh'),
      oldStatus: oldStatus,
      newStatus: newStatus,
      oldNotes: oldNotes,
      newNotes: newNotes,
    };

    // Cập nhật điểm danh và thêm vào editHistory
    const updated = await Attendance.findByIdAndUpdate(
      id,
      {
        $set: {
          ...(status && { status }),
          ...(notes !== undefined && { notes }),
        },
        ...(hasChanges && { $push: { editHistory: editLog } }), // Chỉ thêm log nếu có thay đổi
      },
      { new: true }
    )
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className classCode grade')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name teacherCode')
      .populate('editHistory.editedBy', 'name teacherCode')
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
 * 📋 Xóa điểm danh (Chỉ Admin)
 * DELETE /attendance/:id
 */
exports.deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;

    if (role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Chỉ admin mới được xóa điểm danh' 
      });
    }

    const attendance = await Attendance.findByIdAndDelete(id);
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi điểm danh' });
    }

    res.json({
      success: true,
      message: 'Đã xóa điểm danh thành công',
    });
  } catch (err) {
    console.error('[deleteAttendance]', err);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa điểm danh', error: err.message });
  }
};

/**
 * 📋 Lấy lịch sử chỉnh sửa điểm danh (BGH/Admin)
 * GET /attendance/edit-history?classId=xxx&startDate=xxx&endDate=xxx&schoolYear=xxx&semester=xxx
 */
exports.getAttendanceEditHistory = async (req, res) => {
  try {
    const { classId, startDate, endDate, schoolYear, semester, studentId } = req.query;
    const { role } = req.user;

    // ✅ Chỉ BGH và Admin mới được xem lịch sử chỉnh sửa
    if (role !== 'admin' && role !== 'teacher') {
      return res.status(403).json({ 
        success: false, 
        message: 'Chỉ BGH và Admin mới được xem lịch sử chỉnh sửa điểm danh' 
      });
    }

    // Kiểm tra nếu là teacher thì phải là BGH (isLeader)
    if (role === 'teacher') {
      const Teacher = require('../../models/user/teacher');
      const teacher = await Teacher.findOne({ accountId: req.user.accountId }).lean();
      if (!teacher || !teacher.isLeader) {
        return res.status(403).json({ 
          success: false, 
          message: 'Chỉ BGH và Admin mới được xem lịch sử chỉnh sửa điểm danh' 
        });
      }
    }

    const query = {
      editHistory: { $exists: true, $ne: [] }, // Chỉ lấy các bản ghi có lịch sử chỉnh sửa
    };

    if (classId) query.classId = classId;
    if (studentId) query.studentId = studentId;
    if (schoolYear) query.schoolYear = schoolYear;
    if (semester) query.semester = semester;

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

    const attendances = await Attendance.find(query)
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className classCode grade')
      .populate('teacherId', 'name teacherCode')
      .populate('editHistory.editedBy', 'name teacherCode')
      .sort({ date: -1, 'editHistory.editedAt': -1 })
      .lean();

    // ✅ Format dữ liệu lịch sử chỉnh sửa
    const editHistory = [];
    attendances.forEach(att => {
      if (att.editHistory && att.editHistory.length > 0) {
        att.editHistory.forEach((edit) => {
          editHistory.push({
            _id: edit._id,
            attendanceId: att._id,
            student: att.studentId ? {
              _id: att.studentId._id,
              name: att.studentId.name,
              studentCode: att.studentId.studentCode,
            } : null,
            class: att.classId ? {
              _id: att.classId._id,
              className: att.classId.className,
            } : null,
            date: att.date,
            session: att.session,
            editedBy: edit.editedBy ? {
              _id: edit.editedBy._id,
              name: edit.editedBy.name,
              teacherCode: edit.editedBy.teacherCode,
            } : null,
            editedAt: edit.editedAt,
            reason: edit.reason,
            oldStatus: edit.oldStatus,
            newStatus: edit.newStatus,
            oldNotes: edit.oldNotes,
            newNotes: edit.newNotes,
          });
        });
      }
    });

    // Sắp xếp theo thời gian chỉnh sửa mới nhất
    editHistory.sort((a, b) => new Date(b.editedAt).getTime() - new Date(a.editedAt).getTime());

    res.json({
      success: true,
      count: editHistory.length,
      data: editHistory,
    });
  } catch (err) {
    console.error('[getAttendanceEditHistory]', err);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy lịch sử chỉnh sửa', error: err.message });
  }
};

/**
 * 📋 Lấy thống kê điểm danh
 * GET /attendance/stats?studentId=xxx&classId=xxx&schoolYear=xxx&semester=xxx&startDate=xxx&endDate=xxx
 * - Học sinh: Thống kê của mình
 * - GVCN: Thống kê lớp chủ nhiệm
 * - Admin/BGH: Thống kê tất cả
 */
exports.getAttendanceStats = async (req, res) => {
  try {
    const { studentId, classId, schoolYear, semester, startDate, endDate, session } = req.query;
    const { role, accountId } = req.user;
    const permissionContext = req.permissionContext || {};

    const query = {};
    if (schoolYear) query.schoolYear = schoolYear;
    if (semester) query.semester = semester;
    if (session) query.session = session;

    // ✅ Học sinh chỉ xem được thống kê của mình
    if (role === 'student') {
      const student = await Student.findOne({ accountId }).lean();
      if (!student) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy học sinh' });
      }
      query.studentId = student._id;
    } else if (studentId) {
      query.studentId = studentId;
    }

    // ✅ GVCN chỉ xem được thống kê lớp chủ nhiệm
    if (role === 'teacher') {
      const isHomeroom = permissionContext.isHomeroom || false;
      const homeroomClassIds = permissionContext.homeroomClassIds || [];

      if (isHomeroom) {
        if (classId && !homeroomClassIds.includes(String(classId))) {
          return res.status(403).json({ 
            success: false, 
            message: 'Bạn chỉ có thể xem thống kê lớp chủ nhiệm' 
          });
        }
        if (!classId && homeroomClassIds.length > 0) {
          query.classId = { $in: homeroomClassIds };
        }
      } else {
        return res.status(403).json({ 
          success: false, 
          message: 'Chỉ giáo viên chủ nhiệm mới được xem thống kê điểm danh' 
        });
      }
    } else if (classId) {
      query.classId = classId;
    }

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

    // Lấy tất cả học sinh trong lớp (để tính số học sinh có mặt)
    let totalStudents = 0;
    if (classId) {
      totalStudents = await Student.countDocuments({ classId, status: 'active' });
    } else if (query.classId && query.classId.$in) {
      totalStudents = await Student.countDocuments({ classId: { $in: query.classId.$in }, status: 'active' });
    }

    const attendances = await Attendance.find(query).lean();

    // ✅ Học sinh có mặt = tổng số học sinh - số học sinh có bản ghi điểm danh (vắng mặt)
    const absentCount = attendances.filter(a => a.status === 'absent').length;
    const excusedCount = attendances.filter(a => a.status === 'excused').length;
    const lateCount = attendances.filter(a => a.status === 'late').length;
    const totalAbsent = attendances.length; // Tổng số bản ghi = tổng số vắng mặt
    const presentCount = totalStudents > 0 ? totalStudents - totalAbsent : 0;

    const stats = {
      totalStudents: totalStudents || 0,
      present: presentCount,
      absent: absentCount,
      excused: excusedCount,
      late: lateCount,
      totalAbsent: totalAbsent, // Tổng số học sinh vắng (absent + excused + late)
      attendanceRate: totalStudents > 0
        ? ((presentCount / totalStudents) * 100).toFixed(1)
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
 * - GVCN: Lấy học sinh lớp chủ nhiệm
 * - Admin: Lấy học sinh bất kỳ lớp nào
 */
exports.getStudentsForAttendance = async (req, res) => {
  try {
    const { classId } = req.params;
    const { role, accountId } = req.user;
    const permissionContext = req.permissionContext || {};

    const classItem = await Class.findById(classId).lean();
    if (!classItem) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học' });
    }

    // ✅ Kiểm tra quyền: GVCN chỉ lấy học sinh lớp chủ nhiệm
    if (role === 'teacher') {
      const isHomeroom = permissionContext.isHomeroom || false;
      const homeroomClassIds = permissionContext.homeroomClassIds || [];

      if (!isHomeroom) {
        return res.status(403).json({ 
          success: false, 
          message: 'Chỉ giáo viên chủ nhiệm mới được điểm danh' 
        });
      }

      if (!homeroomClassIds.includes(String(classId))) {
        return res.status(403).json({ 
          success: false, 
          message: 'Bạn chỉ có thể điểm danh lớp chủ nhiệm của mình' 
        });
      }
    }

    // ✅ Lấy thông tin lớp để lấy năm học
    const classInfo3 = await Class.findById(classId).select('year').lean();
    if (!classInfo3) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học' });
    }
    
    // ✅ Lấy tất cả học sinh trong lớp - CHỈ lấy học sinh của niên khóa tương ứng
    const students = await Student.find({ 
      classId, 
      status: 'active',
      currentYear: classInfo3.year // ✅ CHỈ lấy học sinh có currentYear trùng với năm học của lớp
    })
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

/**
 * 📊 Lấy thống kê điểm danh chi tiết theo lớp (Admin)
 * GET /attendance/stats/by-class?schoolYear=xxx&semester=xxx&startDate=xxx&endDate=xxx
 */
exports.getAttendanceStatsByClass = async (req, res) => {
  try {
    const { schoolYear, semester, startDate, endDate, grade } = req.query;
    const { role } = req.user;

    // Admin và BGH (teacher với isLeader) đều có quyền xem
    if (role === 'teacher') {
      const Teacher = require('../../models/user/teacher');
      const teacher = await Teacher.findOne({ accountId: req.user.accountId }).lean();
      if (!teacher || !teacher.isLeader) {
        return res.status(403).json({ 
          success: false, 
          message: 'Chỉ BGH và Admin mới được xem thống kê chi tiết' 
        });
      }
    } else if (role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Chỉ BGH và Admin mới được xem thống kê chi tiết' 
      });
    }

    // Lấy danh sách lớp
    let classQuery = {};
    if (grade) classQuery.grade = grade;
    const classes = await Class.find(classQuery).lean();

    const statsByClass = [];

    for (const cls of classes) {
      // Lấy số học sinh trong lớp
      const totalStudents = await Student.countDocuments({ classId: cls._id, status: 'active' });

      // Query điểm danh
      const attendanceQuery = {
        classId: cls._id,
      };
      if (schoolYear) attendanceQuery.schoolYear = schoolYear;
      if (semester) attendanceQuery.semester = semester;
      if (startDate || endDate) {
        attendanceQuery.date = {};
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          attendanceQuery.date.$gte = start;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          attendanceQuery.date.$lte = end;
        }
      }

      const attendances = await Attendance.find(attendanceQuery).lean();
      
      const absentCount = attendances.filter(a => a.status === 'absent').length;
      const excusedCount = attendances.filter(a => a.status === 'excused').length;
      const lateCount = attendances.filter(a => a.status === 'late').length;
      const totalAbsent = attendances.length;
      const presentCount = totalStudents > 0 ? totalStudents - totalAbsent : 0;
      const attendanceRate = totalStudents > 0 
        ? ((presentCount / totalStudents) * 100).toFixed(1) 
        : 0;

      statsByClass.push({
        classId: cls._id,
        className: cls.className,
        classCode: cls.classCode,
        grade: cls.grade,
        totalStudents,
        present: presentCount,
        absent: absentCount,
        excused: excusedCount,
        late: lateCount,
        totalAbsent,
        attendanceRate: parseFloat(attendanceRate),
      });
    }

    // Sắp xếp theo tỷ lệ điểm danh
    statsByClass.sort((a, b) => b.attendanceRate - a.attendanceRate);

    res.json({
      success: true,
      data: statsByClass,
    });
  } catch (err) {
    console.error('[getAttendanceStatsByClass]', err);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy thống kê theo lớp', error: err.message });
  }
};

/**
 * 📊 Lấy thống kê điểm danh theo khối (Admin)
 * GET /attendance/stats/by-grade?schoolYear=xxx&semester=xxx&startDate=xxx&endDate=xxx
 */
exports.getAttendanceStatsByGrade = async (req, res) => {
  try {
    const { schoolYear, semester, startDate, endDate } = req.query;
    const { role } = req.user;

    // Admin và BGH (teacher với isLeader) đều có quyền xem
    if (role === 'teacher') {
      const Teacher = require('../../models/user/teacher');
      const teacher = await Teacher.findOne({ accountId: req.user.accountId }).lean();
      if (!teacher || !teacher.isLeader) {
        return res.status(403).json({ 
          success: false, 
          message: 'Chỉ BGH và Admin mới được xem thống kê chi tiết' 
        });
      }
    } else if (role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Chỉ BGH và Admin mới được xem thống kê chi tiết' 
      });
    }

    // Lấy tất cả khối
    const grades = await Class.distinct('grade');
    const statsByGrade = [];

    for (const grade of grades.sort()) {
      // Lấy tất cả lớp trong khối
      const classes = await Class.find({ grade }).lean();
      const classIds = classes.map(c => c._id);

      // Lấy số học sinh trong khối
      const totalStudents = await Student.countDocuments({ 
        classId: { $in: classIds }, 
        status: 'active' 
      });

      // Query điểm danh
      const attendanceQuery = {
        classId: { $in: classIds },
      };
      if (schoolYear) attendanceQuery.schoolYear = schoolYear;
      if (semester) attendanceQuery.semester = semester;
      if (startDate || endDate) {
        attendanceQuery.date = {};
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          attendanceQuery.date.$gte = start;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          attendanceQuery.date.$lte = end;
        }
      }

      const attendances = await Attendance.find(attendanceQuery).lean();
      
      const absentCount = attendances.filter(a => a.status === 'absent').length;
      const excusedCount = attendances.filter(a => a.status === 'excused').length;
      const lateCount = attendances.filter(a => a.status === 'late').length;
      const totalAbsent = attendances.length;
      const presentCount = totalStudents > 0 ? totalStudents - totalAbsent : 0;
      const attendanceRate = totalStudents > 0 
        ? ((presentCount / totalStudents) * 100).toFixed(1) 
        : 0;

      statsByGrade.push({
        grade,
        totalClasses: classes.length,
        totalStudents,
        present: presentCount,
        absent: absentCount,
        excused: excusedCount,
        late: lateCount,
        totalAbsent,
        attendanceRate: parseFloat(attendanceRate),
      });
    }

    res.json({
      success: true,
      data: statsByGrade,
    });
  } catch (err) {
    console.error('[getAttendanceStatsByGrade]', err);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy thống kê theo khối', error: err.message });
  }
};

/**
 * 📈 Lấy xu hướng điểm danh theo ngày/tuần/tháng (Admin)
 * GET /attendance/stats/trends?schoolYear=xxx&semester=xxx&startDate=xxx&endDate=xxx&groupBy=day|week|month
 */
exports.getAttendanceTrends = async (req, res) => {
  try {
    const { schoolYear, semester, startDate, endDate, groupBy = 'day', classId, grade } = req.query;
    const { role } = req.user;

    // Admin và BGH (teacher với isLeader) đều có quyền xem
    if (role === 'teacher') {
      const Teacher = require('../../models/user/teacher');
      const teacher = await Teacher.findOne({ accountId: req.user.accountId }).lean();
      if (!teacher || !teacher.isLeader) {
        return res.status(403).json({ 
          success: false, 
          message: 'Chỉ BGH và Admin mới được xem xu hướng điểm danh' 
        });
      }
    } else if (role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Chỉ BGH và Admin mới được xem xu hướng điểm danh' 
      });
    }

    // Query điểm danh
    const attendanceQuery = {};
    if (schoolYear) attendanceQuery.schoolYear = schoolYear;
    if (semester) attendanceQuery.semester = semester;

    // Filter theo lớp hoặc khối
    if (classId) {
      attendanceQuery.classId = classId;
    } else if (grade) {
      const classes = await Class.find({ grade }).lean();
      const classIds = classes.map(c => c._id);
      attendanceQuery.classId = { $in: classIds };
    }

    // Date range
    if (startDate || endDate) {
      attendanceQuery.date = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        attendanceQuery.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        attendanceQuery.date.$lte = end;
      }
    }

    const attendances = await Attendance.find(attendanceQuery)
      .populate('classId', 'className grade')
      .sort({ date: 1 })
      .lean();

    // Group by date
    const trends = {};
    const dateMap = {};

    attendances.forEach(att => {
      const date = new Date(att.date);
      let key;

      if (groupBy === 'week') {
        // Lấy tuần trong năm
        const week = getWeekNumber(date);
        key = `${date.getFullYear()}-W${week}`;
      } else if (groupBy === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else {
        // day
        key = date.toISOString().split('T')[0];
      }

      if (!trends[key]) {
        trends[key] = {
          date: key,
          present: 0,
          absent: 0,
          excused: 0,
          late: 0,
          total: 0,
        };
        dateMap[key] = date;
      }

      if (att.status === 'absent') trends[key].absent++;
      else if (att.status === 'excused') trends[key].excused++;
      else if (att.status === 'late') trends[key].late++;
      trends[key].total++;
    });

    // Tính số học sinh có mặt (cần lấy tổng số học sinh)
    const classIds = classId 
      ? [classId] 
      : grade 
        ? (await Class.find({ grade }).lean()).map(c => c._id)
        : await Class.distinct('_id');

    // Tính present cho mỗi ngày/tuần/tháng
    const trendsArray = Object.keys(trends)
      .sort()
      .map(key => {
        // Ước tính số học sinh có mặt (cần query thực tế)
        const totalStudents = classIds.length > 0 
          ? 0 // Sẽ tính sau nếu cần
          : 0;
        
        const trend = trends[key];
        const present = Math.max(0, totalStudents - trend.total);
        const attendanceRate = totalStudents > 0 
          ? ((present / totalStudents) * 100).toFixed(1)
          : 0;

        return {
          ...trend,
          present,
          attendanceRate: parseFloat(attendanceRate),
          dateObj: dateMap[key],
        };
      });

    res.json({
      success: true,
      data: trendsArray,
    });
  } catch (err) {
    console.error('[getAttendanceTrends]', err);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy xu hướng điểm danh', error: err.message });
  }
};

// Helper function để tính số tuần
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * 📊 Lấy thống kê tổng quan toàn trường (Admin)
 * GET /attendance/stats/overview?schoolYear=xxx&semester=xxx
 */
exports.getAttendanceOverview = async (req, res) => {
  try {
    const { schoolYear, semester, startDate, endDate } = req.query;
    const { role } = req.user;

    // Admin và BGH (teacher với isLeader) đều có quyền xem
    if (role === 'teacher') {
      const Teacher = require('../../models/user/teacher');
      const teacher = await Teacher.findOne({ accountId: req.user.accountId }).lean();
      if (!teacher || !teacher.isLeader) {
        return res.status(403).json({ 
          success: false, 
          message: 'Chỉ BGH và Admin mới được xem thống kê tổng quan' 
        });
      }
    } else if (role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Chỉ BGH và Admin mới được xem thống kê tổng quan' 
      });
    }

    // Query điểm danh
    const attendanceQuery = {};
    if (schoolYear) attendanceQuery.schoolYear = schoolYear;
    if (semester) attendanceQuery.semester = semester;
    if (startDate || endDate) {
      attendanceQuery.date = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        attendanceQuery.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        attendanceQuery.date.$lte = end;
      }
    }

    // Tổng số học sinh
    const totalStudents = await Student.countDocuments({ status: 'active' });

    // Tổng số lớp
    const totalClasses = await Class.countDocuments({});

    // Điểm danh
    const attendances = await Attendance.find(attendanceQuery).lean();

    const absentCount = attendances.filter(a => a.status === 'absent').length;
    const excusedCount = attendances.filter(a => a.status === 'excused').length;
    const lateCount = attendances.filter(a => a.status === 'late').length;
    const totalAbsent = attendances.length;
    const presentCount = totalStudents > 0 ? totalStudents - totalAbsent : 0;
    const attendanceRate = totalStudents > 0 
      ? ((presentCount / totalStudents) * 100).toFixed(1) 
      : 0;

    // Thống kê theo khối
    const grades = await Class.distinct('grade');
    const byGrade = [];
    for (const grade of grades.sort()) {
      const classes = await Class.find({ grade }).lean();
      const classIds = classes.map(c => c._id);
      const gradeStudents = await Student.countDocuments({ 
        classId: { $in: classIds }, 
        status: 'active' 
      });
      const gradeAttendances = attendances.filter(a => 
        classIds.includes(String(a.classId))
      );
      const gradeAbsent = gradeAttendances.filter(a => a.status === 'absent').length;
      const gradeTotalAbsent = gradeAttendances.length;
      const gradePresent = gradeStudents > 0 ? gradeStudents - gradeTotalAbsent : 0;
      const gradeRate = gradeStudents > 0 
        ? ((gradePresent / gradeStudents) * 100).toFixed(1) 
        : 0;

      byGrade.push({
        grade,
        totalStudents: gradeStudents,
        totalClasses: classes.length,
        present: gradePresent,
        absent: gradeAbsent,
        totalAbsent: gradeTotalAbsent,
        attendanceRate: parseFloat(gradeRate),
      });
    }

    // Top 5 lớp có tỷ lệ điểm danh thấp nhất
    const classes = await Class.find({}).lean();
    const classStats = [];
    for (const cls of classes) {
      const clsStudents = await Student.countDocuments({ 
        classId: cls._id, 
        status: 'active' 
      });
      const clsAttendances = attendances.filter(a => 
        String(a.classId) === String(cls._id)
      );
      const clsTotalAbsent = clsAttendances.length;
      const clsPresent = clsStudents > 0 ? clsStudents - clsTotalAbsent : 0;
      const clsRate = clsStudents > 0 
        ? ((clsPresent / clsStudents) * 100).toFixed(1) 
        : 0;

      classStats.push({
        classId: cls._id,
        className: cls.className,
        grade: cls.grade,
        attendanceRate: parseFloat(clsRate),
        totalAbsent: clsTotalAbsent,
      });
    }

    const topLowAttendance = classStats
      .filter(c => c.attendanceRate < 100)
      .sort((a, b) => a.attendanceRate - b.attendanceRate)
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        overall: {
          totalStudents,
          totalClasses,
          present: presentCount,
          absent: absentCount,
          excused: excusedCount,
          late: lateCount,
          totalAbsent,
          attendanceRate: parseFloat(attendanceRate),
        },
        byGrade,
        topLowAttendance,
      },
    });
  } catch (err) {
    console.error('[getAttendanceOverview]', err);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy thống kê tổng quan', error: err.message });
  }
};

/**
 * 📊 Lấy thống kê điểm danh hôm nay cho BGH
 * GET /attendance/stats/today?schoolYear=xxx&semester=xxx
 */
exports.getTodayAttendanceStats = async (req, res) => {
  try {
    const { schoolYear, semester } = req.query;
    const { role } = req.user;

    // BGH và Admin đều có quyền xem
    if (role !== 'admin' && role !== 'teacher') {
      return res.status(403).json({ 
        success: false, 
        message: 'Chỉ BGH và Admin mới được xem thống kê hôm nay' 
      });
    }

    // Kiểm tra nếu là teacher thì phải là BGH (isLeader)
    if (role === 'teacher') {
      const Teacher = require('../../models/user/teacher');
      const teacher = await Teacher.findOne({ accountId: req.user.accountId }).lean();
      if (!teacher || !teacher.isLeader) {
        return res.status(403).json({ 
          success: false, 
          message: 'Chỉ BGH mới được xem thống kê hôm nay' 
        });
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Query điểm danh hôm nay
    const attendanceQuery = {
      date: { $gte: today, $lt: tomorrow },
    };
    if (schoolYear) attendanceQuery.schoolYear = schoolYear;
    if (semester) attendanceQuery.semester = semester;

    // Tổng số học sinh
    const totalStudents = await Student.countDocuments({ status: 'active' });

    // Điểm danh hôm nay
    const attendances = await Attendance.find(attendanceQuery).lean();

    const absentCount = attendances.filter(a => a.status === 'absent').length;
    const excusedCount = attendances.filter(a => a.status === 'excused').length;
    const lateCount = attendances.filter(a => a.status === 'late').length;
    const totalAbsent = attendances.length;
    const presentCount = totalStudents > 0 ? totalStudents - totalAbsent : 0;
    const attendanceRate = totalStudents > 0 
      ? ((presentCount / totalStudents) * 100).toFixed(1) 
      : 0;

    // Tìm lớp có tỷ lệ vắng cao nhất hôm nay
    const classes = await Class.find({}).lean();
    let topLowAttendanceClass = null;
    let lowestRate = 100;

    for (const cls of classes) {
      const clsStudents = await Student.countDocuments({ 
        classId: cls._id, 
        status: 'active' 
      });
      const clsAttendances = attendances.filter(a => 
        String(a.classId) === String(cls._id)
      );
      const clsTotalAbsent = clsAttendances.length;
      const clsPresent = clsStudents > 0 ? clsStudents - clsTotalAbsent : 0;
      const clsRate = clsStudents > 0 
        ? ((clsPresent / clsStudents) * 100).toFixed(1) 
        : 100;

      if (parseFloat(clsRate) < lowestRate && clsTotalAbsent > 0) {
        lowestRate = parseFloat(clsRate);
        topLowAttendanceClass = {
          classId: cls._id,
          className: cls.className,
          grade: cls.grade,
          attendanceRate: parseFloat(clsRate),
          totalAbsent: clsTotalAbsent,
        };
      }
    }

    res.json({
      success: true,
      data: {
        present: presentCount,
        absent: absentCount,
        excused: excusedCount,
        late: lateCount,
        totalAbsent,
        attendanceRate: parseFloat(attendanceRate),
        topLowAttendanceClass,
      },
    });
  } catch (err) {
    console.error('[getTodayAttendanceStats]', err);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy thống kê hôm nay', error: err.message });
  }
};

/**
 * 🔔 Lấy danh sách cảnh báo cho BGH
 * GET /attendance/alerts?schoolYear=xxx&semester=xxx
 */
exports.getAttendanceAlerts = async (req, res) => {
  try {
    const { schoolYear, semester } = req.query;
    const { role } = req.user;

    // BGH và Admin đều có quyền xem
    if (role !== 'admin' && role !== 'teacher') {
      return res.status(403).json({ 
        success: false, 
        message: 'Chỉ BGH và Admin mới được xem cảnh báo' 
      });
    }

    // Kiểm tra nếu là teacher thì phải là BGH (isLeader)
    if (role === 'teacher') {
      const Teacher = require('../../models/user/teacher');
      const teacher = await Teacher.findOne({ accountId: req.user.accountId }).lean();
      if (!teacher || !teacher.isLeader) {
        return res.status(403).json({ 
          success: false, 
          message: 'Chỉ BGH mới được xem cảnh báo' 
        });
      }
    }

    const alerts = {
      lowAttendanceClasses: [],
      studentsAbsentConsecutive: [],
      teachersNotSubmitted: [],
    };

    // 1. Top 5 lớp có tỷ lệ vắng cao (hôm nay)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const attendanceQuery = {
      date: { $gte: today, $lt: tomorrow },
    };
    if (schoolYear) attendanceQuery.schoolYear = schoolYear;
    if (semester) attendanceQuery.semester = semester;

    const todayAttendances = await Attendance.find(attendanceQuery).lean();
    const classes = await Class.find({}).lean();
    const classStats = [];

    for (const cls of classes) {
      const clsStudents = await Student.countDocuments({ 
        classId: cls._id, 
        status: 'active' 
      });
      const clsAttendances = todayAttendances.filter(a => 
        String(a.classId) === String(cls._id)
      );
      const clsTotalAbsent = clsAttendances.length;
      const clsPresent = clsStudents > 0 ? clsStudents - clsTotalAbsent : 0;
      const clsRate = clsStudents > 0 
        ? ((clsPresent / clsStudents) * 100).toFixed(1) 
        : 100;

      if (clsTotalAbsent > 0 && parseFloat(clsRate) < 95) {
        classStats.push({
          classId: cls._id,
          className: cls.className,
          grade: cls.grade,
          attendanceRate: parseFloat(clsRate),
          totalAbsent: clsTotalAbsent,
          present: clsPresent,
        });
      }
    }

    alerts.lowAttendanceClasses = classStats
      .sort((a, b) => a.attendanceRate - b.attendanceRate)
      .slice(0, 5);

    // 2. Học sinh vắng nhiều ngày liên tiếp (3+ ngày)
    const last7Days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      last7Days.push(date.toISOString().split('T')[0]);
    }

    const last7DaysQuery = {
      date: {
        $gte: new Date(last7Days[6]),
        $lt: tomorrow,
      },
      status: 'absent',
    };
    if (schoolYear) last7DaysQuery.schoolYear = schoolYear;
    if (semester) last7DaysQuery.semester = semester;

    const absentRecords = await Attendance.find(last7DaysQuery)
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className')
      .lean();

    // Group by student
    const studentAbsentMap = {};
    absentRecords.forEach(record => {
      const studentId = String(record.studentId._id || record.studentId);
      if (!studentAbsentMap[studentId]) {
        studentAbsentMap[studentId] = {
          student: record.studentId,
          class: record.classId,
          dates: [],
        };
      }
      const dateStr = new Date(record.date).toISOString().split('T')[0];
      if (!studentAbsentMap[studentId].dates.includes(dateStr)) {
        studentAbsentMap[studentId].dates.push(dateStr);
      }
    });

    // Tìm học sinh vắng 3+ ngày liên tiếp
    Object.values(studentAbsentMap).forEach((item) => {
      const dates = item.dates.sort();
      let consecutiveCount = 1;
      let maxConsecutive = 1;

      for (let i = 1; i < dates.length; i++) {
        const prevDate = new Date(dates[i - 1]);
        const currDate = new Date(dates[i]);
        const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          consecutiveCount++;
          maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
        } else {
          consecutiveCount = 1;
        }
      }

      if (maxConsecutive >= 3) {
        alerts.studentsAbsentConsecutive.push({
          student: item.student,
          class: item.class,
          consecutiveDays: maxConsecutive,
          dates: dates.slice(-maxConsecutive),
        });
      }
    });

    alerts.studentsAbsentConsecutive = alerts.studentsAbsentConsecutive
      .sort((a, b) => b.consecutiveDays - a.consecutiveDays)
      .slice(0, 10);

    // 3. Giáo viên chưa nhập điểm danh (cần kiểm tra theo lịch dạy)
    // Tạm thời bỏ qua phần này vì cần thông tin từ schedule

    res.json({
      success: true,
      data: alerts,
    });
  } catch (err) {
    console.error('[getAttendanceAlerts]', err);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy cảnh báo', error: err.message });
  }
};

/**
 * 📋 Lấy điểm danh theo lớp hôm nay cho BGH
 * GET /attendance/class/:classId/today?schoolYear=xxx&semester=xxx
 */
exports.getTodayAttendanceByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { schoolYear, semester } = req.query;
    const { role } = req.user;

    // BGH và Admin đều có quyền xem
    if (role !== 'admin' && role !== 'teacher') {
      return res.status(403).json({ 
        success: false, 
        message: 'Chỉ BGH và Admin mới được xem điểm danh theo lớp' 
      });
    }

    // Kiểm tra nếu là teacher thì phải là BGH (isLeader)
    if (role === 'teacher') {
      const Teacher = require('../../models/user/teacher');
      const teacher = await Teacher.findOne({ accountId: req.user.accountId }).lean();
      if (!teacher || !teacher.isLeader) {
        return res.status(403).json({ 
          success: false, 
          message: 'Chỉ BGH mới được xem điểm danh theo lớp' 
        });
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // ✅ Lấy thông tin lớp để lấy năm học
    const classInfo4 = await Class.findById(classId).select('year').lean();
    if (!classInfo4) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học' });
    }
    
    // ✅ Lấy tất cả học sinh trong lớp - CHỈ lấy học sinh của niên khóa tương ứng
    const students = await Student.find({ 
      classId, 
      status: 'active',
      currentYear: classInfo4.year // ✅ CHỈ lấy học sinh có currentYear trùng với năm học của lớp
    })
      .select('name studentCode avatarUrl')
      .sort({ name: 1 })
      .lean();

    // Lấy điểm danh hôm nay
    const attendanceQuery = {
      classId,
      date: { $gte: today, $lt: tomorrow },
    };
    if (schoolYear) attendanceQuery.schoolYear = schoolYear;
    if (semester) attendanceQuery.semester = semester;

    const attendances = await Attendance.find(attendanceQuery)
      .populate('studentId', 'name studentCode avatarUrl')
      .lean();

    // Tạo danh sách điểm danh đầy đủ (có mặt + vắng)
    const attendanceList = students.map(student => {
      const attendance = attendances.find(a => 
        String(a.studentId._id || a.studentId) === String(student._id)
      );

      return {
        student: {
          _id: student._id,
          name: student.name,
          studentCode: student.studentCode,
          avatarUrl: student.avatarUrl,
        },
        status: attendance ? attendance.status : 'present',
        notes: attendance?.notes || null,
        session: attendance?.session || null,
      };
    });

    res.json({
      success: true,
      data: attendanceList,
    });
  } catch (err) {
    console.error('[getTodayAttendanceByClass]', err);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy điểm danh theo lớp', error: err.message });
  }
};


