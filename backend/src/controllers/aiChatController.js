const Student = require('../models/user/student');
const Teacher = require('../models/user/teacher');
const Account = require('../models/user/account');
const Admin = require('../models/user/admin');
const Setting = require('../models/settings');
const { Exam, ExamSchedule, ExamStudent } = require('../models/exam/examIndex');
const RoomAssignment = require('../models/exam/roomAssignment');
const TeachingAssignment = require('../models/subject/teachingAssignment');
const Schedule = require('../models/subject/schedule');
const { chatWithAI, isAvailable: isOpenAIAvailable } = require('../services/openaiService');
const { getCurrentSchoolYear } = require('../utils/schoolYearHelper');

/* =========================================================
   🤖 AI CHAT CONTROLLER
   Xử lý các câu hỏi từ học sinh, giáo viên, admin
========================================================= */

/**
 * Xử lý câu hỏi từ người dùng
 */
exports.chat = async (req, res) => {
  try {
    const { message } = req.body;
    const user = req.user; // Từ authMiddleware
    const { role, accountId } = user;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Vui lòng nhập câu hỏi' });
    }

    const query = message.toLowerCase().trim();
    let response = null;

    // Xử lý câu chào hỏi chung cho tất cả roles
    if (isGreeting(query)) {
      response = handleGreeting(role);
    }
    // Phân loại và xử lý theo role
    else if (role === 'student') {
      response = await handleStudentQuery(query, user);
    } else if (role === 'teacher' || role === 'gvbm' || role === 'gvcn') {
      response = await handleTeacherQuery(query, user);
    } else if (role === 'admin' || role === 'bgh' || role === 'qlbm') {
      response = await handleAdminQuery(query, user);
    } else {
      response = {
        text: 'Xin lỗi, tôi chỉ hỗ trợ học sinh, giáo viên và admin.',
        type: 'text'
      };
    }

    // Nếu không tìm thấy intent, sử dụng OpenAI nếu có
    if (!response) {
      if (isOpenAIAvailable()) {
        try {
          // Lấy thông tin context chi tiết để AI hiểu rõ hơn
          const account = await Account.findById(user.accountId);
          let context = {};
          
          if (role === 'student') {
            const student = await Student.findOne({ accountId: account?._id })
              .populate('classId', 'className grade');
            if (student) {
              context.userName = student.name;
              context.className = student.classId?.className;
              context.grade = student.grade || student.classId?.grade;
              context.studentCode = student.studentCode;
            }
          } else if (role === 'teacher' || role === 'gvbm' || role === 'gvcn') {
            const teacher = await Teacher.findOne({ accountId: account?._id })
              .populate('subjects.subjectId', 'name');
            
            if (teacher) {
              context.userName = teacher.name;
              
              // ✅ Lấy các môn giáo viên đang dạy
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
            }
          } else if (role === 'admin' || role === 'bgh' || role === 'qlbm') {
            const adminUser = await Admin.findOne({ accountId: account?._id });
            if (adminUser) {
              context.userName = adminUser.name;
            }
          }

          const aiResponse = await chatWithAI(message, role, context);
          response = {
            text: aiResponse,
            type: 'text'
          };
        } catch (error) {
          console.error('❌ [OpenAI Fallback Error]:', error);
          // Fallback về câu trả lời mặc định nếu OpenAI lỗi
          response = {
            text: 'Xin lỗi, tôi chưa hiểu câu hỏi của bạn. Vui lòng thử lại với câu hỏi khác.\n\n💡 Bạn có thể hỏi:\n- Tìm học sinh, giáo viên\n- Xem lịch thi, thời khóa biểu\n- Xem điểm số\n- Hướng dẫn sử dụng hệ thống',
            type: 'text'
          };
        }
      } else {
        // Nếu không có OpenAI, trả về câu trả lời mặc định
        response = {
          text: 'Xin lỗi, tôi chưa hiểu câu hỏi của bạn. Vui lòng thử lại với câu hỏi khác.\n\n💡 Bạn có thể hỏi:\n- Tìm học sinh, giáo viên\n- Xem lịch thi, thời khóa biểu\n- Xem điểm số\n- Hướng dẫn sử dụng hệ thống',
          type: 'text'
        };
      }
    }

    res.json(response);
  } catch (error) {
    console.error('❌ [AI Chat Error]:', error);
    res.status(500).json({
      text: 'Xin lỗi, hệ thống đang gặp sự cố. Vui lòng thử lại sau.',
      type: 'text'
    });
  }
};

