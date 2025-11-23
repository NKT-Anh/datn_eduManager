const admin = require('../config/firebaseAdmin')
module.exports = async (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ message: 'Missing token' });
  
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      req.firebaseUser = decoded; // gắn user Firebase vào request
      next(); // cho phép đi tiếp
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };