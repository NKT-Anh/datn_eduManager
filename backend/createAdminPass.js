// scripts/createAdmin.js
const admin = require('./src/config/firebaseAdmin');
const mongoose = require("mongoose");
const Account = require('./src/models/user/account');
const User = require('./src/models/user/user');
require("dotenv").config();

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log("MongoDB connected"))
.catch(err => console.error(err));

async function createAdminPass() {
  try {
    const phone = "0397090096"; // Số điện thoại admin
    const formattedPhone = phone.startsWith('+') ? phone : (phone.startsWith('0') ? '+84' + phone.substring(1) : '+84' + phone);
    const email = "anh.nkt.lt@gmail.com"; // Email (nếu muốn login bằng email)
    const password = "123456"; // Password (nếu dùng email)
    const name = "Nguyễn Khang Thái Admin";

    let userRecord;
    let isNewUser = false;

    // ✅ Kiểm tra xem email hoặc phone đã tồn tại chưa
    try {
      // Thử tìm user theo email
      if (email) {
        try {
          userRecord = await admin.auth().getUserByEmail(email);
          console.log("✅ Tìm thấy user với email:", email);
        } catch (emailError) {
          if (emailError.code === 'auth/user-not-found') {
            // Thử tìm theo phone
            try {
              userRecord = await admin.auth().getUserByPhoneNumber(formattedPhone);
              console.log("✅ Tìm thấy user với số điện thoại:", formattedPhone);
            } catch (phoneError) {
              if (phoneError.code === 'auth/user-not-found') {
                // User chưa tồn tại, tạo mới
                isNewUser = true;
                userRecord = await admin.auth().createUser({
                  phoneNumber: formattedPhone,
                  displayName: name,
                  email: email,
                  password: password
                });
                console.log("✅ Đã tạo user mới trên Firebase");
              } else {
                throw phoneError;
              }
            }
          } else {
            throw emailError;
          }
        }
      } else {
        // Chỉ có phone, thử tìm theo phone
        try {
          userRecord = await admin.auth().getUserByPhoneNumber(formattedPhone);
          console.log("✅ Tìm thấy user với số điện thoại:", formattedPhone);
        } catch (phoneError) {
          if (phoneError.code === 'auth/user-not-found') {
            // User chưa tồn tại, tạo mới
            isNewUser = true;
            userRecord = await admin.auth().createUser({
              phoneNumber: formattedPhone,
              displayName: name,
              email: email,
              password: password
            });
            console.log("✅ Đã tạo user mới trên Firebase");
          } else {
            throw phoneError;
          }
        }
      }

      // ✅ Nếu user đã tồn tại, cập nhật thông tin (nếu cần)
      if (!isNewUser) {
        try {
          const updateData = {
            displayName: name
          };
          
          // Cập nhật email nếu khác với email hiện tại
          if (email && userRecord.email !== email) {
            updateData.email = email;
            console.log(`📧 Đang cập nhật email từ "${userRecord.email}" sang "${email}"`);
          }
          
          // Cập nhật password nếu có
          if (password) {
            updateData.password = password;
          }
          
          await admin.auth().updateUser(userRecord.uid, updateData);
          console.log("✅ Đã cập nhật thông tin user trên Firebase");
          
          // Lấy lại thông tin user sau khi cập nhật
          userRecord = await admin.auth().getUser(userRecord.uid);
        } catch (updateError) {
          if (updateError.code === 'auth/email-already-exists') {
            console.warn("⚠️ Email đã được sử dụng bởi tài khoản khác. Giữ nguyên email hiện tại.");
          } else {
            console.warn("⚠️ Không thể cập nhật thông tin user:", updateError.message);
          }
        }
      }
    } catch (error) {
      if (error.code === 'auth/email-already-exists' || error.code === 'auth/phone-number-already-exists') {
        // User đã tồn tại, lấy thông tin
        if (error.code === 'auth/email-already-exists' && email) {
          userRecord = await admin.auth().getUserByEmail(email);
        } else if (error.code === 'auth/phone-number-already-exists') {
          userRecord = await admin.auth().getUserByPhoneNumber(formattedPhone);
        }
        console.log("✅ User đã tồn tại trên Firebase, sử dụng UID:", userRecord.uid);
      } else {
        throw error;
      }
    }

    // ✅ Kiểm tra xem Account đã tồn tại trong MongoDB chưa
    let account = await Account.findOne({ uid: userRecord.uid });
    if (account) {
      console.log("⚠️ Account đã tồn tại trong MongoDB:", {
        _id: account._id,
        uid: account.uid,
        email: account.email,
        role: account.role
      });
      
      // Cập nhật thông tin nếu cần
      let accountUpdated = false;
      if (email && account.email !== email) {
        account.email = email;
        accountUpdated = true;
        console.log(`✅ Đã cập nhật email cho account: ${email}`);
      }
      if (formattedPhone && account.phone !== formattedPhone) {
        account.phone = formattedPhone;
        accountUpdated = true;
        console.log(`✅ Đã cập nhật phone cho account: ${formattedPhone}`);
      }
      if (accountUpdated) {
        await account.save();
      }
    } else {
      // Tạo Account mới trong MongoDB
      account = await Account.create({
        uid: userRecord.uid,
        phone: formattedPhone,
        email: email,
        role: "admin"
      });
      console.log("✅ Đã tạo Account mới trong MongoDB:", {
        _id: account._id,
        uid: account.uid,
        email: account.email,
        role: account.role
      });
    }

    // ✅ Kiểm tra xem User document đã tồn tại chưa
    let adminUser = await User.findOne({ accountId: account._id });
    if (adminUser) {
      console.log("⚠️ User document đã tồn tại:", {
        _id: adminUser._id,
        name: adminUser.name,
        accountId: adminUser.accountId
      });
      
      // Cập nhật thông tin nếu cần
      if (name && adminUser.name !== name) {
        adminUser.name = name;
        await adminUser.save();
        console.log("✅ Đã cập nhật tên cho user");
      }
      if (formattedPhone && adminUser.phone !== formattedPhone) {
        adminUser.phone = formattedPhone;
        await adminUser.save();
        console.log("✅ Đã cập nhật phone cho user");
      }
    } else {
      // Tạo User document mới
      adminUser = await User.create({
        accountId: account._id,
        name: name,
        phone: formattedPhone
      });
      console.log("✅ Đã tạo User document mới:", {
        _id: adminUser._id,
        name: adminUser.name,
        accountId: adminUser.accountId
      });
    }

    console.log("\n🎉 Hoàn tất! Thông tin admin:");
    console.log("   - UID:", userRecord.uid);
    console.log("   - Email (Firebase):", userRecord.email || "N/A");
    console.log("   - Email (MongoDB):", account.email || "N/A");
    console.log("   - Phone:", formattedPhone);
    console.log("   - Name:", name);
    console.log("   - Role: admin");
    console.log("   - Account ID:", account._id);
    console.log("   - User ID:", adminUser._id);
    console.log("\n📝 Bạn có thể đăng nhập với:");
    console.log("   - Email:", userRecord.email || account.email || "N/A");
    console.log("   - Phone:", formattedPhone);
    console.log("   - Password:", password ? "***" : "N/A (chỉ dùng Phone Auth)");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi tạo admin:", error.message);
    if (error.code) {
      console.error("   - Error code:", error.code);
    }
    process.exit(1);
  }
}

createAdminPass();
