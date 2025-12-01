const mongoose = require('mongoose');

/**
 * 📚 Model: Tổ Bộ Môn (Department)
 * Quản lý các tổ chuyên môn trong trường
 */
const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  }, // Ví dụ: "Tổ Toán", "Tổ Văn", "Tổ Anh", "Tổ Lý – Hóa – Sinh"

  code: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true
  }, // Ví dụ: "TOAN", "VAN", "ANH", "LY_HOA_SINH"

  description: {
    type: String,
    trim: true
  }, // Mô tả về tổ bộ môn

  // Trưởng bộ môn (department head)
  headTeacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    default: null
  }, // Giáo viên trưởng bộ môn

  // ✅ Danh sách thành viên tham gia tổ bộ môn (bao gồm cả trưởng bộ môn)
  teacherIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher'
  }], // Danh sách giáo viên thành viên trong tổ

  // Danh sách môn học thuộc tổ này
  subjectIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject'
  }],

  // Năm học
  year: {
    type: String,
    required: true,
    trim: true
  }, // Ví dụ: "2024-2025"

  // Legacy kept as `year`. Add `schoolYear` as canonical field (kept in sync)
  schoolYear: {
    type: String,
    required: false,
    trim: true,
    default: undefined
  },

  // Trạng thái
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },

  // ✅ Soft Delete - Không xóa thật vì liên quan đến lịch sử phân công
  isDeleted: {
    type: Boolean,
    default: false,
    description: 'Đánh dấu xóa mềm - giữ lịch sử tổ bộ môn'
  },

  // Thông tin bổ sung
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
// Keep unique index for backward compatibility; also include schoolYear to support new field
departmentSchema.index({ code: 1, year: 1 }, { unique: true }); // Unique theo code và year
departmentSchema.index({ code: 1, schoolYear: 1 }, { unique: false });
departmentSchema.index({ headTeacherId: 1 });
departmentSchema.index({ teacherIds: 1 }); // ✅ Index cho teacherIds để query nhanh
departmentSchema.index({ status: 1 });
departmentSchema.index({ year: 1 }); // Index cho năm học (legacy)
departmentSchema.index({ schoolYear: 1 }); // Index cho schoolYear

// Note: model is registered after hooks and methods are attached below

// Ensure teacher yearRoles exist for department year when saving/updating department
departmentSchema.pre('save', async function(next) {
  try {
    const dept = this;
    // Sync schoolYear with legacy year if needed
    if (!dept.schoolYear && dept.year) {
      dept.schoolYear = String(dept.year);
    }

    if (!dept.schoolYear || !Array.isArray(dept.teacherIds) || dept.teacherIds.length === 0) return next();
    // require here to avoid circular deps at module load time
    const Teacher = require('../user/teacher');
    const year = String(dept.schoolYear);

    // for each teacherId, ensure teacher.yearRoles contains entry for this year
    await Promise.all(dept.teacherIds.map(async (tId) => {
      if (!tId) return;
      const teacher = await Teacher.findById(tId).select('yearRoles').lean();
      if (!teacher) return;
      const hasYear = Array.isArray(teacher.yearRoles) && teacher.yearRoles.some(r => String(r.schoolYear) === year);
      if (!hasYear) {
        // push new yearRole with minimal info
        await Teacher.findByIdAndUpdate(tId, { $push: { yearRoles: { schoolYear: year } } });
      }
    }));

    next();
  } catch (err) {
    next(err);
  }
});

/**
 * Instance helper: populate teachers and return each teacher with schoolYear and matching yearRole
 * ✅ CHỈ trả về giáo viên có departmentId trong yearRole trùng với department này trong năm học đó
 * @param {string} targetYear - Năm học cần filter (optional, nếu không có sẽ dùng year của department)
 */