/* =========================================================
   👋 XỬ LÝ CÂU CHÀO HỎI
========================================================= */

function isGreeting(query) {
  const greetings = [
    'chào', 'hello', 'hi', 'xin chào', 'chào bạn', 'chào anh', 'chào chị',
    'chào em', 'chào thầy', 'chào cô', 'good morning', 'good afternoon',
    'good evening', 'hey', 'hế lô', 'hê lô'
  ];
  return greetings.some(greeting => query.includes(greeting));
}

function handleGreeting(role) {
  const roleMessages = {
    student: 'Xin chào! Tôi có thể giúp bạn tìm email, mã số, lịch thi, phòng học, xem điểm. Bạn cần hỗ trợ gì?',
    teacher: 'Xin chào! Tôi có thể giúp bạn xem lớp dạy, thời khóa biểu, hướng dẫn nhập điểm, tra cứu học sinh. Bạn cần hỗ trợ gì?',
    admin: 'Xin chào! Tôi có thể giúp bạn gợi ý phân phòng thi, kiểm tra lỗi, hướng dẫn sử dụng hệ thống, tìm học sinh/giáo viên. Bạn cần hỗ trợ gì?'
  };
  
  return {
    text: roleMessages[role] || roleMessages.admin,
    type: 'text'
  };
}

/* =========================================================
   👨‍🎓 XỬ LÝ CÂU HỎI HỌC SINH
========================================================= */

async function handleStudentQuery(query, user) {
  // Tìm email trường
  if (query.includes('email') || query.includes('mail')) {
    return await findSchoolEmail(user);
  }

  // Tìm mã học sinh
  if (query.includes('mã') || query.includes('mã số') || query.includes('studentcode')) {
    return await findStudentCode(user);
  }

  // Xem lịch thi
  if (query.includes('lịch thi') || query.includes('kỳ thi') || query.includes('exam')) {
    return await findStudentExamSchedule(user);
  }

  // Tìm phòng học
  if (query.includes('phòng') && (query.includes('học') || query.includes('hôm nay'))) {
    return await findStudentClassroom(user);
  }

  // Xem điểm
  if (query.includes('điểm') || query.includes('grade')) {
    return await findStudentGrades(query, user);
  }

  // Giải thích cách nhập dữ liệu
  if (query.includes('học kỳ') || query.includes('tính') || query.includes('nhập')) {
    return {
      text: `📚 **Cách tính điểm học kỳ:**

Điểm học kỳ được tính từ các thành phần sau:
- **Điểm miệng** (hệ số 1)
- **Điểm 15 phút** (hệ số 1)
- **Điểm 1 tiết** (hệ số 2)
- **Điểm học kỳ** (hệ số 3)

**Công thức:** 
ĐTB = (Điểm miệng × 1 + Điểm 15p × 1 + Điểm 1 tiết × 2 + Điểm HK × 3) / 7

Bạn có thể xem điểm chi tiết tại trang **Điểm số** trong menu.`,
      type: 'text'
    };
  }

  return null;
}

async function findSchoolEmail(user) {
  try {
    const settings = await Setting.findOne();
    const studentEmailDomain = settings?.studentEmailDomain || '@student.school.com';
    
    // Tìm thông tin học sinh qua Account
    const account = await Account.findById(user.accountId);
    if (!account) {
      return {
        text: 'Không tìm thấy tài khoản của bạn.',
        type: 'text'
      };
    }
    
    const student = await Student.findOne({ accountId: account._id });
    if (!student) {
      return {
        text: 'Không tìm thấy thông tin học sinh của bạn.',
        type: 'text'
      };
    }

    // Tạo email từ studentCode
    const email = `${student.studentCode}${studentEmailDomain}`;
    
    return {
      text: `📧 **Email trường của bạn:**

**Email:** ${email}

Bạn có thể sử dụng email này để đăng nhập và nhận thông báo từ trường.`,
      type: 'text',
      data: { email }
    };
  } catch (error) {
    console.error('Error finding school email:', error);
    return {
      text: 'Không thể tìm email trường. Vui lòng liên hệ admin.',
      type: 'text'
    };
  }
}

