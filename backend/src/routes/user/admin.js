const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/user/adminController');
const verifyToken = require('../../middlewares/verifyFirebaseToken');
const checkRole = require('../../middlewares/checkRole');
router.use(verifyToken, checkRole('admin'));
router.get('/dashboard', (req, res) => {
    res.json({ message: `Xin chào admin ${req.currentUser.name}` });
  });

router.get('/', adminController.getAllAdmins);
router.get('/:id', adminController.getAdminById);
router.post('/', adminController.createAdmin);
router.put('/:id', adminController.updateAdmin);
router.delete('/:id', adminController.deleteAdmin);

module.exports = router; 