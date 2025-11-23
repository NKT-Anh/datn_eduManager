const mongoose = require('mongoose');

/**
 * Schema cấu hình hạnh kiểm
 * - Lưu ngưỡng (thresholds) cho từng mức hạnh kiểm: Tốt, Khá, Trung bình, Yếu
 * - Áp dụng theo năm học
 */
const conductConfigSchema = new mongoose.Schema({
  schoolYear: { 
    type: String, 
    required: true,
    unique: true 
  }, // "2025-2026"
  
  // ✅ Ngưỡng cho từng tiêu chí
  thresholds: {
    // Chuyên cần (Attendance)
    attendance: {
      // Nghỉ không phép (unexcused absence)
      maxAbsenceNoPermission: {
        good: { type: Number, default: 5 },      // ≤ 5 buổi → Tốt
        fair: { type: Number, default: 10 },     // 6-10 buổi → Khá
        average: { type: Number, default: 20 },  // 11-20 buổi → Trung bình
        // > 20 buổi → Yếu
      },
      // Nghỉ có phép (excused absence) - có thể không ảnh hưởng hoặc ảnh hưởng nhẹ
      maxAbsenceWithPermission: {
        good: { type: Number, default: 20 },     // ≤ 20 buổi → Tốt
        fair: { type: Number, default: 30 },     // 21-30 buổi → Khá
        average: { type: Number, default: 40 },  // 31-40 buổi → Trung bình
        // > 40 buổi → Yếu
      },
      // Đi trễ (late)
      maxLate: {
        good: { type: Number, default: 3 },       // ≤ 3 lần → Tốt
        fair: { type: Number, default: 6 },      // 4-6 lần → Khá
        average: { type: Number, default: 10 },  // 7-10 lần → Trung bình
        // > 10 lần → Yếu
      },
    },
    
    // Vi phạm kỷ luật (Discipline)
    discipline: {
      // Số lần vi phạm (incidents với type='discipline')
      maxDisciplineIncidents: {
        good: { type: Number, default: 0 },      // 0 lần → Tốt
        fair: { type: Number, default: 1 },      // 1 lần nhắc nhở → Khá
        average: { type: Number, default: 2 },   // 1 cảnh cáo hoặc 2 nhắc nhở → Trung bình
        // ≥ 2 cảnh cáo → Yếu
      },
      // Mức độ nghiêm trọng (severity)
      maxSeverity: {
        good: { type: String, enum: ['low'], default: 'low' },        // Chỉ low → Tốt
        fair: { type: String, enum: ['low', 'medium'], default: 'medium' }, // Low hoặc medium → Khá
        average: { type: String, enum: ['low', 'medium', 'high'], default: 'high' }, // Low, medium, high → Trung bình
        // Critical → Yếu
      },
    },
    
    // Học tập (Academic) - Tùy chọn
    academic: {
      enabled: { type: Boolean, default: false }, // Bật/tắt ảnh hưởng của học tập
      // Điểm trung bình tối thiểu
      minGPA: {
        good: { type: Number, default: 8.0 },    // ≥ 8.0 → Tốt
        fair: { type: Number, default: 6.5 },    // 6.5-7.9 → Khá
        average: { type: Number, default: 5.0 },  // 5.0-6.4 → Trung bình
        // < 5.0 → Yếu
      },
    },
    
    // Phong trào / Tham gia hoạt động - Tùy chọn
    activities: {
      enabled: { type: Boolean, default: false }, // Bật/tắt ảnh hưởng của phong trào
      // Tỷ lệ tham gia tối thiểu (%)
      minParticipationRate: {
        good: { type: Number, default: 80 },      // ≥ 80% → Tốt
        fair: { type: Number, default: 60 },      // 60-79% → Khá
        average: { type: Number, default: 40 },  // 40-59% → Trung bình
        // < 40% → Yếu
      },
    },
  },
  
  // ✅ Mô tả quy tắc cho từng mức hạnh kiểm
  rules: {
    good: { 
      type: String, 
      default: "Đi học đầy đủ, không vi phạm kỷ luật, tham gia tích cực các hoạt động" 
    },
    fair: { 
      type: String, 
      default: "Nghỉ ít, vi phạm nhẹ, tham gia hoạt động đầy đủ" 
    },
    average: { 
      type: String, 
      default: "Nghỉ nhiều, có cảnh cáo, tham gia hoạt động chưa đầy đủ" 
    },
    poor: { 
      type: String, 
      default: "Nghỉ quá nhiều, vi phạm nặng, không tham gia hoạt động" 
    },
  },
  
  // ✅ Trọng số cho từng tiêu chí (tổng = 100%)
  weights: {
    attendance: { type: Number, default: 50 },    // Chuyên cần: 50%
    discipline: { type: Number, default: 30 },    // Kỷ luật: 30%
    academic: { type: Number, default: 10 },      // Học tập: 10% (nếu bật)
    activities: { type: Number, default: 10 },   // Phong trào: 10% (nếu bật)
  },
  
  // ✅ Tự động tính toán hay thủ công
  autoCalculate: { type: Boolean, default: true }, // true = tự động, false = GVCN nhập thủ công
  
  // ✅ Người tạo/cập nhật
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });

// Index
conductConfigSchema.index({ schoolYear: 1 }, { unique: true });

const ConductConfig = mongoose.model('ConductConfig', conductConfigSchema);
module.exports = ConductConfig;