async function findStudentCode(user) {
  try {
    const account = await Account.findById(user.accountId);
    if (!account) {
      return {
        text: 'Không tìm thấy tài khoản của bạn.',
        type: 'text'
      };
    }
    
    const student = await Student.findOne({ accountId: account._id })
      .select('studentCode name');
    
    if (!student) {
      return {
        text: 'Không tìm thấy mã số học sinh của bạn.',
        type: 'text'
      };
    }

    return {
      text: `🆔 **Mã số học sinh của bạn:**

**Mã số:** ${student.studentCode}
**Họ tên:** ${student.name}`,
      type: 'text',
      data: { studentCode: student.studentCode }
    };
  } catch (error) {
    console.error('Error finding student code:', error);
    return {
      text: 'Không thể tìm mã số học sinh. Vui lòng thử lại sau.',
      type: 'text'
    };
  }
}

async function findStudentExamSchedule(user) {
  try {
    const account = await Account.findById(user.accountId);
    if (!account) {
      return {
        text: 'Không tìm thấy tài khoản của bạn.',
        type: 'text'
      };
    }
    
    const student = await Student.findOne({ accountId: account._id });
    if (!student) {
      return {
        text: 'Không tìm thấy thông tin học sinh.',
        type: 'text'
      };
    }

    const examStudents = await ExamStudent.find({ student: student._id, status: 'active' })
      .populate({
        path: 'exam',
        select: 'name year semester type status startDate endDate'
      })
      .sort({ createdAt: -1 })
      .limit(5);

    if (!examStudents || examStudents.length === 0) {
      return {
        text: 'Bạn chưa có lịch thi nào. Vui lòng kiểm tra lại sau.',
        type: 'text'
      };
    }

    let text = '📅 **Lịch thi của bạn:**\n\n';
    examStudents.forEach((es, index) => {
      const exam = es.exam;
      if (exam) {
        text += `${index + 1}. **${exam.name}**\n`;
        text += `   - Năm học: ${exam.year}\n`;
        text += `   - Học kỳ: ${exam.semester}\n`;
        text += `   - Loại: ${exam.type}\n`;
        text += `   - Trạng thái: ${exam.status}\n\n`;
      }
    });

    text += '💡 Để xem chi tiết lịch thi, vui lòng vào trang **Lịch thi** trong menu.';

    return {
      text,
      type: 'text',
      data: { exams: examStudents.map(es => ({
        id: es.exam?._id,
        name: es.exam?.name,
        year: es.exam?.year,
        semester: es.exam?.semester
      })) }
    };
  } catch (error) {
    console.error('Error finding exam schedule:', error);
    return {
      text: 'Không thể tải lịch thi. Vui lòng thử lại sau.',
      type: 'text'
    };
  }
}

async function findStudentClassroom(user) {
  try {
    const account = await Account.findById(user.accountId);
    if (!account) {
      return {
        text: 'Không tìm thấy tài khoản của bạn.',
        type: 'text'
      };
    }
    
    const student = await Student.findOne({ accountId: account._id })
      .populate('classId', 'className roomCode');
    
    if (!student) {
      return {
        text: 'Không tìm thấy thông tin học sinh.',
        type: 'text'
      };
    }

    const className = student.classId?.className || 'Chưa có lớp';
    const roomCode = student.classId?.roomCode || 'Chưa có phòng';

    return {
      text: `🏫 **Thông tin lớp học:**

**Lớp:** ${className}
**Phòng học:** ${roomCode}

💡 Để xem thời khóa biểu chi tiết, vui lòng vào trang **Thời khóa biểu** trong menu.`,
      type: 'text',
      data: { className, roomCode }
    };
  } catch (error) {
    console.error('Error finding classroom:', error);
    return {
      text: 'Không thể tìm thông tin phòng học. Vui lòng thử lại sau.',
      type: 'text'
    };
  }
}

