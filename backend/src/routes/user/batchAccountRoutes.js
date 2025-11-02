// routes/batchAccountRoutes.js
const express = require('express');
const router = express.Router();
const  authMiddleware  = require('../../middlewares/authMiddleware');
const { createBatchStudents, createBatchTeachers,resetAccountsPassword,getAllAccounts

,deleteAccounts
 } = require('../../controllers/user/batchAccountController');

router.post('/students', authMiddleware, createBatchStudents);
router.post('/teachers', authMiddleware, createBatchTeachers);
router.post('/reset-password', authMiddleware,resetAccountsPassword);
router.get('/all-accounts', authMiddleware, getAllAccounts);
router.post('/delete-accounts', authMiddleware, deleteAccounts);


module.exports = router;
