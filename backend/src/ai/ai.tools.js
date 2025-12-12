const Student = require('../models/user/student');
const Teacher = require('../models/user/teacher');
const Account = require('../models/user/account');
const Class = require('../models/class/class');
const Subject = require('../models/subject/subject');
const TeachingAssignment = require('../models/subject/teachingAssignment');
const Schedule = require('../models/subject/schedule');
const Room = require('../models/room/room');
const { Exam, ExamSchedule, ExamRoom, ExamStudent, RoomAssignment } = require('../models/exam/examIndex');
const { getCurrentSchoolYear } = require('../utils/schoolYearHelper');

/**
 * AI Tools - Function calling system cho AI (Production Ready)
 * 
 * AI có thể gọi các functions này để lấy dữ liệu thật từ hệ thống và thực hiện các tác vụ
 */
class AITools {
  constructor() {
    this.tools = this.initializeTools();
  }

  /**
   * Khởi tạo danh sách tools (20+ functions cho Admin)
   */
  initializeTools() {
    return [
      // ============================================================
      // 📚 TÌM KIẾM HỌC SINH (3 functions)
      // ============================================================
      {
        type: 'function',
        function: {
          name: 'findStudentByClass',
          description: 'Tìm danh sách học sinh theo lớp học. Ví dụ: "tìm học sinh lớp 10A1", "danh sách lớp 11B2"',
          parameters: {
            type: 'object',
            properties: {
              className: {
                type: 'string',
                description: 'Tên lớp học (ví dụ: 10A1, 11B2, 12C3)'
              }
            },
            required: ['className']
          }
        },
        roles: ['admin', 'bgh', 'gvcn', 'teacher']
      },
      {
        type: 'function',
        function: {
          name: 'findStudentByName',
          description: 'Tìm học sinh theo tên. Ví dụ: "tìm học sinh tên Nguyễn Văn A"',
          parameters: {
            type: 'object',
            properties: {
              studentName: {
                type: 'string',
                description: 'Tên học sinh cần tìm'
              }
            },
            required: ['studentName']
          }
        },
        roles: ['admin', 'bgh', 'gvcn', 'teacher']
      },
      {
        type: 'function',
        function: {
          name: 'findStudentByCode',
          description: 'Tìm học sinh theo mã số học sinh. Ví dụ: "tìm học sinh mã HS001"',
          parameters: {
            type: 'object',
            properties: {
              studentCode: {
                type: 'string',
                description: 'Mã số học sinh'
              }
            },
            required: ['studentCode']
          }
        },
        roles: ['admin', 'bgh', 'gvcn', 'teacher']
      },
      
      // ============================================================
      // 👨‍🏫 TÌM KIẾM GIÁO VIÊN (3 functions)
      // ============================================================
      {
        type: 'function',
        function: {
          name: 'findTeacherBySubject',
          description: 'Tìm giáo viên dạy môn học. Ví dụ: "tìm giáo viên dạy Toán", "ai dạy môn Lý"',
          parameters: {
            type: 'object',
            properties: {
              subject: {
                type: 'string',
                description: 'Tên môn học (ví dụ: Toán, Lý, Hóa, Văn)'
              }
            },
            required: ['subject']
          }
        },
        roles: ['admin', 'bgh', 'qlbm', 'teacher']
      },
      {
        type: 'function',
        function: {
          name: 'findTeacherByClass',
          description: 'Tìm giáo viên dạy lớp. Ví dụ: "giáo viên dạy lớp 10A1", "ai dạy lớp 11B2"',
          parameters: {
            type: 'object',
            properties: {
              className: {
                type: 'string',
                description: 'Tên lớp học'
              }
            },
            required: ['className']
          }
        },
        roles: ['admin', 'bgh', 'qlbm', 'teacher']
      },
      {
        type: 'function',
        function: {
          name: 'findTeacherByName',
          description: 'Tìm giáo viên theo tên. Ví dụ: "tìm giáo viên tên Nguyễn Văn A"',
          parameters: {
            type: 'object',
            properties: {
              teacherName: {
                type: 'string',
                description: 'Tên giáo viên cần tìm'
              }
            },
            required: ['teacherName']
          }
        },
        roles: ['admin', 'bgh', 'qlbm']
      },
      
      // ============================================================
      // 🏫 TÌM KIẾM LỚP HỌC (2 functions)
      // ============================================================
      {
        type: 'function',
        function: {
          name: 'findClassByGrade',
          description: 'Tìm danh sách lớp theo khối. Ví dụ: "lớp khối 10", "danh sách lớp 12"',
          parameters: {
            type: 'object',
            properties: {
              grade: {
                type: 'string',
                description: 'Khối lớp (10, 11, 12)'
              }
            },
            required: ['grade']
          }
        },
        roles: ['admin', 'bgh', 'teacher']
      },
      {
        type: 'function',
        function: {
          name: 'findClassByName',
          description: 'Tìm lớp học theo tên. Ví dụ: "tìm lớp 10A1"',
          parameters: {
            type: 'object',
            properties: {
              className: {
                type: 'string',
                description: 'Tên lớp học'
              }
            },
            required: ['className']
          }
        },
        roles: ['admin', 'bgh', 'teacher']
      },
      
      // ============================================================
      // 🏢 QUẢN LÝ PHÒNG HỌC (3 functions)
      // ============================================================
      {
        type: 'function',
        function: {
          name: 'findAvailableRoom',
          description: 'Tìm phòng học trống trong khoảng thời gian. Ví dụ: "phòng nào trống tiết 3", "phòng trống thứ 2 tiết 1"',
          parameters: {
            type: 'object',
            properties: {
              dayOfWeek: {
                type: 'number',
                description: 'Thứ trong tuần (0=Chủ nhật, 1=Thứ 2, ..., 6=Thứ 7)'
              },
              period: {
                type: 'number',
                description: 'Tiết học (1-10)'
              },
              year: {
                type: 'string',
                description: 'Năm học (ví dụ: 2025-2026)'
              },
              semester: {
                type: 'string',
                description: 'Học kỳ (1 hoặc 2)'
              }
            },
            required: ['dayOfWeek', 'period']
          }
        },
        roles: ['admin', 'bgh', 'teacher']
      },
      {
        type: 'function',
        function: {
          name: 'checkRoomConflict',
          description: 'Kiểm tra xung đột phòng học. Ví dụ: "kiểm tra phòng A101 có trùng không", "xung đột phòng học"',
          parameters: {
            type: 'object',
            properties: {
              roomCode: {
                type: 'string',
                description: 'Mã phòng học'
              },
              day: {
                type: 'string',
                description: 'Thứ trong tuần (Monday, Tuesday, ...)'
              },
              period: {
                type: 'number',
                description: 'Tiết học (1-10)'
              },
              year: {
                type: 'string',
                description: 'Năm học'
              },
              semester: {
                type: 'string',
                description: 'Học kỳ'
              }
            },
            required: ['roomCode', 'day', 'period']
          }
        },
        roles: ['admin', 'bgh']
      },
      {
        type: 'function',
        function: {
          name: 'getRoomCapacity',
          description: 'Lấy thông tin sức chứa và trạng thái phòng học. Ví dụ: "phòng A101 chứa được bao nhiêu học sinh"',
          parameters: {
            type: 'object',
            properties: {
              roomCode: {
                type: 'string',
                description: 'Mã phòng học'
              }
            },
            required: ['roomCode']
          }
        },
        roles: ['admin', 'bgh']
      },
      
      // ============================================================
      // 📅 QUẢN LÝ KỲ THI (5 functions)
      // ============================================================
      {
        type: 'function',
        function: {
          name: 'checkExamRoomConflict',
          description: 'Kiểm tra xung đột phòng thi trong kỳ thi. Ví dụ: "kiểm tra trùng phòng thi", "xung đột phòng thi kỳ thi X"',
          parameters: {
            type: 'object',
            properties: {
              examId: {
                type: 'string',
                description: 'ID kỳ thi'
              }
            },
            required: ['examId']
          }
        },
        roles: ['admin', 'bgh']
      },
      {
        type: 'function',
        function: {
          name: 'suggestExamRoomAssignment',
          description: 'Gợi ý phân phòng thi tự động. Ví dụ: "gợi ý phân phòng thi", "chia phòng thi tự động cho kỳ thi X"',
          parameters: {
            type: 'object',
            properties: {
              examId: {
                type: 'string',
                description: 'ID kỳ thi'
              },
              scheduleId: {
                type: 'string',
                description: 'ID lịch thi (optional)'
              }
            },
            required: ['examId']
          }
        },
        roles: ['admin']
      },
      {
        type: 'function',
        function: {
          name: 'getExamStudents',
          description: 'Lấy danh sách học sinh dự thi. Ví dụ: "học sinh dự thi kỳ thi X", "danh sách thí sinh"',
          parameters: {
            type: 'object',
            properties: {
              examId: {
                type: 'string',
                description: 'ID kỳ thi'
              },
              grade: {
                type: 'string',
                description: 'Khối lớp (optional)'
              }
            },
            required: ['examId']
          }
        },
        roles: ['admin', 'bgh']
      },
      {
        type: 'function',
        function: {
          name: 'getExamSchedule',
          description: 'Lấy lịch thi của kỳ thi. Ví dụ: "lịch thi kỳ thi X", "xem lịch thi"',
          parameters: {
            type: 'object',
            properties: {
              examId: {
                type: 'string',
                description: 'ID kỳ thi'
              }
            },
            required: ['examId']
          }
        },
        roles: ['admin', 'bgh', 'teacher', 'student']
      },
      {
        type: 'function',
        function: {
          name: 'getExamRoomStats',
          description: 'Lấy thống kê phòng thi. Ví dụ: "thống kê phòng thi kỳ thi X", "số lượng phòng thi"',
          parameters: {
            type: 'object',
            properties: {
              examId: {
                type: 'string',
                description: 'ID kỳ thi'
              }
            },
            required: ['examId']
          }
        },
        roles: ['admin', 'bgh']
      },
      
      // ============================================================
      // 📚 QUẢN LÝ THỜI KHÓA BIỂU (4 functions)
      // ============================================================
      {
        type: 'function',
        function: {
          name: 'suggestScheduleGeneration',
          description: 'Gợi ý tạo thời khóa biểu tự động. Ví dụ: "gợi ý xếp thời khóa biểu", "tạo TKB tự động cho khối 10"',
          parameters: {
            type: 'object',
            properties: {
              grade: {
                type: 'string',
                description: 'Khối lớp (10, 11, 12)'
              },
              year: {
                type: 'string',
                description: 'Năm học'
              },
              semester: {
                type: 'string',
                description: 'Học kỳ (1 hoặc 2)'
              }
            },
            required: ['grade']
          }
        },
        roles: ['admin']
      },
      {
        type: 'function',
        function: {
          name: 'checkScheduleConflict',
          description: 'Kiểm tra xung đột thời khóa biểu. Ví dụ: "kiểm tra xung đột TKB", "trùng lịch dạy"',
          parameters: {
            type: 'object',
            properties: {
              teacherId: {
                type: 'string',
                description: 'ID giáo viên (optional)'
              },
              classId: {
                type: 'string',
                description: 'ID lớp học (optional)'
              },
              year: {
                type: 'string',
                description: 'Năm học'
              },
              semester: {
                type: 'string',
                description: 'Học kỳ'
              }
            },
            required: ['year', 'semester']
          }
        },
        roles: ['admin', 'bgh']
      },
      {
        type: 'function',
        function: {
          name: 'getClassSchedule',
          description: 'Lấy thời khóa biểu của lớp. Học sinh có thể dùng để xem lịch học của lớp mình. Ví dụ: "TKB lớp 10A1", "xem lịch học lớp X", "lịch học của tôi"',
          parameters: {
            type: 'object',
            properties: {
              className: {
                type: 'string',
                description: 'Tên lớp học (học sinh có thể dùng tên lớp của mình từ context)'
              },
              year: {
                type: 'string',
                description: 'Năm học (optional, sẽ dùng năm học hiện tại nếu không có)'
              },
              semester: {
                type: 'string',
                description: 'Học kỳ (optional, sẽ dùng học kỳ hiện tại nếu không có)'
              }
            },
            required: ['className']
          }
        },
        roles: ['admin', 'bgh', 'teacher', 'student']
      },
      {
        type: 'function',
        function: {
          name: 'getMyExamSchedule',
          description: 'Lấy lịch thi của học sinh. Ví dụ: "lịch thi của tôi", "khi nào thi", "thi môn gì"',
          parameters: {
            type: 'object',
            properties: {
              examId: {
                type: 'string',
                description: 'ID kỳ thi (optional, nếu không có sẽ lấy tất cả kỳ thi)'
              }
            },
            required: []
          }
        },
        roles: ['student']
      },
      {
        type: 'function',
        function: {
          name: 'getTeacherSchedule',
          description: 'Lấy thời khóa biểu của giáo viên. Ví dụ: "TKB giáo viên X", "lịch dạy của thầy Y"',
          parameters: {
            type: 'object',
            properties: {
              teacherName: {
                type: 'string',
                description: 'Tên giáo viên'
              },
              year: {
                type: 'string',
                description: 'Năm học'
              },
              semester: {
                type: 'string',
                description: 'Học kỳ'
              }
            },
            required: ['teacherName']
          }
        },
        roles: ['admin', 'bgh']
      },
      
      // ============================================================
      // 👨‍🏫 QUẢN LÝ GIÁO VIÊN (3 functions)
      // ============================================================
      {
        type: 'function',
        function: {
          name: 'findAvailableTeachers',
          description: 'Tìm giáo viên rảnh trong khoảng thời gian. Ví dụ: "giáo viên rảnh tiết 3 thứ 2", "tìm GV rảnh"',
          parameters: {
            type: 'object',
            properties: {
              dayOfWeek: {
                type: 'number',
                description: 'Thứ trong tuần (0-6)'
              },
              period: {
                type: 'number',
                description: 'Tiết học (1-10)'
              },
              subject: {
                type: 'string',
                description: 'Môn học (optional)'
              }
            },
            required: ['dayOfWeek', 'period']
          }
        },
        roles: ['admin', 'bgh']
      },
      {
        type: 'function',
        function: {
          name: 'getTeacherWorkload',
          description: 'Lấy khối lượng công việc của giáo viên. Ví dụ: "khối lượng công việc giáo viên X", "số lớp dạy của thầy Y"',
          parameters: {
            type: 'object',
            properties: {
              teacherName: {
                type: 'string',
                description: 'Tên giáo viên'
              },
              year: {
                type: 'string',
                description: 'Năm học'
              },
              semester: {
                type: 'string',
                description: 'Học kỳ'
              }
            },
            required: ['teacherName']
          }
        },
        roles: ['admin', 'bgh']
      },
      {
        type: 'function',
        function: {
          name: 'checkTeacherAvailability',
          description: 'Kiểm tra lịch rảnh của giáo viên. Ví dụ: "giáo viên X có rảnh không", "kiểm tra lịch rảnh thầy Y"',
          parameters: {
            type: 'object',
            properties: {
              teacherName: {
                type: 'string',
                description: 'Tên giáo viên'
              },
              dayOfWeek: {
                type: 'number',
                description: 'Thứ trong tuần (0-6)'
              },
              period: {
                type: 'number',
                description: 'Tiết học (1-10)'
              }
            },
            required: ['teacherName', 'dayOfWeek', 'period']
          }
        },
        roles: ['admin', 'bgh']
      },
      
      // ============================================================
      // 📊 THỐNG KÊ VÀ BÁO CÁO (3 functions)
      // ============================================================
      {
        type: 'function',
        function: {
          name: 'getClassStatistics',
          description: 'Lấy thống kê lớp học. Ví dụ: "thống kê lớp 10A1", "số học sinh lớp X"',
          parameters: {
            type: 'object',
            properties: {
              className: {
                type: 'string',
                description: 'Tên lớp học'
              }
            },
            required: ['className']
          }
        },
        roles: ['admin', 'bgh', 'gvcn']
      },
      {
        type: 'function',
        function: {
          name: 'getSubjectStatistics',
          description: 'Lấy thống kê môn học. Ví dụ: "thống kê môn Toán", "số lớp dạy môn X"',
          parameters: {
            type: 'object',
            properties: {
              subjectName: {
                type: 'string',
                description: 'Tên môn học'
              }
            },
            required: ['subjectName']
          }
        },
        roles: ['admin', 'bgh']
      },
      {
        type: 'function',
        function: {
          name: 'getSystemStatistics',
          description: 'Lấy thống kê tổng quan hệ thống. Ví dụ: "thống kê hệ thống", "tổng số học sinh, giáo viên"',
          parameters: {
            type: 'object',
            properties: {}
          },
          required: []
        },
        roles: ['admin', 'bgh']
      },
      
      // ============================================================
      // 🔔 THÔNG BÁO (1 function)
      // ============================================================
      {
        type: 'function',
        function: {
          name: 'generateNotification',
          description: 'Sinh thông báo tự động dựa trên ngữ cảnh. Ví dụ: "tạo thông báo cho lớp 10A1", "thông báo kỳ thi"',
          parameters: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['exam', 'schedule', 'grade', 'general'],
                description: 'Loại thông báo'
              },
              target: {
                type: 'string',
                description: 'Đối tượng nhận (lớp, khối, toàn trường)'
              },
              content: {
                type: 'string',
                description: 'Nội dung thông báo (optional, AI có thể tự sinh)'
              }
            },
            required: ['type', 'target']
          }
        },
        roles: ['admin', 'bgh']
      }
    ];
  }

  /**
   * Lấy tools phù hợp với role
   */
  getToolsForRole(role, context = {}) {
    let effectiveRole = role;
    if (role === 'teacher') {
      if (context.isLeader) effectiveRole = 'bgh';
      else if (context.isDepartmentHead) effectiveRole = 'qlbm';
      else if (context.isHomeroom) effectiveRole = 'gvcn';
      else effectiveRole = 'gvbm';
    }

    return this.tools
      .filter(tool => tool.roles.includes(effectiveRole) || tool.roles.includes(role))
      .map(tool => ({
        type: tool.type,
        function: tool.function
      }));
  }

  /**
   * Thực thi tool
   */
  async executeTool(toolName, args, context = {}) {
    try {
      switch (toolName) {
        // Tìm học sinh
        case 'findStudentByClass':
          return await this.findStudentByClass(args.className);
        case 'findStudentByName':
          return await this.findStudentByName(args.studentName);
        case 'findStudentByCode':
          return await this.findStudentByCode(args.studentCode);
        
        // Tìm giáo viên
        case 'findTeacherBySubject':
          return await this.findTeacherBySubject(args.subject);
        case 'findTeacherByClass':
          return await this.findTeacherByClass(args.className);
        case 'findTeacherByName':
          return await this.findTeacherByName(args.teacherName);
        
        // Tìm lớp học
        case 'findClassByGrade':
          return await this.findClassByGrade(args.grade);
        case 'findClassByName':
          return await this.findClassByName(args.className);
        
        // Phòng học
        case 'findAvailableRoom':
          return await this.findAvailableRoom(args.dayOfWeek, args.period, args.year, args.semester);
        case 'checkRoomConflict':
          return await this.checkRoomConflict(args.roomCode, args.day, args.period, args.year, args.semester);
        case 'getRoomCapacity':
          return await this.getRoomCapacity(args.roomCode);
        
        // Kỳ thi
        case 'checkExamRoomConflict':
          return await this.checkExamRoomConflict(args.examId);
        case 'suggestExamRoomAssignment':
          return await this.suggestExamRoomAssignment(args.examId, args.scheduleId);
        case 'getExamStudents':
          return await this.getExamStudents(args.examId, args.grade);
        case 'getExamSchedule':
          return await this.getExamSchedule(args.examId);
        case 'getExamRoomStats':
          return await this.getExamRoomStats(args.examId);
        
        // Thời khóa biểu
        case 'suggestScheduleGeneration':
          return await this.suggestScheduleGeneration(args.grade, args.year, args.semester);
        case 'checkScheduleConflict':
          return await this.checkScheduleConflict(args.teacherId, args.classId, args.year, args.semester);
        case 'getClassSchedule':
          return await this.getClassSchedule(args.className, args.year, args.semester);
        case 'getTeacherSchedule':
          return await this.getTeacherSchedule(args.teacherName, args.year, args.semester);
        case 'getMyExamSchedule':
          return await this.getMyExamSchedule(context);
        
        // Giáo viên
        case 'findAvailableTeachers':
          return await this.findAvailableTeachers(args.dayOfWeek, args.period, args.subject);
        case 'getTeacherWorkload':
          return await this.getTeacherWorkload(args.teacherName, args.year, args.semester);
        case 'checkTeacherAvailability':
          return await this.checkTeacherAvailability(args.teacherName, args.dayOfWeek, args.period);
        
        // Thống kê
        case 'getClassStatistics':
          return await this.getClassStatistics(args.className);
        case 'getSubjectStatistics':
          return await this.getSubjectStatistics(args.subjectName);
        case 'getSystemStatistics':
          return await this.getSystemStatistics();
        
        // Thông báo
        case 'generateNotification':
          return await this.generateNotification(args.type, args.target, args.content);
        
        default:
          throw new Error(`Tool không tồn tại: ${toolName}`);
      }
    } catch (error) {
      console.error(`❌ [Tool Execution Error] ${toolName}:`, error);
      return {
        error: error.message,
        success: false
      };
    }
  }

  // ============================================================
  // 📚 IMPLEMENTATION: Tìm học sinh
  // ============================================================

  async findStudentByClass(className) {
    const classDoc = await Class.findOne({ 
      className: { $regex: new RegExp(className, 'i') }
    });
    
    if (!classDoc) {
      return {
        success: false,
        message: `Không tìm thấy lớp ${className}`,
        students: []
      };
    }

    const students = await Student.find({ 
      classId: classDoc._id,
      isDeleted: { $ne: true }
    })
      .select('name studentCode email phone dob gender')
      .limit(50)
      .lean();

    return {
      success: true,
      className: classDoc.className,
      grade: classDoc.grade,
      count: students.length,
      students: students
    };
  }

  async findStudentByName(studentName) {
    const students = await Student.find({
      name: { $regex: new RegExp(studentName, 'i') },
      isDeleted: { $ne: true }
    })
      .select('name studentCode email phone className')
      .populate('classId', 'className grade')
      .limit(20)
      .lean();

    return {
      success: true,
      count: students.length,
      students: students.map(s => ({
        name: s.name,
        studentCode: s.studentCode,
        email: s.email,
        phone: s.phone,
        className: s.classId?.className || 'N/A',
        grade: s.classId?.grade || 'N/A'
      }))
    };
  }

  async findStudentByCode(studentCode) {
    const student = await Student.findOne({
      studentCode: { $regex: new RegExp(studentCode, 'i') },
      isDeleted: { $ne: true }
    })
      .select('name studentCode email phone dob gender')
      .populate('classId', 'className grade')
      .lean();

    if (!student) {
      return {
        success: false,
        message: `Không tìm thấy học sinh với mã ${studentCode}`,
        student: null
      };
    }

    return {
      success: true,
      student: {
        name: student.name,
        studentCode: student.studentCode,
        email: student.email,
        phone: student.phone,
        dob: student.dob,
        gender: student.gender,
        className: student.classId?.className || 'N/A',
        grade: student.classId?.grade || 'N/A'
      }
    };
  }

  // ============================================================
  // 👨‍🏫 IMPLEMENTATION: Tìm giáo viên
  // ============================================================

  async findTeacherBySubject(subjectName) {
    const subject = await Subject.findOne({
      name: { $regex: new RegExp(subjectName, 'i') }
    });

    if (!subject) {
      return {
        success: false,
        message: `Không tìm thấy môn ${subjectName}`,
        teachers: []
      };
    }

    const currentYear = await getCurrentSchoolYear() || '2025-2026';
    const now = new Date();
    const month = now.getMonth() + 1;
    const semester = (month >= 8 || month <= 1) ? '1' : '2';

    const assignments = await TeachingAssignment.find({
      subjectId: subject._id,
      year: currentYear,
      semester: semester
    })
      .populate('teacherId', 'name email phone teacherCode')
      .populate('classId', 'className grade')
      .lean();

    const teachersMap = new Map();
    assignments.forEach(ass => {
      if (ass.teacherId) {
        const teacherId = ass.teacherId._id.toString();
        if (!teachersMap.has(teacherId)) {
          teachersMap.set(teacherId, {
            teacher: {
              name: ass.teacherId.name,
              teacherCode: ass.teacherId.teacherCode || 'N/A',
              email: ass.teacherId.email,
              phone: ass.teacherId.phone
            },
            classes: []
          });
        }
        if (ass.classId?.className) {
          teachersMap.get(teacherId).classes.push({
            className: ass.classId.className,
            grade: ass.classId.grade
          });
        }
      }
    });

    return {
      success: true,
      subject: subject.name,
      count: teachersMap.size,
      teachers: Array.from(teachersMap.values())
    };
  }

  async findTeacherByClass(className) {
    const classDoc = await Class.findOne({
      className: { $regex: new RegExp(className, 'i') }
    });

    if (!classDoc) {
      return {
        success: false,
        message: `Không tìm thấy lớp ${className}`,
        teachers: []
      };
    }

    const currentYear = await getCurrentSchoolYear() || '2025-2026';
    const now = new Date();
    const month = now.getMonth() + 1;
    const semester = (month >= 8 || month <= 1) ? '1' : '2';

    const assignments = await TeachingAssignment.find({
      classId: classDoc._id,
      year: currentYear,
      semester: semester
    })
      .populate('teacherId', 'name email phone teacherCode')
      .populate('subjectId', 'name code')
      .lean();

    return {
      success: true,
      className: classDoc.className,
      grade: classDoc.grade,
      count: assignments.length,
      teachers: assignments.map(ass => ({
        teacher: ass.teacherId,
        subject: ass.subjectId
      }))
    };
  }

  async findTeacherByName(teacherName) {
    const teachers = await Teacher.find({
      name: { $regex: new RegExp(teacherName, 'i') },
      isDeleted: { $ne: true }
    })
      .select('name teacherCode email phone departmentId')
      .populate('departmentId', 'name')
      .limit(20)
      .lean();

    return {
      success: true,
      count: teachers.length,
      teachers: teachers.map(t => ({
        name: t.name,
        teacherCode: t.teacherCode || 'N/A',
        email: t.email,
        phone: t.phone,
        department: t.departmentId?.name || 'N/A'
      }))
    };
  }

  // ============================================================
  // 🏫 IMPLEMENTATION: Tìm lớp học
  // ============================================================

  async findClassByGrade(grade) {
    const classes = await Class.find({
      grade: grade.toString(),
      isDeleted: { $ne: true }
    })
      .select('className grade year')
      .sort('className')
      .lean();

    return {
      success: true,
      grade: grade,
      count: classes.length,
      classes: classes
    };
  }

  async findClassByName(className) {
    const classDoc = await Class.findOne({
      className: { $regex: new RegExp(className, 'i') },
      isDeleted: { $ne: true }
    })
      .select('className grade year roomId')
      .populate('roomId', 'roomCode capacity')
      .lean();

    if (!classDoc) {
      return {
        success: false,
        message: `Không tìm thấy lớp ${className}`,
        class: null
      };
    }

    return {
      success: true,
      class: classDoc
    };
  }

  // ============================================================
  // 🏢 IMPLEMENTATION: Phòng học
  // ============================================================

  async findAvailableRoom(dayOfWeek, period, year, semester) {
    try {
      const currentYear = year || await getCurrentSchoolYear() || '2025-2026';
      const currentSemester = semester || (() => {
        const now = new Date();
        const month = now.getMonth() + 1;
        return (month >= 8 || month <= 1) ? '1' : '2';
      })();

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[dayOfWeek] || 'Monday';

      // Lấy tất cả phòng học
      const allRooms = await Room.find({ 
        status: 'available',
        type: 'normal'
      }).lean();

      // Lấy tất cả schedule đã xếp
      const schedules = await Schedule.find({
        year: currentYear,
        semester: currentSemester,
        isDeleted: { $ne: true }
      }).lean();

      // Tìm phòng đã được sử dụng
      const usedRooms = new Set();
      schedules.forEach(schedule => {
        schedule.timetable?.forEach(dayEntry => {
          if (dayEntry.day === dayName) {
            dayEntry.periods?.forEach(periodEntry => {
              if (periodEntry.period === period && schedule.classId) {
                // Lấy roomId từ class
                const classObj = schedule.classId;
                if (classObj.roomId) {
                  usedRooms.add(classObj.roomId.toString());
                }
              }
            });
          }
        });
      });

      // Lọc phòng trống
      const availableRooms = allRooms.filter(room => 
        !usedRooms.has(room._id.toString())
      );

      return {
        success: true,
        dayOfWeek: dayName,
        period: period,
        count: availableRooms.length,
        rooms: availableRooms.map(r => ({
          roomCode: r.roomCode,
          capacity: r.capacity,
          type: r.type
        }))
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        rooms: []
      };
    }
  }

  async checkRoomConflict(roomCode, day, period, year, semester) {
    try {
      const currentYear = year || await getCurrentSchoolYear() || '2025-2026';
      const currentSemester = semester || (() => {
        const now = new Date();
        const month = now.getMonth() + 1;
        return (month >= 8 || month <= 1) ? '1' : '2';
      })();

      const room = await Room.findOne({ roomCode });
      if (!room) {
        return {
          success: false,
          message: `Không tìm thấy phòng ${roomCode}`,
          conflict: false
        };
      }

      // Lấy tất cả lớp có phòng này
      const classes = await Class.find({ roomId: room._id }).lean();
      const classIds = classes.map(c => c._id);

      // Kiểm tra schedule
      const schedules = await Schedule.find({
        classId: { $in: classIds },
        year: currentYear,
        semester: currentSemester,
        isDeleted: { $ne: true }
      }).lean();

      const conflicts = [];
      schedules.forEach(schedule => {
        schedule.timetable?.forEach(dayEntry => {
          if (dayEntry.day === day) {
            dayEntry.periods?.forEach(periodEntry => {
              if (periodEntry.period === period) {
                conflicts.push({
                  className: schedule.className,
                  subject: periodEntry.subject,
                  teacher: periodEntry.teacher
                });
              }
            });
          }
        });
      });

      return {
        success: true,
        roomCode: roomCode,
        day: day,
        period: period,
        conflict: conflicts.length > 0,
        conflicts: conflicts
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        conflict: false
      };
    }
  }

  async getRoomCapacity(roomCode) {
    const room = await Room.findOne({ roomCode });
    
    if (!room) {
      return {
        success: false,
        message: `Không tìm thấy phòng ${roomCode}`,
        capacity: null
      };
    }

    return {
      success: true,
      roomCode: room.roomCode,
      capacity: room.capacity,
      type: room.type,
      status: room.status
    };
  }

  // ============================================================
  // 📅 IMPLEMENTATION: Kỳ thi
  // ============================================================

  async checkExamRoomConflict(examId) {
    try {
      const exam = await Exam.findById(examId);
      if (!exam) {
        return {
          success: false,
          message: `Không tìm thấy kỳ thi ${examId}`,
          conflicts: []
        };
      }

      const examRooms = await ExamRoom.find({ exam: examId })
        .populate('schedule', 'subject date startTime endTime')
        .lean();

      const roomUsage = new Map(); // roomCode -> [{ scheduleId, date, time }]
      const conflicts = [];

      examRooms.forEach(examRoom => {
        const roomCode = examRoom.roomCode;
        const schedule = examRoom.schedule;
        
        if (!schedule) return;

        const key = `${roomCode}_${schedule.date}_${schedule.startTime}`;
        
        if (roomUsage.has(key)) {
          conflicts.push({
            roomCode: roomCode,
            date: schedule.date,
            time: schedule.startTime,
            schedule1: roomUsage.get(key),
            schedule2: {
              scheduleId: schedule._id,
              subject: schedule.subject?.name || 'N/A'
            }
          });
        } else {
          roomUsage.set(key, {
            scheduleId: schedule._id,
            subject: schedule.subject?.name || 'N/A'
          });
        }
      });

      return {
        success: true,
        examId: examId,
        examName: exam.name,
        conflictCount: conflicts.length,
        conflicts: conflicts
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        conflicts: []
      };
    }
  }

  async suggestExamRoomAssignment(examId, scheduleId) {
    try {
      const exam = await Exam.findById(examId);
      if (!exam) {
        return {
          success: false,
          message: `Không tìm thấy kỳ thi ${examId}`,
          suggestion: null
        };
      }

      // Lấy danh sách học sinh dự thi
      const examStudents = await ExamStudent.find({ exam: examId })
        .populate('student', 'name studentCode')
        .lean();

      // Lấy danh sách phòng khả dụng
      const availableRooms = await Room.find({
        status: 'available',
        type: 'normal'
      })
        .sort({ capacity: -1 })
        .lean();

      // Tính toán gợi ý
      const totalStudents = examStudents.length;
      const totalCapacity = availableRooms.reduce((sum, r) => sum + (r.capacity || 0), 0);
      const suggestedRooms = [];
      let remainingStudents = totalStudents;
      let roomIndex = 0;

      while (remainingStudents > 0 && roomIndex < availableRooms.length) {
        const room = availableRooms[roomIndex];
        const studentsInRoom = Math.min(remainingStudents, room.capacity || 0);
        
        if (studentsInRoom > 0) {
          suggestedRooms.push({
            roomCode: room.roomCode,
            capacity: room.capacity,
            suggestedStudents: studentsInRoom
          });
          remainingStudents -= studentsInRoom;
        }
        roomIndex++;
      }

      return {
        success: true,
        examId: examId,
        totalStudents: totalStudents,
        totalCapacity: totalCapacity,
        suggestedRoomCount: suggestedRooms.length,
        canAccommodate: totalCapacity >= totalStudents,
        suggestedRooms: suggestedRooms,
        message: totalCapacity >= totalStudents 
          ? `Có thể phân phòng cho ${totalStudents} học sinh với ${suggestedRooms.length} phòng`
          : `Không đủ phòng: Cần ${totalStudents} chỗ nhưng chỉ có ${totalCapacity} chỗ`
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        suggestion: null
      };
    }
  }

  async getExamStudents(examId, grade) {
    try {
      const query = { exam: examId };
      if (grade) {
        const classes = await Class.find({ grade: grade.toString() }).select('_id').lean();
        const classIds = classes.map(c => c._id);
        query.classId = { $in: classIds };
      }

      const examStudents = await ExamStudent.find(query)
        .populate('student', 'name studentCode')
        .populate('classId', 'className grade')
        .limit(100)
        .lean();

      return {
        success: true,
        examId: examId,
        grade: grade || 'all',
        count: examStudents.length,
        students: examStudents.map(es => ({
          name: es.student?.name,
          studentCode: es.student?.studentCode,
          className: es.classId?.className,
          grade: es.classId?.grade,
          sbd: es.sbd
        }))
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        students: []
      };
    }
  }

  async getExamSchedule(examId) {
    try {
      const schedules = await ExamSchedule.find({ exam: examId })
        .populate('subject', 'name code')
        .sort('date startTime')
        .lean();

      return {
        success: true,
        examId: examId,
        count: schedules.length,
        schedules: schedules.map(s => ({
          subject: s.subject?.name || 'N/A',
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          grade: s.grade
        }))
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        schedules: []
      };
    }
  }

  async getExamRoomStats(examId) {
    try {
      const examRooms = await ExamRoom.find({ exam: examId })
        .populate('room', 'roomCode capacity')
        .lean();

      const totalRooms = examRooms.length;
      const totalCapacity = examRooms.reduce((sum, er) => {
        return sum + (er.room?.capacity || er.capacity || 0);
      }, 0);

      const assignedStudents = await RoomAssignment.countDocuments({ exam: examId });

      return {
        success: true,
        examId: examId,
        totalRooms: totalRooms,
        totalCapacity: totalCapacity,
        assignedStudents: assignedStudents,
        utilizationRate: totalCapacity > 0 ? (assignedStudents / totalCapacity * 100).toFixed(2) : 0
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        stats: null
      };
    }
  }

  // ============================================================
  // 📚 IMPLEMENTATION: Thời khóa biểu
  // ============================================================

  async suggestScheduleGeneration(grade, year, semester) {
    try {
      const currentYear = year || await getCurrentSchoolYear() || '2025-2026';
      const currentSemester = semester || (() => {
        const now = new Date();
        const month = now.getMonth() + 1;
        return (month >= 8 || month <= 1) ? '1' : '2';
      })();

      const classes = await Class.find({
        grade: grade.toString(),
        isDeleted: { $ne: true }
      }).lean();

      const assignments = await TeachingAssignment.find({
        year: currentYear,
        semester: currentSemester
      })
        .populate('classId', 'className grade')
        .populate('teacherId', 'name')
        .lean();

      const classAssignments = {};
      classes.forEach(cls => {
        const classAssigns = assignments.filter(a => 
          a.classId && a.classId._id.toString() === cls._id.toString()
        );
        classAssignments[cls.className] = classAssigns.length;
      });

      const classesWithSchedule = await Schedule.countDocuments({
        year: currentYear,
        semester: currentSemester,
        'classId': { $in: classes.map(c => c._id) }
      });

      return {
        success: true,
        grade: grade,
        year: currentYear,
        semester: currentSemester,
        totalClasses: classes.length,
        classesWithSchedule: classesWithSchedule,
        classesWithoutSchedule: classes.length - classesWithSchedule,
        suggestion: classes.length > classesWithSchedule
          ? `Có ${classes.length - classesWithSchedule} lớp chưa có thời khóa biểu. Nên tạo TKB tự động.`
          : 'Tất cả lớp đã có thời khóa biểu.',
        classAssignments: classAssignments
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        suggestion: null
      };
    }
  }

  async checkScheduleConflict(teacherId, classId, year, semester) {
    try {
      const currentYear = year || await getCurrentSchoolYear() || '2025-2026';
      const currentSemester = semester || (() => {
        const now = new Date();
        const month = now.getMonth() + 1;
        return (month >= 8 || month <= 1) ? '1' : '2';
      })();

      const query = {
        year: currentYear,
        semester: currentSemester,
        isDeleted: { $ne: true }
      };

      if (teacherId) {
        query['timetable.periods.teacherId'] = teacherId;
      }
      if (classId) {
        query.classId = classId;
      }

      const schedules = await Schedule.find(query).lean();
      const conflicts = [];

      // Kiểm tra trùng giáo viên
      const teacherSlots = new Map();
      schedules.forEach(schedule => {
        schedule.timetable?.forEach(dayEntry => {
          dayEntry.periods?.forEach(periodEntry => {
            if (periodEntry.teacherId) {
              const key = `${periodEntry.teacherId}_${dayEntry.day}_${periodEntry.period}`;
              if (teacherSlots.has(key)) {
                conflicts.push({
                  type: 'teacher',
                  teacherId: periodEntry.teacherId,
                  day: dayEntry.day,
                  period: periodEntry.period,
                  className1: teacherSlots.get(key).className,
                  className2: schedule.className
                });
              } else {
                teacherSlots.set(key, {
                  className: schedule.className,
                  subject: periodEntry.subject
                });
              }
            }
          });
        });
      });

      return {
        success: true,
        year: currentYear,
        semester: currentSemester,
        conflictCount: conflicts.length,
        conflicts: conflicts
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        conflicts: []
      };
    }
  }

  async getClassSchedule(className, year, semester) {
    try {
      const classDoc = await Class.findOne({
        className: { $regex: new RegExp(className, 'i') }
      });

      if (!classDoc) {
        return {
          success: false,
          message: `Không tìm thấy lớp ${className}`,
          schedule: null
        };
      }

      const currentYear = year || await getCurrentSchoolYear() || '2025-2026';
      const currentSemester = semester || (() => {
        const now = new Date();
        const month = now.getMonth() + 1;
        return (month >= 8 || month <= 1) ? '1' : '2';
      })();

      const schedule = await Schedule.findOne({
        classId: classDoc._id,
        year: currentYear,
        semester: currentSemester,
        isDeleted: { $ne: true }
      }).lean();

      if (!schedule) {
        return {
          success: false,
          message: `Lớp ${className} chưa có thời khóa biểu cho năm học ${currentYear}, học kỳ ${currentSemester}`,
          schedule: null
        };
      }

      return {
        success: true,
        className: className,
        year: currentYear,
        semester: currentSemester,
        schedule: schedule.timetable
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        schedule: null
      };
    }
  }

  async getTeacherSchedule(teacherName, year, semester) {
    try {
      const teacher = await Teacher.findOne({
        name: { $regex: new RegExp(teacherName, 'i') }
      });

      if (!teacher) {
        return {
          success: false,
          message: `Không tìm thấy giáo viên ${teacherName}`,
          schedule: null
        };
      }

      const currentYear = year || await getCurrentSchoolYear() || '2025-2026';
      const currentSemester = semester || (() => {
        const now = new Date();
        const month = now.getMonth() + 1;
        return (month >= 8 || month <= 1) ? '1' : '2';
      })();

      const schedules = await Schedule.find({
        year: currentYear,
        semester: currentSemester,
        'timetable.periods.teacherId': teacher._id,
        isDeleted: { $ne: true }
      })
        .populate('classId', 'className grade')
        .lean();

      const teacherSchedule = [];
      schedules.forEach(schedule => {
        schedule.timetable?.forEach(dayEntry => {
          dayEntry.periods?.forEach(periodEntry => {
            if (periodEntry.teacherId && periodEntry.teacherId.toString() === teacher._id.toString()) {
              teacherSchedule.push({
                day: dayEntry.day,
                period: periodEntry.period,
                subject: periodEntry.subject,
                className: schedule.className,
                grade: schedule.classId?.grade
              });
            }
          });
        });
      });

      return {
        success: true,
        teacherName: teacherName,
        year: currentYear,
        semester: currentSemester,
        count: teacherSchedule.length,
        schedule: teacherSchedule
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        schedule: null
      };
    }
  }

  // ============================================================
  // 👨‍🏫 IMPLEMENTATION: Giáo viên
  // ============================================================

  async findAvailableTeachers(dayOfWeek, period, subject) {
    try {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[dayOfWeek] || 'Monday';

      const teachers = await Teacher.find({
        isDeleted: { $ne: true }
      })
        .select('name teacherCode availableMatrix')
        .lean();

      const availableTeachers = [];

      teachers.forEach(teacher => {
        if (teacher.availableMatrix && Array.isArray(teacher.availableMatrix)) {
          const dayMatrix = teacher.availableMatrix[dayOfWeek];
          if (dayMatrix && dayMatrix[period - 1] === true) {
            availableTeachers.push({
              name: teacher.name,
              teacherCode: teacher.teacherCode || 'N/A'
            });
          }
        } else {
          // Nếu không có availableMatrix, mặc định là rảnh
          availableTeachers.push({
            name: teacher.name,
            teacherCode: teacher.teacherCode || 'N/A'
          });
        }
      });

      // Nếu có subject, lọc giáo viên dạy môn đó
      if (subject) {
        const subjectDoc = await Subject.findOne({
          name: { $regex: new RegExp(subject, 'i') }
        });

        if (subjectDoc) {
          const currentYear = await getCurrentSchoolYear() || '2025-2026';
          const now = new Date();
          const month = now.getMonth() + 1;
          const currentSemester = (month >= 8 || month <= 1) ? '1' : '2';

          const assignments = await TeachingAssignment.find({
            subjectId: subjectDoc._id,
            year: currentYear,
            semester: currentSemester
          })
            .populate('teacherId', 'name teacherCode')
            .lean();

          const teacherIds = new Set(assignments.map(a => a.teacherId?._id.toString()));
          const filtered = availableTeachers.filter(t => {
            const teacher = teachers.find(te => te.name === t.name);
            return teacher && teacherIds.has(teacher._id.toString());
          });

          return {
            success: true,
            dayOfWeek: dayName,
            period: period,
            subject: subject,
            count: filtered.length,
            teachers: filtered
          };
        }
      }

      return {
        success: true,
        dayOfWeek: dayName,
        period: period,
        count: availableTeachers.length,
        teachers: availableTeachers
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        teachers: []
      };
    }
  }

  async getTeacherWorkload(teacherName, year, semester) {
    try {
      const teacher = await Teacher.findOne({
        name: { $regex: new RegExp(teacherName, 'i') }
      });

      if (!teacher) {
        return {
          success: false,
          message: `Không tìm thấy giáo viên ${teacherName}`,
          workload: null
        };
      }

      const currentYear = year || await getCurrentSchoolYear() || '2025-2026';
      const currentSemester = semester || (() => {
        const now = new Date();
        const month = now.getMonth() + 1;
        return (month >= 8 || month <= 1) ? '1' : '2';
      })();

      const assignments = await TeachingAssignment.find({
        teacherId: teacher._id,
        year: currentYear,
        semester: currentSemester
      })
        .populate('classId', 'className grade')
        .populate('subjectId', 'name')
        .lean();

      const classes = new Set();
      const subjects = new Set();
      let totalPeriods = 0;

      assignments.forEach(ass => {
        if (ass.classId) classes.add(ass.classId.className);
        if (ass.subjectId) subjects.add(ass.subjectId.name);
        // TODO: Tính tổng số tiết từ Schedule
      });

      return {
        success: true,
        teacherName: teacherName,
        year: currentYear,
        semester: currentSemester,
        classCount: classes.size,
        subjectCount: subjects.size,
        classes: Array.from(classes),
        subjects: Array.from(subjects),
        totalPeriods: totalPeriods
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        workload: null
      };
    }
  }

  async checkTeacherAvailability(teacherName, dayOfWeek, period) {
    try {
      const teacher = await Teacher.findOne({
        name: { $regex: new RegExp(teacherName, 'i') }
      });

      if (!teacher) {
        return {
          success: false,
          message: `Không tìm thấy giáo viên ${teacherName}`,
          available: false
        };
      }

      const available = getTeacherAvailability(teacher, dayOfWeek, period - 1);

      return {
        success: true,
        teacherName: teacherName,
        dayOfWeek: dayOfWeek,
        period: period,
        available: available
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        available: false
      };
    }
  }

  // ============================================================
  // 📊 IMPLEMENTATION: Thống kê
  // ============================================================

  async getClassStatistics(className) {
    try {
      const classDoc = await Class.findOne({
        className: { $regex: new RegExp(className, 'i') }
      });

      if (!classDoc) {
        return {
          success: false,
          message: `Không tìm thấy lớp ${className}`,
          statistics: null
        };
      }

      const studentCount = await Student.countDocuments({
        classId: classDoc._id,
        isDeleted: { $ne: true }
      });

      const currentYear = await getCurrentSchoolYear() || '2025-2026';
      const now = new Date();
      const month = now.getMonth() + 1;
      const currentSemester = (month >= 8 || month <= 1) ? '1' : '2';

      const assignmentCount = await TeachingAssignment.countDocuments({
        classId: classDoc._id,
        year: currentYear,
        semester: currentSemester
      });

      return {
        success: true,
        className: className,
        grade: classDoc.grade,
        studentCount: studentCount,
        teacherCount: assignmentCount,
        year: currentYear,
        semester: currentSemester
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statistics: null
      };
    }
  }

  async getSubjectStatistics(subjectName) {
    try {
      const subject = await Subject.findOne({
        name: { $regex: new RegExp(subjectName, 'i') }
      });

      if (!subject) {
        return {
          success: false,
          message: `Không tìm thấy môn ${subjectName}`,
          statistics: null
        };
      }

      const currentYear = await getCurrentSchoolYear() || '2025-2026';
      const now = new Date();
      const month = now.getMonth() + 1;
      const currentSemester = (month >= 8 || month <= 1) ? '1' : '2';

      const assignments = await TeachingAssignment.find({
        subjectId: subject._id,
        year: currentYear,
        semester: currentSemester
      })
        .populate('classId', 'className grade')
        .populate('teacherId', 'name')
        .lean();

      const classes = new Set();
      const teachers = new Set();
      assignments.forEach(ass => {
        if (ass.classId) classes.add(ass.classId.className);
        if (ass.teacherId) teachers.add(ass.teacherId.name);
      });

      return {
        success: true,
        subjectName: subjectName,
        classCount: classes.size,
        teacherCount: teachers.size,
        classes: Array.from(classes),
        teachers: Array.from(teachers),
        year: currentYear,
        semester: currentSemester
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statistics: null
      };
    }
  }

  async getSystemStatistics() {
    try {
      const studentCount = await Student.countDocuments({ isDeleted: { $ne: true } });
      const teacherCount = await Teacher.countDocuments({ isDeleted: { $ne: true } });
      const classCount = await Class.countDocuments({ isDeleted: { $ne: true } });
      const subjectCount = await Subject.countDocuments({ isActive: { $ne: false } });
      const roomCount = await Room.countDocuments({ status: 'available' });

      const currentYear = await getCurrentSchoolYear() || '2025-2026';
      const examCount = await Exam.countDocuments({ year: currentYear });

      return {
        success: true,
        statistics: {
          students: studentCount,
          teachers: teacherCount,
          classes: classCount,
          subjects: subjectCount,
          rooms: roomCount,
          exams: examCount,
          year: currentYear
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statistics: null
      };
    }
  }

  // ============================================================
  // 🔔 IMPLEMENTATION: Thông báo
  // ============================================================

  async generateNotification(type, target, content) {
    try {
      // Đây là function gợi ý, không thực sự tạo thông báo
      // AI sẽ sử dụng kết quả này để tạo nội dung thông báo

      let suggestedContent = '';
      let recipients = [];

      switch (type) {
        case 'exam':
          suggestedContent = `Thông báo về kỳ thi cho ${target}. Vui lòng xem lịch thi và phòng thi trên hệ thống.`;
          break;
        case 'schedule':
          suggestedContent = `Thông báo về thời khóa biểu cho ${target}. Vui lòng kiểm tra lịch học trên hệ thống.`;
          break;
        case 'grade':
          suggestedContent = `Thông báo về điểm số cho ${target}. Vui lòng xem bảng điểm trên hệ thống.`;
          break;
        case 'general':
          suggestedContent = content || `Thông báo chung cho ${target}.`;
          break;
      }

      return {
        success: true,
        type: type,
        target: target,
        suggestedContent: suggestedContent,
        recipients: recipients,
        note: 'Đây là gợi ý. Bạn có thể chỉnh sửa nội dung trước khi gửi.'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        suggestion: null
      };
    }
  }
}

/**
 * Helper: Kiểm tra giáo viên có rảnh không
 */
function getTeacherAvailability(teacher, dayIdx, periodIdx) {
  if (!teacher || !teacher.availableMatrix) return true;
  const matrix = teacher.availableMatrix;
  if (!Array.isArray(matrix)) return true;
  if (dayIdx < 0 || dayIdx >= matrix.length) return true;
  const dayRow = matrix[dayIdx];
  if (!Array.isArray(dayRow)) return true;
  if (periodIdx < 0 || periodIdx >= dayRow.length) return true;
  const value = dayRow[periodIdx];
  return value === true || value === undefined || value === null;
}

module.exports = new AITools();
