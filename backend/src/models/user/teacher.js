// models/Teacher.ts
// ✅ Teacher Schema tối ưu – phiên bản chuẩn
const mongoose = require('mongoose');
const User = require('./user');

const teacherSchema = new mongoose.Schema({
  // ==============================
  // Thông tin cơ bản
  // ==============================
  teacherCode: { type: String, unique: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  
  // ==============================
  // Thông tin chuyên môn
  // ==============================
  subjects: [{
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject" },
    grades: [{ type: String, enum: ['10', '11', '12'], required: true }], // mảng khối
  }],
  mainSubject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }, // môn giảng dạy chính
  qualification: { type: String }, // trình độ / bằng cấp
  specialization: { type: String }, // chuyên ngành đào tạo
  teachingExperience: { type: Number }, // thâm niên công tác (số năm dạy)
  certifications: { type: String, default: "" }, // chứng chỉ / khóa đào tạo
  
  // ==============================
  // Tổ bộ môn
  // ==============================
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null
  },
  
  // ==============================
  // Quyền và chức vụ
  // ==============================
  // ✅ Giáo viên có 3 khả năng (có thể kết hợp):
  // 1. Giáo viên bình thường: isHomeroom = false, isDepartmentHead = false
  // 2. Giáo viên + Trưởng bộ môn: isHomeroom = false, isDepartmentHead = true
  // 3. Giáo viên + Giáo viên chủ nhiệm: isHomeroom = true, isDepartmentHead = false
  // 4. Giáo viên + Trưởng bộ môn + Giáo viên chủ nhiệm: isHomeroom = true, isDepartmentHead = true
  isHomeroom: {
    type: Boolean,
    default: false
  }, // Giáo viên chủ nhiệm
  
  isDepartmentHead: {
    type: Boolean,
    default: false
  }, // Trưởng bộ môn (Tổ trưởng chuyên môn)
  
  isLeader: {
    type: Boolean,
    default: false
  }, // Ban giám hiệu (Hiệu trưởng, Phó Hiệu trưởng)
  
  permissions: {
    type: [String],
    default: []
  }, // Danh sách quyền bổ sung nếu cần
  
  // ==============================
  // Lớp chủ nhiệm
  // ==============================
  // ✅ Giữ lại để theo dõi lịch sử GVCN (tất cả các lớp đã từng chủ nhiệm)
  homeroomClassIds: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Class' 
  }],
  
  // ✅ Thêm field mới: Lớp chủ nhiệm hiện tại
  currentHomeroomClassId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    default: null
  },
  
  // ==============================
  // Thông tin công tác
  // ==============================
  hireYear: { type: Number }, // năm về trường
  hireYearInField: { type: Number }, // năm vào ngành
  position: { type: String }, // chức vụ: Giáo viên, Tổ trưởng, PHT...
  weeklyLessons: { type: Number, default: 17 }, // ✅ Giới hạn tối đa số tiết/tuần (cap limit), KHÔNG dùng để tính effectiveWeeklyLessons
  optionalWeeklyLessons: { type: Number, default: 0 }, // ✅ Số tiết tự chọn bổ sung (admin/BGH có thể nhập)
  maxClasses: { type: Number, default: 3 }, // ✅ Số lớp tối đa có thể dạy (tổng)
  // ✅ Số lớp tối đa cho từng khối (10, 11, 12)
  maxClassPerGrade: {
    type: Map,
    of: Number,
    default: () => new Map([["10", 2], ["11", 2], ["12", 2]]), // Mặc định: 2 lớp/khối
  },
  
  // ==============================
  // Lịch dạy
  // ==============================
  availableMatrix: {
    type: [[Boolean]],
    default: () =>
      Array(6)
        .fill(null)
        .map(() => Array(10).fill(true)),
  },
  
  // ==============================
  // Thông tin bổ sung
  // ==============================
  notes: { type: String }, // ghi chú
  avatarUrl: { type: String }, // URL ảnh đại diện
  
  // ==============================
  // ❌ Đã loại bỏ:
  // - classIds: Không cần vì đã có TeachingAssignment để quản lý phân công lớp
  // - school: Thừa (thông tin này nên ở level hệ thống)
  // ==============================
}, {
  timestamps: true,
  toJSON: { virtuals: true }, // Cho phép virtual fields xuất hiện trong JSON
});

