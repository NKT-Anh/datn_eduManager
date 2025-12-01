const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  },
  questionOrder: { 
    type: Number, 
    required: true 
  },
  score: { 
    type: Number, 
    required: true,
    min: 1,
    max: 5 
  },
  question: { 
    type: String 
  }, // Lưu câu hỏi tại thời điểm submit để đảm bảo tính nhất quán
}, { _id: false });

const surveyResponseSchema = new mongoose.Schema({
  // ✅ Liên kết với khảo sát, học sinh, giáo viên
  surveyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Survey',
    required: true 
  },
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student',
    required: true 
  },
  teacherId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Teacher',
    required: true 
  },
  
  // ✅ Câu trả lời (điểm từng câu hỏi)
  answers: [answerSchema],
  
  // ✅ Điểm trung bình (tự động tính)
  averageScore: { 
    type: Number,
    min: 1,
    max: 5 
  },
  weightedAverageScore: { 
    type: Number,
    min: 1,
    max: 5 
  }, // Điểm trung bình có trọng số
  
  // ✅ Năm học, học kỳ (để filter dễ dàng)
  year: { 
    type: String, 
    required: true 
  },
  semester: { 
    type: String, 
    enum: ['1', '2'], 
    required: true 
  },
  
  // ✅ Thông tin bổ sung
  submittedAt: { 
    type: Date, 
    default: Date.now 
  },
  
  // ✅ Soft Delete (nếu học sinh bị xóa, vẫn giữ dữ liệu để tính trung bình)
  isDeleted: { 
    type: Boolean, 
    default: false 
  },
}, { timestamps: true });

// ✅ Index để tìm kiếm và đảm bảo unique constraint
surveyResponseSchema.index({ surveyId: 1, studentId: 1, teacherId: 1, year: 1 }, { unique: true });
surveyResponseSchema.index({ teacherId: 1, year: 1, semester: 1 });
surveyResponseSchema.index({ surveyId: 1, isDeleted: 1 });

// ✅ Tính điểm trung bình trước khi save
surveyResponseSchema.pre('save', function(next) {
  if (this.answers && this.answers.length > 0) {
    // Tính điểm trung bình đơn giản
    const totalScore = this.answers.reduce((sum, ans) => sum + ans.score, 0);
    this.averageScore = totalScore / this.answers.length;
    
    // Tính điểm trung bình có trọng số (nếu có weight)
    const totalWeighted = this.answers.reduce((sum, ans) => {
      const weight = ans.weight || 1;
      return sum + (ans.score * weight);
    }, 0);
    const totalWeight = this.answers.reduce((sum, ans) => sum + (ans.weight || 1), 0);
    this.weightedAverageScore = totalWeight > 0 ? totalWeighted / totalWeight : this.averageScore;
  }
  next();
});

const SurveyResponse = mongoose.model('SurveyResponse', surveyResponseSchema);
module.exports = SurveyResponse;

