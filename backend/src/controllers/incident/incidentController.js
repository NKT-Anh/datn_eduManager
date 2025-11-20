const Incident = require('../../models/incident');
const Student = require('../../models/user/student');
const Teacher = require('../../models/user/teacher');
const Class = require('../../models/class/class');

/**
 * 📋 LẤY DANH SÁCH SỰ CỐ
 * - Admin: Tất cả
 * - BGH: Tất cả
 * - GVCN: Sự cố lớp chủ nhiệm
 * - Học sinh: Sự cố của mình
 */
exports.getIncidents = async (req, res) => {
  try {
    const { role } = req.user;
    const { status, type, classId, studentId } = req.query;
    
    let filter = {};
    
    // Admin và BGH: Xem tất cả
    if (role === 'admin' || role === 'bgh') {
      // Không giới hạn
    } 
    // GVCN: Xem sự cố lớp chủ nhiệm
    else if (role === 'gvcn') {
      const teacher = await Teacher.findOne({ accountId: req.user.accountId })
        .populate('homeroomClassIds');
      if (!teacher || !teacher.homeroomClassIds || teacher.homeroomClassIds.length === 0) {
        return res.json({ success: true, total: 0, data: [] });
      }
      const homeroomClassIds = teacher.homeroomClassIds.map(c => c._id || c);
      filter.classId = { $in: homeroomClassIds };
    }
    // Học sinh: Xem sự cố của mình
    else if (role === 'student') {
      const student = await Student.findOne({ accountId: req.user.accountId });
      if (!student) {
        return res.json({ success: true, total: 0, data: [] });
      }
      filter.reportedBy = student._id;
    } else {
      return res.status(403).json({ error: 'Không có quyền truy cập' });
    }
    
    // Lọc theo query params
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (classId && (role === 'admin' || role === 'bgh')) filter.classId = classId;
    if (studentId && (role === 'admin' || role === 'bgh')) filter.studentId = studentId;
    
    const incidents = await Incident.find(filter)
      .populate('reportedBy', 'name studentCode')
      .populate('classId', 'className grade')
      .populate('studentId', 'name studentCode')
      .populate('handledBy', 'name teacherCode')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, total: incidents.length, data: incidents });
  } catch (error) {
    console.error('❌ Lỗi getIncidents:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 📋 LẤY CHI TIẾT SỰ CỐ
 */
exports.getIncidentById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;
    
    const incident = await Incident.findById(id)
      .populate('reportedBy', 'name studentCode')
      .populate('classId', 'className grade')
      .populate('studentId', 'name studentCode')
      .populate('handledBy', 'name teacherCode');
    
    if (!incident) {
      return res.status(404).json({ error: 'Không tìm thấy sự cố' });
    }
    
    // Kiểm tra quyền truy cập
    if (role === 'student') {
      const student = await Student.findOne({ accountId: req.user.accountId });
      if (String(incident.reportedBy._id) !== String(student._id)) {
        return res.status(403).json({ error: 'Không có quyền truy cập' });
      }
    } else if (role === 'gvcn') {
      const teacher = await Teacher.findOne({ accountId: req.user.accountId })
        .populate('homeroomClassIds');
      if (!teacher || !teacher.homeroomClassIds || 
          !teacher.homeroomClassIds.some(c => String(c._id || c) === String(incident.classId?._id || incident.classId))) {
        return res.status(403).json({ error: 'Không có quyền truy cập' });
      }
    }
    
    res.json({ success: true, data: incident });
  } catch (error) {
    console.error('❌ Lỗi getIncidentById:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * ➕ TẠO SỰ CỐ (Học sinh gửi báo cáo)
 */
exports.createIncident = async (req, res) => {
  try {
    const { role } = req.user;
    
    // Chỉ học sinh mới được tạo sự cố
    if (role !== 'student') {
      return res.status(403).json({ error: 'Chỉ học sinh mới được gửi báo cáo sự cố' });
    }
    
    const student = await Student.findOne({ accountId: req.user.accountId });
    if (!student) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin học sinh' });
    }
    
    const { title, description, type, severity, classId, studentId } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ error: 'Tiêu đề và mô tả là bắt buộc' });
    }
    
    const incident = await Incident.create({
      title,
      description,
      type: type || 'other',
      severity: severity || 'medium',
      reportedBy: student._id,
      classId: classId || student.classId,
      studentId: studentId || student._id,
      status: 'reported'
    });
    
    const populated = await Incident.findById(incident._id)
      .populate('reportedBy', 'name studentCode')
      .populate('classId', 'className grade')
      .populate('studentId', 'name studentCode');
    
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.error('❌ Lỗi createIncident:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * ✏️ CẬP NHẬT SỰ CỐ
 * - Admin: Tạo/Sửa/Xem
 * - BGH: Xem/Xử lý
 * - GVCN: Xem lớp CN
 */
exports.updateIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;
    
    const incident = await Incident.findById(id);
    if (!incident) {
      return res.status(404).json({ error: 'Không tìm thấy sự cố' });
    }
    
    // Admin: Có thể sửa tất cả
    if (role === 'admin') {
      const { title, description, type, severity, status, resolution, handledBy } = req.body;
      if (title) incident.title = title;
      if (description) incident.description = description;
      if (type) incident.type = type;
      if (severity) incident.severity = severity;
      if (status) {
        incident.status = status;
        if (status === 'resolved' || status === 'closed') {
          incident.resolutionDate = new Date();
        }
      }
      if (resolution) incident.resolution = resolution;
      if (handledBy) incident.handledBy = handledBy;
    }
    // BGH: Xử lý sự cố
    else if (role === 'bgh') {
      const { status, resolution, handledBy } = req.body;
      if (status) {
        incident.status = status;
        if (status === 'resolved' || status === 'closed') {
          incident.resolutionDate = new Date();
        }
      }
      if (resolution) incident.resolution = resolution;
      if (handledBy) incident.handledBy = handledBy;
    } else {
      return res.status(403).json({ error: 'Không có quyền cập nhật sự cố' });
    }
    
    await incident.save();
    
    const populated = await Incident.findById(incident._id)
      .populate('reportedBy', 'name studentCode')
      .populate('classId', 'className grade')
      .populate('studentId', 'name studentCode')
      .populate('handledBy', 'name teacherCode');
    
    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('❌ Lỗi updateIncident:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 🗑️ XÓA SỰ CỐ (Chỉ Admin)
 */
exports.deleteIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;
    
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin mới được xóa sự cố' });
    }
    
    const incident = await Incident.findByIdAndDelete(id);
    if (!incident) {
      return res.status(404).json({ error: 'Không tìm thấy sự cố' });
    }
    
    res.json({ success: true, message: 'Đã xóa sự cố' });
  } catch (error) {
    console.error('❌ Lỗi deleteIncident:', error);
    res.status(500).json({ error: error.message });
  }
};
















