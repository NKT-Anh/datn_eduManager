const ConductConfig = require('../../models/grade/conductConfig');
const StudentYearRecord = require('../../models/user/studentYearRecord');
const Attendance = require('../../models/class/attendance');
const Incident = require('../../models/incident');
const Student = require('../../models/user/student');
const SchoolYear = require('../../models/schoolYear');

/**
 * 📋 LẤY CẤU HÌNH HẠNH KIỂM
 * - Admin: Xem tất cả
 * - BGH: Xem tất cả
 * - GVCN: Xem cấu hình để hiểu quy tắc
 */
exports.getConductConfig = async (req, res) => {
  try {
    const { schoolYear } = req.query;
    
    let filter = {};
    if (schoolYear) filter.schoolYear = schoolYear;
    
    const configs = await ConductConfig.find(filter)
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .sort({ schoolYear: -1 });
    
    res.json({ success: true, data: configs });
  } catch (error) {
    console.error('❌ Lỗi getConductConfig:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 📋 LẤY CẤU HÌNH HẠNH KIỂM THEO ID
 */
exports.getConductConfigById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const config = await ConductConfig.findById(id)
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');
    
    if (!config) {
      return res.status(404).json({ error: 'Không tìm thấy cấu hình' });
    }
    
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('❌ Lỗi getConductConfigById:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * ➕ TẠO CẤU HÌNH HẠNH KIỂM (Chỉ Admin)
 */
exports.createConductConfig = async (req, res) => {
  try {
    const { role, accountId } = req.user;
    
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin mới được tạo cấu hình' });
    }
    
    const { schoolYear, thresholds, rules, weights, autoCalculate } = req.body;
    
    if (!schoolYear) {
      return res.status(400).json({ error: 'Thiếu năm học' });
    }
    
    // Kiểm tra xem đã tồn tại chưa
    const existing = await ConductConfig.findOne({ schoolYear });
    if (existing) {
      return res.status(400).json({ error: 'Cấu hình cho năm học này đã tồn tại' });
    }
    
    const config = await ConductConfig.create({
      schoolYear,
      thresholds: thresholds || {},
      rules: rules || {},
      weights: weights || {},
      autoCalculate: autoCalculate !== undefined ? autoCalculate : true,
      createdBy: accountId,
      updatedBy: accountId,
    });
    
    res.status(201).json({ success: true, data: config });
  } catch (error) {
    console.error('❌ Lỗi createConductConfig:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * ✏️ CẬP NHẬT CẤU HÌNH HẠNH KIỂM (Chỉ Admin)
 */
exports.updateConductConfig = async (req, res) => {
  try {
    const { role, accountId } = req.user;
    
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin mới được cập nhật cấu hình' });
    }
    
    const { id } = req.params;
    const { thresholds, rules, weights, autoCalculate } = req.body;
    
    const config = await ConductConfig.findById(id);
    if (!config) {
      return res.status(404).json({ error: 'Không tìm thấy cấu hình' });
    }
    
    if (thresholds) config.thresholds = { ...config.thresholds, ...thresholds };
    if (rules) config.rules = { ...config.rules, ...rules };
    if (weights) config.weights = { ...config.weights, ...weights };
    if (autoCalculate !== undefined) config.autoCalculate = autoCalculate;
    config.updatedBy = accountId;
    
    await config.save();
    
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('❌ Lỗi updateConductConfig:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 🗑️ XÓA CẤU HÌNH HẠNH KIỂM (Chỉ Admin)
 */
exports.deleteConductConfig = async (req, res) => {
  try {
    const { role } = req.user;
    
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin mới được xóa cấu hình' });
    }
    
    const { id } = req.params;
    
    const config = await ConductConfig.findByIdAndDelete(id);
    if (!config) {
      return res.status(404).json({ error: 'Không tìm thấy cấu hình' });
    }
    
    res.json({ success: true, message: 'Đã xóa cấu hình thành công' });
  } catch (error) {
    console.error('❌ Lỗi deleteConductConfig:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 🧮 TÍNH TOÁN HẠNH KIỂM TỰ ĐỘNG CHO MỘT HỌC SINH
 * @param {string} studentId - ID học sinh
 * @param {string} schoolYear - Năm học
 * @param {string} semester - Học kỳ ('HK1', 'HK2', 'CN')
 * @returns {Promise<string>} - Kết quả hạnh kiểm: 'Tốt', 'Khá', 'Trung bình', 'Yếu'
 */
exports.calculateConduct = async (studentId, schoolYear, semester) => {
  try {
    // Lấy cấu hình cho năm học
    const config = await ConductConfig.findOne({ schoolYear });
    if (!config) {
      throw new Error(`Không tìm thấy cấu hình hạnh kiểm cho năm học ${schoolYear}`);
    }
    
    // Nếu không bật tự động tính toán, trả về null (để GVCN nhập thủ công)
    if (!config.autoCalculate) {
      return null;
    }
    
    // Xác định khoảng thời gian của học kỳ
    const startDate = await getSemesterStartDate(schoolYear, semester);
    const endDate = await getSemesterEndDate(schoolYear, semester);
    
    // 1. Lấy dữ liệu điểm danh (Attendance)
    const attendanceData = await getAttendanceData(studentId, startDate, endDate, schoolYear, semester);
    
    // 2. Lấy dữ liệu vi phạm kỷ luật (Incidents)
    const disciplineData = await getDisciplineData(studentId, startDate, endDate);
    
    // 3. Lấy dữ liệu học tập (Academic) - nếu bật
    const academicData = config.thresholds.academic?.enabled 
      ? await getAcademicData(studentId, schoolYear, semester)
      : null;
    
    // 4. Lấy dữ liệu phong trào (Activities) - nếu bật
    // TODO: Implement khi có model Activity
    const activitiesData = null;
    
    // 5. Tính điểm cho từng tiêu chí
    const scores = {
      attendance: calculateAttendanceScore(attendanceData, config.thresholds.attendance),
      discipline: calculateDisciplineScore(disciplineData, config.thresholds.discipline),
      academic: academicData ? calculateAcademicScore(academicData, config.thresholds.academic) : null,
      activities: activitiesData ? calculateActivitiesScore(activitiesData, config.thresholds.activities) : null,
    };
    
    // 6. Tính điểm tổng hợp (weighted average)
    const totalScore = calculateTotalScore(scores, config.weights, {
      academic: config.thresholds.academic?.enabled || false,
      activities: config.thresholds.activities?.enabled || false,
    });
    
    // 7. Xác định mức hạnh kiểm dựa trên điểm tổng hợp
    const conduct = determineConductLevel(totalScore);
    
    return conduct;
  } catch (error) {
    console.error('❌ Lỗi calculateConduct:', error);
    throw error;
  }
};

/**
 * 📊 TÍNH TOÁN HẠNH KIỂM CHO NHIỀU HỌC SINH (Batch)
 * POST /conduct-config/calculate
 */
exports.calculateConductsBatch = async (req, res) => {
  try {
    const { role } = req.user;
    
    if (role !== 'admin' && role !== 'teacher') {
      return res.status(403).json({ error: 'Không có quyền tính toán hạnh kiểm' });
    }
    
    const { schoolYear, semester, classId, studentIds } = req.body;
    
    if (!schoolYear || !semester) {
      return res.status(400).json({ error: 'Thiếu năm học hoặc học kỳ' });
    }
    
    // Lấy danh sách học sinh
    let students = [];
    if (studentIds && studentIds.length > 0) {
      students = await Student.find({ _id: { $in: studentIds } });
    } else if (classId) {
      const Class = require('../../models/class/class');
      const classData = await Class.findById(classId).populate('students');
      students = classData?.students || [];
    } else {
      return res.status(400).json({ error: 'Cần cung cấp classId hoặc studentIds' });
    }
    
    const results = [];
    const errors = [];
    
    for (const student of students) {
      try {
        const conduct = await exports.calculateConduct(student._id, schoolYear, semester);
        
        if (conduct) {
          // Tìm hoặc tạo StudentYearRecord
          let record = await StudentYearRecord.findOne({
            studentId: student._id,
            year: schoolYear,
            semester: semester,
          });
          
          if (!record) {
            // Tạo mới nếu chưa có
            record = await StudentYearRecord.create({
              studentId: student._id,
              classId: classId || student.currentClassId,
              year: schoolYear,
              semester: semester,
              conduct: conduct,
            });
          } else {
            // Cập nhật nếu đã có
            record.conduct = conduct;
            await record.save();
          }
          
          results.push({
            studentId: student._id,
            studentName: student.name,
            conduct: conduct,
            success: true,
          });
        } else {
          results.push({
            studentId: student._id,
            studentName: student.name,
            conduct: null,
            message: 'Cấu hình không bật tự động tính toán',
            success: false,
          });
        }
      } catch (error) {
        errors.push({
          studentId: student._id,
          studentName: student.name,
          error: error.message,
        });
      }
    }
    
    res.json({
      success: true,
      total: students.length,
      successCount: results.filter(r => r.success).length,
      results: results,
      errors: errors,
    });
  } catch (error) {
    console.error('❌ Lỗi calculateConductsBatch:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Lấy dữ liệu điểm danh
 */
async function getAttendanceData(studentId, startDate, endDate, schoolYear, semester) {
  const attendances = await Attendance.find({
    studentId,
    date: { $gte: startDate, $lte: endDate },
    schoolYear,
    semester,
  });
  
  let absenceNoPermission = 0; // Vắng không phép
  let absenceWithPermission = 0; // Vắng có phép
  let late = 0; // Đi trễ
  
  attendances.forEach(att => {
    if (att.status === 'absent') {
      absenceNoPermission++;
    } else if (att.status === 'excused') {
      absenceWithPermission++;
    } else if (att.status === 'late') {
      late++;
    }
  });
  
  return {
    absenceNoPermission,
    absenceWithPermission,
    late,
    total: attendances.length,
  };
}

/**
 * Lấy dữ liệu vi phạm kỷ luật
 */
async function getDisciplineData(studentId, startDate, endDate) {
  const incidents = await Incident.find({
    studentId,
    type: 'discipline',
    createdAt: { $gte: startDate, $lte: endDate },
  });
  
  let count = incidents.length;
  let maxSeverity = 'low';
  
  incidents.forEach(inc => {
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
    if (severityOrder[inc.severity] > severityOrder[maxSeverity]) {
      maxSeverity = inc.severity;
    }
  });
  
  return {
    count,
    maxSeverity,
    incidents: incidents,
  };
}

/**
 * Lấy dữ liệu học tập
 */
async function getAcademicData(studentId, schoolYear, semester) {
  const record = await StudentYearRecord.findOne({
    studentId,
    year: schoolYear,
    semester: semester,
  });
  
  return {
    gpa: record?.gpa || 0,
  };
}

/**
 * Tính điểm chuyên cần
 */
function calculateAttendanceScore(data, thresholds) {
  let score = 100; // Điểm ban đầu
  
  // Trừ điểm cho nghỉ không phép
  if (data.absenceNoPermission > thresholds.maxAbsenceNoPermission.average) {
    score -= 50; // Yếu
  } else if (data.absenceNoPermission > thresholds.maxAbsenceNoPermission.fair) {
    score -= 30; // Trung bình
  } else if (data.absenceNoPermission > thresholds.maxAbsenceNoPermission.good) {
    score -= 15; // Khá
  }
  
  // Trừ điểm cho nghỉ có phép (ít hơn)
  if (data.absenceWithPermission > thresholds.maxAbsenceWithPermission.average) {
    score -= 20;
  } else if (data.absenceWithPermission > thresholds.maxAbsenceWithPermission.fair) {
    score -= 10;
  }
  
  // Trừ điểm cho đi trễ
  if (data.late > thresholds.maxLate.average) {
    score -= 20;
  } else if (data.late > thresholds.maxLate.fair) {
    score -= 10;
  } else if (data.late > thresholds.maxLate.good) {
    score -= 5;
  }
  
  return Math.max(0, score);
}

/**
 * Tính điểm kỷ luật
 */
function calculateDisciplineScore(data, thresholds) {
  let score = 100;
  
  // Trừ điểm cho số lần vi phạm
  if (data.count > thresholds.maxDisciplineIncidents.average) {
    score -= 50;
  } else if (data.count > thresholds.maxDisciplineIncidents.fair) {
    score -= 30;
  } else if (data.count > thresholds.maxDisciplineIncidents.good) {
    score -= 15;
  }
  
  // Trừ điểm cho mức độ nghiêm trọng
  const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
  const maxSeverityOrder = severityOrder[data.maxSeverity] || 1;
  
  if (maxSeverityOrder >= 4) {
    score -= 40; // Critical
  } else if (maxSeverityOrder >= 3) {
    score -= 25; // High
  } else if (maxSeverityOrder >= 2) {
    score -= 10; // Medium
  }
  
  return Math.max(0, score);
}

/**
 * Tính điểm học tập
 */
function calculateAcademicScore(data, thresholds) {
  if (data.gpa >= thresholds.minGPA.good) {
    return 100;
  } else if (data.gpa >= thresholds.minGPA.fair) {
    return 75;
  } else if (data.gpa >= thresholds.minGPA.average) {
    return 50;
  } else {
    return 25;
  }
}

/**
 * Tính điểm phong trào (TODO: Implement khi có model Activity)
 */
function calculateActivitiesScore(data, thresholds) {
  // TODO: Implement
  return 100;
}

/**
 * Tính điểm tổng hợp
 */
function calculateTotalScore(scores, weights, enabled) {
  let total = 0;
  let totalWeight = 0;
  
  // Chuyên cần
  total += scores.attendance * (weights.attendance / 100);
  totalWeight += weights.attendance;
  
  // Kỷ luật
  total += scores.discipline * (weights.discipline / 100);
  totalWeight += weights.discipline;
  
  // Học tập
  if (enabled.academic && scores.academic !== null) {
    total += scores.academic * (weights.academic / 100);
    totalWeight += weights.academic;
  }
  
  // Phong trào
  if (enabled.activities && scores.activities !== null) {
    total += scores.activities * (weights.activities / 100);
    totalWeight += weights.activities;
  }
  
  // Chuẩn hóa về 100
  if (totalWeight > 0) {
    total = (total / totalWeight) * 100;
  }
  
  return total;
}

/**
 * Xác định mức hạnh kiểm dựa trên điểm tổng hợp
 */
function determineConductLevel(score) {
  if (score >= 80) {
    return 'Tốt';
  } else if (score >= 60) {
    return 'Khá';
  } else if (score >= 40) {
    return 'Trung bình';
  } else {
    return 'Yếu';
  }
}

/**
 * Lấy ngày bắt đầu học kỳ
 */
async function getSemesterStartDate(schoolYearCode, semester) {
  try {
    const schoolYear = await SchoolYear.findOne({ code: schoolYearCode });
    if (schoolYear && schoolYear.semesters && schoolYear.semesters.length > 0) {
      const semesterData = schoolYear.semesters.find(s => s.code === semester);
      if (semesterData) {
        return new Date(semesterData.startDate);
      }
    }
    // Fallback: Logic mặc định
    const [startYear] = schoolYearCode.split('-');
    if (semester === 'HK1') {
      return new Date(`${startYear}-09-01`);
    } else if (semester === 'HK2') {
      return new Date(`${parseInt(startYear) + 1}-01-01`);
    } else {
      return new Date(`${startYear}-09-01`);
    }
  } catch (error) {
    console.error('Lỗi lấy ngày bắt đầu học kỳ:', error);
    // Fallback
    const [startYear] = schoolYearCode.split('-');
    return new Date(`${startYear}-09-01`);
  }
}

/**
 * Lấy ngày kết thúc học kỳ
 */
async function getSemesterEndDate(schoolYearCode, semester) {
  try {
    const schoolYear = await SchoolYear.findOne({ code: schoolYearCode });
    if (schoolYear && schoolYear.semesters && schoolYear.semesters.length > 0) {
      const semesterData = schoolYear.semesters.find(s => s.code === semester);
      if (semesterData) {
        return new Date(semesterData.endDate);
      }
    }
    // Fallback: Logic mặc định
    const [startYear] = schoolYearCode.split('-');
    if (semester === 'HK1') {
      return new Date(`${startYear}-12-31`);
    } else if (semester === 'HK2') {
      return new Date(`${parseInt(startYear) + 1}-05-31`);
    } else {
      return new Date(`${parseInt(startYear) + 1}-05-31`);
    }
  } catch (error) {
    console.error('Lỗi lấy ngày kết thúc học kỳ:', error);
    // Fallback
    const [startYear] = schoolYearCode.split('-');
    if (semester === 'HK1') {
      return new Date(`${startYear}-12-31`);
    } else {
      return new Date(`${parseInt(startYear) + 1}-05-31`);
    }
  }
}

