const StudentYearRecord = require('../../models/user/studentYearRecord');
const Student = require('../../models/user/student');
const Teacher = require('../../models/user/teacher');
const Class = require('../../models/class/class');
const { checkConductEntryTime, isConductLocked } = require('../../utils/conductTimeHelper');
const { calculateConduct } = require('./conductConfigController');
const { getCurrentSchoolYear } = require('../../utils/schoolYearHelper');

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
    let targetStudentIds = null; // Danh sách học sinh cần lấy
    
    const isBGH =
      role === 'bgh' || (role === 'teacher' && req.user.teacherFlags?.isLeader);
    
    // Admin & BGH: Xem tất cả (có thể filter thêm theo year/semester/classId/studentId qua query)
    if (role === 'admin' || isBGH) {
      // Không giới hạn thêm ngoài filter query phía dưới
    } 
    // Teacher (GVCN): Xem hạnh kiểm lớp chủ nhiệm
    else if (role === 'teacher') {
      const teacher = await Teacher.findOne({ accountId })
        .select('yearRoles currentHomeroomClassId homeroomClassIds')
        .lean();
      
      if (!teacher) {
        return res.json({ success: true, total: 0, data: [] });
      }

      // ✅ Xác định năm học cần lấy
      
      let targetYear = year || null;
      if (!targetYear) {
        targetYear = await getCurrentSchoolYear();
      }
      
      if (!targetYear) {
        return res.json({ success: true, total: 0, data: [] });
      }

      // ✅ Tìm lớp chủ nhiệm từ yearRoles theo năm học
      let homeroomClassId = null;
      if (Array.isArray(teacher.yearRoles) && teacher.yearRoles.length > 0) {
        const yearRole = teacher.yearRoles.find(yr => String(yr.schoolYear) === String(targetYear));
        if (yearRole && yearRole.isHomeroom && yearRole.currentHomeroomClassId) {
          homeroomClassId = yearRole.currentHomeroomClassId;
        }
      }

      // ✅ Fallback về currentHomeroomClassId hoặc homeroomClassIds
      if (!homeroomClassId && teacher.currentHomeroomClassId && !year) {
        const classInfo = await Class.findById(teacher.currentHomeroomClassId).lean();
        if (classInfo && String(classInfo.year) === String(targetYear)) {
          homeroomClassId = teacher.currentHomeroomClassId;
        }
      }

      // ✅ Fallback về homeroomClassIds (lịch sử)
      if (!homeroomClassId && teacher.homeroomClassIds && Array.isArray(teacher.homeroomClassIds) && teacher.homeroomClassIds.length > 0) {
        // Tìm lớp có năm học khớp
        const classes = await Class.find({ 
          _id: { $in: teacher.homeroomClassIds },
          year: targetYear
        }).lean();
        if (classes.length > 0) {
          homeroomClassId = classes[0]._id;
        }
      }

      if (!homeroomClassId) {
        return res.json({ success: true, total: 0, data: [] });
      }

      // ✅ Lấy thông tin lớp để lấy năm học
      const classInfo = await Class.findById(homeroomClassId).select('year').lean();
      if (!classInfo) {
        return res.json({ success: true, total: 0, data: [] });
      }

      // ✅ Lấy danh sách học sinh trong lớp chủ nhiệm - CHỈ lấy học sinh của niên khóa tương ứng
      const students = await Student.find({ 
        classId: homeroomClassId, 
        status: 'active',
        currentYear: classInfo.year || targetYear,
        isDeleted: { $ne: true } // ✅ Không lấy học sinh đã bị xóa mềm
      })
        .select('_id')
        .lean();
      
      targetStudentIds = students.map(s => s._id);
      
      if (targetStudentIds.length === 0) {
        return res.json({ success: true, total: 0, data: [] });
      }

      // ✅ Filter theo danh sách học sinh
      filter.studentId = { $in: targetStudentIds };
      filter.classId = homeroomClassId;
    }
    // Học sinh: Xem hạnh kiểm của mình - CHỈ xem khi đã được BGH phê duyệt
    else if (role === 'student') {
      const student = await Student.findOne({ accountId });
      if (!student) {
        return res.json({ success: true, total: 0, data: [] });
      }
      filter.studentId = student._id;
      // ✅ Học sinh chỉ xem được hạnh kiểm đã được phê duyệt (approved) hoặc đã chốt (locked)
      filter.conductStatus = { $in: ['approved', 'locked'] };
    } else {
      return res.status(403).json({ error: 'Không có quyền truy cập' });
    }
    
    // Lọc theo query params
    if (year) filter.year = year;
    if (semester) filter.semester = semester;
    if (classId && role === 'admin') filter.classId = classId;
    if (studentId && role === 'admin') filter.studentId = studentId;
    
    // ✅ Lấy records từ StudentYearRecord
    const records = await StudentYearRecord.find(filter)
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className grade')
      .populate('homeroomTeacherId', 'name teacherCode')
      .sort({ year: -1, semester: 1 })
      .lean();
    
    // ✅ Nếu là GVCN và có học sinh nhưng chưa có record, tạo record rỗng cho các học sinh chưa có
    if (role === 'teacher' && targetStudentIds && targetStudentIds.length > 0) {
      const existingStudentIds = records.map(r => String(r.studentId._id || r.studentId));
      const missingStudentIds = targetStudentIds.filter(id => !existingStudentIds.includes(String(id)));
      
      if (missingStudentIds.length > 0 && year && semester) {
        // Lấy thông tin học sinh và lớp để tạo record
        const missingStudents = await Student.find({ _id: { $in: missingStudentIds } })
          .populate('classId', 'className grade')
          .lean();
        
        const emptyRecords = missingStudents.map(student => ({
          _id: null, // Sẽ được tạo khi save
          studentId: {
            _id: student._id,
            name: student.name,
            studentCode: student.studentCode
          },
          classId: student.classId ? {
            _id: student.classId._id,
            className: student.classId.className,
            grade: student.classId.grade
          } : null,
          year: year,
          semester: semester,
          conduct: null,
          conductDraft: null,
          conductSuggested: null,
          conductNote: '',
          conductStatus: 'draft',
          gpa: null,
          academicLevel: null,
          note: null
        }));
        
        records.push(...emptyRecords);
      }
    }
    
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
      // ✅ Học sinh chỉ xem được hạnh kiểm đã được phê duyệt (approved) hoặc đã chốt (locked)
      if (!['approved', 'locked'].includes(record.conductStatus)) {
        return res.status(403).json({ error: 'Hạnh kiểm chưa được phê duyệt' });
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
    const { conduct, conductNote, action, studentId, year, semester } = req.body; // action: 'save' (bản nháp) hoặc 'submit' (gửi phê duyệt)
    
    let record = null;
    
    // ✅ Nếu có id, tìm record hiện có
    if (id && id !== 'null' && id !== 'undefined') {
      record = await StudentYearRecord.findById(id)
        .populate('classId')
        .populate('studentId');
    }
    
    // ✅ Nếu không tìm thấy record nhưng có studentId, year, semester, tạo mới hoặc tìm theo các thông tin này
    if (!record && studentId && year && semester) {
      record = await StudentYearRecord.findOne({
        studentId: studentId,
        year: year,
        semester: semester
      })
      .populate('classId')
      .populate('studentId');
      
      // ✅ Nếu vẫn không có, tạo record mới
      if (!record) {
        const student = await Student.findById(studentId)
          .populate('classId')
          .lean();
        
        if (!student) {
          return res.status(404).json({ error: 'Không tìm thấy học sinh' });
        }
        
        record = new StudentYearRecord({
          studentId: studentId,
          classId: student.classId?._id || student.classId,
          year: year,
          semester: semester,
          conduct: null,
          conductDraft: conduct || null,
          conductNote: conductNote || '',
          conductStatus: 'draft',
          gpa: null,
          academicLevel: null,
          note: null
        });
      }
    }
    
    if (!record) {
      return res.status(404).json({ error: 'Không tìm thấy hạnh kiểm. Vui lòng cung cấp studentId, year và semester nếu tạo mới.' });
    }
    
    // ✅ Admin/BGH: Luôn được phép nhập (có thể override thời gian)
    const isAdminOrBGH = role === 'admin' || role === 'bgh';
    
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
      
      // ✅ Kiểm tra trạng thái locked (GVCN không thể sửa khi đã locked)
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
      if (conduct !== undefined) {
        if (conduct && !['Tốt', 'Khá', 'Trung bình', 'Yếu'].includes(conduct)) {
          return res.status(400).json({ error: 'Hạnh kiểm không hợp lệ' });
        }
        record.conductDraft = conduct || null;
        record.homeroomTeacherId = teacher._id;
      }
      
      // Cập nhật ghi chú
      if (conductNote !== undefined) {
        record.conductNote = conductNote;
      }

      record.homeroomTeacherId = teacher._id;
      
      // Xử lý action
      if (action === 'submit') {
        // ✅ Gửi phê duyệt: cần có hạnh kiểm
        const draftValue = conduct || record.conductDraft;
        if (!draftValue) {
          return res.status(400).json({ error: 'Vui lòng nhập hạnh kiểm trước khi gửi phê duyệt' });
        }
        record.conductDraft = draftValue;
        // Gửi phê duyệt: chuyển từ draft → pending
        if (record.conductStatus === 'draft' || !record.conductStatus) {
          record.conductStatus = 'pending';
        }
      } else if (action === 'save') {
        // Lưu bản nháp: giữ nguyên draft
        record.conductStatus = 'draft';
      } else {
        // Nếu không có action, mặc định là draft
        record.conductStatus = record.conductStatus || 'draft';
      }
    }
    // BGH: Phê duyệt/chốt hạnh kiểm
    else if (role === 'teacher' && req.user.teacherFlags?.isLeader) {
      // Xử lý trong hàm approveConduct riêng
      return res.status(400).json({ error: 'Vui lòng sử dụng API phê duyệt hạnh kiểm' });
    }
    // ✅ Admin/BGH: Có thể sửa tất cả (override thời gian và locked)
    else if (isAdminOrBGH) {
      const { gpa, rank, note, conductStatus } = req.body;
      
      if (conduct !== undefined) {
        if (conduct && !['Tốt', 'Khá', 'Trung bình', 'Yếu'].includes(conduct)) {
          return res.status(400).json({ error: 'Hạnh kiểm không hợp lệ' });
        }
        record.conduct = conduct || null;
        record.conductDraft = conduct || null;
      }
      if (gpa !== undefined) record.gpa = gpa;
      if (rank !== undefined) record.rank = rank;
      if (note !== undefined) record.note = note;
      if (conductNote !== undefined) record.conductNote = conductNote;
      
      // Admin/BGH có thể thay đổi trạng thái (mở khóa)
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

// ...existing code...

/**
 * ✅ Phê duyệt hạnh kiểm cho 1 lớp
 */
exports.approveConduct = async (req, res) => {
  try {
    const classId = req.params.classId;
    await StudentYearRecord.updateMany({ classId }, { $set: { conductStatus: 'approved', conductApprovedAt: new Date() } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * ✅ Phê duyệt tất cả hạnh kiểm
 */
exports.approveAllConduct = async (req, res) => {
  try {
    await StudentYearRecord.updateMany({}, { $set: { conductStatus: 'approved', conductApprovedAt: new Date() } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * 📊 Thống kê hạnh kiểm theo khối
 */
/**
 * 📊 Thống kê hạnh kiểm theo khối (đúng chuẩn: lấy tất cả lớp trong năm học)
 */
exports.getConductBlockStatistics = async (req, res) => {
  try {
    const { year, semester = "CN" } = req.query;

    if (!year) {
      return res.status(400).json({ message: "Missing academic year" });
    }

    // Lấy tất cả lớp trong năm học
    const classes = await Class.find({ year }).lean();
    if (!classes.length) return res.json({ year, semester, totalBlocks: 0, data: [] });

    const classIds = classes.map(cls => cls._id);

    // Lấy tất cả record đã locked theo lớp
    const match = { year, classId: { $in: classIds }, conductStatus: "locked" };
    if (semester !== "all") match.semester = semester;

    const conductRecords = await StudentYearRecord.aggregate([
      { $match: match },
      { $group: { _id: { classId: "$classId", conduct: "$conduct" }, count: { $sum: 1 } } },
    ]);

    const conductKeyMap = { "Tốt": "TOT", "Khá": "KHA", "Trung bình": "TB", "Yếu": "YEU" };
    const conductMap = {};
    conductRecords.forEach(r => {
      const clsId = r._id.classId.toString();
      if (!conductMap[clsId]) conductMap[clsId] = { TOT: 0, KHA: 0, TB: 0, YEU: 0 };
      const key = conductKeyMap[r._id.conduct] || r._id.conduct;
      conductMap[clsId][key] = r.count;
    });


    // Đếm sĩ số từng lớp bằng Student
    const studentCounts = await Student.aggregate([
      {
        $match: {
          classId: { $in: classIds },
          status: 'active',
          currentYear: year,
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: "$classId",
          count: { $sum: 1 },
        },
      },
    ]);
    const studentCountMap = {};
    studentCounts.forEach(sc => {
      studentCountMap[sc._id.toString()] = sc.count;
    });

    // Gom theo khối, đồng thời tạo mảng classes cho từng khối
    const grouped = {};
    for (const cls of classes) {
      const grade = parseInt(cls.className.slice(0, 2));
      if (!grouped[grade]) {
        grouped[grade] = {
          grade,
          classCount: 0,
          studentCount: 0,
          stats: { TOT: 0, KHA: 0, TB: 0, YEU: 0 },
          completedClass: 0,
          classes: [],
        };
      }
      grouped[grade].classCount++;
      const clsIdStr = cls._id.toString();
      const totalStudents = studentCountMap[clsIdStr] || 0;
      grouped[grade].studentCount += totalStudents;

      // Tính trạng thái hoàn thành của lớp
      const conductCounts = conductMap[clsIdStr] || { TOT: 0, KHA: 0, TB: 0, YEU: 0 };
      const lockedCount = Object.values(conductCounts).reduce((a, b) => a + b, 0);
      const isCompleted = totalStudents > 0 && lockedCount === totalStudents;
      if (isCompleted) grouped[grade].completedClass++;

      // Cộng dồn thống kê hạnh kiểm
      grouped[grade].stats.TOT += conductCounts.TOT;
      grouped[grade].stats.KHA += conductCounts.KHA;
      grouped[grade].stats.TB += conductCounts.TB;
      grouped[grade].stats.YEU += conductCounts.YEU;

      // Thêm thông tin từng lớp vào mảng classes
      grouped[grade].classes.push({
        classId: cls._id,
        className: cls.className,
        teacherName: cls.teacherId?.name || "Chưa có",
        studentCount: totalStudents,
        TOT: conductCounts.TOT,
        KHA: conductCounts.KHA,
        TB: conductCounts.TB,
        YEU: conductCounts.YEU,
        progressPercent: totalStudents > 0 ? Math.round((lockedCount / totalStudents) * 100) : 0,
        status: isCompleted ? "Đã hoàn thành" : "Chưa hoàn thành",
      });
    }

    res.json({
      year,
      semester,
      totalBlocks: Object.keys(grouped).length,
      data: Object.values(grouped),
    });
  } catch (error) {
    console.error("[ERROR getConductBlockStatistics]", error);
    res.status(500).json({ message: "Server error" });
  }
};






/**
 * ✅ PHÊ DUYỆT HẠNH KIỂM (BGH + Admin)
 * - Approve: Duyệt hạnh kiểm
 * - Reject: Yêu cầu chỉnh sửa (chuyển về draft)
 * - Lock: Chốt dữ liệu (không cho sửa nữa)
 */
exports.approveConduct = async (req, res) => {
  try {
    const { role, accountId } = req.user;
    const { id } = req.params;
    const { action = 'approve', comment } = req.body;
    const isAdminOrBGH = role === 'admin' || (role === 'teacher' && req.user.teacherFlags?.isLeader);
    if (!isAdminOrBGH) {
      return res.status(403).json({ error: 'Chỉ Ban Giám Hiệu hoặc Admin mới được phê duyệt hạnh kiểm' });
    }
    const record = await StudentYearRecord.findById(id);
    if (!record) {
      return res.status(404).json({ error: 'Không tìm thấy hạnh kiểm' });
    }
    let approverId = null;
    if (role === 'admin') {
      approverId = accountId;
    } else {
      const teacher = await Teacher.findOne({ accountId });
      if (!teacher) {
        approverId = accountId; // fallback nếu là BGH nhưng không có teacher
      } else {
        approverId = teacher._id;
      }
    }
    if (action === 'approve') {
      const approvedConduct = record.conductDraft ?? record.conduct;
      if (approvedConduct) {
        record.conduct = approvedConduct;
        record.conductDraft = approvedConduct;
      }
      record.conductStatus = 'approved';
      record.conductApprovedBy = approverId;
      record.conductApprovedAt = new Date();
      if (comment) record.conductComment = comment;
    } else if (action === 'reject') {
      record.conductStatus = 'draft';
      record.conductComment = comment || 'Yêu cầu chỉnh sửa lại';
    } else if (action === 'lock') {
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
    
    const isBGH =
      role === 'bgh' || (role === 'teacher' && req.user.teacherFlags?.isLeader);
    
    // Chỉ BGH và Admin mới xem được
    if (!isBGH && role !== 'admin') {
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
 * ✅ PHÊ DUYỆT HÀNG LOẠT HẠNH KIỂM (BGH + Admin)
 * - action = 'approve': pending → approved
 * - action = 'lock': approved → locked
 */
exports.bulkApproveConducts = async (req, res) => {
  try {
    const { role, accountId } = req.user;
    const { action = 'approve', comment, year, semester, classId, ids } = req.body;
    const isAdminOrBGH = role === 'admin' || (role === 'teacher' && req.user.teacherFlags?.isLeader);
    if (!isAdminOrBGH) {
      return res.status(403).json({ error: 'Chỉ Ban Giám Hiệu hoặc Admin mới được phê duyệt hạnh kiểm' });
    }
    let approverId = null;
    if (role === 'admin') {
      approverId = accountId;
    } else {
      const teacher = await Teacher.findOne({ accountId });
      if (!teacher) {
        approverId = accountId;
      } else {
        approverId = teacher._id;
      }
    }
    const filter = {};
    if (action === 'approve') {
      filter.conductStatus = 'pending';
    } else if (action === 'lock') {
      filter.conductStatus = 'approved';
    }
    // Nếu truyền danh sách id cụ thể, chỉ áp dụng cho các bản ghi đó
    if (Array.isArray(ids) && ids.length > 0) {
      filter._id = { $in: ids };
    }
    if (year) filter.year = year;
    if (semester) filter.semester = semester;
    if (classId) filter.classId = classId;

    const now = new Date();

    const records = await StudentYearRecord.find(filter);

    let matchedCount = records.length;
    let modifiedCount = 0;

    for (const record of records) {
      if (action === 'approve') {
        if (record.conductStatus !== 'pending') continue;
        const approvedConduct = record.conductDraft ?? record.conduct;
        if (approvedConduct) {
          record.conduct = approvedConduct;
          record.conductDraft = approvedConduct;
        }
        record.conductStatus = 'approved';
        record.conductApprovedBy = approverId;
        record.conductApprovedAt = now;
        if (comment) record.conductComment = comment;
        await record.save();
        modifiedCount += 1;
      } else if (action === 'lock') {
        if (record.conductStatus !== 'approved') continue;
        record.conductStatus = 'locked';
        record.conductLockedAt = now;
        if (comment) record.conductComment = comment;
        await record.save();
        modifiedCount += 1;
      }
    }

    res.json({
      success: true,
      action,
      matchedCount,
      modifiedCount,
    });
  } catch (error) {
    console.error('❌ Lỗi bulkApproveConducts:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * ➕ TẠO HẠNH KIỂM (Chỉ Admin)
 */
/* =========================================================
   📝 CẬP NHẬT NHẬN XÉT CỦA GVCN (HK1, HK2, Cuối năm)
   - Chỉ GVCN mới có quyền
   - Cập nhật trường note trong StudentYearRecord với semester='HK1', 'HK2', hoặc 'CN'
========================================================= */
exports.updateYearNote = async (req, res) => {
  try {
    const { role, accountId } = req.user;
    const { studentId, year, semester, note } = req.body;

    if (!studentId || !year || !semester) {
      return res.status(400).json({ error: 'Vui lòng cung cấp studentId, year và semester (HK1, HK2, hoặc CN)' });
    }

    // ✅ Validate semester
    if (!['HK1', 'HK2', 'CN'].includes(semester)) {
      return res.status(400).json({ error: 'Semester phải là HK1, HK2 hoặc CN' });
    }

    // ✅ Chỉ GVCN mới có quyền
    if (role !== 'teacher' && role !== 'admin' && role !== 'bgh') {
      return res.status(403).json({ error: 'Chỉ giáo viên chủ nhiệm mới có quyền cập nhật nhận xét' });
    }

    // ✅ Kiểm tra học sinh tồn tại
    const student = await Student.findById(studentId)
      .populate('classId', 'className year homeroomTeacherId')
      .lean();
    
    if (!student) {
      return res.status(404).json({ error: 'Không tìm thấy học sinh' });
    }

    // ✅ Kiểm tra quyền GVCN (trừ admin/bgh)
    if (role === 'teacher') {
      const teacher = await Teacher.findOne({ accountId })
        .select('yearRoles currentHomeroomClassId homeroomClassIds')
        .lean();
      if (!teacher) {
        return res.status(404).json({ error: 'Không tìm thấy thông tin giáo viên' });
      }

      const studentClassId = student.classId?._id || student.classId;
      const studentClassYear = student.classId?.year || year;
      
      // Kiểm tra từ yearRoles
      let isHomeroom = false;
      if (teacher.yearRoles && Array.isArray(teacher.yearRoles)) {
        const yearRole = teacher.yearRoles.find(yr => String(yr.schoolYear) === String(studentClassYear));
        if (yearRole && yearRole.isHomeroom && yearRole.currentHomeroomClassId) {
          if (String(yearRole.currentHomeroomClassId) === String(studentClassId)) {
            isHomeroom = true;
          }
        }
      }
      
      // Kiểm tra từ homeroomClassIds (lịch sử)
      if (!isHomeroom && teacher.homeroomClassIds && Array.isArray(teacher.homeroomClassIds)) {
        const hasHomeroom = teacher.homeroomClassIds.some(
          id => String(id._id || id) === String(studentClassId)
        );
        if (hasHomeroom) {
          isHomeroom = true;
        }
      }
      
      // Kiểm tra trực tiếp từ lớp học sinh
      if (!isHomeroom && student.classId && student.classId.homeroomTeacherId) {
        const Class = require('../../models/class/class');
        const studentClass = await Class.findById(studentClassId)
          .select('homeroomTeacherId year')
          .lean();
        
        if (studentClass && studentClass.homeroomTeacherId) {
          const TeacherModel = require('../../models/user/teacher');
          const homeroomTeacher = await TeacherModel.findById(studentClass.homeroomTeacherId)
            .select('accountId')
            .lean();
          
          if (homeroomTeacher && String(homeroomTeacher.accountId) === String(accountId)) {
            isHomeroom = true;
          }
        }
      }

      if (!isHomeroom) {
        return res.status(403).json({ error: 'Bạn không phải giáo viên chủ nhiệm của học sinh này' });
      }

      // Kiểm tra năm học của lớp có khớp không
      if (student.classId?.year && String(student.classId.year) !== String(year)) {
        return res.status(403).json({ error: 'Năm học không khớp với lớp của học sinh' });
      }
    }

    // ✅ Tìm hoặc tạo StudentYearRecord với semester tương ứng
    const semesterMap = {
      'HK1': 'HK1',
      'HK2': 'HK2',
      'CN': 'CN',
      '1': 'HK1',
      '2': 'HK2',
      'cuoi-nam': 'CN'
    };
    const semesterValue = semesterMap[semester] || semester;

    const yearRecord = await StudentYearRecord.findOneAndUpdate(
      {
        studentId: studentId,
        year: year,
        semester: semesterValue
      },
      {
        $set: {
          note: note || null,
          studentId: studentId,
          classId: student.classId?._id || student.classId,
          year: year,
          semester: semesterValue,
          homeroomTeacherId: role === 'teacher' ? (await Teacher.findOne({ accountId }).lean())?._id : undefined
        }
      },
      {
        upsert: true,
        new: true
      }
    )
      .populate('studentId', 'name studentCode')
      .populate('classId', 'className')
      .lean();

    const semesterLabel = {
      'HK1': 'học kỳ 1',
      'HK2': 'học kỳ 2',
      'CN': 'cuối năm'
    };

    res.json({
      success: true,
      message: `Đã cập nhật nhận xét ${semesterLabel[semesterValue] || semesterValue} thành công`,
      data: yearRecord
    });
  } catch (error) {
    console.error('❌ Lỗi updateYearNote:', error);
    res.status(500).json({ error: error.message });
  }
};

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
      conduct: conduct || null, // ✅ Không tự động gắn "Tốt", để GVCN nhập thủ công
      conductDraft: conduct || null,
      conductNote: conductNote || '',
      conductStatus: 'draft',
      gpa: gpa || null,
      rank: rank || null,
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

/**
 * 📊 Thống kê hạnh kiểm các lớp (theo năm học, học kỳ, cả năm)
 */
/**
 * 📊 Thống kê hạnh kiểm các lớp (theo năm học, học kỳ hoặc cả năm)
 */
exports.getConductClassStatistics = async (req, res) => {
  try {
    const { year, semester } = req.query;
    if (!year) return res.status(400).json({ message: "Year is required" });

    // Lấy tất cả lớp trong năm học, populate giáo viên
    const classes = await Class.find({ year, isDeleted: false })
      .populate('teacherId', 'name')
      .lean();
    if (!classes.length) return res.json([]);

    const classIds = classes.map(cls => cls._id);

    // Lấy tất cả record của các lớp trong năm học và học kỳ (không chỉ locked)
    const match = {
      year,
      classId: { $in: classIds },
    };
    if (semester && semester !== "all") match.semester = semester;

    // Lấy tất cả record của các lớp
    const allRecords = await StudentYearRecord.find(match).lean();

    // Gom theo classId và conductStatus
    const conductKeyMap = { "Tốt": "TOT", "Khá": "KHA", "Trung bình": "TB", "Yếu": "YEU" };


    // Đếm sĩ số từng lớp bằng Student
    const studentCounts = await Student.aggregate([
      {
        $match: {
          classId: { $in: classIds },
          status: 'active',
          currentYear: year,
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: "$classId",
          count: { $sum: 1 },
        },
      },
    ]);
    const studentCountMap = {};
    studentCounts.forEach(sc => {
      studentCountMap[sc._id.toString()] = sc.count;
    });

    // Map: { classId: { locked: {TOT, KHA, TB, YEU}, total: n, lockedCount: n } }
    const classStats = {};
    for (const cls of classes) {
      const clsIdStr = cls._id.toString();
      classStats[clsIdStr] = {
        TOT: 0, KHA: 0, TB: 0, YEU: 0,
        lockedCount: 0,
        total: studentCountMap[clsIdStr] || 0,
      };
    }

    for (const record of allRecords) {
      const clsIdStr = record.classId?.toString?.() || record.classId;
      if (!classStats[clsIdStr]) continue;
      if (record.conductStatus === 'locked') {
        const key = conductKeyMap[record.conduct] || record.conduct;
        if (['TOT', 'KHA', 'TB', 'YEU'].includes(key)) {
          classStats[clsIdStr][key]++;
        }
        classStats[clsIdStr].lockedCount++;
      }
    }

    const result = classes.map(cls => {
      const clsIdStr = cls._id.toString();
      const stats = classStats[clsIdStr] || { TOT: 0, KHA: 0, TB: 0, YEU: 0, lockedCount: 0, total: 0 };
      const progress = stats.total > 0 ? Math.round((stats.lockedCount / stats.total) * 100) : 0;
      return {
        classId: cls._id,
        className: cls.className,
        studentCount: stats.total,
        teacherName: cls.teacherId?.name || "Chưa có",
        TOT: stats.TOT,
        KHA: stats.KHA,
        TB: stats.TB,
        YEU: stats.YEU,
        progressPercent: progress,
      };
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
