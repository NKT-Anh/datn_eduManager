const express = require('express');
const router = express.Router();
const { login } = require('../controllers/authController');
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

module.exports = router;