async function findStudentGrades(query, user) {
  try {
    const account = await Account.findById(user.accountId);
    if (!account) {
      return {
        text: 'Không tìm thấy tài khoản của bạn.',
        type: 'text'
      };
    }
    
    const student = await Student.findOne({ accountId: account._id });
    if (!student) {
      return {
        text: 'Không tìm thấy thông tin học sinh.',
        type: 'text'
      };
    }

    // Tìm môn học nếu có trong query
    let subjectName = null;
    const subjects = ['toán', 'văn', 'anh', 'lý', 'hóa', 'sinh', 'sử', 'địa', 'gdcd'];
    for (const subj of subjects) {
      if (query.includes(subj)) {
        subjectName = subj;
        break;
      }
    }

    return {
      text: `📊 **Xem điểm số:**

Để xem điểm chi tiết, vui lòng vào trang **Điểm số** trong menu.

${subjectName ? `\n💡 Bạn có thể xem điểm môn **${subjectName.toUpperCase()}** tại đó.` : ''}

**Lưu ý:** Điểm số được cập nhật sau khi giáo viên nhập điểm.`,
      type: 'text',
      action: 'navigate',
      data: { path: '/student/grades' }
    };
  } catch (error) {
    console.error('Error finding grades:', error);
    return {
      text: 'Không thể tải điểm số. Vui lòng thử lại sau.',
      type: 'text'
    };
  }
}

/* =========================================================
   👨‍🏫 XỬ LÝ CÂU HỎI GIÁO VIÊN
========================================================= */

async function handleTeacherQuery(query, user) {
  // Xem danh sách lớp dạy
  if (query.includes('lớp') && (query.includes('dạy') || query.includes('giảng'))) {
    return await findTeacherClasses(user);
  }

  // Xem thời khóa biểu
  if (query.includes('thời khóa biểu') || query.includes('tkb') || query.includes('hôm nay') && query.includes('tiết')) {
    return await findTeacherSchedule(user);
  }

  // Hướng dẫn nhập điểm
  if (query.includes('nhập điểm') || query.includes('điểm')) {
    return {
      text: `📝 **Hướng dẫn nhập điểm:**

1. Vào menu **Điểm số** → Chọn lớp và môn học
2. Chọn loại điểm cần nhập:
   - Điểm miệng
   - Điểm 15 phút
   - Điểm 1 tiết
   - Điểm học kỳ
3. Nhập điểm cho từng học sinh
4. Lưu lại

💡 Bạn chỉ có thể nhập điểm trong thời gian cho phép.`,
      type: 'text',
      action: 'navigate',
      data: { path: '/teacher/grades' }
    };
  }

  // Tra cứu học sinh
  if (query.includes('học sinh') || query.includes('tìm') || query.includes('tra cứu')) {
    return {
      text: `🔍 **Tra cứu học sinh:**

Để tra cứu học sinh, vui lòng:
1. Vào menu **Lớp học** → Chọn lớp bạn dạy
2. Xem danh sách học sinh trong lớp
3. Hoặc sử dụng chức năng tìm kiếm

💡 Bạn chỉ có thể xem thông tin học sinh trong các lớp bạn dạy.`,
      type: 'text',
      action: 'navigate',
      data: { path: '/teacher/classes' }
    };
  }

  return null;
}

