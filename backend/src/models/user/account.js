const mongoose = require('mongoose');
const accountSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    // Role chính: chỉ có 3 roles cơ bản
    role: {
        type: String,
        enum: ['admin', 'student', 'teacher'],
        required: true,
    },
    // ✅ OTP tạm thời cho reset password qua email
    tempOTP: { type: String },
    tempOTPExpiry: { type: Date },
    // ✅ OTP cho đăng nhập
    loginOTP: { type: String },
    loginOTPExpiry: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Account = mongoose.model('Account', accountSchema);
module.exports = Account;