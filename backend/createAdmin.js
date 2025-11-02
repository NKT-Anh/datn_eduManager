const admin = require('./src/config/firebaseAdmin');
const mongoose = require("mongoose");
const Account = require('./src/models/user/account');
const User = require('./src/models/user/user');
require('dotenv').config();

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Mongo connected');

    const userRecord = await admin.auth().createUser({
      email: 'teacher1@gmail.com',
      password: '123456',
      displayName: 'teacher1',
      phoneNumber: '+84123456789',
    });

    const newAdmin = new Admin({
      uid: userRecord.uid,
      email: userRecord.email,
      role: 'teacher',
      name: userRecord.displayName,
      phone: userRecord.phoneNumber,
      permissions: 'all', // tuỳ schema bạn đặt
    });
    await newAdmin.save();
    console.log('✅ Admin created');
    process.exit();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

createAdmin();