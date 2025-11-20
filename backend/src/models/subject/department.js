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
departmentSchema.index({ code: 1 }, { unique: true });
departmentSchema.index({ headTeacherId: 1 });
departmentSchema.index({ teacherIds: 1 }); // ✅ Index cho teacherIds để query nhanh
departmentSchema.index({ status: 1 });

const Department = mongoose.model('Department', departmentSchema);
module.exports = Department;












