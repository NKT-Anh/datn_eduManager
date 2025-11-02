// scripts/createAdmin.js
const admin = require('./src/config/firebaseAdmin');
const mongoose = require("mongoose");
const Account = require('./src/models/user/account');
const User = require('./src/models/user/user');
require("dotenv").config();

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.error(err));

async function createAdminPass() {
  try {
    const phone = "+84912345178"; // Số điện thoại admin
    const email = "adminweb@gmail.com"; // Email (nếu muốn login bằng email)
    const password = "123456"; // Password (nếu dùng email)
    const name = "Nguyễn Khang Thái Admin";

    // Tạo user trên Firebase
    const userRecord = await admin.auth().createUser({
      phoneNumber: phone,
      displayName: name,
      email: email,
      password: password
    });

    // Lưu vào MongoDB Account
    const account = await Account.create({
      uid: userRecord.uid,
      phone: phone,
      email: email,
      role: "admin"
    });

    // Tạo User document cho admin
    const adminUser = await User.create({
      accountId: account._id,
      name: name,
      phone: phone
      // address, dob, gender sẽ để trống, có thể cập nhật sau
    });

    console.log("Admin Account created:", account);
    console.log("Admin User created:", adminUser);
    process.exit(0);
  } catch (error) {
    console.error("Lỗi tạo admin:", error);
    process.exit(1);
  }
}

createAdminPass();
