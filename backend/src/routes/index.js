// src/routes/index.js
const express = require('express');
const router = express.Router();
const { checkMongoConnection } = require('../controllers/indexController');

// Import các router
const registerRoutes = require('./register');
const adminRoutes = require('./user/admin');
const studentRoutes = require('./user/student');
const accountRoute = require('./user/account');
const subjectRoute = require('./subject/subject');
const activityRoute = require('./subject/activity');
const classRoute = require('./classes/class');
const teacherRoutes = require('./user/teacher');
const teachingAssignment = require('./subject/teachingAssignment');
const scheduleConfig = require('./subject/scheduleConfig');
const schedule = require('./subject/schedule');
const autoSchedule = require('./subject/autoSchedule');
const grade = require("./classes/grade");
const setting = require("./settingRoutes")
const batchAccountRoutes = require('./user/batchAccountRoutes')
const profileRoutes = require('./user/profileRoutes')
const gradesRoutes = require('./grade/gradesRoutes')
const gradeConfigRoutes = require('./grade/gradeConfigRoutes')
const schoolConfigRoutes = require('./system/schoolConfigRoutes')
const examRoutes = require('./exam/examRoutes')
const examRoomRoutes = require('./exam/examRoomRoutes');
const examClassRoutes = require('./exam/examClassRoutes');
const examScheduleRoutes = require('./exam/examScheduleRoutes');
const examStudentRoutes = require('./exam/examStudentRoutes');
const examGradeRoutes = require('./exam/examGradeRoutes');
const roomAssignmentRoutes = require('./exam/roomAssignmentRoutes');
const roomRoutes = require('./roomRoutes');
const studentExamRoutes = require('./exam/studentExamRoutes');

// Tạo mảng routers với group name và mô tả
const routers = [
  { group: 'subjects', router: subjectRoute, description: 'Quản lý môn học' },
  { group: 'activities', router: activityRoute, description: 'Hoạt động môn học' },
  { group: 'students', router: studentRoutes, description: 'Quản lý học sinh' },
  { group: 'teachers', router: teacherRoutes, description: 'Quản lý giáo viên' },
  { group: 'accounts', router: accountRoute, description: 'Quản lý tài khoản' },
  { group: 'register', router: registerRoutes, description: 'Đăng ký tài khoản' },
  { group: 'class', router: classRoute, description: 'Quản lý lớp học' },
  { group: 'teachingAssignments', router: teachingAssignment, description: 'Phân công giảng dạy' },
  { group: 'scheduleConfig', router: scheduleConfig, description: 'Cấu hình thời khóa biểu' },
  { group: 'schedules', router: schedule, description: 'Thời khóa biểu' },
  { group: 'auto-schedule', router: autoSchedule, description: 'Tự động sắp thời khóa biểu' },
  { group: 'grade', router: grade, description: 'Quản lý khối lớp' },
    { group: 'rooms', router: roomRoutes, description: 'Quản lý phòng' },
  { group: 'settings', router: setting, description: 'Cài đặt hệ thống' },
  { group: 'batch', router: batchAccountRoutes, description: 'Tài khoản' },
   { group: 'school-config', router: schoolConfigRoutes, description: 'Quản lý admin hệ thống' },
  { group: 'profile', router: profileRoutes, description: 'Thông tin cá nhân' },
   { group: 'grades', router: gradesRoutes, description: 'Điểm môn học' },
   { group: 'grade-config', router: gradeConfigRoutes, description: 'cấu hình điểm môn học' },
  { group: 'admin', router: adminRoutes, description: 'Quản lý admin hệ thống' },
  { group: 'attendance', router: require('./classes/attendance'), description: 'Điểm danh học sinh' },

  { group: 'exam/rooms', router: examRoomRoutes, description: 'Quản lý phòng thi' },
  { group: 'exam/room-assignments', router: roomAssignmentRoutes, description: 'Quản lý xếp phòng thi' },

  { group: 'exam/classes', router: examClassRoutes, description: 'Quản lý khối và lớp tham gia kỳ thi' },
  { group: 'exam/schedules', router: examScheduleRoutes, description: 'Lịch thi' },
  { group: 'exam/students', router: examStudentRoutes, description: 'Học sinh dự thi' },      // ✅
  { group: 'exam/grades', router: examGradeRoutes, description: 'Quản lý điểm thi' },
    { group: 'exam', router: examRoutes, description: 'Quản lý lịch thi' },
    { group: 'student-exams', router: studentExamRoutes, description: 'Học sinh xem thông tin kỳ thi' },

];  

// Mount các router tự động
routers.forEach(r => {
  router.use(`/${r.group}`, r.router);
});

// Các route riêng lẻ
router.get('/mongo-status', checkMongoConnection);

module.exports = { router, routers };
