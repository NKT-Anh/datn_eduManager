// ✅ Controller quản lý thùng rác (Soft Delete) - Chỉ Admin

// ✅ Lấy danh sách dữ liệu đã xóa mềm (Thùng rác) - Chỉ Admin
exports.getTrashData = async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;

    const skip = (page - 1) * limit;
    const query = { isDeleted: true };

    let data = [];
    let total = 0;

    if (type === 'teacher' || !type) {
      const Teacher = require('../../models/user/teacher');
      const teachers = await Teacher.find(query)
        .select('teacherCode name status departmentId isDeleted')
        .populate('departmentId', 'name')
        .skip(type ? skip : 0)
        .limit(type ? limit : 10)
        .lean();
      total += await Teacher.countDocuments(query);
      data.push({ type: 'teacher', items: teachers, total: type ? total : teachers.length });
    }

    if (type === 'student' || !type) {
      const Student = require('../../models/user/student');
      const students = await Student.find(query)
        .select('studentCode name grade status classId isDeleted')
        .populate('classId', 'className grade')
        .skip(type ? skip : 0)
        .limit(type ? limit : 10)
        .lean();
      total += await Student.countDocuments(query);
      data.push({ type: 'student', items: students, total: type ? total : students.length });
    }

    if (type === 'class' || !type) {
      const Class = require('../../models/class/class');
      const classes = await Class.find(query)
        .select('classCode className grade year isDeleted')
        .skip(type ? skip : 0)
        .limit(type ? limit : 10)
        .lean();
      total += await Class.countDocuments(query);
      data.push({ type: 'class', items: classes, total: type ? total : classes.length });
    }

    if (type === 'subject' || !type) {
      const Subject = require('../../models/subject/subject');
      const subjects = await Subject.find(query)
        .select('code name grades isDeleted')
        .skip(type ? skip : 0)
        .limit(type ? limit : 10)
        .lean();
      total += await Subject.countDocuments(query);
      data.push({ type: 'subject', items: subjects, total: type ? total : subjects.length });
    }

    if (type === 'teachingAssignment' || !type) {
      const TeachingAssignment = require('../../models/subject/teachingAssignment');
      const assignments = await TeachingAssignment.find(query)
        .select('teacherId subjectId classId year semester isDeleted')
        .populate('teacherId', 'name teacherCode')
        .populate('subjectId', 'name code')
        .populate('classId', 'className classCode')
        .skip(type ? skip : 0)
        .limit(type ? limit : 10)
        .lean();
      total += await TeachingAssignment.countDocuments(query);
      data.push({ type: 'teachingAssignment', items: assignments, total: type ? total : assignments.length });
    }

    if (type === 'department' || !type) {
      const Department = require('../../models/subject/department');
      const departments = await Department.find(query)
        .select('name code year status isDeleted')
        .skip(type ? skip : 0)
        .limit(type ? limit : 10)
        .lean();
      total += await Department.countDocuments(query);
      data.push({ type: 'department', items: departments, total: type ? total : departments.length });
    }

    if (type === 'schedule' || !type) {
      const Schedule = require('../../models/subject/schedule');
      const schedules = await Schedule.find(query)
        .select('classId year semester isLocked isDeleted')
        .populate('classId', 'className classCode grade')
        .skip(type ? skip : 0)
        .limit(type ? limit : 10)
        .lean();
      total += await Schedule.countDocuments(query);
      data.push({ type: 'schedule', items: schedules, total: type ? total : schedules.length });
    }

    if (type === 'activity' || !type) {
      const Activity = require('../../models/subject/activity');
      const activities = await Activity.find(query)
        .select('title description date isDeleted')
        .skip(type ? skip : 0)
        .limit(type ? limit : 10)
        .lean();
      total += await Activity.countDocuments(query);
      data.push({ type: 'activity', items: activities, total: type ? total : activities.length });
    }

    if (type === 'room' || !type) {
      const Room = require('../../models/room/room');
      const rooms = await Room.find(query)
        .select('roomCode name type status isDeleted')
        .skip(type ? skip : 0)
        .limit(type ? limit : 10)
        .lean();
      total += await Room.countDocuments(query);
      data.push({ type: 'room', items: rooms, total: type ? total : rooms.length });
    }

    res.json({
      success: true,
      data: type ? data[0] : data,
      pagination: type ? { page, limit, total } : null
    });
  } catch (error) {
    console.error('❌ Lỗi khi lấy dữ liệu thùng rác:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy dữ liệu thùng rác',
      error: error.message
    });
  }
};