async function findTeacherClasses(user) {
  try {
    const account = await Account.findById(user.accountId);
    if (!account) {
      return {
        text: 'Không tìm thấy tài khoản của bạn.',
        type: 'text'
      };
    }
    
    const teacher = await Teacher.findOne({ accountId: account._id });
    if (!teacher) {
      return {
        text: 'Không tìm thấy thông tin giáo viên.',
        type: 'text'
      };
    }

    // ✅ Lấy năm học hiện tại
    const currentYear = await getCurrentSchoolYear() || '2025-2026';
    // Lấy học kỳ hiện tại từ ngày tháng
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const semester = (month >= 8 || month <= 1) ? '1' : '2'; // Học kỳ 1: tháng 8-1, Học kỳ 2: tháng 2-7

    const assignments = await TeachingAssignment.find({
      teacherId: teacher._id,
      year: currentYear,
      semester: semester
    })
      .populate('classId', 'className grade')
      .populate('subjectId', 'name code');

    if (!assignments || assignments.length === 0) {
      return {
        text: 'Bạn chưa được phân công dạy lớp nào trong học kỳ này.',
        type: 'text'
      };
    }

    // Nhóm theo môn học
    const bySubject = {};
    assignments.forEach(ass => {
      const subjectName = ass.subjectId?.name || 'Chưa có môn';
      if (!bySubject[subjectName]) {
        bySubject[subjectName] = [];
      }
      bySubject[subjectName].push(ass.classId?.className || 'Chưa có lớp');
    });

    let text = '📚 **Danh sách lớp bạn dạy:**\n\n';
    Object.keys(bySubject).forEach(subject => {
      text += `**${subject}:**\n`;
      bySubject[subject].forEach(className => {
        text += `  - ${className}\n`;
      });
      text += '\n';
    });

    return {
      text,
      type: 'text',
      data: { classes: assignments.map(a => ({
        className: a.classId?.className,
        subject: a.subjectId?.name
      })) }
    };
  } catch (error) {
    console.error('Error finding teacher classes:', error);
    return {
      text: 'Không thể tải danh sách lớp. Vui lòng thử lại sau.',
      type: 'text'
    };
  }
}

async function findTeacherSchedule(user) {
  try {
    const account = await Account.findById(user.accountId);
    if (!account) {
      return {
        text: 'Không tìm thấy tài khoản của bạn.',
        type: 'text'
      };
    }
    
    const teacher = await Teacher.findOne({ accountId: account._id });
    if (!teacher) {
      return {
        text: 'Không tìm thấy thông tin giáo viên.',
        type: 'text'
      };
    }

    const settings = await Setting.findOne();
    const currentYear = settings?.currentSchoolYear || '2025-2026';
    // Lấy học kỳ hiện tại từ ngày tháng
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const semester = (month >= 8 || month <= 1) ? '1' : '2'; // Học kỳ 1: tháng 8-1, Học kỳ 2: tháng 2-7

    // Lấy lịch dạy hôm nay
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Chủ nhật, 1 = Thứ 2, ...
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayName = dayNames[dayOfWeek];

    // Lấy các lớp giáo viên dạy
    const assignments = await TeachingAssignment.find({
      teacherId: teacher._id,
      year: currentYear,
      semester: semester
    })
      .populate('classId', 'className')
      .populate('subjectId', 'name');

    if (!assignments || assignments.length === 0) {
      return {
        text: `📅 **Lịch dạy hôm nay (${getDayName(dayOfWeek)}):**

Bạn chưa được phân công dạy lớp nào trong học kỳ này.`,
        type: 'text'
      };
    }

    // Lấy thời khóa biểu của các lớp
    const classIds = assignments.map(a => a.classId?._id).filter(Boolean);
    const schedules = await Schedule.find({
      classId: { $in: classIds },
      year: currentYear,
      semester: semester
    })
      .populate('classId', 'className');

    // Tìm các tiết dạy hôm nay
    const todaySchedule = [];
    schedules.forEach(schedule => {
      const dayTimetable = schedule.timetable?.find(t => t.day === dayName);
      if (dayTimetable && dayTimetable.periods) {
        dayTimetable.periods.forEach(period => {
          // Kiểm tra xem giáo viên có dạy môn này không
          const assignment = assignments.find(a => 
            String(a.classId?._id) === String(schedule.classId?._id) &&
            period.teacher === teacher.name
          );
          if (assignment) {
            todaySchedule.push({
              period: period.period,
              subject: period.subject || assignment.subjectId?.name || 'Chưa có môn',
              className: schedule.classId?.className || schedule.className || 'Chưa có lớp'
            });
          }
        });
      }
    });

    if (todaySchedule.length === 0) {
      return {
        text: `📅 **Lịch dạy hôm nay (${getDayName(dayOfWeek)}):**

Bạn không có tiết dạy nào hôm nay.`,
        type: 'text'
      };
    }

    // Sắp xếp theo tiết
    todaySchedule.sort((a, b) => a.period - b.period);

    let text = `📅 **Lịch dạy hôm nay (${getDayName(dayOfWeek)}):**\n\n`;
    todaySchedule.forEach(item => {
      text += `**Tiết ${item.period}:** ${item.subject} - ${item.className}\n`;
    });

    return {
      text,
      type: 'text',
      data: { schedules: todaySchedule }
    };
  } catch (error) {
    console.error('Error finding teacher schedule:', error);
    return {
      text: 'Không thể tải thời khóa biểu. Vui lòng thử lại sau.',
      type: 'text'
    };
  }
}

