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
 */
departmentSchema.methods.getTeachersWithYear = async function() {
  const dept = this;
  const Teacher = require('../user/teacher');
  const teachers = await Teacher.find({ _id: { $in: dept.teacherIds } }).lean();
  const year = String(dept.schoolYear || dept.year || '');
  return teachers.map(t => {
    const yearRole = Array.isArray(t.yearRoles) ? t.yearRoles.find(r => String(r.schoolYear) === year) : null;
    return Object.assign({}, t, { schoolYear: year, yearRole });
  });
};

// Register model after attaching hooks/methods
const Department = mongoose.model('Department', departmentSchema);
module.exports = Department;













