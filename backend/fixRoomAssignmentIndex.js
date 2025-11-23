/**
 * Script để fix index trong collection roomassignments
 * - Xóa các document có schedule hoặc examStudent là null
 * - Drop và recreate index với sparse: true
 */

require("dotenv").config();
const mongoose = require("mongoose");

async function fixRoomAssignmentIndex() {
  try {
    // ✅ Kết nối MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Đã kết nối MongoDB");

    const db = mongoose.connection.db;
    const collection = db.collection("roomassignments");

    // ✅ 1. Xóa các document có schedule hoặc examStudent là null
    console.log("🧹 Đang xóa các document có schedule hoặc examStudent là null...");
    const deleteResult = await collection.deleteMany({
      $or: [
        { schedule: null },
        { examStudent: null },
      ],
    });
    console.log(`✅ Đã xóa ${deleteResult.deletedCount} document có giá trị null`);

    // ✅ 2. Drop các index cũ (bao gồm cả index cũ với tên khác)
    console.log("🗑️ Đang xóa các index cũ...");
    
    // ✅ Xóa index cũ với tên examScheduleId_1_studentId_1
    try {
      await collection.dropIndex("examScheduleId_1_studentId_1");
      console.log("✅ Đã xóa index examScheduleId_1_studentId_1");
    } catch (err) {
      if (err.code !== 27) { // 27 = IndexNotFound
        console.warn("⚠️ Không tìm thấy index examScheduleId_1_studentId_1:", err.message);
      }
    }

    // ✅ Xóa index cũ với tên schedule_1_examStudent_1
    try {
      await collection.dropIndex("schedule_1_examStudent_1");
      console.log("✅ Đã xóa index schedule_1_examStudent_1");
    } catch (err) {
      if (err.code !== 27) {
        console.warn("⚠️ Không tìm thấy index schedule_1_examStudent_1:", err.message);
      }
    }

    // ✅ Xóa index cũ với tên examRoom_1_seatNumber_1
    try {
      await collection.dropIndex("examRoom_1_seatNumber_1");
      console.log("✅ Đã xóa index examRoom_1_seatNumber_1");
    } catch (err) {
      if (err.code !== 27) {
        console.warn("⚠️ Không tìm thấy index examRoom_1_seatNumber_1:", err.message);
      }
    }
    
    // ✅ Liệt kê tất cả index để kiểm tra
    console.log("📋 Đang liệt kê tất cả index hiện có...");
    const indexes = await collection.indexes();
    console.log("📋 Các index hiện có:", indexes.map(idx => idx.name).join(", "));

    // ✅ 3. Tạo lại index với sparse: true
    console.log("🔨 Đang tạo lại index với sparse: true...");
    await collection.createIndex(
      { schedule: 1, examStudent: 1 },
      { unique: true, sparse: true, name: "schedule_1_examStudent_1" }
    );
    console.log("✅ Đã tạo index schedule_1_examStudent_1 với sparse: true");

    await collection.createIndex(
      { examRoom: 1, seatNumber: 1 },
      { unique: true, sparse: true, name: "examRoom_1_seatNumber_1" }
    );
    console.log("✅ Đã tạo index examRoom_1_seatNumber_1 với sparse: true");

    // ✅ 4. Tạo các index không unique (nếu chưa có)
    try {
      await collection.createIndex({ schedule: 1, examRoom: 1 });
      console.log("✅ Đã tạo index schedule_1_examRoom_1");
    } catch (err) {
      console.warn("⚠️ Index schedule_1_examRoom_1 đã tồn tại hoặc có lỗi:", err.message);
    }

    try {
      await collection.createIndex({ exam: 1 });
      console.log("✅ Đã tạo index exam_1");
    } catch (err) {
      console.warn("⚠️ Index exam_1 đã tồn tại hoặc có lỗi:", err.message);
    }

    console.log("✅ Hoàn thành! Index đã được fix.");
  } catch (err) {
    console.error("❌ Lỗi:", err);
  } finally {
    await mongoose.connection.close();
    console.log("✅ Đã đóng kết nối MongoDB");
  }
}

// ✅ Chạy script
fixRoomAssignmentIndex();

