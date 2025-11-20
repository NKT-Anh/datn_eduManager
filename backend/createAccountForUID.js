// Script tạo account cho UID Firebase đã tồn tại
const admin = require('./src/config/firebaseAdmin');
const mongoose = require("mongoose");
const Account = require('./src/models/user/account');
const Admin = require('./src/models/user/admin');
const Teacher = require('./src/models/user/teacher');
const Student = require('./src/models/user/student');
require("dotenv").config();

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("✅ MongoDB connected");
  console.log("📊 Database:", mongoose.connection.db.databaseName);
  console.log("📁 Collections:", Object.keys(mongoose.connection.collections).join(", "));
})
.catch(err => {
  console.error("❌ MongoDB connection error:", err);
  process.exit(1);
});

async function createAccountForUID() {
  try {
    // ✅ Thay đổi UID này thành UID của bạn
    const uid = "klJBLwrtCzSYuapg5ZjVUVob1Lp1";
    
    // Lấy thông tin user từ Firebase
    const userRecord = await admin.auth().getUser(uid);
    console.log("✅ Tìm thấy user trên Firebase:", {
      uid: userRecord.uid,
      email: userRecord.email,
      phone: userRecord.phoneNumber,
      displayName: userRecord.displayName
    });

    // Kiểm tra xem account đã tồn tại chưa trong collection 'accounts'
    const existingAccount = await Account.findOne({ uid });
    if (existingAccount) {
      console.log("⚠️ Account đã tồn tại trong collection 'accounts':");
      console.log("   - _id:", existingAccount._id);
      console.log("   - uid:", existingAccount.uid);
      console.log("   - email:", existingAccount.email || "N/A");
      console.log("   - role:", existingAccount.role);
      process.exit(0);
      return;
    }

    // Tạo Account trong MongoDB (collection: accounts)
    const account = await Account.create({
      uid: userRecord.uid,
      phone: userRecord.phoneNumber || null,
      email: userRecord.email || null,
      role: "admin" // ✅ Thay đổi role nếu cần (admin, teacher, student)
    });
    console.log("✅ Account created trong collection 'accounts':");
    console.log("   - _id:", account._id);
    console.log("   - uid:", account.uid);
    console.log("   - email:", account.email || "N/A");
    console.log("   - phone:", account.phone || "N/A");
    console.log("   - role:", account.role);

    // Tạo User document dựa trên role (sử dụng discriminator)
    let user;
    if (account.role === "admin") {
      user = await Admin.create({
        accountId: account._id,
        name: userRecord.displayName || "Admin",
        phone: userRecord.phoneNumber || null,
        permissions: "all"
      });
      console.log("✅ Admin User created:", user);
    } else if (account.role === "teacher") {
      user = await Teacher.create({
        accountId: account._id,
        name: userRecord.displayName || "Teacher",
        phone: userRecord.phoneNumber || null
      });
      console.log("✅ Teacher User created:", user);
    } else if (account.role === "student") {
      user = await Student.create({
        accountId: account._id,
        name: userRecord.displayName || "Student",
        phone: userRecord.phoneNumber || null,
        studentCode: userRecord.email?.split("@")[0] || "STU001",
        grade: "10",
        admissionYear: new Date().getFullYear()
      });
      console.log("✅ Student User created:", user);
    } else {
      throw new Error(`Role không hợp lệ: ${account.role}`);
    }

    console.log("\n🎉 Hoàn tất! Bạn có thể đăng nhập với:");
    console.log("   Email:", userRecord.email || "N/A");
    console.log("   Phone:", userRecord.phoneNumber || "N/A");
    console.log("   Role:", account.role);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi:", error.message);
    if (error.code === 'auth/user-not-found') {
      console.error("   → User không tồn tại trên Firebase với UID này");
    }
    process.exit(1);
  }
}

createAccountForUID();

