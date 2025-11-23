const mongoose = require("mongoose");
const User = require("./user");

const studentSchema = new mongoose.Schema(
  {
    /* =========================================================
       🆔 Thông tin định danh
    ========================================================== */
    studentCode: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      uppercase: true,
       immutable: true,
    },

    // Liên kết với tài khoản lớp học hiện tại
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null,
    },

    /* =========================================================
       📚 Thông tin học tập
    ========================================================== */
    admissionYear: { type: Number, required: true }, // năm nhập học (VD: 2023)
    grade: {
      type: String,
      enum: ["10", "11", "12"],
      required: true,
    },
    currentYear: {
      type: String,
      match: /^\d{4}-\d{4}$/, // định dạng: 2025-2026
    },

    /* =========================================================
       👨‍👩‍👧‍👦 Phụ huynh
    ========================================================== */
    parentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Parent",
        default: [],
      },
    ],

    /* =========================================================
       🏫 Trạng thái học sinh
    ========================================================== */
    status: {
      type: String,
      enum: ["active", "inactive", "graduated", "suspended", "transferred"],
      default: "active",
    },

    /* =========================================================
       🪪 Thông tin cá nhân
    ========================================================== */
    ethnic: { type: String }, // Dân tộc (VD: Kinh, Hoa, Khmer)
    religion: { type: String }, // Tôn giáo
    idNumber: { type: String }, // CCCD / CMND
    birthPlace: { type: String }, // Nơi sinh (trên giấy khai sinh)
    hometown: { type: String }, // Quê quán (VD: Bình Dương)
    address: { type: String }, // Địa chỉ thường trú
    avatarUrl: { type: String }, // Ảnh đại diện
    note: { type: String }, // Ghi chú thêm (VD: học sinh chuyển trường, học sinh giỏi, ...)

  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    collection: 'users',
  }
);

/* =========================================================
   🔁 Đồng bộ dữ liệu lớp → học sinh khi lưu
========================================================= */
// studentSchema.pre("save", async function (next) {
//   try {
//     if (this.classId) {
//       const Class = mongoose.model("Class");
//       const c = await Class.findById(this.classId);
//       if (c) {
//         this.grade = c.grade;
//         this.currentYear = c.year; // ví dụ "2025-2026"
//       }
//     }

//     // Nếu chưa có currentYear, tự động điền theo năm học hiện tại
//     if (!this.currentYear) {
//       const now = new Date();
//       const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
//       this.currentYear = `${start}-${start + 1}`;
//     }
//   } catch (err) {
//     console.error("⚠️ Lỗi khi đồng bộ grade/currentYear:", err.message);
//   }
//   next();
// });
studentSchema.pre("save", async function (next) {
  try {
    if (this.isModified("classId") && this.classId) {
      const Class = mongoose.model("Class");
      const c = await Class.findById(this.classId);
      if (c) {
        this.grade = c.grade;
        this.currentYear = c.year;
      }
    }

    if (!this.currentYear) {
      const now = new Date();
      const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      this.currentYear = `${start}-${start + 1}`;
    }
  } catch (err) {
    console.error("⚠️ Lỗi khi đồng bộ grade/currentYear:", err.message);
  }
  next();
});


/* =========================================================
   🧠 Virtuals (thuộc tính ảo)
========================================================= */
studentSchema.virtual("className", {
  ref: "Class",
  localField: "classId",
  foreignField: "_id",
  justOne: true,
  options: { select: "className grade year" },
});

/* =========================================================
   ⚙️ Index tối ưu hiệu năng
========================================================= */
studentSchema.index({ studentCode: 1 }, { unique: true });
studentSchema.index({ classId: 1, status: 1 });
studentSchema.index({ currentYear: 1 });

/* =========================================================
   📘 Export Model
========================================================= */
const Student = User.discriminator("Student", studentSchema);
module.exports = Student;
