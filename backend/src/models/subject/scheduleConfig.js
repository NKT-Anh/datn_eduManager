const mongoose = require("mongoose");

// Schema cấu hình cho từng ngày
const DailyScheduleSchema = new mongoose.Schema(
  {
    totalPeriods: { type: Number, required: true, default: 7 }, // Tổng số tiết
    morningPeriods: { type: Number, required: true, default: 4 }, // Sáng
    afternoonPeriods: { type: Number, default: 3 }, // Sẽ tính lại
  },
  { _id: false }
);

const SpecialBreakSchema = new mongoose.Schema(
  {
    period: { type: Number, required: true }, // Tiết áp dụng
    session: { type: String, enum: ["morning", "afternoon"], required: true }, // Buổi
    minutes: { type: Number, required: true }, // Thời gian nghỉ đặc biệt
  },
  { _id: false }
);

const ActivitySlotSchema = new mongoose.Schema(
  {
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: "Activity", required: true },
    periodsPerWeek: { type: Number, required: true },
    session: { type: String, enum: ["main", "extra"], required: true },
  },
  { _id: false }
);
const GradeSessionRuleSchema = new mongoose.Schema(
  {
    grade: { type: String, enum: ["10", "11", "12"], required: true },
    session: { type: String, enum: ["morning", "afternoon", "both"], required: true },
  },
  { _id: false }
);
const SubjectHourSchema = new mongoose.Schema(
  {
    periodsPerWeek: { type: Number, required: true, default: 4 },
    maxPeriodsPerDay: { type: Number, required: true, default: 2 },
    allowConsecutive: { type: Boolean, default: true },
    session: {
      type: String,
      enum: ["main", "extra"], // main = buổi chính, extra = buổi phụ
      default: "main",
    },
    
  },
  { _id: false }
);

const ScheduleConfigSchema = new mongoose.Schema(
  {
    // --- Cấu hình chung ---
    defaultStartTimeMorning: { type: String, default: "07:00" },
    defaultStartTimeAfternoon: { type: String, default: "13:00" },
    minutesPerPeriod: { type: Number, default: 45 },
    defaultBreakMinutes: { type: Number, default: 5 },
    specialBreaks: { type: [SpecialBreakSchema], default: [] },
    activities: { type: [ActivitySlotSchema], default: [] },

    // --- Cấu hình từng ngày ---
    days: {
      type: Map,
      of: DailyScheduleSchema,
      default: {},
    },

    // --- Số tiết / tuần & config cho từng môn ---
    subjectHours: {
      type: Map,
      of: SubjectHourSchema,
      default: {},
    },
    gradeSessionRules: { type: [GradeSessionRuleSchema], default: [] },
  },
  { timestamps: true }
);

// Middleware tự tính afternoonPeriods khi lưu
ScheduleConfigSchema.pre("save", function (next) {
  if (this.days && this.days instanceof Map) {
    for (const [day, config] of this.days.entries()) {
      if (config.totalPeriods != null && config.morningPeriods != null) {
        config.afternoonPeriods = Math.max(0, config.totalPeriods - config.morningPeriods);
      }
    }
  }
  next();
});


ScheduleConfigSchema.path("days").validate(function (days) {
  for (const [day, cfg] of days.entries()) {
    if (cfg.morningPeriods > cfg.totalPeriods) {
      throw new Error(`Buổi sáng (${cfg.morningPeriods}) vượt quá tổng (${cfg.totalPeriods}) cho thứ ${day}`);
    }
  }
  return true;
});

ScheduleConfigSchema.statics.getOrCreateConfig = async function () {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({
      days: new Map([
        ["Monday",    { totalPeriods: 9, morningPeriods: 5, afternoonPeriods: 4 }],
        ["Tuesday",   { totalPeriods: 9, morningPeriods: 5, afternoonPeriods: 4 }],
        ["Wednesday", { totalPeriods: 9, morningPeriods: 5, afternoonPeriods: 4 }],
        ["Thursday",  { totalPeriods: 9, morningPeriods: 5, afternoonPeriods: 4 }],
        ["Friday",    { totalPeriods: 10, morningPeriods: 5, afternoonPeriods: 5 }],
        ["Saturday",  { totalPeriods: 9, morningPeriods: 5, afternoonPeriods: 4 }],
      ]),
      
    });
  }
  return config;
};

const ScheduleConfig = mongoose.model("ScheduleConfig", ScheduleConfigSchema);
module.exports = ScheduleConfig;
