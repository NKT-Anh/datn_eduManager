const express = require('express');
const router = express.Router();
const surveyController = require('../../controllers/survey/surveyController');
const surveyResponseController = require('../../controllers/survey/surveyResponseController');
const surveyStatisticsController = require('../../controllers/survey/surveyStatisticsController');
const authMiddleware = require('../../middlewares/authMiddleware');
const checkPermission = require('../../middlewares/checkPermission');
const { PERMISSIONS } = require('../../config/permissions');

// ✅ Admin: Tạo khảo sát mới
router.post('/',
  authMiddleware,
  checkPermission(PERMISSIONS.USER_CREATE, { checkContext: false }),
  surveyController.createSurvey
);

// ✅ Lấy danh sách khảo sát
router.get('/',
  authMiddleware,
  checkPermission([PERMISSIONS.TEACHER_VIEW, PERMISSIONS.STUDENT_VIEW], { checkContext: false }),
  surveyController.getAllSurveys
);

// ✅ Dashboard tổng hợp cho Admin/BGH - Phải đặt trước /:id để tránh conflict
router.get('/statistics/dashboard',
  authMiddleware,
  checkPermission(PERMISSIONS.TEACHER_VIEW, { checkContext: false }),
  surveyStatisticsController.getSurveyDashboard
);

// ✅ Lấy chi tiết 1 khảo sát
router.get('/:id',
  authMiddleware,
  checkPermission([PERMISSIONS.TEACHER_VIEW, PERMISSIONS.STUDENT_VIEW], { checkContext: false }),
  surveyController.getSurvey
);

// ✅ Admin: Cập nhật khảo sát
router.put('/:id',
  authMiddleware,
  checkPermission(PERMISSIONS.USER_UPDATE, { checkContext: false }),
  surveyController.updateSurvey
);

// ✅ Admin: Xóa mềm khảo sát
router.delete('/:id',
  authMiddleware,
  checkPermission(PERMISSIONS.USER_DELETE, { checkContext: false }),
  surveyController.deleteSurvey
);

// ✅ Admin: Mở khảo sát cho học sinh
router.post('/:id/open',
  authMiddleware,
  checkPermission(PERMISSIONS.USER_UPDATE, { checkContext: false }),
  surveyController.openSurveyForStudents
);

// ✅ Admin: Theo dõi tiến độ khảo sát
router.get('/:id/progress',
  authMiddleware,
  checkPermission(PERMISSIONS.USER_VIEW, { checkContext: false }),
  surveyController.getSurveyProgress
);

// ✅ Học sinh: Lấy danh sách khảo sát có thể tham gia
router.get('/student/available',
  authMiddleware,
  checkPermission(PERMISSIONS.STUDENT_VIEW_SELF, { checkContext: false }),
  surveyResponseController.getAvailableSurveys
);

// ✅ Học sinh: Submit đánh giá giáo viên
router.post('/student/submit',
  authMiddleware,
  checkPermission(PERMISSIONS.STUDENT_VIEW_SELF, { checkContext: false }),
  surveyResponseController.submitSurveyResponse
);

// ✅ Giáo viên: Xem thống kê điểm khảo sát của mình
router.get('/teacher/statistics',
  authMiddleware,
  checkPermission(PERMISSIONS.SURVEY_VIEW_RESULTS, { checkContext: false }),
  surveyResponseController.getTeacherStatistics
);

// ✅ BGH: Xem báo cáo tổng hợp khảo sát
router.get('/bgh/report',
  authMiddleware,
  checkPermission(PERMISSIONS.TEACHER_VIEW, { checkContext: false }),
  surveyResponseController.getBGHReport
);

// ✅ Tính điểm trung bình và phân loại giáo viên
router.post('/statistics/calculate-ratings',
  authMiddleware,
  checkPermission(PERMISSIONS.USER_UPDATE, { checkContext: false }),
  surveyStatisticsController.calculateTeacherRatings
);

// ✅ Trao danh hiệu/khen thưởng cho giáo viên
router.post('/awards',
  authMiddleware,
  checkPermission(PERMISSIONS.USER_UPDATE, { checkContext: false }),
  surveyStatisticsController.awardTeacher
);

// ✅ Lấy danh sách giáo viên có danh hiệu/khen thưởng
router.get('/awards/teachers',
  authMiddleware,
  checkPermission(PERMISSIONS.TEACHER_VIEW, { checkContext: false }),
  surveyStatisticsController.getTeachersWithAwards
);

// ✅ Giáo viên: Xem danh hiệu/khen thưởng của chính mình
router.get('/awards/my-awards',
  authMiddleware,
  checkPermission(PERMISSIONS.SURVEY_VIEW_RESULTS, { checkContext: false }),
  surveyStatisticsController.getMyAwards
);

module.exports = router;

