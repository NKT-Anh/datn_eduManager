// models/Teacher.ts
const mongoose = require('mongoose');
const User = require('./user');

const teacherSchema = new mongoose.Schema({
  teacherCode: { type: String, unique: true },
  subjects: [
    {
      subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject" },
      grades: [{ type: String, enum: ['10', '11', '12'], required: true }], // mảng khối
    }
  ],
  classIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],         // các lớp phụ trách
  homeroomClassIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }], // các lớp chủ nhiệm
  hireYear: { type: Number },                                                 // năm về trường
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },

  // ==============================
  // ⬇ Phần bổ sung các trường còn thiếu
  // ==============================
  // Thông tin chuyên môn
  qualification: { type: String },                                            // trình độ / bằng cấp
  specialization: { type: String },                                           // chuyên ngành đào tạo
  mainSubject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },      // môn giảng dạy chính
  teachingExperience: { type: Number },                                       // thâm niên công tác (số năm dạy)
//   department: { type: String },                                               // tổ chuyên môn / bộ môn
  certifications: { type: String, default: "" },                                     // chứng chỉ / khóa đào tạo

  // Thông tin công tác
  school: { type: String },                                                   // trường đang công tác
  position: { type: String },                                                 // chức vụ: Giáo viên, Tổ trưởng, PHT...
  weeklyLessons: { type: Number },                                            // số tiết / tuần
  hireYearInField: { type: Number },                                          // năm vào ngành
  maxClasses: { type: Number, default: 3 } ,

  availableMatrix: {
    type: [[Boolean]],
    default: () =>
      Array(6)
        .fill(null)
        .map(() => Array(10).fill(false)),
  },
  // Thông tin bổ sung
  notes: { type: String },                                                    // ghi chú
  avatarUrl: { type: String },                                             // URL ảnh đại diện
}, {
  timestamps: true
});

// Kế thừa từ User
const Teacher = User.discriminator('Teacher', teacherSchema);

module.exports = Teacher;
