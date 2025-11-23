const StudentYearRecord = require('../../models/user/studentYearRecord');
const Student = require('../../models/user/student');
const Teacher = require('../../models/user/teacher');
const Class = require('../../models/class/class');

/**
 * 📋 LẤY DANH SÁCH HẠNH KIỂM
 * - Admin: Xem tất cả
 * - BGH: Xem tất cả
 * - GVCN: Xem hạnh kiểm lớp chủ nhiệm
 * - Học sinh: Xem hạnh kiểm của mình
 */
exports.getConducts = async (req, res) => {
  try {
    const { role } = req.user;
    const { year, semester, classId, studentId } = req.query;
    
    let filter = {};
    
    // Admin và BGH: Xem tất cả
    if (role === 'admin' || role === 'bgh') {
      // Không giới hạn
    } 
    // GVCN: Xem hạnh kiểm lớp chủ nhiệm
    else if (role === 'gvcn') {
      const teacher = await Teacher.findOne({ accountId: req.user.accountId })
        .populate('homeroomClassIds');
      if (!teacher || !teacher.homeroomClassIds || teacher.homeroomClassIds.length === 0) {
        return res.json({ success: true, total: 0, data: [] });
      }
      const homeroomClassIds = teacher.homeroomClassIds.map(c => c._id || c);
      filter.classId = { $in: homeroomClassIds };
    }
    // Học sinh: Xem hạnh kiểm của mình
    else if (role === 'student') {
      const student = await Student.findOne({ accountId: req.user.accountId });
      if (!student) {
        return res.json({ success: true, total: 0, data: [] });
      }
      filter.studentId = student._id;
    } else {
      return res.status(403).json({ error: 'Không có quyền truy cập' });
    }
    
    // Lọc theo query params
    if (year) filter.year = year;
    if (semester) filter.semester = semester;
    if (classId && (role === 'admin' || role === 'bgh')) filter.classId = classId;
    if (studentId && (role === 'admin' || role === 'bgh')) filter.studentId = studentId;
    
    const records = await StudentYearRecord.find(filter)
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className grade')
      .populate('homeroomTeacherId', 'name teacherCode')
      .sort({ year: -1, semester: 1 });
    
    res.json({ success: true, total: records.length, data: records });
  } catch (error) {
    console.error('❌ Lỗi getConducts:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 📋 LẤY CHI TIẾT HẠNH KIỂM
 */
exports.getConductById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;
    
    const record = await StudentYearRecord.findById(id)
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className grade')
      .populate('homeroomTeacherId', 'name teacherCode');
    
    if (!record) {
      return res.status(404).json({ error: 'Không tìm thấy hạnh kiểm' });
    }
    
    // Kiểm tra quyền truy cập
    if (role === 'student') {
      const student = await Student.findOne({ accountId: req.user.accountId });
      if (String(record.studentId._id) !== String(student._id)) {
        return res.status(403).json({ error: 'Không có quyền truy cập' });
      }
    } else if (role === 'gvcn') {
      const teacher = await Teacher.findOne({ accountId: req.user.accountId })
        .populate('homeroomClassIds');
      if (!teacher || !teacher.homeroomClassIds || 
          !teacher.homeroomClassIds.some(c => String(c._id || c) === String(record.classId?._id || record.classId))) {
        return res.status(403).json({ error: 'Không có quyền truy cập' });
      }
    }
    
    res.json({ success: true, data: record });
  } catch (error) {
    console.error('❌ Lỗi getConductById:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * ✏️ CẬP NHẬT HẠNH KIỂM (GVCN nhập hạnh kiểm lớp CN)
 */
exports.updateConduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;
    
    const record = await StudentYearRecord.findById(id)
      .populate('classId');
    
    if (!record) {
      return res.status(404).json({ error: 'Không tìm thấy hạnh kiểm' });
    }
    
    // GVCN: Nhập hạnh kiểm lớp chủ nhiệm
    if (role === 'gvcn') {
      const teacher = await Teacher.findOne({ accountId: req.user.accountId })
        .populate('homeroomClassIds');
      if (!teacher || !teacher.homeroomClassIds || 
          !teacher.homeroomClassIds.some(c => String(c._id || c) === String(record.classId?._id || record.classId))) {
        return res.status(403).json({ error: 'Không phải lớp chủ nhiệm của bạn' });
      }
      
      const { conduct } = req.body;
      if (conduct) {
        if (!['Tốt', 'Khá', 'Trung bình', 'Yếu'].includes(conduct)) {
          return res.status(400).json({ error: 'Hạnh kiểm không hợp lệ' });
        }
        record.conduct = conduct;
        record.homeroomTeacherId = teacher._id;
      }
    }
    // Admin: Có thể sửa tất cả
    else if (role === 'admin') {
      const { conduct, gpa, rank, note } = req.body;
      if (conduct) {
        if (!['Tốt', 'Khá', 'Trung bình', 'Yếu'].includes(conduct)) {
          return res.status(400).json({ error: 'Hạnh kiểm không hợp lệ' });
        }
        record.conduct = conduct;
      }
      if (gpa !== undefined) record.gpa = gpa;
      if (rank !== undefined) record.rank = rank;
      if (note !== undefined) record.note = note;
    } else {
      return res.status(403).json({ error: 'Không có quyền cập nhật hạnh kiểm' });
    }
    
    await record.save();
    
    const populated = await StudentYearRecord.findById(record._id)
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className grade')
      .populate('homeroomTeacherId', 'name teacherCode');
    
    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('❌ Lỗi updateConduct:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * ➕ TẠO HẠNH KIỂM (Chỉ Admin)
 */
exports.createConduct = async (req, res) => {
  try {
    const { role } = req.user;
    
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin mới được tạo hạnh kiểm' });
    }
    
    const { studentId, classId, year, semester, conduct, gpa, rank, note } = req.body;
    
    if (!studentId || !classId || !year || !semester) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    }
    
    // Kiểm tra xem đã tồn tại chưa
    const existing = await StudentYearRecord.findOne({ studentId, year, semester });
    if (existing) {
      return res.status(400).json({ error: 'Hạnh kiểm đã tồn tại cho học kỳ này' });
    }
    
    const record = await StudentYearRecord.create({
      studentId,
      classId,
      year,
      semester,
      conduct: conduct || 'Tốt',
      gpa: gpa || 0,
      rank: rank || 0,
      note: note || ''
    });
    
    const populated = await StudentYearRecord.findById(record._id)
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className grade');
    
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.error('❌ Lỗi createConduct:', error);
    res.status(500).json({ error: error.message });
  }
};

















