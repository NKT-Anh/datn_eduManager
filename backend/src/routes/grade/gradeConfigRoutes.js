// routes/grade/gradeConfigRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');
const gradeConfigController = require('../../controllers/grade/gradeConfigController');

router.get('/', authMiddleware, gradeConfigController.getGradeConfig);
router.post('/', authMiddleware, gradeConfigController.upsertGradeConfig);

module.exports = router;
