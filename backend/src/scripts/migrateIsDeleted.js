// ✅ Migration script: Set isDeleted = false cho tất cả document hiện tại chưa có trường này
// Chạy: node backend/src/scripts/migrateIsDeleted.js

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Student = require('../models/user/student');
const Teacher = require('../models/user/teacher');
const Class = require('../models/class/class');
const Subject = require('../models/subject/subject');
const GradeSummary = require('../models/grade/gradeSummary');
const GradeItem = require('../models/grade/gradeItem');
const TeachingAssignment = require('../models/subject/teachingAssignment');
const Department = require('../models/subject/department');
const Activity = require('../models/subject/activity');
const Room = require('../models/room/room');
const Schedule = require('../models/subject/schedule');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/eduManager';

async function migrateIsDeleted() {
  try {
    console.log('🔌 Đang kết nối MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB');

    const models = [
      { name: 'Student', model: Student },
      { name: 'Teacher', model: Teacher },
      { name: 'Class', model: Class },
      { name: 'Subject', model: Subject },
      { name: 'GradeSummary', model: GradeSummary },
      { name: 'GradeItem', model: GradeItem },
      { name: 'TeachingAssignment', model: TeachingAssignment },
      { name: 'Department', model: Department },
      { name: 'Activity', model: Activity },
      { name: 'Room', model: Room },
      { name: 'Schedule', model: Schedule },
    ];

    console.log('📋 Bắt đầu migration isDeleted cho các models...\n');

    let totalUpdated = 0;

    for (const { name, model } of models) {
      try {
        // Tìm tất cả document chưa có isDeleted hoặc isDeleted = null
        const result = await model.updateMany(
          {
            $or: [
              { isDeleted: { $exists: false } },
              { isDeleted: null }
            ]
          },
          {
            $set: { isDeleted: false }
          }
        );

        if (result.modifiedCount > 0) {
          console.log(`✅ ${name}: Đã cập nhật ${result.modifiedCount} documents`);
          totalUpdated += result.modifiedCount;
        } else {
          console.log(`ℹ️  ${name}: Không có document nào cần cập nhật`);
        }
      } catch (error) {
        console.error(`❌ Lỗi khi migrate ${name}:`, error.message);
      }
    }

    console.log(`\n🎉 Hoàn thành! Tổng cộng đã cập nhật ${totalUpdated} documents`);
    console.log('✅ Tất cả document hiện tại đã có isDeleted = false');

  } catch (error) {
    console.error('❌ Lỗi migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Đã ngắt kết nối MongoDB');
    process.exit(0);
  }
}

// Chạy migration
migrateIsDeleted();

