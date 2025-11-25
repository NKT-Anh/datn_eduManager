const StudentYearRecord = require('../../models/user/studentYearRecord');
const Student = require('../../models/user/student');
const Teacher = require('../../models/user/teacher');
const Class = require('../../models/class/class');
const { checkConductEntryTime, isConductLocked } = require('../../utils/conductTimeHelper');
const { calculateConduct } = require('./conductConfigController');

/**
 * 📋 LẤY DANH SÁCH HẠNH KIỂM
 * - Admin: Xem tất cảs
 * - BGH: Xem tất cả
 * - GVCN: Xem hạnh kiểm lớp chủ nhiệm
 * - Học sinh: Xem hạnh kiểm của mình
 */
exports.getConducts = async (req, res) => {
  try {
    const { role, accountId } = req.user;
    const { year, semester, classId, studentId } = req.query;
    
    let filter = {};
    
    // Admin: Xem tất cả
    if (role === 'admin') {
      // Không giới hạn
    } 
    // Teacher với isHomeroom flag: Xem hạnh kiểm lớp chủ nhiệm
    else if (role === 'teacher') {
      const teacher = await Teacher.findOne({ accountId })
        .populate('homeroomClassIds')
        .populate('currentHomeroomClassId');
      
      // Kiểm tra permission context từ middleware
      const permissionContext = req.permissionContext || {};
      const isHomeroom = permissionContext.isHomeroom || false;
      const homeroomClassIds = permissionContext.homeroomClassIds || [];
      
      if (isHomeroom && homeroomClassIds.length > 0) {
        // GVCN: Chỉ xem hạnh kiểm lớp chủ nhiệm
        filter.classId = { $in: homeroomClassIds };
      } else {
        // Không phải GVCN, không có quyền xem hạnh kiểm
        return res.json({ success: true, total: 0, data: [] });
      }
    }
    // Học sinh: Xem hạnh kiểm của mình
    else if (role === 'student') {
      const student = await Student.findOne({ accountId });
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
    if (classId && role === 'admin') filter.classId = classId;
    if (studentId && role === 'admin') filter.studentId = studentId;
    
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
    const { role, accountId } = req.user;
    
    const record = await StudentYearRecord.findById(id)
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className grade')
      .populate('homeroomTeacherId', 'name teacherCode');
    
    if (!record) {
      return res.status(404).json({ error: 'Không tìm thấy hạnh kiểm' });
    }
    
    // Kiểm tra quyền truy cập
    if (role === 'student') {
      const student = await Student.findOne({ accountId });
      if (String(record.studentId._id) !== String(student._id)) {
        return res.status(403).json({ error: 'Không có quyền truy cập' });
      }
    } else if (role === 'teacher') {
      // Kiểm tra permission context từ middleware
      const permissionContext = req.permissionContext || {};
      const isHomeroom = permissionContext.isHomeroom || false;
      const homeroomClassIds = permissionContext.homeroomClassIds || [];
      
      if (isHomeroom) {
        const recordClassId = String(record.classId?._id || record.classId);
        if (!homeroomClassIds.includes(recordClassId)) {
          return res.status(403).json({ error: 'Không có quyền truy cập' });
        }
      } else {
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
 * - Kiểm tra thời gian cho phép nhập
 * - Kiểm tra trạng thái locked
 * - Hỗ trợ lưu bản nháp và gửi phê duyệt
 */
exports.updateConduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, accountId } = req.user;
    const { conduct, conductNote, action } = req.body; // action: 'save' (bản nháp) hoặc 'submit' (gửi phê duyệt)
    
    const record = await StudentYearRecord.findById(id)
      .populate('classId')
      .populate('studentId');
    
    if (!record) {
      return res.status(404).json({ error: 'Không tìm thấy hạnh kiểm' });
    }
    
    // Teacher với isHomeroom flag: Nhập hạnh kiểm lớp chủ nhiệm
    if (role === 'teacher') {
      // Kiểm tra permission context từ middleware
      const permissionContext = req.permissionContext || {};
      const isHomeroom = permissionContext.isHomeroom || false;
      const homeroomClassIds = permissionContext.homeroomClassIds || [];
      
      if (!isHomeroom) {
        return res.status(403).json({ error: 'Bạn không phải giáo viên chủ nhiệm' });
      }
      
      const recordClassId = String(record.classId?._id || record.classId);
      if (!homeroomClassIds.includes(recordClassId)) {
        return res.status(403).json({ error: 'Không phải lớp chủ nhiệm của bạn' });
      }
      
      // ✅ Kiểm tra trạng thái locked
      const locked = await isConductLocked(record, false);
      if (locked) {
        return res.status(403).json({ 
          error: 'Hạnh kiểm đã được chốt. Vui lòng liên hệ Admin để mở khóa nếu cần chỉnh sửa.' 
        });
      }
      
      // ✅ Kiểm tra thời gian cho phép nhập (trừ khi đang gửi phê duyệt bản đã có)
      if (action !== 'submit' || record.conductStatus === 'draft') {
        const timeCheck = await checkConductEntryTime(record.semester, false);
        if (!timeCheck.allowed) {
          return res.status(403).json({ 
            error: timeCheck.message,
            timeInfo: {
              startDate: timeCheck.startDate,
              endDate: timeCheck.endDate
            }
          });
        }
      }
      
      const teacher = await Teacher.findOne({ accountId });
      if (!teacher) {
        return res.status(404).json({ error: 'Không tìm thấy thông tin giáo viên' });
      }
      
      // Cập nhật hạnh kiểm
      if (conduct) {
        if (!['Tốt', 'Khá', 'Trung bình', 'Yếu'].includes(conduct)) {
          return res.status(400).json({ error: 'Hạnh kiểm không hợp lệ' });
        }
        record.conduct = conduct;
        record.homeroomTeacherId = teacher._id;
      }
      
      // Cập nhật ghi chú
      if (conductNote !== undefined) {
        record.conductNote = conductNote;
      }
      
      // Xử lý action
      if (action === 'submit') {
        // Gửi phê duyệt: chuyển từ draft → pending
        if (record.conductStatus === 'draft') {
          record.conductStatus = 'pending';
        }
      } else if (action === 'save') {
        // Lưu bản nháp: giữ nguyên draft
        record.conductStatus = 'draft';
      }
      // Nếu không có action, giữ nguyên trạng thái hiện tại
    }
    // BGH: Phê duyệt/chốt hạnh kiểm
    else if (role === 'teacher' && req.user.teacherFlags?.isLeader) {
      // Xử lý trong hàm approveConduct riêng
      return res.status(400).json({ error: 'Vui lòng sử dụng API phê duyệt hạnh kiểm' });
    }
    // Admin: Có thể sửa tất cả (override)
    else if (role === 'admin') {
      const { gpa, rank, note, conductStatus } = req.body;
      
      if (conduct) {
        if (!['Tốt', 'Khá', 'Trung bình', 'Yếu'].includes(conduct)) {
          return res.status(400).json({ error: 'Hạnh kiểm không hợp lệ' });
        }
        record.conduct = conduct;
      }
      if (gpa !== undefined) record.gpa = gpa;
      if (rank !== undefined) record.rank = rank;
      if (note !== undefined) record.note = note;
      if (conductNote !== undefined) record.conductNote = conductNote;
      
      // Admin có thể thay đổi trạng thái (mở khóa)
      if (conductStatus && ['draft', 'pending', 'approved', 'locked'].includes(conductStatus)) {
        record.conductStatus = conductStatus;
        if (conductStatus === 'locked') {
          record.conductLockedAt = new Date();
        }
      }
    } else {
      return res.status(403).json({ error: 'Không có quyền cập nhật hạnh kiểm' });
    }
    
    await record.save();
    
    const populated = await StudentYearRecord.findById(record._id)
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className grade')
      .populate('homeroomTeacherId', 'name teacherCode')
      .populate('conductApprovedBy', 'name teacherCode');
    
    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('❌ Lỗi updateConduct:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * ✅ TÍNH TOÁN HẠNH KIỂM TỰ ĐỘNG (Đề xuất)
 * GVCN có thể xem đề xuất từ hệ thống trước khi nhập
 */
exports.calculateSuggestedConduct = async (req, res) => {
  try {
    const { studentId, year, semester } = req.query;
    
    if (!studentId || !year || !semester) {
      return res.status(400).json({ error: 'Thiếu thông tin: studentId, year, semester' });
    }
    
    try {
      const suggested = await calculateConduct(studentId, year, semester);
      
      // Cập nhật conductSuggested vào record nếu có
      const record = await StudentYearRecord.findOne({ studentId, year, semester });
      if (record) {
        record.conductSuggested = suggested;
        await record.save();
      }
      
      res.json({ 
        success: true, 
        data: { 
          suggested,
          message: suggested ? `Hệ thống đề xuất: ${suggested}` : 'Không thể tính toán tự động. Vui lòng nhập thủ công.'
        }
      });
    } catch (calcError) {
      console.error('Error calculating conduct:', calcError);
      res.json({ 
        success: true, 
        data: { 
          suggested: null,
          message: 'Không thể tính toán tự động. Vui lòng nhập thủ công.'
        }
      });
    }
  } catch (error) {
    console.error('❌ Lỗi calculateSuggestedConduct:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * ✅ PHÊ DUYỆT HẠNH KIỂM (BGH)
 * - Approve: Duyệt hạnh kiểm
 * - Reject: Yêu cầu chỉnh sửa (chuyển về draft)
 * - Lock: Chốt dữ liệu (không cho sửa nữa)
 */
exports.approveConduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, accountId } = req.user;
    const { action, comment } = req.body; // action: 'approve', 'reject', 'lock'
    
    // Chỉ BGH mới được phê duyệt
    if (role !== 'teacher' || !req.user.teacherFlags?.isLeader) {
      return res.status(403).json({ error: 'Chỉ Ban Giám Hiệu mới được phê duyệt hạnh kiểm' });
    }
    
    const record = await StudentYearRecord.findById(id);
    if (!record) {
      return res.status(404).json({ error: 'Không tìm thấy hạnh kiểm' });
    }
    
    const teacher = await Teacher.findOne({ accountId });
    if (!teacher) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin giáo viên' });
    }
    
    if (action === 'approve') {
      // Duyệt: pending → approved
      record.conductStatus = 'approved';
      record.conductApprovedBy = teacher._id;
      record.conductApprovedAt = new Date();
      if (comment) record.conductComment = comment;
    } else if (action === 'reject') {
      // Từ chối: pending → draft (để GVCN chỉnh sửa lại)
      record.conductStatus = 'draft';
      record.conductComment = comment || 'Yêu cầu chỉnh sửa lại';
    } else if (action === 'lock') {
      // Chốt: approved → locked
      if (record.conductStatus !== 'approved') {
        return res.status(400).json({ error: 'Chỉ có thể chốt hạnh kiểm đã được phê duyệt' });
      }
      record.conductStatus = 'locked';
      record.conductLockedAt = new Date();
      if (comment) record.conductComment = comment;
    } else {
      return res.status(400).json({ error: 'Action không hợp lệ. Phải là: approve, reject, hoặc lock' });
    }
    
    await record.save();
    
    const populated = await StudentYearRecord.findById(record._id)
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className grade')
      .populate('homeroomTeacherId', 'name teacherCode')
      .populate('conductApprovedBy', 'name teacherCode');
    
    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('❌ Lỗi approveConduct:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 📋 LẤY DANH SÁCH HẠNH KIỂM CHỜ PHÊ DUYỆT (BGH)
 */
exports.getPendingConducts = async (req, res) => {
  try {
    const { role } = req.user;
    const { year, semester, classId } = req.query;
    
    // Chỉ BGH và Admin mới xem được
    if (role !== 'admin' && (role !== 'teacher' || !req.user.teacherFlags?.isLeader)) {
      return res.status(403).json({ error: 'Không có quyền truy cập' });
    }
    
    let filter = { conductStatus: 'pending' };
    if (year) filter.year = year;
    if (semester) filter.semester = semester;
    if (classId) filter.classId = classId;
    
    const records = await StudentYearRecord.find(filter)
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className grade')
      .populate('homeroomTeacherId', 'name teacherCode')
      .sort({ year: -1, semester: 1, 'classId.className': 1 });
    
    res.json({ success: true, total: records.length, data: records });
  } catch (error) {
    console.error('❌ Lỗi getPendingConducts:', error);
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

















