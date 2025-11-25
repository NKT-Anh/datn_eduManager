const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');
const checkNotificationPermission = require('../../middlewares/checkNotificationPermission');
const { auditLog } = require('../../middlewares/auditLogMiddleware');
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
router.post('/', 
  checkNotificationPermission('create'),
  auditLog({
    action: 'CREATE',
    resource: 'NOTIFICATION',
    getDescription: (req) => `Tạo thông báo: ${req.body?.title || 'N/A'}, Gửi đến: ${req.body?.targetRole || 'Tất cả'}`,
  }),
  createNotification
);

// ✏️ Cập nhật thông báo (Chỉ Admin)
router.put('/:id', 
  checkNotificationPermission('update'),
  auditLog({
    action: 'UPDATE',
    resource: 'NOTIFICATION',
    getResourceId: (req) => req.params.id,
    getDescription: (req) => `Cập nhật thông báo: ${req.params.id}`,
  }),
  updateNotification
);

// 🗑️ Xóa thông báo (Chỉ Admin)
router.delete('/:id', 
  checkNotificationPermission('delete'),
  auditLog({
    action: 'DELETE',
    resource: 'NOTIFICATION',
    getResourceId: (req) => req.params.id,
    getDescription: (req) => `Xóa thông báo: ${req.params.id}`,
  }),
  deleteNotification
);

// 🔔 Đếm số thông báo chưa đọc
router.get('/unread/count', getUnreadCount);

// ✅ Đánh dấu đã đọc
router.post('/:id/read', markAsRead);

// ✅ Đánh dấu tất cả đã đọc
router.post('/read-all', markAllAsRead);

module.exports = router;







