const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  recipientRole: { type: String, enum: ['student', 'teacher', 'parent', 'all'], default: 'all' },
  recipientId: { type: mongoose.Schema.Types.ObjectId }, // optional
  createdAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
