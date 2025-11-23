const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  notificationId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Notification', 
    required: true 
  },
  accountId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Account', 
    required: true 
  },
  content: { 
    type: String, 
    required: true,
    trim: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

replySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index để tối ưu query
replySchema.index({ notificationId: 1, createdAt: -1 });

module.exports = mongoose.model('NotificationReply', replySchema);

