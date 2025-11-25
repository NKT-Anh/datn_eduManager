// routes/grade/gradeConfigRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');
const gradeConfigController = require('../../controllers/grade/gradeConfigController');
const { auditLog } = require('../../middlewares/auditLogMiddleware');

router.get('/', authMiddleware, gradeConfigController.getGradeConfig);
router.post('/', 
  authMiddleware,
  auditLog({
    action: 'UPDATE',
    resource: 'GRADE_CONFIG',
    getDescription: (req) => `BGH cập nhật cấu hình điểm số: Năm học ${req.body?.schoolYear || 'N/A'}, Học kỳ ${req.body?.semester || 'N/A'}`,
  }),
  gradeConfigController.upsertGradeConfig
);

module.exports = router;
