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
    // ✅ Lưu ý: dayOfWeek, timeSlot, isPermanent, startDate, endDate được lưu trong ScheduleConfig.ActivitySlot, không lưu ở đây
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
