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

    // ✅ Tạo thời khóa biểu cho 1 lớp
    console.log(`🔄 Bắt đầu tạo thời khóa biểu cho lớp ${classObj.className}...`);
    
    // ✅ Kiểm tra có phân công giảng dạy không
    if (assignments.length === 0) {
      return res.status(400).json({ 
        message: `Lớp ${classObj.className} không có phân công giảng dạy cho năm học ${year}, học kỳ ${semester}` 
      });
    }
    
    // ✅ Sử dụng logic tương tự autoGenerateSchedule nhưng chỉ cho 1 lớp
    // Tạo mảng classes chỉ có 1 lớp này
    const classes = [classObj];
    
    // ✅ Lấy ClassPeriods cho lớp này
    const classPeriodsForClass = classPeriodsData.find(cp => 
      cp.classId && cp.classId._id.toString() === classId.toString()
    );
    
    // ✅ Helper functions (copy từ autoGenerateSchedule)
    const getSubjectPeriodsPerWeek = (subjectId, grade, classId, classPeriodsDataForClass) => {
      const subjectIdStr = subjectId.toString();
      const classIdStr = classId.toString();
      
      // ✅ 1. Ưu tiên: Lấy từ ClassPeriods collection
      if (classPeriodsDataForClass && classPeriodsDataForClass.subjectPeriods) {
        let subjectPeriodsMap;
        if (classPeriodsDataForClass.subjectPeriods instanceof Map) {
          subjectPeriodsMap = classPeriodsDataForClass.subjectPeriods;
        } else if (typeof classPeriodsDataForClass.subjectPeriods === 'object') {
          subjectPeriodsMap = new Map(Object.entries(classPeriodsDataForClass.subjectPeriods));
        }
        
        if (subjectPeriodsMap) {
          const periods = subjectPeriodsMap.get?.(subjectIdStr) || 
                         subjectPeriodsMap.get?.(new mongoose.Types.ObjectId(subjectIdStr).toString());
          if (periods !== undefined && periods !== null && periods > 0) {
            return periods;
          }
        }
      }
      
      // ✅ 2. Fallback: Lấy từ gradeConfig
      const gradeConfig = config.gradeConfigs?.get?.(grade) || config.gradeConfigs?.[grade];
      if (gradeConfig) {
        const subjectConfig = gradeConfig.subjects?.get?.(subjectIdStr) || 
                           gradeConfig.subjects?.[subjectIdStr];
        if (subjectConfig) {
          if (subjectConfig.classPeriods) {
            const classPeriodsMap = subjectConfig.classPeriods instanceof Map 
              ? subjectConfig.classPeriods 
              : new Map(Object.entries(subjectConfig.classPeriods || {}));
            const periodsForClass = classPeriodsMap.get?.(classIdStr);
            if (periodsForClass !== undefined && periodsForClass !== null && periodsForClass > 0) {
              return periodsForClass;
            }
          }
          return subjectConfig.periodsPerWeek || 0;
        }
      }
      
      return 0;
    };
    
    const getDaysFromConfig = () => {
      if (config.days instanceof Map) {
        return Array.from(config.days.keys());
      }
      return Object.keys(config.days || {});
    };
    
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
    
    // ✅ Map để track teacher conflicts trong memory (chỉ cho 1 lớp này)
    const inMemoryTeacherConflicts = new Map();
    
    // ✅ Helper: Kiểm tra xung đột giáo viên
    const checkTeacherConflict = async (teacherId, day, period, classId) => {
      if (!teacherId) {
        return { conflict: false };
      }
      
      if (!day || !period || !classId) {
        return { conflict: false };
      }
      
      const conflictKey = `${teacherId.toString()}_${day}_${period}_${year}_${semester}`;
      
      // ✅ 1. Kiểm tra xung đột trong memory
      if (inMemoryTeacherConflicts.has(conflictKey)) {
        const existing = inMemoryTeacherConflicts.get(conflictKey);
        if (existing && existing.classId) {
          const existingClassIdStr = existing.classId.toString();
          const currentClassIdStr = classId.toString();
          
          if (existingClassIdStr !== currentClassIdStr) {
            return { conflict: true, source: 'memory', className: existing.className || 'Không xác định' };
          }
        }
      }
      
      // ✅ 2. Kiểm tra xung đột trong database
      try {
        const conflict = await Schedule.checkTeacherConflict(
          teacherId,
          day,
          period,
          year,
          semester,
          classId // Exclude class hiện tại
        );
        if (conflict) {
          try {
            const existingSchedule = await Schedule.findOne({
              year,
              semester,
              classId: { $ne: classId },
              timetable: {
                $elemMatch: {
                  day: day,
                  periods: {
                    $elemMatch: {
                      period: period,
                      teacherId: teacherId
                    }
                  }
                }
              }
            }).populate('classId', 'className').lean();
            
            if (existingSchedule) {
              return { 
                conflict: true, 
                source: 'database', 
                className: existingSchedule?.classId?.className || 'Không xác định' 
              };
            }
          } catch (findError) {
            console.warn('⚠️ Không thể tìm lớp có xung đột:', findError.message);
            return { conflict: true, source: 'database', className: 'Không xác định' };
          }
        }
      } catch (dbError) {
        console.warn('⚠️ Không thể kiểm tra conflict trong database:', dbError.message);
      }
      
      return { conflict: false };
    };
    
    // ✅ Helper: Kiểm tra giáo viên có rảnh không
    const isTeacherAvailable = (teacher, dayIdx, periodIdx) => {
      if (!teacher || !teacher.availableMatrix) {
        return true;
      }
      
      if (!Array.isArray(teacher.availableMatrix)) {
        return true;
      }
      
      if (dayIdx < 0 || dayIdx >= teacher.availableMatrix.length) {
        return true;
      }
      
      const dayMatrix = teacher.availableMatrix[dayIdx];
      if (!Array.isArray(dayMatrix)) {
        return true;
      }
      
      if (periodIdx < 0 || periodIdx >= dayMatrix.length) {
        return true;
      }
      
      const isAvailable = dayMatrix[periodIdx];
      return isAvailable === true || isAvailable === undefined || isAvailable === null;
    };
    
    // ✅ Lấy cấu hình cho khối
    const gradeConfig = config.gradeConfigs?.get?.(classObj.grade) || 
                       config.gradeConfigs?.[classObj.grade];
    if (!gradeConfig) {
      return res.status(400).json({
        message: `Không có cấu hình cho khối ${classObj.grade}`
      });
    }
    
    // ✅ Xác định buổi chính của khối
    let mainSession = 'morning';
    let extraSession = 'afternoon';
    
    if (gradeConfig.rules && gradeConfig.rules.session) {
      if (gradeConfig.rules.session === 'afternoon') {
        mainSession = 'afternoon';
        extraSession = 'morning';
      } else if (gradeConfig.rules.session === 'both') {
        mainSession = 'morning';
        extraSession = 'afternoon';
      }
    } else if (config.gradeSessionRules) {
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
    
    const mainStart = mainSession === 'morning' ? 0 : morningPeriods;
    const mainEnd = mainSession === 'morning' ? morningPeriods : totalPeriods;
    const extraStart = extraSession === 'morning' ? 0 : morningPeriods;
    const extraEnd = extraSession === 'morning' ? morningPeriods : totalPeriods;
    
    // Khởi tạo timetable trống
    // ✅ Lấy danh sách tiết nghỉ từ gradeConfig (format: [{ day: "Monday", period: 5 }])
    const restPeriods = gradeConfig.restPeriods || [];
    
    // ✅ Tạo Map để check nhanh: day -> Set<period>
    const restPeriodsMap = new Map();
    restPeriods.forEach(rest => {
      if (!restPeriodsMap.has(rest.day)) {
        restPeriodsMap.set(rest.day, new Set());
      }
      restPeriodsMap.get(rest.day).add(rest.period);
    });
    
    const timetable = days.map(day => ({
      day: day,
      periods: Array.from({ length: totalPeriods }, (_, i) => {
        const periodNumber = i + 1;
        // ✅ Check xem tiết này có trong danh sách nghỉ của ngày này không
        const dayRestPeriods = restPeriodsMap.get(day) || new Set();
        const isRestPeriod = dayRestPeriods.has(periodNumber);
        return {
          period: periodNumber,
          subject: '',
          teacher: '',
          teacherId: null,
          subjectId: null,
          locked: isRestPeriod // ✅ Mark tiết nghỉ là locked để không xếp môn học vào
        };
      })
    }));
    
    if (restPeriods.length > 0) {
      const restPeriodsStr = restPeriods.map(r => `${r.day} - Tiết ${r.period}`).join(', ');
      console.log(`📌 Khối ${classObj.grade} (Lớp ${classObj.className}): Các tiết nghỉ: ${restPeriodsStr}`);
    }
    
    // ✅ BƯỚC 1: Xếp các hoạt động (activities) vào timetable TRƯỚC
    const gradeActivities = gradeConfig.activities || [];
    
    for (const activityConfig of gradeActivities) {
      if (!activityConfig.activityId) continue;
      
      const activity = activities.find(a => 
        a._id.toString() === activityConfig.activityId.toString()
      );
      if (!activity) continue;
      
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
              slot.locked = true;
            }
          }
        }
      } else {
        // ✅ Xếp activity tự động
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
            slot.locked = true;
            placedCount++;
          }
        }
        
        if (placedCount < activityPeriodsPerWeek) {
          console.warn(`⚠️ Lớp ${classObj.className}, hoạt động ${activity.name}: chỉ xếp được ${placedCount}/${activityPeriodsPerWeek} tiết`);
        }
      }
    }
    
    // ✅ BƯỚC 2: Xếp các môn học vào timetable
    let gradeSubjects = [];
    if (gradeConfig.subjects instanceof Map) {
      gradeSubjects = Array.from(gradeConfig.subjects.entries());
    } else if (gradeConfig.subjects && typeof gradeConfig.subjects === 'object') {
      gradeSubjects = Object.entries(gradeConfig.subjects);
    }
    
    for (const [subjectIdStr, subjectConfig] of gradeSubjects) {
      let subjectIdObj;
      try {
        subjectIdObj = mongoose.Types.ObjectId.isValid(subjectIdStr) 
          ? new mongoose.Types.ObjectId(subjectIdStr)
          : subjectIdStr;
      } catch (e) {
        continue;
      }
      
      const periodsPerWeek = getSubjectPeriodsPerWeek(
        subjectIdStr, 
        classObj.grade, 
        classObj._id.toString(),
        classPeriodsForClass
      );
      
      const assignment = assignments.find(a => {
        if (!a.subjectId) return false;
        const assignmentSubjectId = a.subjectId._id ? a.subjectId._id.toString() : a.subjectId.toString();
        return assignmentSubjectId === subjectIdStr;
      });
      
      const subject = subjects.find(s => {
        const sId = s._id.toString();
        return sId === subjectIdStr;
      });
      
      const subjectName = subject?.name || subjectIdStr;
      const teacherName = assignment?.teacherId?.name || (assignment?.teacherId ? 'Chưa có tên' : 'Chưa có phân công');
      
      if (periodsPerWeek <= 0) {
        console.log(`⚠️ Lớp ${classObj.className}, môn ${subjectName} (GV: ${teacherName}): Không có số tiết/tuần, bỏ qua`);
        continue;
      }
      
      if (!assignment || !assignment.teacherId) {
        console.warn(`⚠️ Lớp ${classObj.className}, môn ${subjectName}: Không có phân công giảng dạy (thiếu giáo viên), bỏ qua`);
        continue;
      }
      
      if (!subject) {
        console.warn(`⚠️ Lớp ${classObj.className}, môn ${subjectIdStr} (GV: ${teacherName}): Không tìm thấy thông tin môn học, bỏ qua`);
        continue;
      }
      
      console.log(`📚 Lớp ${classObj.className}, môn ${subjectName} (GV: ${teacherName}): ${periodsPerWeek} tiết/tuần`);
      const maxPeriodsPerDay = subjectConfig.maxPeriodsPerDay || 2;
      const allowConsecutive = subjectConfig.allowConsecutive !== false;
      
      const subjectSession = subjectConfig.session || 'main';
      const targetStart = subjectSession === 'main' ? mainStart : extraStart;
      const targetEnd = subjectSession === 'main' ? mainEnd : extraEnd;
      
      console.log(`📚 Môn ${subject.name} (GV: ${teacherName}, ${subjectSession}): Xếp vào buổi ${subjectSession === 'main' ? mainSession : extraSession} (periods ${targetStart + 1}-${targetEnd})`);
      
      let placedCount = 0;
      let attempts = 0;
      const maxAttempts = 1000;
      let consecutiveAttempts = 0; // ✅ Đếm số lần thử tìm liền kề
      const maxConsecutiveAttempts = 50; // ✅ Sau 50 lần thử không tìm được liền kề → fallback về đơn
      
      while (placedCount < periodsPerWeek && attempts < maxAttempts) {
        attempts++;
        const dayIdx = Math.floor(Math.random() * days.length);
        const dayName = days[dayIdx];
        
        const periodsInDay = timetable[dayIdx].periods
          .slice(targetStart, targetEnd)
          .filter(p => p.subject === subject.name).length;
        if (periodsInDay >= maxPeriodsPerDay) {
          continue;
        }
        
        const remainingPeriods = periodsPerWeek - placedCount;
        const needConsecutive = allowConsecutive && remainingPeriods >= 2 && consecutiveAttempts < maxConsecutiveAttempts;
        
        if (needConsecutive) {
          // ✅ ƯU TIÊN: Tìm 2 slot liền kề
          consecutiveAttempts++;
          let foundConsecutive = false;
          const startPeriodIdx = Math.floor(Math.random() * (targetEnd - targetStart - 1)) + targetStart;
          
          const pairsToTry = [];
          for (let i = startPeriodIdx; i < targetEnd - 1; i++) {
            pairsToTry.push([i, i + 1]);
          }
          for (let i = targetStart; i < startPeriodIdx; i++) {
            if (i + 1 < targetEnd) {
              pairsToTry.push([i, i + 1]);
            }
          }
          
          for (const [firstPeriod, secondPeriod] of pairsToTry) {
            if (dayIdx < 0 || dayIdx >= timetable.length) continue;
            if (!timetable[dayIdx] || !timetable[dayIdx].periods) continue;
            if (firstPeriod < 0 || firstPeriod >= timetable[dayIdx].periods.length) continue;
            if (secondPeriod < 0 || secondPeriod >= timetable[dayIdx].periods.length) continue;
            
            const firstSlot = timetable[dayIdx].periods[firstPeriod];
            const secondSlot = timetable[dayIdx].periods[secondPeriod];
            
            if (!firstSlot || !secondSlot) continue;
            if (firstSlot.subject || firstSlot.locked || secondSlot.subject || secondSlot.locked) continue;
            if (!isTeacherAvailable(assignment.teacherId, dayIdx, firstPeriod) || 
                !isTeacherAvailable(assignment.teacherId, dayIdx, secondPeriod)) continue;
            
            const conflictCheck1 = await checkTeacherConflict(
              assignment.teacherId._id,
              dayName,
              firstPeriod + 1,
              classObj._id
            );
            const conflictCheck2 = await checkTeacherConflict(
              assignment.teacherId._id,
              dayName,
              secondPeriod + 1,
              classObj._id
            );
            
            if (conflictCheck1.conflict || conflictCheck2.conflict) {
              continue;
            }
            
            firstSlot.subject = subject.name;
            firstSlot.teacher = teacherName;
            firstSlot.teacherId = assignment.teacherId._id;
            firstSlot.subjectId = subject._id;
            
            secondSlot.subject = subject.name;
            secondSlot.teacher = teacherName;
            secondSlot.teacherId = assignment.teacherId._id;
            secondSlot.subjectId = subject._id;
            
            placedCount += 2;
            consecutiveAttempts = 0; // ✅ Reset counter khi tìm được liền kề
            
            console.log(`✅ Lớp ${classObj.className}, môn ${subject.name} (GV: ${teacherName}): Gán 2 tiết liền kề vào ${dayName}, tiết ${firstPeriod + 1}-${secondPeriod + 1}`);
            
            const conflictKey1 = `${assignment.teacherId._id.toString()}_${dayName}_${firstPeriod + 1}_${year}_${semester}`;
            const conflictKey2 = `${assignment.teacherId._id.toString()}_${dayName}_${secondPeriod + 1}_${year}_${semester}`;
            inMemoryTeacherConflicts.set(conflictKey1, {
              className: classObj.className,
              classId: classObj._id
            });
            inMemoryTeacherConflicts.set(conflictKey2, {
              className: classObj.className,
              classId: classObj._id
            });
            
            foundConsecutive = true;
            break;
          }
          
          if (!foundConsecutive) {
            // ✅ Nếu đã thử nhiều lần không tìm được liền kề → fallback về đơn (nhưng vẫn tuân thủ maxPeriodsPerDay)
            if (consecutiveAttempts >= maxConsecutiveAttempts) {
              console.log(`⚠️ Lớp ${classObj.className}, môn ${subject.name} (GV: ${teacherName}): Đã thử ${maxConsecutiveAttempts} lần không tìm được 2 slot liền kề → chuyển sang xếp đơn (vẫn tuân thủ maxPeriodsPerDay=${maxPeriodsPerDay})`);
              consecutiveAttempts = 0; // Reset để lần sau vẫn ưu tiên liền kề
              // ✅ Fallback về xếp đơn - tiếp tục với logic xếp đơn bên dưới (không continue)
            } else {
              console.log(`⚠️ Lớp ${classObj.className}, môn ${subject.name} (GV: ${teacherName}): Không tìm được 2 slot liền kề trong ${dayName} (thử ${consecutiveAttempts}/${maxConsecutiveAttempts}) - thử ngày khác...`);
              continue;
            }
          } else {
            // ✅ Đã tìm được liền kề, tiếp tục vòng lặp
            continue;
          }
        }
        
        // ✅ Xếp 1 tiết (allowConsecutive = false, chỉ còn 1 tiết, hoặc đã fallback từ liền kề)
        // ✅ Vẫn tuân thủ maxPeriodsPerDay (đã check ở đầu vòng lặp)
        const startPeriodIdx = Math.floor(Math.random() * (targetEnd - targetStart)) + targetStart;
        let foundSlot = false;
          
          const periodsToTry = [];
          for (let i = startPeriodIdx; i < targetEnd; i++) {
            periodsToTry.push(i);
          }
          for (let i = targetStart; i < startPeriodIdx; i++) {
            periodsToTry.push(i);
          }
          
          for (const tryPeriod of periodsToTry) {
            if (dayIdx < 0 || dayIdx >= timetable.length) continue;
            if (!timetable[dayIdx] || !timetable[dayIdx].periods) continue;
            if (tryPeriod < 0 || tryPeriod >= timetable[dayIdx].periods.length) continue;
            
            const slot = timetable[dayIdx].periods[tryPeriod];
            if (!slot) continue;
            if (slot.subject || slot.locked) continue;
            if (!isTeacherAvailable(assignment.teacherId, dayIdx, tryPeriod)) continue;
            if (!assignment.teacherId || !assignment.teacherId._id) continue;
            
            const conflictCheck = await checkTeacherConflict(
              assignment.teacherId._id,
              dayName,
              tryPeriod + 1,
              classObj._id
            );
            
            if (conflictCheck.conflict) {
              continue;
            }
            
            slot.subject = subject.name;
            slot.teacher = teacherName;
            slot.teacherId = assignment.teacherId._id;
            slot.subjectId = subject._id;
            placedCount++;
            
            console.log(`✅ Lớp ${classObj.className}, môn ${subject.name} (GV: ${teacherName}): Gán vào ${dayName}, tiết ${tryPeriod + 1}`);
            
            const conflictKey = `${assignment.teacherId._id.toString()}_${dayName}_${tryPeriod + 1}_${year}_${semester}`;
            inMemoryTeacherConflicts.set(conflictKey, {
              className: classObj.className,
              classId: classObj._id
            });
            
            foundSlot = true;
            break;
          }
          
          if (!foundSlot) {
            console.log(`⚠️ Lớp ${classObj.className}, môn ${subject.name}: Không tìm được slot trống trong ${dayName} - thử ngày khác...`);
            continue;
          }
      }
      
      if (placedCount < periodsPerWeek) {
        console.warn(`⚠️ Lớp ${classObj.className}, môn ${subject.name} (GV: ${teacherName}): chỉ xếp được ${placedCount}/${periodsPerWeek} tiết - thiếu ${periodsPerWeek - placedCount} tiết`);
      }
    }
    
    // ✅ Cleanup: Xóa field `locked` khỏi timetable trước khi lưu
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
    
    // ✅ Xóa lịch cũ nếu có
    await Schedule.deleteMany({
      classId: classId,
      year: year,
      semester: semester
    });
    
    // ✅ Lưu lịch mới
    const newSchedule = new Schedule({
      classId: classId,
      className: classObj.className,
      year: year,
      semester: semester,
      timetable: cleanedTimetable
    });
    
    await newSchedule.save();
    console.log(`✅ Đã lưu lịch cho lớp ${classObj.className}`);
    
    return res.json({
      message: `Đã tạo thời khóa biểu cho lớp ${classObj.className}`,
      schedule: newSchedule,
      className: classObj.className
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
    }).sort({ grade: 1, className: 1 }); // Sắp xếp theo khối và tên lớp

    if (classes.length === 0) {
      return res.status(404).json({ 
        message: `Không tìm thấy lớp nào cho khối ${grades.join(', ')} năm học ${year}` 
      });
    }

    // ✅ Thống kê số lớp theo từng khối
    const classesByGrade = {};
    classes.forEach(cls => {
      if (!classesByGrade[cls.grade]) {
        classesByGrade[cls.grade] = [];
      }
      classesByGrade[cls.grade].push(cls);
    });

    console.log(`📊 Tìm thấy ${classes.length} lớp cần tạo lịch:`);
    Object.entries(classesByGrade).forEach(([grade, gradeClasses]) => {
      console.log(`   - Khối ${grade}: ${gradeClasses.length} lớp`);
      gradeClasses.forEach(cls => {
        console.log(`     • ${cls.className}`);
      });
    });

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
      
      // ✅ Thống kê phân công theo lớp
      const assignmentsByClass = {};
      allAssignments.forEach(assignment => {
        if (assignment.classId) {
          const classIdStr = assignment.classId._id.toString();
          if (!assignmentsByClass[classIdStr]) {
            assignmentsByClass[classIdStr] = [];
          }
          assignmentsByClass[classIdStr].push(assignment);
        }
      });
      
      console.log(`📋 Thống kê phân công giảng dạy:`);
      classes.forEach(cls => {
        const classIdStr = cls._id.toString();
        const classAssignments = assignmentsByClass[classIdStr] || [];
        console.log(`   - ${cls.className} (Khối ${cls.grade}): ${classAssignments.length} phân công`);
        if (classAssignments.length === 0) {
          console.warn(`     ⚠️ Lớp ${cls.className} không có phân công giảng dạy - sẽ bỏ qua`);
        }
      });
    } catch (dbError) {
      console.error('❌ Lỗi khi load dữ liệu từ database:', dbError);
      return res.status(500).json({ 
        message: 'Lỗi khi load dữ liệu từ database',
        error: dbError.message 
      });
    }

    // ✅ Tạo lịch cho từng lớp với cơ chế retry
    const results = [];
    const errors = [];
    
    // ✅ Helper: Shuffle array (Fisher-Yates)
    const shuffleArray = (array) => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };
    
    // ✅ Số lần thử lại tối đa cho toàn bộ quá trình
    const maxGlobalAttempts = 5;
    let globalAttempt = 0;
    let allSchedulesGenerated = false;
    
    // ✅ Vòng lặp retry cho toàn bộ quá trình
    while (!allSchedulesGenerated && globalAttempt < maxGlobalAttempts) {
      globalAttempt++;
      console.log(`\n🔄 ========== Lần thử ${globalAttempt}/${maxGlobalAttempts} - Tạo lịch cho ${classes.length} lớp ==========`);
      
      // ✅ Reset kết quả cho mỗi lần thử
      results.length = 0;
      errors.length = 0;
      
      // ✅ Map để track teacher conflicts trong memory (cho tất cả các lớp trong batch) - reset mỗi lần thử
      const inMemoryTeacherConflicts = new Map();
      const schedulesInMemory = []; // Lưu tất cả schedules đã tạo trong memory
      const shuffledClasses = shuffleArray(classes);
      console.log(
        `📦 Thứ tự lớp sau khi shuffle (attempt ${globalAttempt}): ${shuffledClasses
          .map((cls) => cls.className)
          .join(", ")}`
      );

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

      // ✅ Helper: Kiểm tra xung đột giáo viên trong memory và database
    const checkTeacherConflict = async (teacherId, day, period, classId) => {
      if (!teacherId) {
        return { conflict: false };
      }
      
      // ✅ Validate inputs
      if (!day || !period || !classId) {
        return { conflict: false };
      }
      
      const conflictKey = `${teacherId.toString()}_${day}_${period}_${year}_${semester}`;
      
      // ✅ 1. Kiểm tra xung đột trong memory (các lớp đang được tạo)
      // CHỈ kiểm tra xung đột giữa các lớp KHÁC NHAU, không kiểm tra trong cùng 1 lớp
      // Trong cùng 1 lớp, giáo viên có thể dạy nhiều tiết khác nhau (không conflict)
      if (inMemoryTeacherConflicts.has(conflictKey)) {
        const existing = inMemoryTeacherConflicts.get(conflictKey);
        // ✅ CHỈ báo conflict nếu là lớp KHÁC
        // Nếu là cùng 1 lớp → không conflict (giáo viên có thể dạy nhiều tiết trong cùng lớp)
        if (existing && existing.classId) {
          const existingClassIdStr = existing.classId.toString();
          const currentClassIdStr = classId.toString();
          
          // ✅ CHỈ conflict nếu là lớp KHÁC
          if (existingClassIdStr !== currentClassIdStr) {
            return { conflict: true, source: 'memory', className: existing.className || 'Không xác định' };
          }
          // ✅ Nếu là cùng 1 lớp → không conflict, cho phép giáo viên dạy nhiều tiết
        }
      }
      
      // ✅ 2. Kiểm tra xung đột trong database (các schedule đã lưu)
      // Query chính xác: tìm schedule có cùng teacherId, cùng day, cùng period (tiết cụ thể)
      try {
        const conflict = await Schedule.checkTeacherConflict(
          teacherId,
          day,
          period,
          year,
          semester,
          classId // Exclude class hiện tại
        );
        if (conflict) {
          // Tìm lớp có xung đột - query chính xác theo từng tiết
          try {
            // ✅ Query chính xác: tìm schedule có teacherId ở CÙNG NGÀY VÀ CÙNG TIẾT
            // Sử dụng $elemMatch để đảm bảo cùng một entry trong timetable có cả day và period
            const existingSchedule = await Schedule.findOne({
              year,
              semester,
              classId: { $ne: classId },
              timetable: {
                $elemMatch: {
                  day: day,
                  periods: {
                    $elemMatch: {
                      period: period,
                      teacherId: teacherId
                    }
                  }
                }
              }
            }).populate('classId', 'className').lean();
            
            if (existingSchedule) {
              console.log(`  🔍 DEBUG: Tìm thấy xung đột trong DB - GV ${teacherId}, ${day}, tiết ${period}, lớp: ${existingSchedule?.classId?.className || 'N/A'}`);
              return { 
                conflict: true, 
                source: 'database', 
                className: existingSchedule?.classId?.className || existingSchedule?.className || 'Không xác định' 
              };
            }
          } catch (findError) {
            console.warn('⚠️ Không thể tìm lớp có xung đột:', findError.message);
            // Nếu có conflict nhưng không tìm được lớp, vẫn trả về conflict
            return { conflict: true, source: 'database', className: 'Không xác định' };
          }
        }
      } catch (dbError) {
        console.warn('⚠️ Không thể kiểm tra conflict trong database:', dbError.message);
        // Nếu không thể kiểm tra database, giả định không có xung đột để tránh block việc tạo lịch
        // Nhưng sẽ có validation ở pre-save middleware
      }
      
      return { conflict: false };
    };
    
    // ✅ Helper: Thử swap để giải quyết conflict (Backtracking + Local Swap Heuristic)
    const trySwapToResolveConflict = async (
      timetable,
      conflictDayIdx,
      conflictPeriodIdx,
      teacherAId,
      subjectAId,
      subjectAName,
      teacherAName,
      classAId,
      conflictDayName,
      checkConflictFn,
      inMemoryConflicts,
      year,
      semester
    ) => {
      // ✅ Tìm các slot trước đó (tiết < conflictPeriodIdx) trong cùng ngày
      const maxSwapAttempts = 10;
      let swapAttempts = 0;
      
      for (let prevPeriodIdx = conflictPeriodIdx - 1; prevPeriodIdx >= 0 && swapAttempts < maxSwapAttempts; prevPeriodIdx--) {
        swapAttempts++;
        const prevSlot = timetable[conflictDayIdx].periods[prevPeriodIdx];
        if (!prevSlot || prevSlot.locked) continue;
        
        // ✅ Nếu slot trước đó trống → di chuyển giáo viên A vào đó
        if (!prevSlot.teacherId) {
          const checkPrev = await checkConflictFn(
            teacherAId,
            conflictDayName,
            prevPeriodIdx + 1,
            classAId
          );
          
          if (!checkPrev.conflict) {
            prevSlot.subject = subjectAName;
            prevSlot.teacher = teacherAName;
            prevSlot.teacherId = teacherAId;
            prevSlot.subjectId = subjectAId;
            
            // ✅ Slot conflict giờ trống, gán giáo viên A vào
            timetable[conflictDayIdx].periods[conflictPeriodIdx].subject = subjectAName;
            timetable[conflictDayIdx].periods[conflictPeriodIdx].teacher = teacherAName;
            timetable[conflictDayIdx].periods[conflictPeriodIdx].teacherId = teacherAId;
            timetable[conflictDayIdx].periods[conflictPeriodIdx].subjectId = subjectAId;
            
            const prevConflictKey = `${teacherAId.toString()}_${conflictDayName}_${prevPeriodIdx + 1}_${year}_${semester}`;
            inMemoryConflicts.set(prevConflictKey, {
              className: classAId.className || 'Unknown',
              classId: classAId
            });
            
            return { success: true, swappedTeacher: null, swappedSlot: `${conflictDayName}, tiết ${prevPeriodIdx + 1}` };
          }
        } else {
          // ✅ Slot trước đó có giáo viên B → thử swap A ↔ B
          const teacherBId = prevSlot.teacherId;
          const subjectBId = prevSlot.subjectId;
          const subjectBName = prevSlot.subject;
          const teacherBName = prevSlot.teacher;
          
          const checkAAtB = await checkConflictFn(teacherAId, conflictDayName, prevPeriodIdx + 1, classAId);
          const checkBAtA = await checkConflictFn(teacherBId, conflictDayName, conflictPeriodIdx + 1, classAId);
          
          if (!checkAAtB.conflict && !checkBAtA.conflict) {
            // ✅ Swap A ↔ B
            const tempSubject = prevSlot.subject;
            const tempTeacher = prevSlot.teacher;
            const tempTeacherId = prevSlot.teacherId;
            const tempSubjectId = prevSlot.subjectId;
            
            prevSlot.subject = subjectAName;
            prevSlot.teacher = teacherAName;
            prevSlot.teacherId = teacherAId;
            prevSlot.subjectId = subjectAId;
            
            timetable[conflictDayIdx].periods[conflictPeriodIdx].subject = tempSubject;
            timetable[conflictDayIdx].periods[conflictPeriodIdx].teacher = tempTeacher;
            timetable[conflictDayIdx].periods[conflictPeriodIdx].teacherId = tempTeacherId;
            timetable[conflictDayIdx].periods[conflictPeriodIdx].subjectId = tempSubjectId;
            
            const prevConflictKey = `${teacherAId.toString()}_${conflictDayName}_${prevPeriodIdx + 1}_${year}_${semester}`;
            const conflictKey = `${tempTeacherId.toString()}_${conflictDayName}_${conflictPeriodIdx + 1}_${year}_${semester}`;
            inMemoryConflicts.set(prevConflictKey, { className: classAId.className || 'Unknown', classId: classAId });
            inMemoryConflicts.set(conflictKey, { className: classAId.className || 'Unknown', classId: classAId });
            
            return { success: true, swappedTeacher: teacherBName, swappedSlot: `${conflictDayName}, tiết ${prevPeriodIdx + 1}` };
          }
        }
      }
      
      return { success: false, reason: 'Không tìm được slot để swap' };
    };

      for (const classObj of shuffledClasses) {
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
        // ✅ Lấy danh sách tiết nghỉ từ gradeConfig (format: [{ day: "Monday", period: 5 }])
        const restPeriods = gradeConfig.restPeriods || [];
        
        // ✅ Tạo Map để check nhanh: day -> Set<period>
        const restPeriodsMap = new Map();
        restPeriods.forEach(rest => {
          if (!restPeriodsMap.has(rest.day)) {
            restPeriodsMap.set(rest.day, new Set());
          }
          restPeriodsMap.get(rest.day).add(rest.period);
        });
        
        const timetable = days.map(day => ({
          day: day,
          periods: Array.from({ length: totalPeriods }, (_, i) => {
            const periodNumber = i + 1;
            // ✅ Check xem tiết này có trong danh sách nghỉ của ngày này không
            const dayRestPeriods = restPeriodsMap.get(day) || new Set();
            const isRestPeriod = dayRestPeriods.has(periodNumber);
            return {
              period: periodNumber,
              subject: '',
              teacher: '',
              teacherId: null,
              subjectId: null,
              locked: isRestPeriod // ✅ Mark tiết nghỉ là locked để không xếp môn học vào
            };
          })
        }));
        
        if (restPeriods.length > 0) {
          const restPeriodsStr = restPeriods.map(r => `${r.day} - Tiết ${r.period}`).join(', ');
          console.log(`📌 Khối ${classObj.grade} (Lớp ${classObj.className}): Các tiết nghỉ: ${restPeriodsStr}`);
        }

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
          
          // Tìm assignment cho môn này TRƯỚC để lấy thông tin giáo viên
          const assignment = classAssignments.find(a => {
            if (!a.subjectId) return false;
            const assignmentSubjectId = a.subjectId._id ? a.subjectId._id.toString() : a.subjectId.toString();
            return assignmentSubjectId === subjectIdStr;
          });
          
          const subject = subjects.find(s => {
            const sId = s._id.toString();
            return sId === subjectIdStr;
          });
          
          // ✅ Lấy tên môn và giáo viên để hiển thị trong log
          const subjectName = subject?.name || subjectIdStr;
          const teacherName = assignment?.teacherId?.name || (assignment?.teacherId ? 'Chưa có tên' : 'Chưa có phân công');
          
          if (periodsPerWeek <= 0) {
            console.log(`⚠️ Lớp ${classObj.className}, môn ${subjectName} (GV: ${teacherName}): Không có số tiết/tuần, bỏ qua`);
            continue;
          }
          
          if (!assignment || !assignment.teacherId) {
            console.warn(`⚠️ Lớp ${classObj.className}, môn ${subjectName}: Không có phân công giảng dạy (thiếu giáo viên), bỏ qua`);
            continue;
          }
          
          if (!subject) {
            console.warn(`⚠️ Lớp ${classObj.className}, môn ${subjectIdStr} (GV: ${teacherName}): Không tìm thấy thông tin môn học, bỏ qua`);
            continue;
          }
          
          console.log(`📚 Lớp ${classObj.className}, môn ${subjectName} (GV: ${teacherName}): ${periodsPerWeek} tiết/tuần`);
          const maxPeriodsPerDay = subjectConfig.maxPeriodsPerDay || 2;
          const allowConsecutive = subjectConfig.allowConsecutive !== false;
          
          // ✅ Xác định buổi xếp môn học (main/extra)
          const subjectSession = subjectConfig.session || 'main';
          const targetStart = subjectSession === 'main' ? mainStart : extraStart;
          const targetEnd = subjectSession === 'main' ? mainEnd : extraEnd;

          console.log(`📚 Môn ${subject.name} (GV: ${teacherName}, ${subjectSession}): Xếp vào buổi ${subjectSession === 'main' ? mainSession : extraSession} (periods ${targetStart + 1}-${targetEnd})`);

          // Xếp các tiết vào đúng buổi chính/phụ
          let placedCount = 0;
          let attempts = 0;
          const maxAttempts = 1000;
          let consecutiveAttempts = 0; // ✅ Đếm số lần thử tìm liền kề
          const maxConsecutiveAttempts = 50; // ✅ Sau 50 lần thử không tìm được liền kề → fallback về đơn

          while (placedCount < periodsPerWeek && attempts < maxAttempts) {
            attempts++;
            const dayIdx = Math.floor(Math.random() * days.length);
            const dayName = days[dayIdx];
            
            // ✅ Kiểm tra số tiết/ngày trước (chỉ tính trong buổi tương ứng)
            const periodsInDay = timetable[dayIdx].periods
              .slice(targetStart, targetEnd)
              .filter(p => p.subject === subject.name).length;
            if (periodsInDay >= maxPeriodsPerDay) {
              // Đã đủ số tiết/ngày, thử ngày khác
              continue;
            }
            
            // ✅ Nếu allowConsecutive = true và còn cần xếp ít nhất 2 tiết → ƯU TIÊN tìm 2 slot liền kề
            const remainingPeriods = periodsPerWeek - placedCount;
            const needConsecutive = allowConsecutive && remainingPeriods >= 2 && consecutiveAttempts < maxConsecutiveAttempts;
            
            if (needConsecutive) {
              // ✅ ƯU TIÊN: Tìm 2 slot liền kề
              consecutiveAttempts++;
              let foundConsecutive = false;
              const startPeriodIdx = Math.floor(Math.random() * (targetEnd - targetStart - 1)) + targetStart;
              
              // ✅ Thử từ startPeriodIdx, sau đó thử tất cả các cặp liền kề
              const pairsToTry = [];
              for (let i = startPeriodIdx; i < targetEnd - 1; i++) {
                pairsToTry.push([i, i + 1]);
              }
              for (let i = targetStart; i < startPeriodIdx; i++) {
                if (i + 1 < targetEnd) {
                  pairsToTry.push([i, i + 1]);
                }
              }
              
              for (const [firstPeriod, secondPeriod] of pairsToTry) {
                // ✅ Kiểm tra cả 2 slot
                if (dayIdx < 0 || dayIdx >= timetable.length) continue;
                if (!timetable[dayIdx] || !timetable[dayIdx].periods) continue;
                if (firstPeriod < 0 || firstPeriod >= timetable[dayIdx].periods.length) continue;
                if (secondPeriod < 0 || secondPeriod >= timetable[dayIdx].periods.length) continue;
                
                const firstSlot = timetable[dayIdx].periods[firstPeriod];
                const secondSlot = timetable[dayIdx].periods[secondPeriod];
                
                if (!firstSlot || !secondSlot) continue;
                if (firstSlot.subject || firstSlot.locked || secondSlot.subject || secondSlot.locked) continue;
                if (!isTeacherAvailable(assignment.teacherId, dayIdx, firstPeriod) || 
                    !isTeacherAvailable(assignment.teacherId, dayIdx, secondPeriod)) continue;
                
                // ✅ Kiểm tra xung đột cho cả 2 tiết
                const conflictCheck1 = await checkTeacherConflict(
                  assignment.teacherId._id,
                  dayName,
                  firstPeriod + 1,
                  classObj._id
                );
                const conflictCheck2 = await checkTeacherConflict(
                  assignment.teacherId._id,
                  dayName,
                  secondPeriod + 1,
                  classObj._id
                );
                
                if (conflictCheck1.conflict || conflictCheck2.conflict) {
                  continue;
                }
                
                // ✅ Tìm được 2 slot liền kề hợp lệ, gán cả 2
                firstSlot.subject = subject.name;
                firstSlot.teacher = teacherName;
                firstSlot.teacherId = assignment.teacherId._id;
                firstSlot.subjectId = subject._id;
                
                secondSlot.subject = subject.name;
                secondSlot.teacher = teacherName;
                secondSlot.teacherId = assignment.teacherId._id;
                secondSlot.subjectId = subject._id;
                
                placedCount += 2;
                consecutiveAttempts = 0; // ✅ Reset counter khi tìm được liền kề
                
                console.log(`✅ Lớp ${classObj.className}, môn ${subject.name} (GV: ${teacherName}): Gán 2 tiết liền kề vào ${dayName}, tiết ${firstPeriod + 1}-${secondPeriod + 1}`);
                
                // ✅ Đánh dấu vào inMemoryTeacherConflicts
                const conflictKey1 = `${assignment.teacherId._id.toString()}_${dayName}_${firstPeriod + 1}_${year}_${semester}`;
                const conflictKey2 = `${assignment.teacherId._id.toString()}_${dayName}_${secondPeriod + 1}_${year}_${semester}`;
                inMemoryTeacherConflicts.set(conflictKey1, {
                  className: classObj.className,
                  classId: classObj._id
                });
                inMemoryTeacherConflicts.set(conflictKey2, {
                  className: classObj.className,
                  classId: classObj._id
                });
                
                foundConsecutive = true;
                break;
              }
              
              if (!foundConsecutive) {
                // ✅ Nếu đã thử nhiều lần không tìm được liền kề → fallback về đơn (nhưng vẫn tuân thủ maxPeriodsPerDay)
                if (consecutiveAttempts >= maxConsecutiveAttempts) {
                  console.log(`⚠️ Lớp ${classObj.className}, môn ${subject.name} (GV: ${teacherName}): Đã thử ${maxConsecutiveAttempts} lần không tìm được 2 slot liền kề → chuyển sang xếp đơn (vẫn tuân thủ maxPeriodsPerDay=${maxPeriodsPerDay})`);
                  consecutiveAttempts = 0; // Reset để lần sau vẫn ưu tiên liền kề
                  // ✅ Fallback về xếp đơn - tiếp tục với logic xếp đơn bên dưới (không continue)
                } else {
                  console.log(`⚠️ Lớp ${classObj.className}, môn ${subject.name} (GV: ${teacherName}): Không tìm được 2 slot liền kề trong ${dayName} (thử ${consecutiveAttempts}/${maxConsecutiveAttempts}) - thử ngày khác...`);
                  continue;
                }
              } else {
                // ✅ Đã tìm được liền kề, tiếp tục vòng lặp
                continue;
              }
            }
            
            // ✅ Xếp 1 tiết (allowConsecutive = false, chỉ còn 1 tiết, hoặc đã fallback từ liền kề)
            // ✅ Vẫn tuân thủ maxPeriodsPerDay (đã check ở đầu vòng lặp)
            const startPeriodIdx = Math.floor(Math.random() * (targetEnd - targetStart)) + targetStart;
            let foundSlot = false;
            
            const periodsToTry = [];
            for (let i = startPeriodIdx; i < targetEnd; i++) {
              periodsToTry.push(i);
            }
            for (let i = targetStart; i < startPeriodIdx; i++) {
              periodsToTry.push(i);
            }
            
            for (const tryPeriod of periodsToTry) {
              if (dayIdx < 0 || dayIdx >= timetable.length) continue;
              if (!timetable[dayIdx] || !timetable[dayIdx].periods) continue;
              if (tryPeriod < 0 || tryPeriod >= timetable[dayIdx].periods.length) continue;
              
              const slot = timetable[dayIdx].periods[tryPeriod];
              if (!slot) continue;
              if (slot.subject || slot.locked) continue;
              if (!isTeacherAvailable(assignment.teacherId, dayIdx, tryPeriod)) continue;
              if (!assignment.teacherId || !assignment.teacherId._id) continue;
              
              const conflictCheck = await checkTeacherConflict(
                assignment.teacherId._id,
                dayName,
                tryPeriod + 1,
                classObj._id
              );
              
              if (conflictCheck.conflict) {
                // ✅ THỬ SWAP: Khi gặp conflict, thử swap với slot trước đó
                const swapResult = await trySwapToResolveConflict(
                  timetable,
                  dayIdx,
                  tryPeriod,
                  assignment.teacherId._id,
                  subject._id,
                  subject.name,
                  teacherName,
                  classObj._id,
                  dayName,
                  checkTeacherConflict,
                  inMemoryTeacherConflicts,
                  year,
                  semester
                );
                
                if (swapResult.success) {
                  // ✅ Swap thành công, đã gán môn học
                  placedCount++;
                  console.log(`🔄 Lớp ${classObj.className}, môn ${subject.name} (GV: ${teacherName}): Swap thành công vào ${dayName}, tiết ${tryPeriod + 1} (swap với ${swapResult.swappedTeacher || 'slot trống'})`);
                  
                  const conflictKey = `${assignment.teacherId._id.toString()}_${dayName}_${tryPeriod + 1}_${year}_${semester}`;
                  inMemoryTeacherConflicts.set(conflictKey, {
                    className: classObj.className,
                    classId: classObj._id
                  });
                  
                  foundSlot = true;
                  break;
                } else {
                  // ✅ Swap không thành công, tiếp tục tìm slot khác
                  continue;
                }
              }
              
              // ✅ Tìm được slot hợp lệ, gán môn học
              slot.subject = subject.name;
              slot.teacher = teacherName;
              slot.teacherId = assignment.teacherId._id;
              slot.subjectId = subject._id;
              placedCount++;
              
              console.log(`✅ Lớp ${classObj.className}, môn ${subject.name} (GV: ${teacherName}): Gán vào ${dayName}, tiết ${tryPeriod + 1}`);
              
              const conflictKey = `${assignment.teacherId._id.toString()}_${dayName}_${tryPeriod + 1}_${year}_${semester}`;
              inMemoryTeacherConflicts.set(conflictKey, {
                className: classObj.className,
                classId: classObj._id
              });
              
              foundSlot = true;
              break;
            }
            
            if (!foundSlot) {
              console.log(`⚠️ Lớp ${classObj.className}, môn ${subject.name}: Không tìm được slot trống trong ${dayName} - thử ngày khác...`);
              continue;
            }
          }

          if (placedCount < periodsPerWeek) {
            console.warn(`⚠️ Lớp ${classObj.className}, môn ${subject.name} (GV: ${teacherName}): chỉ xếp được ${placedCount}/${periodsPerWeek} tiết - thiếu ${periodsPerWeek - placedCount} tiết`);
          }
        }

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

        // ✅ Lưu schedule vào memory (chưa lưu vào database)
        schedulesInMemory.push({
          classId: classObj._id,
          className: classObj.className,
          year,
          semester,
          timetable: cleanedTimetable
        });
        
        console.log(`✅ Đã tạo lịch trong memory cho lớp ${classObj.className}`);

        } catch (error) {
        console.error(`❌ Lỗi khi tạo lịch cho lớp ${classObj.className}:`, error);
        errors.push({
          className: classObj.className,
          error: error.message
        });
        }
      } // End for shuffledClasses
      
      // ✅ Kiểm tra xem đã tạo thành công cho tất cả lớp chưa
      const successCount = schedulesInMemory.length;
      const failedCount = errors.length;
      const totalCount = classes.length;
      
      console.log(`\n📊 Kết quả lần thử ${globalAttempt}: ${successCount}/${totalCount} lớp tạo được lịch trong memory${failedCount > 0 ? `, ${failedCount} lớp lỗi` : ''}`);
      
      // ✅ Nếu tất cả lớp đều thành công → lưu vào database và dừng retry
      if (successCount === totalCount || failedCount === 0) {
        allSchedulesGenerated = true;
        console.log(`✅ Tạo lịch thành công cho tất cả ${successCount} lớp! Bắt đầu lưu vào database...`);
      } else if (globalAttempt < maxGlobalAttempts) {
        // ✅ Nếu vẫn còn lỗi và chưa hết số lần thử → tiếp tục retry
        console.log(`⚠️ Vẫn còn ${failedCount} lớp chưa tạo được lịch. Sẽ thử lại lần ${globalAttempt + 1}...`);
        // Đợi một chút trước khi retry (tránh race condition)
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue; // Bỏ qua bước lưu database, thử lại từ đầu
      } else {
        // ✅ Đã hết số lần thử, lưu những gì đã tạo được
        console.log(`⚠️ Đã hết ${maxGlobalAttempts} lần thử. Lưu ${successCount} lịch đã tạo được...`);
        allSchedulesGenerated = true;
      }
      
      // ✅ BƯỚC 2: Lưu tất cả schedules vào database (sau khi đã kiểm tra xung đột)
      console.log(`\n💾 Bắt đầu lưu ${schedulesInMemory.length} lịch vào database...`);
      
      for (const scheduleData of schedulesInMemory) {
        try {
          // ✅ Xóa lịch cũ nếu có
        await Schedule.deleteMany({
          classId: scheduleData.classId,
          year: scheduleData.year,
          semester: scheduleData.semester
        });

        // ✅ Lưu lịch mới
        const newSchedule = new Schedule({
          classId: scheduleData.classId,
          className: scheduleData.className,
          year: scheduleData.year,
          semester: scheduleData.semester,
          timetable: scheduleData.timetable
        });

        await newSchedule.save();
        console.log(`✅ Đã lưu lịch cho lớp ${scheduleData.className}`);
        
        results.push({
          className: scheduleData.className,
          classId: scheduleData.classId.toString(),
          status: 'completed'
        });
        } catch (error) {
          console.error(`❌ Lỗi khi lưu lịch cho lớp ${scheduleData.className}:`, error);
          errors.push({
            className: scheduleData.className,
            error: error.message
          });
        }
      }
    } // End while retry loop

    // ✅ Thống kê kết quả theo khối
    const resultsByGrade = {};
    const errorsByGrade = {};
    
    results.forEach(r => {
      const classObj = classes.find(c => c._id.toString() === r.classId);
      if (classObj) {
        const grade = classObj.grade;
        if (!resultsByGrade[grade]) resultsByGrade[grade] = [];
        resultsByGrade[grade].push(r);
      }
    });
    
    errors.forEach(e => {
      const classObj = classes.find(c => c.className === e.className);
      if (classObj) {
        const grade = classObj.grade;
        if (!errorsByGrade[grade]) errorsByGrade[grade] = [];
        errorsByGrade[grade].push(e);
      }
    });

    console.log(`\n📊 Tổng kết tạo lịch:`);
    Object.entries(classesByGrade).forEach(([grade, gradeClasses]) => {
      const successCount = resultsByGrade[grade]?.length || 0;
      const errorCount = errorsByGrade[grade]?.length || 0;
      const totalCount = gradeClasses.length;
      console.log(`   - Khối ${grade}: ${successCount}/${totalCount} lớp thành công${errorCount > 0 ? `, ${errorCount} lớp lỗi` : ''}`);
    });
    console.log(`   - Tổng cộng: ${results.length}/${classes.length} lớp thành công${errors.length > 0 ? `, ${errors.length} lớp lỗi` : ''}`);

    if (errors.length > 0 && results.length === 0) {
      return res.status(500).json({
        message: 'Không thể tạo lịch cho bất kỳ lớp nào',
        errors: errors,
        summary: {
          total: classes.length,
          success: 0,
          failed: errors.length,
          byGrade: Object.fromEntries(
            Object.keys(classesByGrade).map(grade => [
              grade,
              {
                total: classesByGrade[grade].length,
                success: 0,
                failed: errorsByGrade[grade]?.length || 0
              }
            ])
          )
        }
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
      message: `Đã tạo thời khóa biểu cho ${results.length}/${classes.length} lớp`,
      success: results.length,
      failed: errors.length,
      total: classes.length,
      schedules: schedules,
      results: results,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total: classes.length,
        success: results.length,
        failed: errors.length,
        byGrade: Object.fromEntries(
          Object.keys(classesByGrade).map(grade => [
            grade,
            {
              total: classesByGrade[grade].length,
              success: resultsByGrade[grade]?.length || 0,
              failed: errorsByGrade[grade]?.length || 0,
              classes: classesByGrade[grade].map(c => ({
                className: c.className,
                classId: c._id.toString(),
                status: results.find(r => r.classId === c._id.toString()) ? 'success' : 
                        errors.find(e => e.className === c.className) ? 'failed' : 'unknown'
              }))
            }
          ])
        )
      }
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