/**
 * ✅ Tính số tiết thực tế/tuần dựa trên chức vụ và môn học
 * 
 * Quy định:
 * - GV bộ môn: 17 tiết/tuần
 * - GV Thể dục: 17 tiết/tuần
 * - GV Quốc phòng - An ninh: 17 tiết/tuần
 * - GV chủ nhiệm: giảm 3 tiết → 14 tiết/tuần
 * - Tổ trưởng: giảm 3 tiết → 14 tiết/tuần
 * 
 * @param {Object} options - Tùy chọn
 * @param {Object} options.subject - Môn học (để kiểm tra Thể dục, QP-AN)
 * @returns {Number} Số tiết thực tế/tuần
 */
teacherSchema.methods.getEffectiveWeeklyLessons = function(options = {}) {
  const { subject } = options;
  
  // Số tiết cơ bản: 17 tiết/tuần (GV bộ môn)
  let baseWeeklyLessons = 17;
  
  // Kiểm tra môn học đặc biệt (Thể dục, Quốc phòng - An ninh)
  if (subject) {
    const subjectName = (subject.name || "").toLowerCase();
    const subjectCode = (subject.code || "").toLowerCase();
    
    // Môn Thể dục: 17 tiết/tuần
    if (subjectName.includes("thể dục") || subjectName.includes("the duc") || 
        subjectCode.includes("td") || subjectCode.includes("theduc")) {
      baseWeeklyLessons = 17;
    }
    // Môn Quốc phòng - An ninh: 17 tiết/tuần
    else if (subjectName.includes("quốc phòng") || subjectName.includes("quoc phong") ||
             subjectName.includes("an ninh") || subjectName.includes("an ninh") ||
             subjectCode.includes("qp") || subjectCode.includes("an")) {
      baseWeeklyLessons = 17;
    }
  }
  
  // Áp dụng giảm tiết cho chức vụ
  let reduction = 0;
  
  // GV chủ nhiệm: giảm 3 tiết
  if (this.isHomeroom || this.currentHomeroomClassId) {
    reduction = Math.max(reduction, 3);
  }
  
  // Tổ trưởng: giảm 3 tiết
  if (this.isDepartmentHead) {
    reduction = Math.max(reduction, 3);
  }
  
  // Số tiết cơ bản sau khi trừ
  const baseAfterReduction = Math.max(0, baseWeeklyLessons - reduction);
  
  // Số tiết tự chọn (admin/BGH có thể nhập bổ sung)
  const optionalLessons = this.optionalWeeklyLessons || 0;
  
  // Tổng số tiết thực tế = số tiết cơ bản + số tiết tự chọn
  const effectiveWeeklyLessons = baseAfterReduction + optionalLessons;
  
  // Đảm bảo không nhỏ hơn 0
  return Math.max(0, effectiveWeeklyLessons);
};

/**
 * ✅ Tính số tiết thực tế/tuần (không cần môn học cụ thể)
 * Công thức: Base (17) - giảm tiết (nếu có chức vụ) + số tiết tự chọn
 * 
 * LƯU Ý: weeklyLessons chỉ đóng vai trò giới hạn tối đa (cap limit), 
 * KHÔNG được dùng để tính effectiveWeeklyLessons.
 * effectiveWeeklyLessons luôn tính từ base 17 theo quy tắc THPT.
 */
teacherSchema.virtual('effectiveWeeklyLessons').get(function() {
  // ✅ Base luôn là 17 tiết/tuần theo quy tắc THPT (KHÔNG dùng weeklyLessons)
  const baseWeeklyLessons = 17;
  let reduction = 0;
  
  // GV chủ nhiệm: giảm 3 tiết
  if (this.isHomeroom || this.currentHomeroomClassId) {
    reduction = Math.max(reduction, 3);
  }
  
  // Tổ trưởng: giảm 3 tiết
  if (this.isDepartmentHead) {
    reduction = Math.max(reduction, 3);
  }
  
  // Số tiết cơ bản sau khi trừ (áp dụng giảm tiết cho chức vụ)
  const baseAfterReduction = Math.max(0, baseWeeklyLessons - reduction);
  
  // Số tiết tự chọn (admin/BGH có thể nhập bổ sung)
  const optionalLessons = this.optionalWeeklyLessons || 0;
  
  // Tổng số tiết thực tế = số tiết cơ bản (sau khi trừ) + số tiết tự chọn
  const effectiveWeeklyLessons = baseAfterReduction + optionalLessons;
  
  // ✅ Áp dụng cap limit: không được vượt quá weeklyLessons (nếu có)
  const capLimit = this.weeklyLessons || null;
  if (capLimit !== null) {
    return Math.min(effectiveWeeklyLessons, capLimit);
  }
  
  return effectiveWeeklyLessons;
});

// Kế thừa từ User
const Teacher = User.discriminator('Teacher', teacherSchema);

module.exports = Teacher;