// ✅ Khôi phục nhiều dữ liệu đã xóa mềm
exports.restoreMultiple = async (req, res) => {
  try {
    const { items } = req.body; // [{ type: 'teacher', id: '...' }, ...]

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp danh sách items cần khôi phục' });
    }

    const results = { restored: [], failed: [] };

    for (const item of items) {
      try {
        let Model;
        switch (item.type) {
          case 'teacher': Model = require('../../models/user/teacher'); break;
          case 'student': Model = require('../../models/user/student'); break;
          case 'class': Model = require('../../models/class/class'); break;
          case 'subject': Model = require('../../models/subject/subject'); break;
          case 'teachingAssignment': Model = require('../../models/subject/teachingAssignment'); break;
          case 'department': Model = require('../../models/subject/department'); break;
          case 'schedule': Model = require('../../models/subject/schedule'); break;
          case 'activity': Model = require('../../models/subject/activity'); break;
          case 'room': Model = require('../../models/room/room'); break;
          default: throw new Error(`Loại dữ liệu không hợp lệ: ${item.type}`);
        }

        const doc = await Model.findById(item.id);
        if (doc && doc.isDeleted) {
          doc.isDeleted = false;
          if (doc.status === 'inactive') doc.status = 'active'; // Khôi phục status
          await doc.save();
          results.restored.push(item);
        } else {
          results.failed.push({ ...item, reason: 'Không tìm thấy hoặc chưa bị xóa' });
        }
      } catch (error) {
        results.failed.push({ ...item, reason: error.message });
      }
    }

    res.json({
      success: true,
      message: `Đã khôi phục ${results.restored.length} items, thất bại ${results.failed.length}`,
      results
    });
  } catch (error) {
    console.error('❌ Lỗi khi khôi phục dữ liệu:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi khôi phục dữ liệu',
      error: error.message
    });
  }
};

// ✅ Xóa vĩnh viễn nhiều dữ liệu (Force delete)
exports.forceDeleteMultiple = async (req, res) => {
  try {
    const { items } = req.body; // [{ type: 'teacher', id: '...' }, ...]

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp danh sách items cần xóa' });
    }

    // ✅ Kiểm tra quyền Admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền xóa vĩnh viễn' });
    }

    const results = { deleted: [], failed: [] };

    for (const item of items) {
      try {
        let Model;
        switch (item.type) {
          case 'teacher': Model = require('../../models/user/teacher'); break;
          case 'student': Model = require('../../models/user/student'); break;
          case 'class': Model = require('../../models/class/class'); break;
          case 'subject': Model = require('../../models/subject/subject'); break;
          case 'teachingAssignment': Model = require('../../models/subject/teachingAssignment'); break;
          case 'department': Model = require('../../models/subject/department'); break;
          case 'schedule': Model = require('../../models/subject/schedule'); break;
          case 'activity': Model = require('../../models/subject/activity'); break;
          case 'room': Model = require('../../models/room/room'); break;
          default: throw new Error(`Loại dữ liệu không hợp lệ: ${item.type}`);
        }

        const deleted = await Model.findByIdAndDelete(item.id);
        if (deleted) {
          results.deleted.push(item);
        } else {
          results.failed.push({ ...item, reason: 'Không tìm thấy' });
        }
      } catch (error) {
        results.failed.push({ ...item, reason: error.message });
      }
    }

    res.json({
      success: true,
      message: `Đã xóa vĩnh viễn ${results.deleted.length} items, thất bại ${results.failed.length}`,
      results
    });
  } catch (error) {
    console.error('❌ Lỗi khi xóa vĩnh viễn dữ liệu:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa vĩnh viễn dữ liệu',
      error: error.message
    });
  }
};

module.exports = {
  getTrashData: exports.getTrashData,
  restoreMultiple: exports.restoreMultiple,
  forceDeleteMultiple: exports.forceDeleteMultiple
};
