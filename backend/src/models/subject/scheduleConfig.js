const mongoose = require("mongoose");

const DailyScheduleSchema = new mongoose.Schema(
  {
    totalPeriods: { type: Number, default: 10 },
    morningPeriods: { type: Number, default: 5 },
    afternoonPeriods: { type: Number, default: 5 },
  },
  { _id: false }
);

const SpecialBreakSchema = new mongoose.Schema(
  {
    period: { type: Number, required: true },
    session: { type: String, enum: ["morning", "afternoon"], required: true },
    minutes: { type: Number, required: true },
  },
  { _id: false }
);

const SubjectFixedSlotsSchema = new mongoose.Schema(
  {
    dayOfWeek: { type: String, required: true },
    periods: [{ type: Number, required: true }],
  },
  { _id: false }
);

const ActivityFixedSlotsSchema = new mongoose.Schema(
  {
    dayOfWeek: { type: String, required: true },
    period: { type: Number, required: true },
  },
  { _id: false }
);

const ActivitySlotSchema = new mongoose.Schema(
  {
    activityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Activity",
      required: true,
    },

    periodsPerWeek: { type: Number, default: 0 }, // ✅ Default 0, không required

    session: {
      type: String,
      enum: ["main", "extra"],
      default: "main",
    },

    isPermanent: { type: Boolean, default: false },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },

    fixedSlots: {
      type: ActivityFixedSlotsSchema,
      default: null,
    },

    // ✅ Phân bổ số tiết theo lớp (classId -> periodsPerWeek)
    classPeriods: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },
  },
  { _id: false }
);

const GradeSessionRuleSchema = new mongoose.Schema(
  {
    grade: { type: String, enum: ["10", "11", "12"] },
    session: { type: String, enum: ["morning", "afternoon", "both"] },
  },
  { _id: false }
);

const SubjectHourSchema = new mongoose.Schema(
  {
    periodsPerWeek: { type: Number, default: 0 }, // ✅ Default 0, không required

    session: {
      type: String,
      enum: ["main", "extra"],
      default: "main",
    },

    maxPeriodsPerDay: { type: Number, default: 0 }, // ✅ Default 0

    allowConsecutive: { type: Boolean, default: false }, // ✅ Default false

    fixedSlots: {
      type: SubjectFixedSlotsSchema,
      default: null,
    },

    // ✅ Phân bổ số tiết theo lớp (classId -> periodsPerWeek)
    classPeriods: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },
  },
  { _id: false }
);

const ScheduleGradeConfigSchema = new mongoose.Schema(
  {
    subjects: {
      type: Map,
      of: SubjectHourSchema,
      default: () => new Map(),
    },

    activities: {
      type: [ActivitySlotSchema],
      default: [],
    },

    rules: {
      type: GradeSessionRuleSchema,
      default: null,
    },
  },
  { _id: false }
);

const ScheduleConfigSchema = new mongoose.Schema(
  {
    defaultStartTimeMorning: { type: String, default: "07:00" },
    defaultStartTimeAfternoon: { type: String, default: "13:00" },
    minutesPerPeriod: { type: Number, default: 45 },
    defaultBreakMinutes: { type: Number, default: 5 },

    specialBreaks: { type: [SpecialBreakSchema], default: [] },

    days: {
      type: Map,
      of: DailyScheduleSchema,
      default: () => new Map(),
    },

    gradeConfigs: {
      type: Map,
      of: ScheduleGradeConfigSchema,
      default: () => new Map(),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ScheduleConfig", ScheduleConfigSchema);
