const mongoose = require('mongoose');

const surveyQuestionSchema = new mongoose.Schema({
  question: { 
    type: String, 
    required: true,
    trim: true 
  },
  order: { 
    type: Number, 
    required: true,
    min: 1 
  },
  weight: { 
    type: Number, 
    default: 1,
    min: 0,
    max: 10 
  }, // Trọng số câu hỏi (mặc định 1)
}, { _id: true });

const surveySchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true 
  },
  description: { 
    type: String,
    trim: true 
  },
  
  // ✅ Liên kết với môn học, học kỳ, năm học
  subjectId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Subject',
    required: true 
  },
  semester: { 
    type: String, 
    enum: ['1', '2'], 
    required: true 
  },
  year: { 
    type: String, 
    required: true,
    match: /^\d{4}-\d{4}$/ 
  },
  
  // ✅ Câu hỏi (mặc định 5 câu)
  questions: [surveyQuestionSchema],
  
  // ✅ Thang điểm (1-5)
  minScore: { 
    type: Number, 
    default: 1,
    min: 1,
    max: 5 
  },
  maxScore: { 
    type: Number, 
    default: 5,
    min: 1,
    max: 5 
  },
  
  // ✅ Trạng thái khảo sát
  status: { 
    type: String, 
    enum: ['draft', 'active', 'inactive', 'closed'], 
    default: 'draft' 
  },
  
  // ✅ Lớp và học sinh được phép tham gia
  allowedClasses: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Class' 
  }],
  allowedStudents: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student' 
  }], // Nếu để trống = tất cả học sinh trong lớp
  
  // ✅ Thời gian khảo sát
  startDate: { 
    type: Date 
  },
  endDate: { 
    type: Date 
  },
  
  // ✅ Thông báo
  notificationSent: { 
    type: Boolean, 
    default: false 
  },
  notificationSentAt: { 
    type: Date 
  },
  
  // ✅ Soft Delete
  isDeleted: { 
    type: Boolean, 
    default: false 
  },
  deletedAt: { 
    type: Date 
  },
  
  // ✅ Người tạo/cập nhật
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Account',
    required: true 
  },
  updatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Account' 
  },
}, { timestamps: true });

// ✅ Index để tìm kiếm nhanh
surveySchema.index({ subjectId: 1, year: 1, semester: 1 });
surveySchema.index({ status: 1, isDeleted: 1 });
surveySchema.index({ allowedClasses: 1 });

// ✅ Validation: endDate phải sau startDate
surveySchema.pre('save', function(next) {
  if (this.startDate && this.endDate && this.startDate >= this.endDate) {
    return next(new Error('endDate phải sau startDate'));
  }
  if (this.questions.length < 1) {
    return next(new Error('Khảo sát phải có ít nhất 1 câu hỏi'));
  }
  next();
});

const Survey = mongoose.model('Survey', surveySchema);
module.exports = Survey;

