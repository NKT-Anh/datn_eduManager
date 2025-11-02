const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
    },
    type: {
      type: String,
      enum: ['weekly', 'special'], // weekly: hàng tuần, special: đặc biệt
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    grades: {
      type: [String],
      enum: ['10', '11', '12'],
      default: [],
    },
    dayOfWeek: {
      type: String, // ví dụ: Monday, Friday
    },
    timeSlot: {
      type: String, // ví dụ: "Tiết 1" hoặc "07:00 - 07:45"
    },
    startDate: {
      type: Date, // ngày bắt đầu áp dụng (vd: 2025-09-01)
      required: true,
    },
    endDate: {
      type: Date, // ngày kết thúc áp dụng (vd: 2026-05-31)
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Activity = mongoose.model('Activity', activitySchema);
module.exports = Activity;
