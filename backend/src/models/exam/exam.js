const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ExamSchedule = require('./examSchedule');

const examSchema = new Schema({
examId: { 
  type: String, 
  required: true, 
  unique: true,
},

  name: { type: String, required: true },
  year: { type: String, required: true, match: /^\d{4}-\d{4}$/ },
  semester: { type: String, enum: ['1', '2'], required: true },
  type: { type: String, enum: ['regular', 'mock', 'graduation'], default: 'regular' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  grades: { type: [String], enum: ['10', '11', '12'], required: true },
  status: { type: String, enum: ['draft', 'published', 'locked', 'archived'], default: 'draft' },
  description: String,
  note: String,
  createdBy: { type: String },
  updatedBy: { type: String },
    // isArchived: { type: Boolean, default: false },
  config: {
    autoSplitRoom: { type: Boolean, default: true },
    maxStudentsPerRoom: { type: Number, default: 24 }
  }
}, { timestamps: true });

examSchema.pre('save', function(next) {
  if (this.startDate >= this.endDate) {
    return next(new Error('startDate phải nhỏ hơn endDate'));
  }
  next();
});
examSchema.post("findOneAndUpdate", async function (doc) {
  if (!doc) return;
  await syncExamScheduleStatus(doc);
});

// Khi dùng .save()
examSchema.post("save", async function (doc) {
  if (!doc) return;
  await syncExamScheduleStatus(doc);
});

/* =========================================================
   🧩 Hàm đồng bộ trạng thái dùng chung
========================================================= */
async function syncExamScheduleStatus(doc) {
  try {
    const newStatus = doc.status;
    if (!newStatus) return;

    console.log(`🔄 Đồng bộ ExamSchedule của kỳ "${doc.name}" sang trạng thái "${newStatus}"`);

    const statusMap = {
      draft: "draft",
      published: "confirmed",
      locked: "completed",
      archived: "completed",
    };

    const mapped = statusMap[newStatus] || "draft";

    const result = await require("./examSchedule").updateMany(
      { exam: doc._id },
      { $set: { status: mapped } }
    );

    console.log(
      `✅ Cập nhật ${result.modifiedCount || 0} lịch thi của kỳ "${doc.name}" sang "${mapped}"`
    );
  } catch (err) {
    console.error("❌ Lỗi đồng bộ ExamSchedule:", err);
  }
}


examSchema.index({ year: 1, semester: 1 });
examSchema.index({ status: 1 });
examSchema.index({ grades: 1 });

module.exports = mongoose.model('Exam', examSchema);