function getDayName(dayOfWeek) {
  const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  return days[dayOfWeek] || '';
}

/* =========================================================
   👨‍💼 XỬ LÝ CÂU HỎI ADMIN
========================================================= */

async function handleAdminQuery(query, user) {
  // Tìm học sinh theo lớp
  if ((query.includes('tìm') || query.includes('tìm kiếm') || query.includes('danh sách')) && 
      (query.includes('học sinh') || query.includes('hs'))) {
    return await findStudentsByClass(query, user);
  }

  // Tìm giáo viên theo môn
  if ((query.includes('tìm') || query.includes('tìm kiếm') || query.includes('danh sách') || query.includes('giáo viên dạy')) && 
      (query.includes('giáo viên') || query.includes('gv') || query.includes('thầy') || query.includes('cô'))) {
    return await findTeachersBySubject(query, user);
  }

  // Gợi ý phòng thi tự động
  if (query.includes('phòng thi') && (query.includes('chia') || query.includes('phân') || query.includes('gợi ý'))) {
    return {
      text: `🎯 **Gợi ý phân phòng thi:**

Để phân phòng thi tự động:
1. Vào **Kỳ thi** → Chọn kỳ thi
2. Vào tab **Lịch thi** → Chọn lịch thi
3. Vào tab **Phòng thi** → Chọn **Phân phòng tự động**
4. Hệ thống sẽ tự động chia học sinh vào các phòng

💡 Hệ thống sẽ phân bổ đều học sinh vào các phòng có sẵn.`,
      type: 'text',
      action: 'navigate',
      data: { path: '/admin/exams' }
    };
  }

  // Kiểm tra lỗi trùng phòng
  if (query.includes('trùng phòng') || query.includes('lỗi phòng')) {
    return {
      text: `🔍 **Kiểm tra trùng phòng:**

Để kiểm tra lỗi trùng phòng:
1. Vào **Kỳ thi** → Chọn kỳ thi
2. Vào tab **Lịch thi**
3. Hệ thống sẽ tự động hiển thị cảnh báo nếu có trùng phòng

💡 Bạn có thể sử dụng chức năng **Phân phòng tự động** để tránh lỗi trùng phòng.`,
      type: 'text',
      action: 'navigate',
      data: { path: '/admin/exams' }
    };
  }

  // Hướng dẫn sử dụng hệ thống
  if (query.includes('tạo học kỳ') || query.includes('học kỳ') || query.includes('hướng dẫn')) {
    return {
      text: `📖 **Hướng dẫn sử dụng hệ thống:**

**1. Tạo học kỳ:**
   - Vào **Cài đặt** → **Năm học**
   - Tạo năm học mới và cấu hình học kỳ

**2. Quản lý học sinh:**
   - Vào **Học sinh** → Thêm/Sửa/Xóa học sinh

**3. Quản lý giáo viên:**
   - Vào **Giáo viên** → Thêm/Sửa/Xóa giáo viên

**4. Phân công giảng dạy:**
   - Vào **Phân công** → Gán giáo viên dạy lớp

**5. Quản lý kỳ thi:**
   - Vào **Kỳ thi** → Tạo và quản lý kỳ thi

💡 Bạn có thể xem thêm hướng dẫn chi tiết tại menu **Trợ giúp**.`,
      type: 'text'
    };
  }

  // Gợi ý phân công giáo viên
  if (query.includes('phân công') || (query.includes('giáo viên') && query.includes('gợi ý'))) {
    return {
      text: `👨‍🏫 **Gợi ý phân công giáo viên:**

Để xem danh sách giáo viên:
1. Vào **Giáo viên** → Xem danh sách
2. Lọc theo môn học để tìm giáo viên phù hợp
3. Vào **Phân công** → Gán giáo viên dạy lớp

💡 Hệ thống sẽ hiển thị thông tin giáo viên và các lớp họ đang dạy.`,
      type: 'text',
      action: 'navigate',
      data: { path: '/admin/teachers' }
    };
  }

  return null;
}

