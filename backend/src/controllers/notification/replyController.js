const Reply = require('../../models/notification/reply');
const Notification = require('../../models/notification');
const User = require('../../models/user/user');

/**
 * 📋 LẤY DANH SÁCH PHẢN HỒI CỦA THÔNG BÁO
 */
exports.getReplies = async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    // Kiểm tra notification có tồn tại không
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ error: 'Không tìm thấy thông báo' });
    }
    
    // Lấy danh sách phản hồi
    const replies = await Reply.find({ notificationId })
      .populate('accountId', 'email role')
      .sort({ createdAt: 1 }) // Sắp xếp theo thời gian tạo (cũ nhất trước)
      .lean();
    
    // Populate thông tin user (name, avatarUrl) cho mỗi reply
    for (const reply of replies) {
      if (reply.accountId && reply.accountId._id) {
        const user = await User.findOne({ accountId: reply.accountId._id })
          .select('name avatarUrl gender')
          .lean();
        if (user) {
          reply.accountId.linkedId = {
            name: user.name,
            avatarUrl: user.avatarUrl,
            gender: user.gender
          };
        }
      }
    }
    
    res.json({ success: true, data: replies });
  } catch (error) {
    console.error('❌ Lỗi getReplies:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * ➕ TẠO PHẢN HỒI
 */
exports.createReply = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { content } = req.body;
    const accountId = req.user.accountId;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Nội dung phản hồi không được để trống' });
    }
    
    // Kiểm tra notification có tồn tại không
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ error: 'Không tìm thấy thông báo' });
    }
    
    // ✅ Kiểm tra thông báo đã hết hạn chưa
    const now = new Date();
    if (notification.endDate && new Date(notification.endDate) < now) {
      return res.status(403).json({ error: 'Thông báo đã hết hạn, không thể phản hồi' });
    }
    
    // Tạo phản hồi
    const reply = await Reply.create({
      notificationId,
      accountId,
      content: content.trim()
    });
    
    // Populate thông tin
    await reply.populate('accountId', 'email role');
    const user = await User.findOne({ accountId: reply.accountId._id })
      .select('name avatarUrl gender')
      .lean();
    if (user) {
      reply.accountId.linkedId = {
        name: user.name,
        avatarUrl: user.avatarUrl,
        gender: user.gender
      };
    }
    
    res.status(201).json({ success: true, data: reply });
  } catch (error) {
    console.error('❌ Lỗi createReply:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * ✏️ CẬP NHẬT PHẢN HỒI (chỉ người tạo mới được sửa)
 */
exports.updateReply = async (req, res) => {
  try {
    const { replyId } = req.params;
    const { content } = req.body;
    const accountId = req.user.accountId;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Nội dung phản hồi không được để trống' });
    }
    
    const reply = await Reply.findById(replyId);
    if (!reply) {
      return res.status(404).json({ error: 'Không tìm thấy phản hồi' });
    }
    
    // Chỉ người tạo mới được sửa
    if (String(reply.accountId) !== String(accountId)) {
      return res.status(403).json({ error: 'Bạn không có quyền sửa phản hồi này' });
    }
    
    // Kiểm tra notification đã hết hạn chưa
    const notification = await Notification.findById(reply.notificationId);
    if (notification && notification.endDate && new Date(notification.endDate) < new Date()) {
      return res.status(403).json({ error: 'Thông báo đã hết hạn, không thể sửa phản hồi' });
    }
    
    reply.content = content.trim();
    await reply.save();
    
    res.json({ success: true, data: reply });
  } catch (error) {
    console.error('❌ Lỗi updateReply:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 🗑️ XÓA PHẢN HỒI (chỉ người tạo hoặc admin)
 */
exports.deleteReply = async (req, res) => {
  try {
    const { replyId } = req.params;
    const { role } = req.user;
    const accountId = req.user.accountId;
    
    const reply = await Reply.findById(replyId);
    if (!reply) {
      return res.status(404).json({ error: 'Không tìm thấy phản hồi' });
    }
    
    // Chỉ người tạo hoặc admin mới được xóa
    if (String(reply.accountId) !== String(accountId) && role !== 'admin') {
      return res.status(403).json({ error: 'Bạn không có quyền xóa phản hồi này' });
    }
    
    await Reply.findByIdAndDelete(replyId);
    
    res.json({ success: true, message: 'Đã xóa phản hồi' });
  } catch (error) {
    console.error('❌ Lỗi deleteReply:', error);
    res.status(500).json({ error: error.message });
  }
};

