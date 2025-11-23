// models/SchoolYear.js
const mongoose = require('mongoose');

const SemesterSchema = new mongoose.Schema({
  name: { type: String, required: true }, // "Học kỳ 1", "Học kỳ 2"
  code: { type: String, required: true }, // "HK1", "HK2"
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
}, { _id: false });

const SchoolYearSchema = new mongoose.Schema({
  name: { type: String, required: true },        // "Năm học 2024 - 2025"
  code: { type: String, required: true, unique: true }, // "2024-2025"
  startDate: { type: Date, required: true },     // Ngày bắt đầu năm học
  endDate: { type: Date, required: true },       // Ngày kết thúc năm học
  semesters: [SemesterSchema],                   // Danh sách học kỳ
  isActive: { type: Boolean, default: false },   // Năm học được chọn làm hiện tại
  status: { 
    type: String, 
    enum: ['upcoming', 'active', 'inactive'], 
    default: 'upcoming' 
  }, // Trạng thái: upcoming (chưa bắt đầu), active (đang diễn ra), inactive (đã kết thúc)
}, { timestamps: true });

// Validation: endDate phải sau startDate
SchoolYearSchema.pre('save', function(next) {
  if (this.endDate <= this.startDate) {
    return next(new Error('Ngày kết thúc phải sau ngày bắt đầu'));
  }
  
  // Validate semesters
  if (this.semesters && this.semesters.length > 0) {
    for (const semester of this.semesters) {
      if (semester.endDate <= semester.startDate) {
        return next(new Error(`Học kỳ ${semester.name}: Ngày kết thúc phải sau ngày bắt đầu`));
      }
      // Kiểm tra semester nằm trong khoảng năm học
      if (semester.startDate < this.startDate || semester.endDate > this.endDate) {
        return next(new Error(`Học kỳ ${semester.name} phải nằm trong khoảng thời gian của năm học`));
      }
    }
  }
  
  next();
});

module.exports = mongoose.model('SchoolYear', SchoolYearSchema);
