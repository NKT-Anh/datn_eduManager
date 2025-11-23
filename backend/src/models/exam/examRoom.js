const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * 🏫 ExamRoom - Phòng thi riêng từng môn (gắn với lịch thi cụ thể)
 * 
 * - Gắn với lịch thi cụ thể (ExamSchedule)
 * - Có reference đến FixedExamRoom (phòng lý thuyết) để lấy danh sách học sinh
 * - Có reference đến Room (phòng vật lý thật) để biết phòng thực tế
 * - Liên kết FixedExamRoom (lý thuyết) với Room (vật lý)
 * 
 * ⚠️ QUAN TRỌNG: 
 * - CÙNG 1 FixedExamRoom (nhóm học sinh) có thể thi ở PHÒNG VẬT LÝ KHÁC NHAU cho mỗi môn/ngày
 * - Ví dụ: FixedExamRoom "10-1" (20 học sinh)
 *   + Môn Toán (schedule1): thi ở A101
 *   + Môn Văn (schedule2): thi ở A102  
 *   + Môn Anh (schedule3): thi ở Lab1
 * - Mỗi schedule sẽ có ExamRoom riêng, nhưng cùng reference đến FixedExamRoom
 * 
 * ⚠️ LƯU Ý: 
 * - fixedExamRoom: Phòng lý thuyết (chứa danh sách học sinh) - ỔN ĐỊNH
 * - room: Phòng vật lý thật (A101, A102, Lab1...) - CÓ THỂ KHÁC NHAU theo từng schedule
 * - ExamRoom = Cầu nối giữa FixedExamRoom (lý thuyết) và Room (vật lý) cho từng schedule
 */
const examRoomSchema = new Schema({
  exam: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
  
  // 🔗 Lịch thi (bắt buộc - phòng thi riêng từng môn)
  schedule: { 
    type: Schema.Types.ObjectId, 
    ref: "ExamSchedule",
    required: true 
  },
  
  // 🔗 Phòng thi cố định (để lấy danh sách học sinh)
  fixedExamRoom: { 
    type: Schema.Types.ObjectId, 
    ref: "FixedExamRoom", 
    required: true 
  },
  
  // 🏢 Phòng thực tế từ Room model (phòng vật lý thật)
  // ✅ FixedExamRoom = phòng lý thuyết (chứa danh sách học sinh)
  // ✅ Room = phòng vật lý thật (A101, A102, Lab1, Computer1...)
  // ✅ ExamRoom liên kết FixedExamRoom (lý thuyết) với Room (vật lý)
  room: { type: Schema.Types.ObjectId, ref: "Room", required: true }, // ✅ Bắt buộc phải có phòng vật lý
  roomCode: { type: String, required: true }, // ✅ Mã phòng vật lý (từ Room.roomCode)
  type: { type: String, enum: ["normal", "lab", "computer"], default: "normal" }, // ✅ Loại phòng vật lý (từ Room.type)
  grade: { type: String }, // 🔹 thêm để lọc theo khối
  
  // 👨‍🏫 Giám thị (riêng cho từng lịch thi)
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
   - Tính từ số học sinh trong fixedExamRoom
========================================================= */
examRoomSchema.pre("save", async function (next) {
  try {
    if (this.fixedExamRoom) {
      const FixedExamRoom = require("./fixedExamRoom");
      const fixedRoom = await FixedExamRoom.findById(this.fixedExamRoom);
      if (fixedRoom) {
        const studentCount = fixedRoom.students?.length || 0;
        this.isFull = studentCount >= this.capacity;
      }
    }
  } catch (err) {
    // Bỏ qua lỗi, không làm gián đoạn việc save
  }
  next();
});

/* =========================================================
   ⚡ Index để tối ưu truy vấn
========================================================= */
examRoomSchema.index({ exam: 1 });
examRoomSchema.index({ schedule: 1 });
examRoomSchema.index({ fixedExamRoom: 1 });
examRoomSchema.index({ roomCode: 1 });
examRoomSchema.index({ "invigilators.teacher": 1 });
// ✅ Index unique: không cho phép trùng roomCode trong cùng exam và schedule
// ✅ Cho phép cùng FixedExamRoom có nhiều ExamRoom với schedule khác nhau (phòng vật lý khác nhau)
examRoomSchema.index({ exam: 1, schedule: 1, roomCode: 1 }, { unique: true });


module.exports = mongoose.model("ExamRoom", examRoomSchema);
