const express = require('express');
const router = express.Router();
const { login, sendPasswordResetOTP, resetPassword, sendLoginOTP, verifyLoginOTP } = require('../controllers/authController');
const verifyToken = require('../middlewares/verifyFirebaseToken');
const User = require('../models/user/user');

// Route login
router.post('/', login);

// Route check-role
router.get('/check-role', verifyToken, async (req, res) => {
  try {
    const uid = req.firebaseUser.uid;
    const user = await User.findOne({ uid });

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ role: user.role, uid: user.uid, name: user.name, email: user.email });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Route forgot password - gửi OTP qua SMS hoặc Email
router.post('/forgot-password', (req, res, next) => {
  console.log('📥 [Auth Route] Received POST /auth/forgot-password', {
    body: req.body,
    headers: req.headers
  });
  sendPasswordResetOTP(req, res, next);
});

// Route verify OTP (cho email)
router.post('/verify-otp', require('../controllers/authController').verifyOTP);

// Route reset password - sau khi xác thực OTP
router.post('/reset-password', resetPassword);

// Route gửi OTP đăng nhập
router.post('/send-login-otp', sendLoginOTP);

// Route xác thực OTP và đăng nhập
router.post('/verify-login-otp', verifyLoginOTP);

module.exports = router;
