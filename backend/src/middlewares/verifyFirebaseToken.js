const admin = require('../config/firebaseAdmin');
const Account = require('../models/user/account');

module.exports = async (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ message: 'Missing token' });
  
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      
      // ✅ Kiểm tra tài khoản có bị khóa không
      const account = await Account.findOne({ uid: decoded.uid });
      if (account && account.isLocked === true) {
        return res.status(403).json({ 
          message: 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.',
          code: 'ACCOUNT_LOCKED',
          lockedAt: account.lockedAt,
          lockReason: account.lockReason
        });
      }
      
      req.firebaseUser = decoded; // gắn user Firebase vào request
      next(); // cho phép đi tiếp
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };