const mongoose = require("mongoose");

const PeriodSchema = new mongoose.Schema({
  period: { type: Number, required: true }, // tiết số
  subject: { type: String, default: ""  },  // Lưu tên môn học
  teacher: { type: String, default: "" },  // Lưu tên giáo viên
  // ✅ Thêm teacherId để có thể tạo unique constraint
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
    default: null,
    index: true, // Index để query nhanh
  },
  // ✅ Thêm subjectId để query dễ dàng
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    default: null,
  },
});

const TimetableSchema = new mongoose.Schema({
  day: { type: String, required: true }, // mon, tue, wed...
  periods: [PeriodSchema],
});

const ScheduleSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },
    className: { type: String },
    year: { type: String, required: true, index: true }, // "2024-2025"
    semester: { type: String, required: true, index: true }, // "1" hoặc "2"
    timetable: [TimetableSchema],
  },
  { timestamps: true }
);

// ✅ Index để query nhanh theo class + year + semester
ScheduleSchema.index({ classId: 1, year: 1, semester: 1 }, { unique: true });

// ✅ Compound index để tối ưu query
ScheduleSchema.index({ year: 1, semester: 1 });
ScheduleSchema.index({ 'timetable.periods.teacherId': 1, year: 1, semester: 1 });

// ✅ Static method: Kiểm tra conflict teacherId + timeslot
ScheduleSchema.statics.checkTeacherConflict = async function(teacherId, day, period, year, semester, excludeClassId = null) {
  if (!teacherId) return false;
  
  // ✅ Tìm các schedule có teacherId được gán vào timeslot này
  const query = {
    year,
    semester,
    'timetable.day': day,
    'timetable.periods.period': period,
    'timetable.periods.teacherId': teacherId
  };
  
  if (excludeClassId) {
    query.classId = { $ne: excludeClassId };
  }
  
  try {
    const existing = await this.findOne(query).lean();
    return !!existing;
  } catch (error) {
    console.warn('⚠️ Lỗi khi kiểm tra conflict:', error.message);
    return false;
  }
};

// ✅ Middleware: Kiểm tra unique constraint cho teacherId + timeslot trước khi save
ScheduleSchema.pre('save', async function(next) {
  // ✅ Chỉ kiểm tra nếu có timetable và có thay đổi
  if (!this.timetable || this.timetable.length === 0) {
    return next();
  }

  // ✅ Tạo map để track teacherId + timeslot
  const teacherTimeslotMap = new Map();
  
  for (const dayEntry of this.timetable) {
    for (const periodEntry of dayEntry.periods) {
      // ✅ Chỉ kiểm tra nếu có teacherId
      if (periodEntry.teacherId && periodEntry.teacherId.toString() !== '') {
        const lockKey = `${periodEntry.teacherId.toString()}_${dayEntry.day}_${periodEntry.period}_${this.year}_${this.semester}`;
        
        // ✅ Kiểm tra xem teacherId này đã được gán vào timeslot này trong cùng year/semester chưa
        // (trừ lớp hiện tại)
        if (teacherTimeslotMap.has(lockKey)) {
          const existingClass = teacherTimeslotMap.get(lockKey);
          if (existingClass !== this.classId.toString()) {
            return next(new Error(`Giáo viên đã được gán vào ${dayEntry.day}, tiết ${periodEntry.period} ở lớp khác trong cùng năm học ${this.year} học kỳ ${this.semester}`));
          }
        }
        
        teacherTimeslotMap.set(lockKey, this.classId.toString());
        
        // ✅ Kiểm tra trong database (các schedule khác) sử dụng static method
        try {
          const conflict = await this.constructor.checkTeacherConflict(
            periodEntry.teacherId,
            dayEntry.day,
            periodEntry.period,
            this.year,
            this.semester,
            this.classId // Exclude class hiện tại để cho phép update
          );
          
          if (conflict) {
            return next(new Error(`Giáo viên đã được gán vào ${dayEntry.day}, tiết ${periodEntry.period} ở lớp khác trong cùng năm học ${this.year} học kỳ ${this.semester}`));
          }
        } catch (dbError) {
          // ✅ Bỏ qua lỗi database (có thể do chưa có collection)
          console.warn('⚠️ Không thể kiểm tra unique constraint:', dbError.message);
        }
      }
    }
  }
  
  next();
});

module.exports = mongoose.model("Schedule", ScheduleSchema);
