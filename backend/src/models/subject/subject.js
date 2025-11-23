const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  }, // Ví dụ: Toán, Ngữ văn, Tiếng Anh

  code: { 
    type: String, 
    unique: true, 
    uppercase: true, 
    trim: true 
  }, // Ví dụ: MATH10, LIT11

  grades: [{ 
    type: String, 
    enum: ['10', '11', '12'], 
    required: true 
  }], // Mảng khối lớp mà môn này áp dụng

  description: { 
    type: String, 
    trim: true 
  },

  includeInAverage: { 
    type: Boolean, 
    default: true 
  }, // Dùng để tính điểm TB học kỳ (nếu môn đó có trong TB)

  defaultExamDuration: { 
    type: Number, 
    default: 60, 
    min: 15,
    max: 180
  }, // 🕒 Thời lượng thi mặc định (phút)

  isActive: {
    type: Boolean,
    default: true
  }, // ✅ Trạng thái hoạt động của môn học (mặc định là active)

  // Tổ bộ môn
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null
  }, // Tổ bộ môn mà môn học này thuộc về

  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

const Subject = mongoose.model('Subject', subjectSchema);
module.exports = Subject;
