const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const examRoomSchema = new Schema({
  exam: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
  schedule: { type: Schema.Types.ObjectId, ref: "ExamSchedule", required: true },
  room: { type: Schema.Types.ObjectId, ref: "Room" },
  roomCode: { type: String, required: true },
  type: { type: String, enum: ["normal", "lab", "computer"], default: "normal" },
  grade: { type: Number }, // 🔹 thêm để lọc theo khối
  students: [{ type: Schema.Types.ObjectId, ref: "Student" }],
  invigilators: [
    {
      teacher: { type: Schema.Types.ObjectId, ref: "Teacher" },
      role: { type: String, enum: ["main", "assistant"], required: true },
    },
  ],
  capacity: { type: Number, default: 24 },
  isFull: { type: Boolean, default: false },
  note: { type: String },
}, { timestamps: true });

/* =========================================================
   ⚙️ Middleware: Tự động đánh dấu isFull nếu phòng đủ chỗ
========================================================= */
examRoomSchema.pre("save", function (next) {
  this.isFull = this.students?.length >= this.capacity;
  next();
});

/* =========================================================
   ⚡ Index để tối ưu truy vấn
========================================================= */
examRoomSchema.index({ exam: 1 });
examRoomSchema.index({ schedule: 1 });
examRoomSchema.index({ roomCode: 1 });
examRoomSchema.index({ "invigilators.teacher": 1 });
examRoomSchema.index({ exam: 1, schedule: 1, roomCode: 1 }, { unique: true });


module.exports = mongoose.model("ExamRoom", examRoomSchema);
