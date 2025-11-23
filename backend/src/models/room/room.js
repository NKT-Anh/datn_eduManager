// models/room/room.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * 🏫 Room Schema (phòng học hoặc phòng thi)
 * Dùng cho quản lý phòng học thông thường, và sau này có thể liên kết vào kỳ thi.
 */
const roomSchema = new Schema(
  {
    roomCode: { type: String, required: true, unique: true, trim: true }, // VD: A101
    name: { type: String, trim: true }, // VD: Phòng Toán 1
    // floor: { type: Number, default: 1 }, // tầng (nếu cần)
    type: {
      type: String,
      enum: ["normal", "lab", "computer"],
      default: "normal",
    },
    status: {
      type: String,
      enum: ["available", "maintenance", "inactive"],
      default: "available",
    },
    note: { type: String },
  },
  { timestamps: true }
);

roomSchema.index({ roomCode: 1 });

module.exports = mongoose.model("Room", roomSchema);