departmentSchema.methods.getTeachersWithYear = async function(targetYear = null) {
  const dept = this;
  const Teacher = require('../user/teacher');
  const SchoolYearModel = require('../schoolYear');
  
  // ✅ Xác định năm học cần filter
  let year = targetYear ? String(targetYear) : String(dept.schoolYear || dept.year || '');
  
  // ✅ Nếu year là tên năm học, tìm mã năm học tương ứng (tương thích với dữ liệu cũ)
  let yearCode = year;
  let yearName = null;
  
  if (year && (year.includes('Năm học') || year.includes('năm học'))) {
    // year là tên năm học
    yearName = year;
    try {
      const schoolYear = await SchoolYearModel.findOne({ name: year }).lean();
      if (schoolYear && schoolYear.code) {
        yearCode = schoolYear.code;
      }
    } catch (err) {
      console.warn('⚠️ [getTeachersWithYear] Error looking up SchoolYear:', err.message);
    }
  } else if (year) {
    // year có thể là mã năm học, tìm tên năm học tương ứng
    try {
      const schoolYear = await SchoolYearModel.findOne({ code: year }).lean();
      if (schoolYear && schoolYear.name) {
        yearName = schoolYear.name;
      }
    } catch (err) {
      console.warn('⚠️ [getTeachersWithYear] Error looking up SchoolYear:', err.message);
    }
  }
  
  // ✅ Tìm tất cả giáo viên có yearRole.departmentId trùng với department này trong năm học đó
  // Filter theo cả mã và tên năm học để tương thích với dữ liệu cũ và mới
  const yearFilters = [];
  if (yearCode) {
    yearFilters.push({ 'yearRoles.schoolYear': yearCode });
  }
  if (yearName) {
    yearFilters.push({ 'yearRoles.schoolYear': yearName });
  }
  // ✅ Nếu không có yearCode và yearName, vẫn filter theo year gốc (có thể là mã hoặc tên)
  if (!yearCode && !yearName && year) {
    yearFilters.push({ 'yearRoles.schoolYear': year });
  }
  
  const query = {
    'yearRoles.departmentId': dept._id,
    isDeleted: { $ne: true }
  };
  
  if (yearFilters.length > 0) {
    query.$or = yearFilters;
  } else if (!year || year === '') {
    // ✅ Nếu không có year, lấy tất cả teachers có departmentId trong yearRoles (bất kỳ năm nào)
    // Điều này hữu ích khi không biết năm học cụ thể
  }
  
  let teachers = await Teacher.find(query).lean();
  
  console.log(`🔍 [getTeachersWithYear] Department: ${dept.name} (${dept._id}), Year: ${yearCode || yearName || year}`);
  console.log(`🔍 [getTeachersWithYear] Found ${teachers.length} teachers from yearRoles query`);
  console.log(`🔍 [getTeachersWithYear] Department has ${dept.teacherIds?.length || 0} teacherIds`);
  
  // ✅ Nếu không tìm thấy teachers từ yearRoles, fallback về teacherIds trong Department
  // Điều này xử lý trường hợp dữ liệu cũ chưa có yearRoles hoặc yearRoles chưa được cập nhật
  if (teachers.length === 0 && dept.teacherIds && dept.teacherIds.length > 0) {
    console.log(`⚠️ [getTeachersWithYear] No teachers found from yearRoles, falling back to teacherIds`);
    const fallbackTeachers = await Teacher.find({
      _id: { $in: dept.teacherIds },
      isDeleted: { $ne: true }
    }).lean();
    
    console.log(`✅ [getTeachersWithYear] Found ${fallbackTeachers.length} teachers from teacherIds fallback`);
    
    // ✅ Tạo yearRole giả lập từ dữ liệu hiện tại cho các teachers này
    teachers = fallbackTeachers.map(t => {
      // Tìm yearRole nếu có (có thể không có departmentId trong yearRole)
      const yearRole = Array.isArray(t.yearRoles) 
        ? t.yearRoles.find(r => {
            const rYear = String(r.schoolYear || '');
            return rYear === yearCode || rYear === yearName || rYear === year;
          })
        : null;
      
      // ✅ Nếu không có yearRole, tạo một yearRole giả lập từ dữ liệu top-level (backward compatibility)
      const mockYearRole = yearRole || {
        schoolYear: yearCode || yearName || year,
        departmentId: dept._id,
        isDepartmentHead: t.isDepartmentHead || false,
        isHomeroom: t.isHomeroom || false
      };
      
      return Object.assign({}, t, { 
        schoolYear: yearCode || yearName || year, 
        yearRole: mockYearRole 
      });
    });
  } else {
    // ✅ Map và thêm thông tin yearRole tương ứng
    teachers = teachers.map(t => {
      const yearRole = Array.isArray(t.yearRoles) 
        ? t.yearRoles.find(r => {
            const rYear = String(r.schoolYear || '');
            const rDeptId = String(r.departmentId || '');
            return (rYear === yearCode || rYear === yearName || rYear === year) && 
                   rDeptId === String(dept._id);
          })
        : null;
      return Object.assign({}, t, { schoolYear: yearCode || year, yearRole });
    });
  }
  
  console.log(`✅ [getTeachersWithYear] Returning ${teachers.length} teachers`);
  return teachers;
};

// Register model after attaching hooks/methods
const Department = mongoose.model('Department', departmentSchema);
module.exports = Department;













