// src/routes/index.js
const express = require('express');
const router = express.Router();
const { checkMongoConnection } = require('../controllers/indexController');

// Import các routerd
const registerRoutes = require('./register');
const adminRoutes = require('./user/admin');
const studentRoutes = require('./user/student');
const accountRoute = require('./user/account');
const subjectRoute = require('./subject/subject');
const activityRoute = require('./subject/activity');
const departmentRoute = require('./subject/department');
const departmentManagementRoute = require('./subject/departmentManagement');
const classRoute = require('./classes/class');
const classPeriodsRoute = require('./class/classPeriods');
const teacherRoutes = require('./user/teacher');
const teachingAssignment = require('./subject/teachingAssignment');
const teachingAssignmentProposal = require('./subject/teachingAssignmentProposal');
const scheduleConfig = require('./subject/scheduleConfig');
const schedule = require('./subject/schedule');
const autoSchedule = require('./subject/autoSchedule');
const constraintSolverRoutes = require('./subject/constraintSolver');
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
const teacherExamRoutes = require('./exam/teacherExamRoutes');
const incidentRoutes = require('./incident/incidentRoutes');
const notificationRoutes = require('./notification/notificationRoutes');
const replyRoutes = require('./notification/replyRoutes');
const conductRoutes = require('./conduct/conductRoutes');
const conductConfigRoutes = require('./conduct/conductConfigRoutes');
const schoolYearRoutes = require('./schoolYearRoutes');
const aiChatRoutes = require('./aiChatRoutes');
const permissionRoutes = require('./permissionRoutes');
const auditLogRoutes = require('./auditLogRoutes');
const emailLogRoutes = require('./emailLogRoutes');
const backupRoutes = require('./backupRoutes');
const authRoutes = require('./auth');

// Tạo mảng routers với group name và mô tả
const routers = [
  { group: 'subjects', router: subjectRoute, description: 'Quản lý môn học' },
  { group: 'departments', router: departmentRoute, description: 'Quản lý tổ bộ môn' },
  { group: 'department-management', router: departmentManagementRoute, description: 'Quản lý bộ môn (Trưởng Bộ Môn)' },
  { group: 'activities', router: activityRoute, description: 'Hoạt động môn học' },
  { group: 'students', router: studentRoutes, description: 'Quản lý học sinh' },
  { group: 'teachers', router: teacherRoutes, description: 'Quản lý giáo viên' },
  { group: 'accounts', router: accountRoute, description: 'Quản lý tài khoản' },
  { group: 'register', router: registerRoutes, description: 'Đăng ký tài khoản' },
  { group: 'class', router: classRoute, description: 'Quản lý lớp học' },
  { group: 'classPeriods', router: classPeriodsRoute, description: 'Phân bổ số tiết theo lớp' },
  { group: 'teachingAssignments', router: teachingAssignment, description: 'Phân công giảng dạy' },
  { group: 'teachingAssignmentProposals', router: teachingAssignmentProposal, description: 'Đề xuất phân công giảng dạy' },
  { group: 'scheduleConfig', router: scheduleConfig, description: 'Cấu hình thời khóa biểu' },
  { group: 'schedules', router: schedule, description: 'Thời khóa biểu' },
  { group: 'auto-schedule', router: autoSchedule, description: 'Tự động sắp thời khóa biểu' },
  { group: 'constraint-solver', router: constraintSolverRoutes, description: 'Thuật toán Backtracking cho TKB' },
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
    { group: 'teacher-exams', router: teacherExamRoutes, description: 'Giáo viên xem thông tin kỳ thi' },
    { group: 'incidents', router: incidentRoutes, description: 'Quản lý sự cố' },
    { group: 'notifications', router: notificationRoutes, description: 'Quản lý thông báo' },
    { group: 'notifications/replies', router: replyRoutes, description: 'Phản hồi thông báo' },
    { group: 'conducts', router: conductRoutes, description: 'Quản lý hạnh kiểm' },
    { group: 'conduct-config', router: conductConfigRoutes, description: 'Cấu hình hạnh kiểm' },
    { group: 'school-years', router: schoolYearRoutes, description: 'Quản lý năm học' },
    { group: 'ai-chat', router: aiChatRoutes, description: 'AI Chat hỗ trợ' },
    { group: 'permissions', router: permissionRoutes, description: 'Quản lý phân quyền' },
    { group: 'audit-logs', router: auditLogRoutes, description: 'Log hoạt động hệ thống' },
    { group: 'email-logs', router: emailLogRoutes, description: 'Lịch sử email' },
    { group: 'backups', router: backupRoutes, description: 'Sao lưu dữ liệu' },

];  

// Mount các router tự động
routers.forEach(r => {
  router.use(`/${r.group}`, r.router);
});

// ✅ Mount auth routes (không có prefix group)
router.use('/auth', authRoutes);

// Các route riêng lẻ
router.get('/mongo-status', checkMongoConnection);

module.exports = { router, routers };