async function findStudentsByClass(query, user) {
  try {
    // Tìm tên lớp trong query (ví dụ: 10A1, 11B2, 12C3)
    const classMatch = query.match(/(\d{1,2}[a-z]\d{1,2})/i) || query.match(/(lớp\s*)?(\d{1,2}[a-z]\d{1,2})/i);
    let className = null;
    
    if (classMatch) {
      className = classMatch[1] || classMatch[2];
      // Chuẩn hóa tên lớp (10A1 -> 10A1)
      className = className.toUpperCase();
    }

    const Class = require('../models/class/class');
    
    let classes = [];
    if (className) {
      // Tìm lớp cụ thể
      classes = await Class.find({ 
        className: { $regex: className, $options: 'i' }
      }).select('className grade year');
    } else {
      // Lấy tất cả lớp nếu không chỉ định
      classes = await Class.find().select('className grade year').limit(20);
    }

    if (classes.length === 0) {
      return {
        text: `❌ Không tìm thấy lớp học nào.${className ? `\n\n💡 Bạn có thể thử tìm kiếm với tên lớp khác.` : ''}`,
        type: 'text'
      };
    }

    // Lấy danh sách học sinh từ các lớp
    let allStudents = [];
    for (const cls of classes) {
      // ✅ Lấy học sinh - CHỈ lấy học sinh của niên khóa tương ứng
      const students = await Student.find({ 
        classId: cls._id, 
        status: 'active',
        currentYear: cls.year // ✅ CHỈ lấy học sinh có currentYear trùng với năm học của lớp
      })
        .select('name studentCode')
        .limit(50)
        .sort('name');
      
      allStudents.push({
        className: cls.className,
        grade: cls.grade,
        students: students.map(s => ({ name: s.name, studentCode: s.studentCode }))
      });
    }

    let text = `👥 **Danh sách học sinh${className ? ` lớp ${className}` : ''}:**\n\n`;
    
    allStudents.forEach((item, idx) => {
      text += `**${item.className}** (Khối ${item.grade}) - ${item.students.length} học sinh:\n`;
      if (item.students.length > 0) {
        item.students.slice(0, 10).forEach((student, sIdx) => {
          text += `${sIdx + 1}. ${student.name} (${student.studentCode})\n`;
        });
        if (item.students.length > 10) {
          text += `... và ${item.students.length - 10} học sinh khác\n`;
        }
      } else {
        text += `(Chưa có học sinh)\n`;
      }
      text += '\n';
    });

    text += '💡 Để xem chi tiết, vui lòng vào trang **Học sinh** trong menu.';

    return {
      text,
      type: 'text',
      data: { classes: allStudents },
      action: 'navigate',
      path: '/admin/students'
    };
  } catch (error) {
    console.error('Error finding students by class:', error);
    return {
      text: 'Không thể tìm danh sách học sinh. Vui lòng thử lại sau.',
      type: 'text'
    };
  }
}

