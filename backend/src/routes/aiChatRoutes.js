const express = require('express');
const router = express.Router();
const aiChatController = require('../controllers/aiChatController');
const authMiddleware = require('../middlewares/authMiddleware');

// Tất cả routes đều cần authentication
router.post('/chat', authMiddleware, aiChatController.chat);

module.exports = router;















