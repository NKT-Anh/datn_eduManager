const mongoose = require('mongoose');
const ScheduleAssignmentService = require('../../services/scheduleAssignmentService');
const Schedule = require('../../models/subject/schedule');
const ScheduleConfig = require('../../models/subject/scheduleConfig');
const Class = require('../../models/class/class');
const Subject = require('../../models/subject/subject');
const Activity = require('../../models/subject/activity');
const TeachingAssignment = require('../../models/subject/teachingAssignment');
const ClassPeriods = require('../../models/class/classPeriods');
// ✅ TODO: Import AutoScheduleGenerator class when available
// const AutoScheduleGenerator = require('...');

// ✅ API: Tạo thời khóa biểu cho 1 lớp (để test)
exports.generateScheduleForSingleClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { year, semester } = req.body;

    // ✅ Validation
    if (!classId || !year || !semester) {
      return res.status(400).json({ 
        message: 'Thiếu tham số: classId, year, semester là bắt buộc',
        error: 'classId, year and semester are required'
      });
    }

    console.log(`🚀 Bắt đầu tạo thời khóa biểu cho 1 lớp: classId=${classId}, year=${year}, semester=${semester}`);

    // ✅ Lấy cấu hình
    const config = await ScheduleConfig.findOne();
    if (!config) {
      return res.status(400).json({ message: 'Chưa có cấu hình thời khóa biểu' });
    }

    // ✅ Lấy lớp
    const classObj = await Class.findById(classId);
    if (!classObj) {
      return res.status(404).json({ message: 'Không tìm thấy lớp' });
    }

    // ✅ Lấy dữ liệu cần thiết
    console.log(`📥 Đang load dữ liệu cho lớp ${classObj.className}...`);
    
    let subjects, activities, allAssignments, classPeriodsData;
    try {
      [subjects, activities, allAssignments, classPeriodsData] = await Promise.all([
        Subject.find({ isActive: { $ne: false } }),
        Activity.find({ isActive: true }),
        TeachingAssignment.find({ year, semester })
          .populate('teacherId', 'name availableMatrix maxClassPerGrade weeklyLessons maxClasses')
          .populate('subjectId', 'name grades')
          .populate('classId', 'className classCode grade year'),
        ClassPeriods.find({ year, semester, classId: classId })
          .populate('classId', 'className classCode grade')
      ]);
      console.log(`✅ Loaded data: ${subjects.length} subjects, ${activities.length} activities, ${allAssignments.length} assignments, ${classPeriodsData.length} classPeriods`);
    } catch (dbError) {
      console.error('❌ Lỗi khi load dữ liệu từ database:', dbError);
      return res.status(500).json({ 
        message: 'Lỗi khi load dữ liệu từ database',
        error: dbError.message 
      });
    }
    
    // ✅ Filter assignments chỉ lấy những assignment cho lớp này
    const assignments = allAssignments.filter(a => 
      a.classId && a.classId._id.toString() === classId.toString()
    );
    
    console.log(`📊 Filtered assignments: ${assignments.length} assignments cho lớp ${classObj.className}`);

    // ✅ Tạo thời khóa biểu
    console.log(`🔄 Bắt đầu tạo thời khóa biểu cho lớp ${classObj.className}...`);
    
    // ✅ TODO: AutoScheduleGenerator class chưa được implement
    // Tạm thời trả về lỗi rõ ràng
    return res.status(501).json({ 
      message: 'Chức năng tạo lịch tự động cho từng lớp chưa được implement',
      error: 'AutoScheduleGenerator class chưa được implement. Vui lòng sử dụng endpoint POST /auto-schedule/generate để tạo lịch cho nhiều lớp cùng lúc.',
      hint: 'Endpoint /auto-schedule/generate sẽ tạo lịch cho tất cả các lớp trong các khối được chỉ định.'
    });

    // ✅ Lưu vào database
    console.log(`💾 Bắt đầu lưu thời khóa biểu vào database...`);
    try {
      // ✅ Chuyển đổi classId từ string sang ObjectId nếu cần
      const classIdForQuery = mongoose.Types.ObjectId.isValid(schedule.classId) 
        ? schedule.classId 
        : new mongoose.Types.ObjectId(schedule.classId);
      
      // ✅ Xóa thời khóa biểu cũ nếu có
      await Schedule.deleteMany({
        classId: classIdForQuery,
        year: schedule.year,
        semester: schedule.semester
      });

      // ✅ Tạo Schedule mới
      const newSchedule = new Schedule({
        classId: classIdForQuery,
        className: schedule.className,
        year: schedule.year,
        semester: schedule.semester,
        timetable: schedule.timetable
      });

      await newSchedule.save();
      console.log(`✅ Đã lưu thời khóa biểu cho lớp ${schedule.className}`);

      // ✅ Cập nhật teacherId vào timetable periods (với queue và lock để check conflict)
      if (schedule.timetable && schedule.timetable.length > 0) {
        console.log(`🔄 Đang cập nhật teacherId vào timetable với queue và lock...`);
        
        // ✅ Duyệt qua timetable và cập nhật teacherId cho từng period
        for (const dayEntry of schedule.timetable) {
          for (const periodEntry of dayEntry.periods) {
            if (periodEntry.teacher && periodEntry.teacher.trim() !== '') {
              // ✅ Tìm teacherId từ teacherName từ TeachingAssignment
              const teachingAssignment = assignments.find(a => 
                a.classId && 
                a.classId._id.toString() === classId.toString() &&
                a.teacherId && 
                typeof a.teacherId === 'object' &&
                a.teacherId.name === periodEntry.teacher
              );
              
              if (teachingAssignment && teachingAssignment.teacherId) {
                const teacherId = typeof teachingAssignment.teacherId === 'object' 
                  ? teachingAssignment.teacherId._id || teachingAssignment.teacherId 
                  : teachingAssignment.teacherId;
                
                const subjectId = teachingAssignment.subjectId 
                  ? (typeof teachingAssignment.subjectId === 'object' ? teachingAssignment.subjectId._id : teachingAssignment.subjectId)
                  : null;

                // ✅ Kiểm tra conflict trước khi gán (với queue và lock)
                const conflict = await ScheduleAssignmentService.checkConflict(
                  teacherId,
                  dayEntry.day,
                  periodEntry.period,
                  schedule.year,
                  schedule.semester,
                  classIdForQuery // Exclude class hiện tại
                );
                
                if (conflict) {
                  console.warn(`⚠️ Conflict: Giáo viên ${periodEntry.teacher} đã được gán vào ${dayEntry.day}, tiết ${periodEntry.period}`);
                  // ✅ Không gán teacherId nếu conflict
                  periodEntry.teacherId = null;
                } else {
                  // ✅ Gán teacherId vào period
                  periodEntry.teacherId = teacherId;
                  periodEntry.subjectId = subjectId;
                }
              }
            }
          }
        }
        
        // ✅ Cập nhật lại Schedule với teacherId đã được gán
        newSchedule.timetable = schedule.timetable;
        await newSchedule.save();
        
        console.log(`✅ Đã cập nhật teacherId vào timetable với queue và lock`);
      }
      
      res.json({
        message: `Đã tạo thời khóa biểu cho lớp ${schedule.className}`,
        schedule: newSchedule
      });
    } catch (saveError) {
      console.error(`❌ Lỗi khi lưu thời khóa biểu cho lớp ${schedule.className}:`, saveError);
      return res.status(500).json({ 
        message: 'Lỗi khi lưu thời khóa biểu',
        error: saveError.message 
      });
    }

  } catch (error) {
    console.error('❌ Lỗi tạo thời khóa biểu:', error);
    console.error('❌ Stack trace:', error.stack);
    
    res.status(500).json({ 
      message: 'Lỗi server khi tạo thời khóa biểu',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// ✅ Kiểm tra điều kiện trước khi tạo lịch
exports.validateBeforeGenerate = async (req, res) => {
  try {
    const { grades, year, semester } = req.body;

    if (!grades || !Array.isArray(grades) || grades.length === 0) {
      return res.status(400).json({ 
        message: 'Thiếu tham số: grades là bắt buộc và phải là mảng',
        error: 'grades is required and must be an array'
      });
    }

    if (!year || !semester) {
      return res.status(400).json({ 
        message: 'Thiếu tham số: year, semester là bắt buộc',
        error: 'year and semester are required'
      });
    }

    const errors = [];
    const warnings = [];

    // ✅ Kiểm tra cấu hình thời khóa biểu
    const config = await ScheduleConfig.findOne();
    if (!config) {
      errors.push('Chưa có cấu hình thời khóa biểu');
    }

    // ✅ Kiểm tra có lớp nào cho các khối này không
    const classes = await Class.find({ 
      grade: { $in: grades },
      year: year
    });
    if (classes.length === 0) {
      errors.push(`Không tìm thấy lớp nào cho khối ${grades.join(', ')} năm học ${year}`);
    }

    // ✅ Kiểm tra có phân công giảng dạy không
    const assignments = await TeachingAssignment.find({ year, semester });
    if (assignments.length === 0) {
      warnings.push('Chưa có phân công giảng dạy cho năm học và học kỳ này');
    }

    // ✅ Kiểm tra có môn học nào không
    const subjects = await Subject.find({ isActive: { $ne: false } });
    if (subjects.length === 0) {
      warnings.push('Chưa có môn học nào được kích hoạt');
    }

    res.json({
      valid: errors.length === 0,
      errors,
      warnings,
      summary: {
        classesCount: classes.length,
        assignmentsCount: assignments.length,
        subjectsCount: subjects.length,
        hasConfig: !!config
      }
    });
  } catch (error) {
    console.error('❌ Lỗi khi validate:', error);
    res.status(500).json({ 
      message: 'Lỗi khi kiểm tra điều kiện',
      error: error.message 
    });
  }
};

// ✅ API: Tự động tạo thời khóa biểu cho nhiều lớp
exports.autoGenerateSchedule = async (req, res) => {
  try {
    const { grades, year, semester } = req.body;

    // ✅ Validation
    if (!grades || !Array.isArray(grades) || grades.length === 0) {
      return res.status(400).json({ 
        message: 'Thiếu tham số: grades là bắt buộc và phải là mảng',
        error: 'grades is required and must be an array'
      });
    }

    if (!year || !semester) {
      return res.status(400).json({ 
        message: 'Thiếu tham số: year, semester là bắt buộc',
        error: 'year and semester are required'
      });
    }

    console.log(`🚀 Bắt đầu tạo thời khóa biểu cho các khối: grades=${grades.join(', ')}, year=${year}, semester=${semester}`);

    // ✅ Lấy cấu hình
    const config = await ScheduleConfig.findOne();
    if (!config) {
      return res.status(400).json({ message: 'Chưa có cấu hình thời khóa biểu' });
    }

    // ✅ Lấy các lớp theo khối và năm học
    const classes = await Class.find({ 
      grade: { $in: grades },
      year: year
    });

    if (classes.length === 0) {
      return res.status(404).json({ 
        message: `Không tìm thấy lớp nào cho khối ${grades.join(', ')} năm học ${year}` 
      });
    }

    console.log(`📊 Tìm thấy ${classes.length} lớp cần tạo lịch`);

    // ✅ Lấy dữ liệu cần thiết
    console.log(`📥 Đang load dữ liệu...`);
    
    let subjects, activities, allAssignments, classPeriodsData;
    try {
      [subjects, activities, allAssignments, classPeriodsData] = await Promise.all([
        Subject.find({ isActive: { $ne: false } }),
        Activity.find({ isActive: true }),
        TeachingAssignment.find({ year, semester })
          .populate('teacherId', 'name availableMatrix maxClassPerGrade weeklyLessons maxClasses')
          .populate('subjectId', 'name grades')
          .populate('classId', 'className classCode grade year'),
        ClassPeriods.find({ year, semester, classId: { $in: classes.map(c => c._id) } })
          .populate('classId', 'className classCode grade')
      ]);
      console.log(`✅ Loaded data: ${subjects.length} subjects, ${activities.length} activities, ${allAssignments.length} assignments, ${classPeriodsData.length} classPeriods`);
    } catch (dbError) {
      console.error('❌ Lỗi khi load dữ liệu từ database:', dbError);
      return res.status(500).json({ 
        message: 'Lỗi khi load dữ liệu từ database',
        error: dbError.message 
      });
    }

    // ✅ Tạo lịch cho từng lớp
    const results = [];
    const errors = [];

    // ✅ Helper: Lấy số tiết/tuần của môn học theo lớp
    // Ưu tiên: ClassPeriods collection > gradeConfig.classPeriods > gradeConfig.periodsPerWeek
    const getSubjectPeriodsPerWeek = (subjectId, grade, classId, classPeriodsDataForClass) => {
      const subjectIdStr = subjectId.toString();
      const classIdStr = classId.toString();
      
      // ✅ 1. Ưu tiên: Lấy từ ClassPeriods collection (classPeriodsData)
      if (classPeriodsDataForClass && classPeriodsDataForClass.subjectPeriods) {
        let subjectPeriodsMap;
        if (classPeriodsDataForClass.subjectPeriods instanceof Map) {
          subjectPeriodsMap = classPeriodsDataForClass.subjectPeriods;
        } else if (typeof classPeriodsDataForClass.subjectPeriods === 'object') {
          subjectPeriodsMap = new Map(Object.entries(classPeriodsDataForClass.subjectPeriods));
        }
        
        if (subjectPeriodsMap) {
          // Thử với subjectId dạng string và ObjectId
          const periods = subjectPeriodsMap.get?.(subjectIdStr) || 
                         subjectPeriodsMap.get?.(new mongoose.Types.ObjectId(subjectIdStr).toString());
          if (periods !== undefined && periods !== null && periods > 0) {
            return periods;
          }
        }
      }
      
      // ✅ 2. Fallback: Lấy từ gradeConfig.classPeriods (nếu có)
      const gradeConfig = config.gradeConfigs?.get?.(grade) || config.gradeConfigs?.[grade];
      if (gradeConfig) {
        const subjectConfig = gradeConfig.subjects?.get?.(subjectIdStr) || 
                             gradeConfig.subjects?.[subjectIdStr];
        if (subjectConfig) {
          // Kiểm tra classPeriods trong subjectConfig
          if (subjectConfig.classPeriods) {
            const classPeriodsMap = subjectConfig.classPeriods instanceof Map 
              ? subjectConfig.classPeriods 
              : new Map(Object.entries(subjectConfig.classPeriods || {}));
            const periodsForClass = classPeriodsMap.get?.(classIdStr);
            if (periodsForClass !== undefined && periodsForClass !== null && periodsForClass > 0) {
              return periodsForClass;
            }
          }
          
          // ✅ 3. Cuối cùng: Lấy từ periodsPerWeek mặc định
          if (subjectConfig.periodsPerWeek && subjectConfig.periodsPerWeek > 0) {
            return subjectConfig.periodsPerWeek;
          }
        }
      }
      
      return 0;
    };

    // ✅ Helper: Lấy danh sách ngày từ config
    const getDaysFromConfig = () => {
      if (config.days instanceof Map) {
        return Array.from(config.days.keys());
      }
      return Object.keys(config.days || {});
    };

    // ✅ Helper: Lấy số tiết buổi sáng/chiều
    const getPeriodsPerDay = (session) => {
      const days = getDaysFromConfig();
      if (days.length === 0) return session === 'morning' ? 5 : 5;
      
      const firstDay = days[0];
      const dayConfig = config.days?.get?.(firstDay) || config.days?.[firstDay];
      if (!dayConfig) return session === 'morning' ? 5 : 5;
      
      return session === 'morning' 
        ? (dayConfig.morningPeriods || 5)
        : (dayConfig.afternoonPeriods || 5);
    };

    for (const classObj of classes) {
      try {
        console.log(`🔄 Bắt đầu tạo lịch cho lớp ${classObj.className}...`);
        
        const classAssignments = allAssignments.filter(a => 
          a.classId && a.classId._id.toString() === classObj._id.toString()
        );
        
        if (classAssignments.length === 0) {
          console.warn(`⚠️ Lớp ${classObj.className} không có phân công giảng dạy`);
          errors.push({
            className: classObj.className,
            error: 'Không có phân công giảng dạy cho lớp này'
          });
          continue;
        }

        // ✅ Lấy ClassPeriods cho lớp này (ưu tiên số 1)
        const classPeriodsForClass = classPeriodsData.find(cp => 
          cp.classId && cp.classId._id.toString() === classObj._id.toString()
        );
        
        if (classPeriodsForClass) {
          console.log(`📊 Lớp ${classObj.className}: Tìm thấy ClassPeriods với ${classPeriodsForClass.subjectPeriods?.size || 0} môn học`);
        }

        // ✅ Helper: Kiểm tra giáo viên có rảnh vào slot này không
        // availableMatrix: [day][period] - dayIdx: 0=Monday, 1=Tuesday, ..., 5=Saturday
        // periodIdx: 0=Tiết 1, 1=Tiết 2, ... (0-based)
        const isTeacherAvailable = (teacher, dayIdx, periodIdx) => {
          if (!teacher || !teacher.availableMatrix) {
            // Nếu không có availableMatrix, mặc định rảnh
            return true;
          }
          
          if (!Array.isArray(teacher.availableMatrix)) {
            return true;
          }
          
          // Kiểm tra dayIdx có hợp lệ không
          if (dayIdx < 0 || dayIdx >= teacher.availableMatrix.length) {
            return true; // Nếu vượt quá range, mặc định rảnh
          }
          
          const dayMatrix = teacher.availableMatrix[dayIdx];
          if (!Array.isArray(dayMatrix)) {
            return true;
          }
          
          // Kiểm tra periodIdx có hợp lệ không
          if (periodIdx < 0 || periodIdx >= dayMatrix.length) {
            return true; // Nếu vượt quá range, mặc định rảnh
          }
          
          // true = rảnh, false = bận
          // Nếu giá trị là undefined/null, mặc định là rảnh
          const isAvailable = dayMatrix[periodIdx];
          return isAvailable === true || isAvailable === undefined || isAvailable === null;
        };

        // ✅ Lấy cấu hình cho khối
        const gradeConfig = config.gradeConfigs?.get?.(classObj.grade) || 
                           config.gradeConfigs?.[classObj.grade];
        if (!gradeConfig) {
          errors.push({
            className: classObj.className,
            error: `Không có cấu hình cho khối ${classObj.grade}`
          });
          continue;
        }

        // ✅ Xác định buổi chính của khối
        let mainSession = 'morning'; // Mặc định buổi sáng
        let extraSession = 'afternoon'; // Buổi phụ
        
        // Lấy từ gradeConfig.rules (ưu tiên)
        if (gradeConfig.rules && gradeConfig.rules.session) {
          if (gradeConfig.rules.session === 'afternoon') {
            mainSession = 'afternoon';
            extraSession = 'morning';
          } else if (gradeConfig.rules.session === 'both') {
            // Nếu cả hai buổi, mặc định main = morning, extra = afternoon
            mainSession = 'morning';
            extraSession = 'afternoon';
          }
        } else if (config.gradeSessionRules) {
          // Fallback: Lấy từ gradeSessionRules (backward compatibility)
          const rule = config.gradeSessionRules.find(r => 
            r.grade === classObj.grade || r.grade === String(classObj.grade)
          );
          if (rule && rule.session === 'afternoon') {
            mainSession = 'afternoon';
            extraSession = 'morning';
          }
        }

        console.log(`📅 Lớp ${classObj.className} (Khối ${classObj.grade}): Buổi chính = ${mainSession}, Buổi phụ = ${extraSession}`);

        // ✅ Tạo timetable
        const days = getDaysFromConfig();
        const morningPeriods = getPeriodsPerDay('morning');
        const afternoonPeriods = getPeriodsPerDay('afternoon');
        const totalPeriods = morningPeriods + afternoonPeriods;

        // ✅ Xác định range cho buổi chính và buổi phụ
        const mainStart = mainSession === 'morning' ? 0 : morningPeriods;
        const mainEnd = mainSession === 'morning' ? morningPeriods : totalPeriods;
        const extraStart = extraSession === 'morning' ? 0 : morningPeriods;
        const extraEnd = extraSession === 'morning' ? morningPeriods : totalPeriods;

        // Khởi tạo timetable trống
        const timetable = days.map(day => ({
          day: day,
          periods: Array.from({ length: totalPeriods }, (_, i) => ({
            period: i + 1,
            subject: '',
            teacher: '',
            teacherId: null,
            subjectId: null,
            locked: false // Flag để đánh dấu slot đã bị khóa (activities)
          }))
        }));

        // ✅ BƯỚC 1: Xếp các hoạt động (activities) vào timetable TRƯỚC
        // Activities thường có fixed slots và cần được lock trước
        const gradeActivities = gradeConfig.activities || [];
        
        for (const activityConfig of gradeActivities) {
          if (!activityConfig.activityId) continue;
          
          // Tìm activity trong danh sách activities
          const activity = activities.find(a => 
            a._id.toString() === activityConfig.activityId.toString()
          );
          if (!activity) continue;

          // ✅ Lấy số tiết/tuần từ ClassPeriods (ưu tiên)
          let activityPeriodsPerWeek = 0;
          if (classPeriodsForClass && classPeriodsForClass.activityPeriods) {
            let activityPeriodsMap;
            if (classPeriodsForClass.activityPeriods instanceof Map) {
              activityPeriodsMap = classPeriodsForClass.activityPeriods;
            } else if (typeof classPeriodsForClass.activityPeriods === 'object') {
              activityPeriodsMap = new Map(Object.entries(classPeriodsForClass.activityPeriods));
            }
            
            if (activityPeriodsMap) {
              const activityIdStr = activityConfig.activityId.toString();
              activityPeriodsPerWeek = activityPeriodsMap.get?.(activityIdStr) || 0;
            }
          }
          
          // Fallback: Lấy từ activityConfig
          if (activityPeriodsPerWeek <= 0) {
            if (activityConfig.classPeriods) {
              const classPeriodsMap = activityConfig.classPeriods instanceof Map 
                ? activityConfig.classPeriods 
                : new Map(Object.entries(activityConfig.classPeriods || {}));
              activityPeriodsPerWeek = classPeriodsMap.get?.(classObj._id.toString()) || 0;
            }
            
            if (activityPeriodsPerWeek <= 0) {
              activityPeriodsPerWeek = activityConfig.periodsPerWeek || 0;
            }
          }

          if (activityPeriodsPerWeek <= 0) continue;

          // ✅ Nếu có fixedSlots, xếp vào slot cố định trước
          if (activityConfig.fixedSlots) {
            const fixedSlot = activityConfig.fixedSlots;
            const dayName = fixedSlot.dayOfWeek;
            const dayIdx = days.findIndex(d => 
              d.toLowerCase().slice(0, 3) === dayName.toLowerCase().slice(0, 3)
            );
            
            if (dayIdx >= 0 && fixedSlot.period) {
              const periodIdx = fixedSlot.period - 1;
              if (periodIdx >= 0 && periodIdx < totalPeriods) {
                const slot = timetable[dayIdx].periods[periodIdx];
                if (!slot.subject) {
                  slot.subject = activity.name;
                  slot.teacher = '';
                  slot.locked = true; // Lock slot này
                }
              }
            }
          } else {
            // ✅ Xếp activity tự động - xếp vào đúng buổi chính/phụ
            const activitySession = activityConfig.session || 'main';
            const targetStart = activitySession === 'main' ? mainStart : extraStart;
            const targetEnd = activitySession === 'main' ? mainEnd : extraEnd;
            
            let placedCount = 0;
            let attempts = 0;
            const maxAttempts = 500;

            while (placedCount < activityPeriodsPerWeek && attempts < maxAttempts) {
              attempts++;
              const dayIdx = Math.floor(Math.random() * days.length);
              const periodIdx = Math.floor(Math.random() * (targetEnd - targetStart)) + targetStart;
              const slot = timetable[dayIdx].periods[periodIdx];

              if (!slot.subject && !slot.locked) {
                slot.subject = activity.name;
                slot.teacher = '';
                slot.locked = true; // Lock slot này
                placedCount++;
              }
            }

            if (placedCount < activityPeriodsPerWeek) {
              console.warn(`⚠️ Lớp ${classObj.className}, hoạt động ${activity.name}: chỉ xếp được ${placedCount}/${activityPeriodsPerWeek} tiết`);
            }
          }
        }

        // ✅ BƯỚC 2: Xếp các môn học vào timetable (sau activities)
        let gradeSubjects = [];
        if (gradeConfig.subjects instanceof Map) {
          gradeSubjects = Array.from(gradeConfig.subjects.entries());
        } else if (gradeConfig.subjects && typeof gradeConfig.subjects === 'object') {
          gradeSubjects = Object.entries(gradeConfig.subjects);
        }

        for (const [subjectIdStr, subjectConfig] of gradeSubjects) {
          // Convert subjectIdStr to ObjectId nếu cần
          let subjectIdObj;
          try {
            subjectIdObj = mongoose.Types.ObjectId.isValid(subjectIdStr) 
              ? new mongoose.Types.ObjectId(subjectIdStr)
              : subjectIdStr;
          } catch (e) {
            continue;
          }

          // ✅ Lấy số tiết/tuần - ưu tiên từ ClassPeriods
          const periodsPerWeek = getSubjectPeriodsPerWeek(
            subjectIdStr, 
            classObj.grade, 
            classObj._id.toString(),
            classPeriodsForClass
          );
          
          if (periodsPerWeek <= 0) {
            console.log(`⚠️ Lớp ${classObj.className}, môn ${subjectIdStr}: Không có số tiết/tuần, bỏ qua`);
            continue;
          }
          
          console.log(`📚 Lớp ${classObj.className}, môn ${subjectIdStr}: ${periodsPerWeek} tiết/tuần`);

          // Tìm assignment cho môn này
          const assignment = classAssignments.find(a => {
            if (!a.subjectId) return false;
            const assignmentSubjectId = a.subjectId._id ? a.subjectId._id.toString() : a.subjectId.toString();
            return assignmentSubjectId === subjectIdStr;
          });
          if (!assignment || !assignment.teacherId) continue;

          const subject = subjects.find(s => {
            const sId = s._id.toString();
            return sId === subjectIdStr;
          });
          if (!subject) continue;

          const teacherName = assignment.teacherId.name || '';
          const maxPeriodsPerDay = subjectConfig.maxPeriodsPerDay || 2;
          const allowConsecutive = subjectConfig.allowConsecutive !== false;
          
          // ✅ Xác định buổi xếp môn học (main/extra)
          const subjectSession = subjectConfig.session || 'main';
          const targetStart = subjectSession === 'main' ? mainStart : extraStart;
          const targetEnd = subjectSession === 'main' ? mainEnd : extraEnd;

          console.log(`📚 Môn ${subject.name} (${subjectSession}): Xếp vào buổi ${subjectSession === 'main' ? mainSession : extraSession} (periods ${targetStart + 1}-${targetEnd})`);

          // Xếp các tiết vào đúng buổi chính/phụ
          let placedCount = 0;
          let attempts = 0;
          const maxAttempts = 1000;

          while (placedCount < periodsPerWeek && attempts < maxAttempts) {
            attempts++;
            const dayIdx = Math.floor(Math.random() * days.length);
            // ✅ Chỉ xếp vào range của buổi chính hoặc phụ
            const periodIdx = Math.floor(Math.random() * (targetEnd - targetStart)) + targetStart;
            const slot = timetable[dayIdx].periods[periodIdx];

            // Kiểm tra slot có trống và không bị lock không
            if (slot.subject || slot.locked) continue;

            // ✅ Kiểm tra giáo viên có rảnh vào slot này không (availableMatrix)
            if (!isTeacherAvailable(assignment.teacherId, dayIdx, periodIdx)) {
              // Giáo viên bận vào slot này, bỏ qua
              continue;
            }

            // Kiểm tra số tiết/ngày (chỉ tính trong buổi tương ứng)
            const periodsInDay = timetable[dayIdx].periods
              .slice(targetStart, targetEnd)
              .filter(p => p.subject === subject.name).length;
            if (periodsInDay >= maxPeriodsPerDay) continue;

            // Gán môn học
            slot.subject = subject.name;
            slot.teacher = teacherName;
            slot.teacherId = assignment.teacherId._id;
            slot.subjectId = subject._id;
            placedCount++;

            // Double tiết nếu cho phép (chỉ trong cùng buổi)
            if (allowConsecutive && placedCount < periodsPerWeek && periodIdx + 1 < targetEnd) {
              const nextSlot = timetable[dayIdx].periods[periodIdx + 1];
              // ✅ Kiểm tra giáo viên có rảnh vào tiết tiếp theo không
              if (!nextSlot.subject && !nextSlot.locked && 
                  isTeacherAvailable(assignment.teacherId, dayIdx, periodIdx + 1)) {
                nextSlot.subject = subject.name;
                nextSlot.teacher = teacherName;
                nextSlot.teacherId = assignment.teacherId._id;
                nextSlot.subjectId = subject._id;
                placedCount++;
              }
            }
          }

          if (placedCount < periodsPerWeek) {
            console.warn(`⚠️ Lớp ${classObj.className}, môn ${subject.name}: chỉ xếp được ${placedCount}/${periodsPerWeek} tiết`);
          }
        }

        // ✅ Xóa lịch cũ nếu có
        await Schedule.deleteMany({
          classId: classObj._id,
          year,
          semester
        });

        // ✅ Cleanup: Xóa field `locked` khỏi timetable trước khi lưu (model không có field này)
        const cleanedTimetable = timetable.map(dayEntry => ({
          day: dayEntry.day,
          periods: dayEntry.periods.map(period => ({
            period: period.period,
            subject: period.subject,
            teacher: period.teacher,
            teacherId: period.teacherId,
            subjectId: period.subjectId
          }))
        }));

        // ✅ Lưu lịch mới
        const newSchedule = new Schedule({
          classId: classObj._id,
          className: classObj.className,
          year,
          semester,
          timetable: cleanedTimetable
        });

        await newSchedule.save();
        console.log(`✅ Đã tạo lịch cho lớp ${classObj.className}`);
        
        results.push({
          className: classObj.className,
          classId: classObj._id.toString(),
          status: 'completed'
        });

      } catch (error) {
        console.error(`❌ Lỗi khi tạo lịch cho lớp ${classObj.className}:`, error);
        errors.push({
          className: classObj.className,
          error: error.message
        });
      }
    }

    if (errors.length > 0 && results.length === 0) {
      return res.status(500).json({
        message: 'Không thể tạo lịch cho bất kỳ lớp nào',
        errors: errors
      });
    }

    // ✅ Format response theo frontend mong đợi
    const schedules = results.map(r => ({
      classId: r.classId,
      className: r.className,
      year,
      semester,
      timetable: [] // Frontend sẽ load lại từ API
    }));

    res.json({
      message: `Đã tạo thời khóa biểu cho ${results.length} lớp`,
      success: results.length,
      failed: errors.length,
      schedules: schedules,
      results: results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Lỗi tạo thời khóa biểu:', error);
    console.error('❌ Stack trace:', error.stack);
    
    res.status(500).json({ 
      message: 'Lỗi server khi tạo thời khóa biểu',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

exports.updateScheduleByDragDrop = async (req, res) => {
  try {
    const { classId, year, semester, fromDay, fromPeriod, toDay, toPeriod } = req.body;

    if (!classId || !year || !semester || !fromDay || !fromPeriod || !toDay || !toPeriod) {
      return res.status(400).json({ 
        message: 'Thiếu tham số bắt buộc',
        error: 'classId, year, semester, fromDay, fromPeriod, toDay, toPeriod are required'
      });
    }

    // ✅ Tìm schedule
    const schedule = await Schedule.findOne({ classId, year, semester });
    if (!schedule) {
      return res.status(404).json({ message: 'Không tìm thấy thời khóa biểu' });
    }

    // ✅ Tìm period cần di chuyển
    const fromDayEntry = schedule.timetable.find(d => d.day === fromDay);
    const toDayEntry = schedule.timetable.find(d => d.day === toDay);

    if (!fromDayEntry || !toDayEntry) {
      return res.status(400).json({ message: 'Không tìm thấy ngày trong thời khóa biểu' });
    }

    const fromPeriodEntry = fromDayEntry.periods.find(p => p.period === fromPeriod);
    const toPeriodEntry = toDayEntry.periods.find(p => p.period === toPeriod);

    if (!fromPeriodEntry || !toPeriodEntry) {
      return res.status(400).json({ message: 'Không tìm thấy tiết trong thời khóa biểu' });
    }

    // ✅ Kiểm tra conflict nếu có giáo viên
    if (fromPeriodEntry.teacherId) {
      const conflict = await ScheduleAssignmentService.checkConflict(
        fromPeriodEntry.teacherId,
        toDay,
        toPeriod,
        year,
        semester,
        classId
      );

      if (conflict) {
        return res.status(400).json({ 
          message: `Giáo viên đã được gán vào ${toDay}, tiết ${toPeriod} ở lớp khác`,
          error: 'Teacher conflict detected'
        });
      }
    }

    // ✅ Hoán đổi hoặc di chuyển
    const tempSubject = fromPeriodEntry.subject;
    const tempTeacher = fromPeriodEntry.teacher;
    const tempTeacherId = fromPeriodEntry.teacherId;
    const tempSubjectId = fromPeriodEntry.subjectId;

    fromPeriodEntry.subject = toPeriodEntry.subject || '';
    fromPeriodEntry.teacher = toPeriodEntry.teacher || '';
    fromPeriodEntry.teacherId = toPeriodEntry.teacherId || null;
    fromPeriodEntry.subjectId = toPeriodEntry.subjectId || null;

    toPeriodEntry.subject = tempSubject || '';
    toPeriodEntry.teacher = tempTeacher || '';
    toPeriodEntry.teacherId = tempTeacherId || null;
    toPeriodEntry.subjectId = tempSubjectId || null;

    await schedule.save();

    res.json({ 
      message: 'Đã cập nhật thời khóa biểu thành công',
      schedule 
    });
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật lịch bằng drag-drop:', error);
    res.status(500).json({ 
      message: 'Lỗi khi cập nhật lịch',
      error: error.message 
    });
  }
};

exports.createClassesForGrades = async (req, res) => {
  try {
    const { grades, year, classesPerGrade = 8, capacity = 45 } = req.body;

    if (!grades || !Array.isArray(grades) || grades.length === 0) {
      return res.status(400).json({ 
        message: 'Thiếu tham số: grades là bắt buộc và phải là mảng',
        error: 'grades is required and must be an array'
      });
    }

    if (!year) {
      return res.status(400).json({ 
        message: 'Thiếu tham số: year là bắt buộc',
        error: 'year is required'
      });
    }

    const createdClasses = [];
    const errors = [];

    for (const grade of grades) {
      // ✅ Kiểm tra xem đã có lớp nào cho khối này chưa
      const existingClasses = await Class.find({ grade, year });
      if (existingClasses.length > 0) {
        errors.push({
          grade,
          error: `Đã có ${existingClasses.length} lớp cho khối ${grade} năm học ${year}`
        });
        continue;
      }

      // ✅ Tạo các lớp
      for (let i = 1; i <= classesPerGrade; i++) {
        try {
          const className = `${grade}A${i}`;
          const newClass = new Class({
            className,
            classCode: `${grade}${String(i).padStart(2, '0')}`,
            grade,
            year,
            capacity,
            currentSize: 0,
            students: []
          });

          await newClass.save();
          createdClasses.push(newClass);
        } catch (error) {
          errors.push({
            grade,
            className: `${grade}A${i}`,
            error: error.message
          });
        }
      }
    }

    res.json({
      message: `Đã tạo ${createdClasses.length} lớp thành công`,
      created: createdClasses.length,
      failed: errors.length,
      classes: createdClasses,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('❌ Lỗi khi tạo lớp:', error);
    res.status(500).json({ 
      message: 'Lỗi khi tạo lớp',
      error: error.message 
    });
  }
};
