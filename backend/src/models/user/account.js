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
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Account = mongoose.model('Account', accountSchema);
module.exports = Account;