async function findTeachersBySubject(query, user) {
  try {
    // Tìm tên môn học trong query
    const subjectKeywords = {
      'toán': ['toán', 'math'],
      'văn': ['văn', 'ngữ văn', 'van'],
      'anh': ['anh', 'tiếng anh', 'english', 'tieng anh'],
      'lý': ['lý', 'vật lý', 'physics'],
      'hóa': ['hóa', 'hóa học', 'chemistry'],
      'sinh': ['sinh', 'sinh học', 'biology'],
      'sử': ['sử', 'lịch sử', 'history'],
      'địa': ['địa', 'địa lý', 'geography'],
      'gdcd': ['gdcd', 'giáo dục công dân'],
    };

    let subjectName = null;
    for (const [key, keywords] of Object.entries(subjectKeywords)) {
      if (keywords.some(kw => query.includes(kw))) {
        subjectName = key;
        break;
      }
    }

    const Subject = require('../models/subject/subject');
    
    let foundSubjects = [];
    if (subjectName) {
      // Tìm môn cụ thể
      foundSubjects = await Subject.find({ 
        name: { $regex: subjectName, $options: 'i' }
      }).select('name code');
    } else {
      // Lấy tất cả môn nếu không chỉ định
      foundSubjects = await Subject.find().select('name code').limit(20);
    }

    if (foundSubjects.length === 0) {
      return {
        text: `❌ Không tìm thấy môn học nào.${subjectName ? `\n\n💡 Bạn có thể thử tìm kiếm với tên môn khác.` : ''}`,
        type: 'text'
      };
    }

    // Lấy danh sách giáo viên dạy các môn này
    const settings = await Setting.findOne();
    const currentYear = settings?.currentSchoolYear || '2025-2026';
    const now = new Date();
    const month = now.getMonth() + 1;
    const semester = (month >= 8 || month <= 1) ? '1' : '2';

    let allTeachers = [];
    for (const subject of foundSubjects) {
      const assignments = await TeachingAssignment.find({
        subjectId: subject._id,
        year: currentYear,
        semester: semester
      })
        .populate('teacherId', 'name teacherCode')
        .populate('classId', 'className grade');

      const teacherMap = new Map();
      assignments.forEach(ass => {
        if (ass.teacherId) {
          const teacherId = ass.teacherId._id.toString();
          if (!teacherMap.has(teacherId)) {
            teacherMap.set(teacherId, {
              teacher: ass.teacherId,
              classes: []
            });
          }
          if (ass.classId) {
            teacherMap.get(teacherId).classes.push(ass.classId.className);
          }
        }
      });

      allTeachers.push({
        subject: subject.name,
        teachers: Array.from(teacherMap.values()).map(t => ({
          name: t.teacher.name,
          teacherCode: t.teacher.teacherCode,
          classes: t.classes
        }))
      });
    }

    let text = `👨‍🏫 **Danh sách giáo viên${subjectName ? ` dạy môn ${subjectName.toUpperCase()}` : ''}:**\n\n`;
    
    allTeachers.forEach((item, idx) => {
      text += `**Môn ${item.subject}:**\n`;
      if (item.teachers.length > 0) {
        item.teachers.forEach((teacher, tIdx) => {
          text += `${tIdx + 1}. ${teacher.name}`;
          if (teacher.teacherCode) text += ` (${teacher.teacherCode})`;
          if (teacher.classes.length > 0) {
            text += ` - Dạy: ${teacher.classes.slice(0, 5).join(', ')}`;
            if (teacher.classes.length > 5) text += ` ...`;
          }
          text += '\n';
        });
      } else {
        text += `(Chưa có giáo viên được phân công)\n`;
      }
      text += '\n';
    });

    text += '💡 Để xem chi tiết, vui lòng vào trang **Giáo viên** trong menu.';

    return {
      text,
      type: 'text',
      data: { teachers: allTeachers },
      action: 'navigate',
      path: '/admin/teachers'
    };
  } catch (error) {
    console.error('Error finding teachers by subject:', error);
    return {
      text: 'Không thể tìm danh sách giáo viên. Vui lòng thử lại sau.',
      type: 'text'
    };
  }
}

