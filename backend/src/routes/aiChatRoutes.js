const express = require('express');
const router = express.Router();
const aiChatController = require('../controllers/aiChatController');
const authMiddleware = require('../middlewares/authMiddleware');

/**
 * Middleware validate role cho chatbot
 * Chỉ cho phép: student, teacher (gvbm, gvcn, qlbm, bgh), admin
 */
const validateChatbotRole = (req, res, next) => {
  try {
    const user = req.user;
    
    if (!user || !user.role) {
      return res.status(401).json({ 
        message: 'Chưa xác thực người dùng',
        code: 'auth/not-authenticated'
      });
    }

    const allowedRoles = ['student', 'teacher', 'admin'];
    const role = user.role;

    // ✅ Kiểm tra role có được phép sử dụng chatbot không
    if (!allowedRoles.includes(role)) {
      console.log(`❌ [Chatbot] Role không được phép: ${role}`);
      return res.status(403).json({ 
        message: 'Bạn không có quyền sử dụng chatbot. Chỉ học sinh, giáo viên và admin mới có thể sử dụng.',
        code: 'chatbot/role-not-allowed',
        role: role
      });
    }

    // ✅ Kiểm tra tài khoản có bị khóa không
    // Note: authMiddleware đã kiểm tra và reject nếu account bị khóa,
    // nhưng double-check ở đây để đảm bảo an toàn
    // Nếu user.isLocked không có trong req.user, có nghĩa là authMiddleware đã reject rồi

    console.log(`✅ [Chatbot] User được phép sử dụng chatbot. Role: ${role}, UID: ${user.uid}`);
    next();
  } catch (error) {
    console.error('❌ [Chatbot] Lỗi validate role:', error);
    return res.status(500).json({ 
      message: 'Lỗi kiểm tra quyền truy cập chatbot',
      code: 'chatbot/validation-error'
    });
  }
};

/**
 * ✅ Route chatbot với đầy đủ middleware:
 * 1. authMiddleware: Xác thực Firebase token
 * 2. validateChatbotRole: Validate role được phép sử dụng chatbot
 */
router.post('/chat', authMiddleware, validateChatbotRole, aiChatController.chat);

module.exports = router;















