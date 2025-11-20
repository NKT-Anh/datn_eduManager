const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * 🏫 FixedExamRoom - Phòng thi cố định "trên lý thuyết" suốt kỳ thi
 * 
 * - Chỉ chứa danh sách học sinh được phân phòng đều
 * - Mã code tự động: Grade + i (VD: "10-1", "10-2", "11-1"...)
 * - KHÔNG có roomCode, type từ Room model (đây là phòng lý thuyết)
 * - Phải được liên kết với Room vật lý thật thông qua ExamRoom
 * 
 * ⚠️ QUAN TRỌNG:
 * - FixedExamRoom là phòng "lý thuyết" - ỔN ĐỊNH suốt kỳ thi
 * - CÙNG 1 FixedExamRoom có thể thi ở PHÒNG VẬT LÝ KHÁC NHAU cho mỗi môn/ngày
 * - Mỗi ExamRoom (cho từng schedule) sẽ liên kết FixedExamRoom với Room vật lý cụ thể
 * 
 * Ví dụ:
 * - FixedExamRoom "10-1" có 20 học sinh
 * - Schedule Toán: ExamRoom { fixedExamRoom: "10-1", room: A101 }
 * - Schedule Văn: ExamRoom { fixedExamRoom: "10-1", room: A102 }
 * - Schedule Anh: ExamRoom { fixedExamRoom: "10-1", room: Lab1 }
 */
const fixedExamRoomSchema = new Schema({
  exam: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
  grade: { type: String, required: true }, // Khối học (VD: "10", "11", "12")
  
  // 🔢 Mã code tự động: Grade + i (VD: "10-1", "10-2", "11-1"...)
  code: { type: String, required: true, unique: false }, // Không unique vì có thể trùng giữa các exam khác nhau
  
  // 👥 Danh sách học sinh trong phòng này
  students: [{ type: Schema.Types.ObjectId, ref: "ExamStudent" }],
  
  // 📊 Sức chứa (tính từ số học sinh hiện tại)
  capacity: { type: Number, default: 0 },
  
  note: { type: String },
}, { timestamps: true });

// ✅ Index để tìm kiếm nhanh
fixedExamRoomSchema.index({ exam: 1, grade: 1 });
fixedExamRoomSchema.index({ exam: 1, code: 1 });
fixedExamRoomSchema.index({ code: 1 });

// ✅ Unique index: không cho phép trùng code trong cùng exam và grade
fixedExamRoomSchema.index({ exam: 1, grade: 1, code: 1 }, { unique: true });

module.exports = mongoose.model("FixedExamRoom", fixedExamRoomSchema);

