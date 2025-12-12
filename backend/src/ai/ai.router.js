const express = require('express');
const router = express.Router();
const aiService = require('./ai.service');
const authMiddleware = require('../middlewares/authMiddleware');

/**
 * Middleware validate role cho chatbot
 */
const validateChatbotRole = (req, res, next) => {
  try {
    const user = req.user;
    
    if (!user || !user.role) {
      return res.status(401).json({ 
        message: 'Chưa xác thực người dùng',
        code: 'auth/not-authenticated'
      });
    }

    const allowedRoles = ['student', 'teacher', 'admin'];
    const role = user.role;

    if (!allowedRoles.includes(role)) {
      console.log(`❌ [Chatbot] Role không được phép: ${role}`);
      return res.status(403).json({ 
        message: 'Bạn không có quyền sử dụng chatbot. Chỉ học sinh, giáo viên và admin mới có thể sử dụng.',
        code: 'chatbot/role-not-allowed',
        role: role
      });
    }

    console.log(`✅ [Chatbot] User được phép sử dụng chatbot. Role: ${role}, UID: ${user.uid}`);
    next();
  } catch (error) {
    console.error('❌ [Chatbot] Lỗi validate role:', error);
    return res.status(500).json({ 
      message: 'Lỗi kiểm tra quyền truy cập chatbot',
      code: 'chatbot/validation-error'
    });
  }
};

/**
 * POST /ai/chat - Chat với AI
 */
router.post('/chat', authMiddleware, validateChatbotRole, async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;
    const user = req.user;
    const { role, accountId } = user;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Vui lòng nhập câu hỏi' });
    }

    // ✅ Kiểm tra AI có sẵn sàng không
    if (!aiService.isAvailable()) {
      return res.status(503).json({
        text: 'Xin lỗi, dịch vụ AI tạm thời không khả dụng. Vui lòng thử lại sau.',
        type: 'text'
      });
    }

    // ✅ Xây dựng context
    const context = await buildUserContext(user, accountId);

    // ✅ Lấy userId để lưu memory
    const userId = user.uid || accountId?.toString();

    // ✅ Gọi AI service
    const response = await aiService.chat(
      message,
      role,
      context,
      conversationHistory || [],
      userId
    );

    res.json(response);
  } catch (error) {
    console.error('❌ [AI Chat Error]:', error);
    res.status(500).json({
      text: 'Xin lỗi, hệ thống đang gặp sự cố. Vui lòng thử lại sau.',
      type: 'text'
    });
  }
});

/**
 * Xây dựng context cho user
 */
async function buildUserContext(user, accountId) {
  const context = {};
  const Account = require('../models/user/account');
  const Student = require('../models/user/student');
  const Teacher = require('../models/user/teacher');
  const Admin = require('../models/user/admin');
  const { getCurrentSchoolYear } = require('../utils/schoolYearHelper');
  const TeachingAssignment = require('../models/subject/teachingAssignment');

  try {
    const account = await Account.findById(accountId);
    if (!account) return context;

    // ✅ Student context
    if (user.role === 'student') {
      const student = await Student.findOne({ accountId })
        .populate('classId', 'className grade');
      
      if (student) {
        context.userName = student.name;
        context.className = student.classId?.className;
        context.grade = student.classId?.grade;
        context.studentCode = student.studentCode;
      }
    }
    
    // ✅ Teacher context
    if (user.role === 'teacher') {
      const teacher = await Teacher.findOne({ accountId })
        .populate('subjects.subjectId', 'name');
      
      if (teacher) {
        context.userName = teacher.name;
        context.isLeader = user.teacherFlags?.isLeader || false;
        context.isDepartmentHead = user.teacherFlags?.isDepartmentHead || false;
        context.isHomeroom = user.teacherFlags?.isHomeroom || false;
        context.role = getEffectiveRole(user.role, user.teacherFlags);
        
        // ✅ Lấy môn và lớp đang dạy
        const currentYear = await getCurrentSchoolYear() || '2025-2026';
        const now = new Date();
        const month = now.getMonth() + 1;
        const semester = (month >= 8 || month <= 1) ? '1' : '2';
        
        const assignments = await TeachingAssignment.find({
          teacherId: teacher._id,
          year: currentYear,
          semester: semester
        })
          .populate('subjectId', 'name')
          .populate('classId', 'className');
        
        if (assignments.length > 0) {
          const subjectsSet = new Set();
          const classesSet = new Set();
          
          assignments.forEach(ass => {
            if (ass.subjectId?.name) subjectsSet.add(ass.subjectId.name);
            if (ass.classId?.className) classesSet.add(ass.classId.className);
          });
          
          context.subjects = Array.from(subjectsSet);
          context.classes = Array.from(classesSet);
        }
        
        // ✅ Lấy lớp chủ nhiệm
        if (user.teacherFlags?.isHomeroom && user.teacherFlags?.currentHomeroomClassId) {
          const Class = require('../models/class/class');
          const homeroomClass = await Class.findById(user.teacherFlags.currentHomeroomClassId)
            .select('className grade');
          if (homeroomClass) {
            context.homeroomClass = homeroomClass.className;
            context.homeroomGrade = homeroomClass.grade;
          }
        }
      }
    }
    
    // ✅ Admin context
    if (user.role === 'admin') {
      const adminUser = await Admin.findOne({ accountId });
      if (adminUser) {
        context.userName = adminUser.name;
      }
    }
  } catch (error) {
    console.error('❌ [Build Context Error]:', error);
  }

  return context;
}

/**
 * Lấy effective role
 */
function getEffectiveRole(role, teacherFlags = {}) {
  if (role === 'teacher') {
    if (teacherFlags?.isLeader) return 'bgh';
    if (teacherFlags?.isDepartmentHead) return 'qlbm';
    if (teacherFlags?.isHomeroom) return 'gvcn';
    return 'gvbm';
  }
  return role;
}

module.exports = router;

