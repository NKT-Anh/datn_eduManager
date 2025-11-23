/**
 * Script để sửa lỗi index trong collection examstudents
 * Chạy: node backend/fixExamStudentIndex.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function fixIndex() {
  try {
    // Kết nối MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('examstudents');

    // 1. Xóa các document có exam hoặc student là null
    console.log('🧹 Đang xóa các document có exam hoặc student là null...');
    const deleteResult = await collection.deleteMany({
      $or: [
        { exam: null },
        { student: null },
        { examId: { $exists: true } }, // Xóa document có field examId cũ
        { studentId: { $exists: true } }, // Xóa document có field studentId cũ
      ]
    });
    console.log(`✅ Đã xóa ${deleteResult.deletedCount} document không hợp lệ`);

    // 2. Xóa index cũ nếu có
    console.log('🗑️ Đang xóa các index cũ...');
    try {
      await collection.dropIndex('examId_1_studentId_1');
      console.log('✅ Đã xóa index examId_1_studentId_1');
    } catch (err) {
      if (err.code !== 27) { // 27 = IndexNotFound
        console.log('⚠️ Index examId_1_studentId_1 không tồn tại hoặc đã bị xóa');
      }
    }

    try {
      await collection.dropIndex('exam_1_student_1');
      console.log('✅ Đã xóa index exam_1_student_1 cũ');
    } catch (err) {
      if (err.code !== 27) {
        console.log('⚠️ Index exam_1_student_1 không tồn tại');
      }
    }

    try {
      await collection.dropIndex('exam_1_sbd_1');
      console.log('✅ Đã xóa index exam_1_sbd_1 cũ');
    } catch (err) {
      if (err.code !== 27) {
        console.log('⚠️ Index exam_1_sbd_1 không tồn tại');
      }
    }

    // 3. Tạo lại index mới với sparse: true
    console.log('📝 Đang tạo lại index...');
    await collection.createIndex(
      { exam: 1, student: 1 },
      { unique: true, sparse: true, name: 'exam_1_student_1' }
    );
    console.log('✅ Đã tạo index exam_1_student_1');

    await collection.createIndex(
      { exam: 1, sbd: 1 },
      { unique: true, sparse: true, name: 'exam_1_sbd_1' }
    );
    console.log('✅ Đã tạo index exam_1_sbd_1');

    await collection.createIndex(
      { room: 1 },
      { name: 'room_1' }
    );
    console.log('✅ Đã tạo index room_1');

    // 4. Liệt kê tất cả index
    const indexes = await collection.indexes();
    console.log('\n📋 Danh sách index hiện tại:');
    indexes.forEach((idx) => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    console.log('\n✅ Hoàn tất!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi:', err);
    process.exit(1);
  }
}

fixIndex();

