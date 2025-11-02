const express = require('express');
const router = express.Router();
const accountController = require('../../controllers/user/accountController');
const authMiddleware = require('../../middlewares/authMiddleware');
const User = require('../../models/user/user')
// Tạo tài khoản
router.post('/', accountController.createAccount);

// Lấy thông tin tài khoản hiện tại
router.get('/me', authMiddleware, accountController.getMyAccount);

// Lấy role của user hiện tại
router.get('/check-role', authMiddleware, async (req, res) => {
  try {
    const account = await accountController.getAccountByUid(req.user.uid); // dùng helper trong controller

    if (!account) return res.status(404).json({ message: 'Account not found' });

    const user  = await  User.findOne({accountId: account._id })
    res.json({
      role: account.role,
      uid: account.uid,
      email: account.email,
      phone: user ? user.phone : account.phone,
      name: user ? user.name : null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

module.exports = router;
