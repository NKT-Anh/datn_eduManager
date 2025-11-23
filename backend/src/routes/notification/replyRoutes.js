const express = require('express');
const router = express.Router();
const replyController = require('../../controllers/notification/replyController');
const authMiddleware = require('../../middlewares/authMiddleware');

// Tất cả routes đều cần authentication
router.use(authMiddleware);

// Lấy danh sách phản hồi của một thông báo
router.get('/:notificationId', replyController.getReplies);

// Tạo phản hồi mới
router.post('/:notificationId', replyController.createReply);

// Cập nhật phản hồi
router.put('/:replyId', replyController.updateReply);

// Xóa phản hồi
router.delete('/:replyId', replyController.deleteReply);

module.exports = router;

