const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: false },
  name: { type: String, required: true },    // họ tên
  address: { type: String },                 // địa chỉ liên hệ
  phone: { type: String ,sparse: true },
  dob: { type: Date },                       // ngày sinh
  gender: { type: String, enum: ['male', 'female', 'other'] }
  
}, 
{ 
  discriminatorKey: '__t', 
  collection: 'users', 
  timestamps: true 
});

// ⚡ Fix lỗi OverwriteModelError
module.exports = mongoose.models.User || mongoose.model('User', userSchema);
