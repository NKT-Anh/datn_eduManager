const User = require('../models/user/user');
const admin = require('../config/firebaseAdmin'); // Firebase Admin SDK
const jwt = require('jsonwebtoken');

// Login: Xác thực Firebase token + trả về role + JWT backend nếu muốn
exports.login = async (req, res) => {
  const idToken = req.headers.authorization?.split('Bearer ')[1];

  if (!idToken) {
    return res.status(401).json({ message: 'Missing Firebase ID token' });
  }

  try {
    // 1. Xác minh token với Firebase
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // 2. Tìm user trong MongoDB
    const user = await User.findOne({ uid });

    if (!user) {
      return res.status(404).json({ message: 'User not found in database' });
    }

    // 3. (Tuỳ chọn) Tạo JWT riêng để bảo vệ API backend
    const token = jwt.sign(
      { userId: user._id, uid: user.uid, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Login successful',
      role: user.role,
      uid: user.uid,
      jwt: token, // token này chỉ dùng để gọi API backend (nếu cần)
    });
    console.log("JWT_SECRET =", process.env.JWT_SECRET);

  } catch (error) {
    console.error('[Login Error]', error);
    res.status(401).json({ message: 'Invalid Firebase token' });
  }
};
