const mongoose = require('mongoose');
const Grade = require('./src/models/class/grade');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB connection error:", err));

async function initGrades() {
  try {
    const defaultGrades = [
      {
        name: '10',
        code: 'GRADE10',
        level: 'high',
        order: 1,
        description: 'Khối 10'
      },
      {
        name: '11',
        code: 'GRADE11',
        level: 'high',
        order: 2,
        description: 'Khối 11'
      },
      {
        name: '12',
        code: 'GRADE12',
        level: 'high',
        order: 3,
        description: 'Khối 12'
      }
    ];

    let created = 0;
    let skipped = 0;

    for (const gradeData of defaultGrades) {
      // Kiểm tra xem khối đã tồn tại chưa
      const existing = await Grade.findOne({ 
        $or: [
          { name: gradeData.name }, 
          { code: gradeData.code }
        ] 
      });

      if (existing) {
        console.log(`⏭️  Khối ${gradeData.name} đã tồn tại, bỏ qua`);
        skipped++;
      } else {
        const grade = await Grade.create(gradeData);
        console.log(`✅ Đã tạo khối: ${grade.name} (${grade.code})`);
        created++;
      }
    }

    console.log(`\n📊 Kết quả:`);
    console.log(`   ✅ Đã tạo: ${created} khối`);
    console.log(`   ⏭️  Đã bỏ qua: ${skipped} khối`);
    console.log(`\n🎉 Hoàn tất!`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi khi khởi tạo khối:", error);
    process.exit(1);
  }
}

initGrades();
















