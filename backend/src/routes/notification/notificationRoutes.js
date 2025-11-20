const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');
const checkNotificationPermission = require('../../middlewares/checkNotificationPermission');
const {
  getNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  deleteNotification,
  getUnreadCount,
  markAsRead,
  markAllAsRead
} = require('../../controllers/notification/notificationController');

// Tất cả routes đều cần xác thực
router.use(authMiddleware);

// 📋 Lấy danh sách thông báo (Tất cả role đều có thể xem thông báo của mình)
router.get('/', getNotifications);

// 📋 Lấy chi tiết thông báo (Tất cả role đều có thể xem thông báo của mình)
router.get('/:id', getNotificationById);

// ➕ Tạo thông báo
// ✅ Quyền: Admin, BGH, GVCN, GVBM (KHÔNG có học sinh)
router.post('/', checkNotificationPermission('create'), createNotification);

// ✏️ Cập nhật thông báo (Chỉ Admin)
router.put('/:id', checkNotificationPermission('update'), updateNotification);

// 🗑️ Xóa thông báo (Chỉ Admin)
router.delete('/:id', checkNotificationPermission('delete'), deleteNotification);

// 🔔 Đếm số thông báo chưa đọc
router.get('/unread/count', getUnreadCount);

// ✅ Đánh dấu đã đọc
router.post('/:id/read', markAsRead);

// ✅ Đánh dấu tất cả đã đọc
router.post('/read-all', markAllAsRead);

module.exports = router;







