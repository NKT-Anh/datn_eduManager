const mongoose = require('mongoose');
const Schedule = require('../../models/subject/schedule');
const { ScheduleConfig, getEffectiveSession } = require('../../services/scheduleConfigService');
const Class = require('../../models/class/class');
const TeachingAssignment = require('../../models/subject/teachingAssignment');
const Subject = require('../../models/subject/subject');
const Activity = require('../../models/subject/activity');
const Teacher = require('../../models/user/teacher');
const ClassPeriods = require('../../models/class/classPeriods');

/**
 * ============================================================================
 * 📚 THUẬT TOÁN TỰ ĐỘNG XẾP THỜI KHÓA BIỂU
 * ============================================================================
 * 
 * Hệ thống sử dụng thuật toán CSP (Constraint Satisfaction Problem) kết hợp
 * với Backtracking và các Heuristic để tự động tạo thời khóa biểu.
 * 
 * 🔧 KIẾN TRÚC:
 * - CSP: Mỗi môn học = biến, mỗi ngày/tiết = giá trị
 * - Backtracking: Thử xếp và quay lui nếu vi phạm ràng buộc
 * - MRV (Minimum Remaining Values): Ưu tiên môn còn nhiều tiết chưa xếp
 * - LCV (Least Constraining Value): Ưu tiên slot ít ràng buộc nhất
 * 
 * 📋 CÁC RÀNG BUỘC:
 * 1. Không trùng giáo viên (nếu có giáo viên)
 * 2. Không trùng môn (nếu không có giáo viên - cố gắng làm các lớp khác nhau)
 * 3. Lịch rảnh giáo viên (availableMatrix)
 * 4. Max số tiết/ngày (maxPeriodsPerDay)
 * 5. Max số tiết/buổi (maxPeriodsPerDay/buổi)
 * 6. Tiết liên tiếp (allowConsecutive)
 * 7. Fixed slots (cố định)
 * 8. Phân bổ đều (không thiên vị thứ đầu tuần)
 * 
 * 🎯 MỤC TIÊU:
 * - Độ chính xác: Tôn trọng tất cả ràng buộc
 * - Không thiên vị: Phân bổ đều các môn vào các thứ
 * - Tối ưu: Cố gắng làm các lớp có thời khóa biểu khác nhau
 * - Linh hoạt: Xếp được cả môn có và không có giáo viên
 * 
 * 📊 NGUỒN DỮ LIỆU SỐ TIẾT:
 * 1. Ưu tiên: classPeriods (phân bổ theo lớp cho năm học - học kỳ)
 * 2. Fallback: gradeConfigs (cấu hình mặc định từ ScheduleConfig)
 * 
 * Xem chi tiết tại: backend/docs/AUTO_SCHEDULE_ALGORITHM.md
 * ============================================================================
 */

// Thuật toán tự động tạo thời khóa biểu
class AutoScheduleGenerator {
  constructor(config, subjects, activities, classes, assignments, year, semester, classPeriodsData = []) {
    this.config = config;
    this.subjects = subjects;
    this.activities = activities;
    this.classes = classes;
    this.assignments = assignments;
    this.year = year;
    this.semester = semester;
    this.schedules = [];
    this.teacherAvailability = new Map();
    this.fixedPeriods = new Map(); // Lưu các tiết đã được cố định
    // ✅ Tracking: Số lớp mỗi giáo viên đang dạy theo khối
    this.teacherClassCountByGrade = new Map(); // teacherId -> Map(grade -> count)
    // ✅ Tracking: Số tiết/tuần mỗi giáo viên đang dạy
    this.teacherWeeklyLessons = new Map(); // teacherId -> count
    // ✅ Cache: Thông tin giáo viên (maxClassPerGrade, weeklyLessons, maxClasses)
    this.teacherInfo = new Map(); // teacherId -> { maxClassPerGrade, weeklyLessons, maxClasses }
    // ✅ Cache: Phân bổ số tiết theo lớp (từ API ClassPeriods)
    this.classPeriodsCache = new Map(); // classId -> { subjectPeriods: Map, activityPeriods: Map }
    this.initializeClassPeriodsCache(classPeriodsData);
  }

  // ✅ Khởi tạo cache classPeriods từ dữ liệu API
  initializeClassPeriodsCache(classPeriodsData) {
    for (const cp of classPeriodsData) {
      if (!cp.classId) continue;
      const classId = typeof cp.classId === 'object' ? cp.classId._id.toString() : cp.classId.toString();
      
      const subjectPeriodsMap = new Map();
      if (cp.subjectPeriods) {
        Object.entries(cp.subjectPeriods).forEach(([subjectId, periods]) => {
          subjectPeriodsMap.set(subjectId, periods);
        });
      }
      
      const activityPeriodsMap = new Map();
      if (cp.activityPeriods) {
        Object.entries(cp.activityPeriods).forEach(([activityId, periods]) => {
          activityPeriodsMap.set(activityId.toString(), periods);
        });
      }
      
      this.classPeriodsCache.set(classId, {
        subjectPeriods: subjectPeriodsMap,
        activityPeriods: activityPeriodsMap
      });
    }
  }

  // ✅ Helper: Lấy số tiết/tuần cho lớp cụ thể, ưu tiên classPeriods
  // Logic: 
  // 1. Nếu lớp đã có classPeriods → dùng số tiết từ classPeriods (kể cả = 0), bỏ qua cấu hình thời khóa biểu
  // 2. Nếu lớp chưa có classPeriods → mới lấy từ cấu hình thời khóa biểu (gradeConfigs)
  getPeriodsForClass(item, classId) {
    const classIdStr = classId.toString();
    const classPeriods = this.classPeriodsCache.get(classIdStr);
    
    // ✅ Bước 1: Kiểm tra xem lớp này đã có classPeriods chưa
    if (classPeriods) {
      // ✅ Lớp đã có classPeriods → ưu tiên dùng số tiết từ classPeriods
      if (item.type === 'subject') {
        // Tìm subjectId từ item.name
        const subject = this.subjects.find(s => s.name === item.name);
        if (subject) {
          const subjectId = subject._id.toString();
          const periods = classPeriods.subjectPeriods.get(subjectId);
          
          // ✅ Nếu có trong classPeriods (kể cả = 0), dùng giá trị đó, bỏ qua cấu hình
          if (typeof periods === 'number') {
            console.log(`✅ Lấy số tiết từ classPeriods: ${item.name} - ${periods} tiết/tuần cho lớp ${classIdStr}`);
            return periods;
          }
          // ✅ Nếu không có môn này trong classPeriods, trả về 0 (không dùng cấu hình)
          console.log(`📋 Lớp ${classIdStr} đã có classPeriods nhưng không có môn ${item.name}, trả về 0 (bỏ qua cấu hình)`);
          return 0;
        }
      } else if (item.type === 'activity' && item.activityId) {
        const activityId = item.activityId.toString();
        const periods = classPeriods.activityPeriods.get(activityId);
        
        // ✅ Nếu có trong classPeriods (kể cả = 0), dùng giá trị đó, bỏ qua cấu hình
        if (typeof periods === 'number') {
          console.log(`✅ Lấy số tiết từ classPeriods: ${item.name} - ${periods} tiết/tuần cho lớp ${classIdStr}`);
          return periods;
        }
        // ✅ Nếu không có hoạt động này trong classPeriods, trả về 0 (không dùng cấu hình)
        console.log(`📋 Lớp ${classIdStr} đã có classPeriods nhưng không có hoạt động ${item.name}, trả về 0 (bỏ qua cấu hình)`);
        return 0;
      }
      
      // ✅ Nếu không tìm thấy subject/activity, trả về 0 (không dùng cấu hình)
      return 0;
    }
    
    // ✅ Bước 2: Lớp chưa có classPeriods → Fallback về periodsPerWeek từ gradeConfigs (cấu hình thời khóa biểu)
    const fallbackPeriods = item.periodsPerWeek || 0;
    if (fallbackPeriods > 0) {
      console.log(`📋 Lấy số tiết từ cấu hình thời khóa biểu (gradeConfigs): ${item.name} - ${fallbackPeriods} tiết/tuần cho lớp ${classIdStr} (chưa có classPeriods cho năm học - học kỳ này)`);
    }
    return fallbackPeriods;
  }

  // ✅ Khởi tạo ma trận rảnh và thông tin giáo viên
  initializeTeacherAvailability() {
    for (const assignment of this.assignments) {
      if (!assignment.teacherId) continue;
      
      const teacherId = assignment.teacherId._id.toString();
      const teacher = assignment.teacherId;
      
      // Lưu availableMatrix
      if (teacher.availableMatrix) {
        this.teacherAvailability.set(teacherId, {
          matrix: teacher.availableMatrix,
          name: teacher.name || ''
        });
      }
      
      // ✅ Lưu thông tin giáo viên (maxClassPerGrade, weeklyLessons, maxClasses)
      if (!this.teacherInfo.has(teacherId)) {
        // Lấy maxClassPerGrade (Map hoặc Object)
        let maxClassPerGrade = new Map();
        if (teacher.maxClassPerGrade) {
          if (teacher.maxClassPerGrade instanceof Map) {
            maxClassPerGrade = teacher.maxClassPerGrade;
          } else if (typeof teacher.maxClassPerGrade === 'object') {
            maxClassPerGrade = new Map(Object.entries(teacher.maxClassPerGrade));
          }
        } else {
          // Default: 2 lớp/khối
          maxClassPerGrade = new Map([["10", 2], ["11", 2], ["12", 2]]);
        }
        
        // ✅ Sử dụng effectiveWeeklyLessons (đã áp dụng cap limit từ weeklyLessons)
        // effectiveWeeklyLessons = base (17) - reduction + optional, và đã bị cap bởi weeklyLessons
        const effectiveWeeklyLessons = teacher.effectiveWeeklyLessons || 17;
        
        this.teacherInfo.set(teacherId, {
          maxClassPerGrade: maxClassPerGrade,
          weeklyLessons: effectiveWeeklyLessons, // ✅ Dùng effectiveWeeklyLessons thay vì weeklyLessons
          maxClasses: teacher.maxClasses || 3, // Default: 3 lớp
          name: teacher.name || ''
        });
      }
      
      // ✅ Khởi tạo tracking counters
      if (!this.teacherClassCountByGrade.has(teacherId)) {
        this.teacherClassCountByGrade.set(teacherId, new Map([["10", 0], ["11", 0], ["12", 0]]));
      }
      if (!this.teacherWeeklyLessons.has(teacherId)) {
        this.teacherWeeklyLessons.set(teacherId, 0);
      }
    }
  }

  // Lấy buổi học chính cho khối
  getMainSessionForGrade(grade) {
    // ✅ Ưu tiên sử dụng gradeConfigs (cấu trúc mới - mỗi khối có rules riêng)
    const gradeConfig = this.config.gradeConfigs?.get?.(grade) || this.config.gradeConfigs?.get?.(String(grade));
    if (gradeConfig?.rules) {
      return gradeConfig.rules.session || 'morning';
    }
    
    // ✅ Fallback về gradeSessionRules (backward compatibility)
    const rule = this.config.gradeSessionRules?.find?.(r => r.grade === grade || r.grade === String(grade));
    return rule ? rule.session : 'morning';
  }

  // ✅ Kiểm tra giáo viên có rảnh và không trùng lớp khác cùng tiết
  // ✅ Kiểm tra thêm maxClassPerGrade và weeklyLessons
  isTeacherAvailable(teacherId, day, period, classGrade = null, currentClassId = null) {
    if (!teacherId) return true; // Không có giáo viên thì luôn available
    
    // ✅ Bước 1: Kiểm tra lịch rảnh từ availableMatrix
    const availability = this.teacherAvailability.get(teacherId);
    if (availability && availability.matrix) {
      const dayIndex = this.getDayIndex(day);
      const periodIndex = period - 1;

      if (dayIndex < 0 || periodIndex < 0) return false;
      if (!availability.matrix[dayIndex] || availability.matrix[dayIndex][periodIndex] !== true) {
        return false; // Giáo viên không rảnh theo lịch rảnh
      }
    }

    // ✅ Bước 2: Kiểm tra xem giáo viên đó có đang dạy lớp khác cùng tiết không
    // Sử dụng cache nếu có
    const cacheKey = `${teacherId}-${day}-${period}`;
    if (this.teacherConflictCache && this.teacherConflictCache.has(cacheKey)) {
      const assignedClasses = this.teacherConflictCache.get(cacheKey);
      if (currentClassId && assignedClasses.has(currentClassId)) {
        // Nếu lớp hiện tại đã có trong cache, không có xung đột
        return true;
      }
      // Nếu có lớp khác đã được gán, có xung đột
      if (assignedClasses.size > 0) {
        return false;
      }
    }
    
    // ✅ Nếu chưa có cache, tìm kiếm trong schedules đã tạo
    for (const schedule of this.schedules) {
      // Bỏ qua lớp hiện tại nếu đang xếp lại
      if (currentClassId && schedule.classId === currentClassId) continue;
      
      for (const dayEntry of schedule.timetable) {
        if (dayEntry.day === day) {
          const periodIndex = period - 1;
          if (periodIndex < 0 || periodIndex >= dayEntry.periods.length) continue;
          
          const conflict = dayEntry.periods[periodIndex];

          // ✅ So sánh teacher ID - ưu tiên dùng teacherId nếu có, fallback về teacher name
          if (conflict) {
            let conflictTeacherId = null;
            
            // ✅ Ưu tiên: Lấy từ teacherId (nếu đã lưu)
            if (conflict.teacherId) {
              conflictTeacherId = typeof conflict.teacherId === 'string' 
                ? conflict.teacherId 
                : (conflict.teacherId._id ? conflict.teacherId._id.toString() : conflict.teacherId.toString());
            } 
            // ✅ Fallback: Lấy từ teacher (có thể là name hoặc ID)
            else if (conflict.teacher) {
              // Nếu teacher là object có _id, lấy _id
              if (typeof conflict.teacher === 'object' && conflict.teacher._id) {
                conflictTeacherId = conflict.teacher._id.toString();
              }
              // Nếu teacher là string, cần tìm lại từ assignments (không thể so sánh trực tiếp)
              // Trong trường hợp này, sẽ bỏ qua check này và dựa vào logic khác
            }
            
            // ✅ So sánh ID
            if (conflictTeacherId && (conflictTeacherId === teacherId || conflictTeacherId === teacherId.toString())) {
              // ✅ Cập nhật cache
              if (this.teacherConflictCache) {
                if (!this.teacherConflictCache.has(cacheKey)) {
                  this.teacherConflictCache.set(cacheKey, new Set());
                }
                this.teacherConflictCache.get(cacheKey).add(schedule.classId);
              }
            return false; // Giáo viên này đã dạy lớp khác cùng tiết
          }
        }
      }
    }
    }

    return true; // Rảnh và không bị trùng
  }
  
  // ✅ Kiểm tra giáo viên có thể nhận thêm lớp cho khối này không
  canTeacherTakeMoreClasses(teacherId, classGrade) {
    if (!this.teacherInfo.has(teacherId)) return true; // Nếu không có thông tin, cho phép
    
    const teacherInfo = this.teacherInfo.get(teacherId);
    const classCountByGrade = this.teacherClassCountByGrade.get(teacherId);
    
    if (!classCountByGrade) return true;
    
    const maxForGrade = teacherInfo.maxClassPerGrade.get(classGrade) || teacherInfo.maxClassPerGrade.get(String(classGrade)) || 2;
    const currentCount = classCountByGrade.get(classGrade) || classCountByGrade.get(String(classGrade)) || 0;
    
    return currentCount < maxForGrade;
  }
  
  // ✅ Kiểm tra giáo viên có thể nhận thêm tiết/tuần không
  canTeacherTakeMoreLessons(teacherId, additionalLessons = 1) {
    if (!this.teacherInfo.has(teacherId)) return true; // Nếu không có thông tin, cho phép
    
    const teacherInfo = this.teacherInfo.get(teacherId);
    const currentLessons = this.teacherWeeklyLessons.get(teacherId) || 0;
    // ✅ teacherInfo.weeklyLessons đã là effectiveWeeklyLessons (đã áp dụng cap limit)
    const maxLessons = teacherInfo.weeklyLessons || 17;
    
    return (currentLessons + additionalLessons) <= maxLessons;
  }
  
  // ✅ Cập nhật tracking: Tăng số lớp giáo viên đang dạy cho khối
  incrementTeacherClassCount(teacherId, classGrade) {
    if (!this.teacherClassCountByGrade.has(teacherId)) {
      this.teacherClassCountByGrade.set(teacherId, new Map([["10", 0], ["11", 0], ["12", 0]]));
    }
    const classCountByGrade = this.teacherClassCountByGrade.get(teacherId);
    const currentCount = classCountByGrade.get(classGrade) || classCountByGrade.get(String(classGrade)) || 0;
    classCountByGrade.set(classGrade, currentCount + 1);
  }
  
  // ✅ Cập nhật tracking: Tăng số tiết/tuần giáo viên đang dạy
  incrementTeacherWeeklyLessons(teacherId, lessons = 1) {
    const currentLessons = this.teacherWeeklyLessons.get(teacherId) || 0;
    this.teacherWeeklyLessons.set(teacherId, currentLessons + lessons);
  }

  // Chuyển đổi tên ngày thành index
  getDayIndex(day) {
    const dayMap = {
      'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 
      'Thursday': 3, 'Friday': 4, 'Saturday': 5,
      'Thứ 2': 0, 'Thứ 3': 1, 'Thứ 4': 2, 
      'Thứ 5': 3, 'Thứ 6': 4, 'Thứ 7': 5
    };
    return dayMap[day] ?? -1;
  }

  // ✅ Helper: Convert Map hoặc Object thành entries (để iterate)
  getEntries(mapOrObject) {
    if (mapOrObject instanceof Map) {
      return Array.from(mapOrObject.entries());
    }
    if (typeof mapOrObject === 'object' && mapOrObject !== null) {
      return Object.entries(mapOrObject);
    }
    return [];
  }

  // ✅ Helper: Lấy giá trị từ Map hoặc number
  getPeriodsPerWeekForGrade(periodsPerWeek, grade) {
    if (periodsPerWeek instanceof Map) {
      return periodsPerWeek.get(grade) || periodsPerWeek.get(String(grade)) || 0;
    }
    if (typeof periodsPerWeek === 'object' && periodsPerWeek !== null) {
      return periodsPerWeek[grade] || periodsPerWeek[String(grade)] || 0;
    }
    return periodsPerWeek || 0; // Nếu là number hoặc undefined
  }
  
  // ✅ Helper: Lấy gradeConfig cho khối cụ thể
  getGradeConfig(config, grade) {
    if (config.gradeConfigs && config.gradeConfigs instanceof Map) {
      return config.gradeConfigs.get(grade) || config.gradeConfigs.get(String(grade)) || {};
    }
    if (config.gradeConfigs && typeof config.gradeConfigs === 'object') {
      return config.gradeConfigs[grade] || config.gradeConfigs[String(grade)] || {};
    }
    return {}; // Fallback về config mặc định
  }

  // ✅ Helper: Transform session "main"/"extra" → "morning"/"afternoon" theo khối
  // Sử dụng getEffectiveSession từ service
  transformSessionForGrade(session, grade) {
    // ✅ Sử dụng service function
    return getEffectiveSession(this.config, session, grade);
  }

  // Lấy danh sách môn học và hoạt động cho khối
  getSubjectsForGrade(grade) {
    const mainSession = this.getMainSessionForGrade(grade);
    const items = [];

    // ✅ Ưu tiên sử dụng gradeConfigs (cấu trúc mới)
    const gradeConfigData = this.config.gradeConfigs?.get?.(grade) || 
                            this.config.gradeConfigs?.get?.(String(grade)) ||
                            (typeof this.config.gradeConfigs === 'object' && this.config.gradeConfigs?.[grade]) ||
                            (typeof this.config.gradeConfigs === 'object' && this.config.gradeConfigs?.[String(grade)]);
    
    // ✅ Xử lý subjects từ cấu trúc mới (gradeConfigs[grade].subjects với key là subjectId)
    if (gradeConfigData?.subjects) {
      const subjectsMap = gradeConfigData.subjects instanceof Map
        ? Array.from(gradeConfigData.subjects.entries())
        : Object.entries(gradeConfigData.subjects || {});
      
      // Thêm môn học chính (session = "main")
      for (const [subjectIdStr, subjectConfig] of subjectsMap) {
        const subject = this.subjects.find(s => 
          s._id && (s._id.toString() === subjectIdStr || s._id.toString() === String(subjectIdStr))
        );
        if (!subject) continue;
        if (subject.grades && !subject.grades.includes(grade)) continue;
        
        // ✅ periodsPerWeek là number trong cấu trúc mới
        const periodsPerWeek = typeof subjectConfig.periodsPerWeek === 'number' 
          ? subjectConfig.periodsPerWeek 
          : 0;
        if (periodsPerWeek <= 0) continue;
        
        const baseSession = subjectConfig.session || 'main';
        const transformedSession = this.transformSessionForGrade(baseSession, grade);
        
        // ✅ Chỉ thêm môn học chính
        if (baseSession === 'main' && (transformedSession === 'main' || transformedSession === 'morning' || transformedSession === 'afternoon')) {
        items.push({
            name: subject.name,
          type: 'subject',
          periodsPerWeek: periodsPerWeek,
            maxPeriodsPerDay: subjectConfig.maxPeriodsPerDay ?? 2,
            allowConsecutive: subjectConfig.allowConsecutive ?? false, // ✅ Default false
            session: transformedSession,
            fixedSlots: subjectConfig.fixedSlots || null // ✅ Format: { dayOfWeek, periods: [1, 2] }
        });
      }
    }

      // Thêm môn học phụ (session = "extra")
      for (const [subjectIdStr, subjectConfig] of subjectsMap) {
        const subject = this.subjects.find(s => 
          s._id && (s._id.toString() === subjectIdStr || s._id.toString() === String(subjectIdStr))
        );
        if (!subject) continue;
        if (subject.grades && !subject.grades.includes(grade)) continue;
        
        const periodsPerWeek = typeof subjectConfig.periodsPerWeek === 'number' 
          ? subjectConfig.periodsPerWeek 
          : 0;
        if (periodsPerWeek <= 0) continue;
        
        const baseSession = subjectConfig.session || 'main';
        
        // ✅ Chỉ thêm môn học phụ
        if (baseSession === 'extra') {
        items.push({
            name: subject.name,
          type: 'subject',
          periodsPerWeek: periodsPerWeek,
            maxPeriodsPerDay: subjectConfig.maxPeriodsPerDay ?? 2,
            allowConsecutive: subjectConfig.allowConsecutive ?? false,
            session: 'extra',
            fixedSlots: subjectConfig.fixedSlots || null
          });
        }
      }
    }

    // ✅ Xử lý activities từ cấu trúc mới (gradeConfigs[grade].activities với periodsPerWeek là number)
    if (gradeConfigData?.activities && Array.isArray(gradeConfigData.activities)) {
      for (const activityConfig of gradeConfigData.activities) {
        if (!activityConfig.activityId) continue;
        
        const activity = this.activities.find(a => 
          a._id && a._id.toString() === activityConfig.activityId.toString()
        );
      if (!activity) continue;
      
      // ✅ Kiểm tra hoạt động có áp dụng cho khối này không
      if (activity.grades && !activity.grades.includes(grade)) continue;
      
        // ✅ periodsPerWeek là number trong cấu trúc mới
        const periodsPerWeek = typeof activityConfig.periodsPerWeek === 'number' 
          ? activityConfig.periodsPerWeek 
          : 0;
        if (periodsPerWeek <= 0) continue;
        
        const baseSession = activityConfig.session || 'main';
      const transformedSession = this.transformSessionForGrade(baseSession, grade);
      
        // ✅ Xử lý fixedSlots: format mới là object { dayOfWeek, period } hoặc null
        let fixedSlotsArray = [];
        if (activityConfig.fixedSlots && typeof activityConfig.fixedSlots === 'object' && !Array.isArray(activityConfig.fixedSlots)) {
          // Format mới: { dayOfWeek, period }
          if (activityConfig.fixedSlots.dayOfWeek && typeof activityConfig.fixedSlots.period === 'number') {
            fixedSlotsArray = [{
              day: activityConfig.fixedSlots.dayOfWeek,
              periods: [activityConfig.fixedSlots.period]
            }];
          }
        } else if (Array.isArray(activityConfig.fixedSlots)) {
          // Format cũ: array of { day, periods: [...] }
          fixedSlotsArray = activityConfig.fixedSlots;
        }
      
        items.push({
          name: activity.name,
          type: 'activity',
        periodsPerWeek: periodsPerWeek,
          maxPeriodsPerDay: activityConfig.maxPeriodsPerDay ?? 1,
          allowConsecutive: activityConfig.allowConsecutive ?? false, // ✅ Default false
          session: transformedSession,
          activityId: activity._id.toString(),
          fixedSlots: fixedSlotsArray, // ✅ Convert về array format cho placeFixedActivities
          isPermanent: activityConfig.isPermanent ?? false,
          startDate: activityConfig.startDate || null,
          endDate: activityConfig.endDate || null
        });
      }
    }

    return items;
  }

  // Tìm giáo viên cho môn học (chỉ năm + học kỳ hiện tại)
  findTeacherForSubject(subjectName, classId) {
    const assignment = this.assignments.find(a => 
      a.subjectId && a.subjectId.name === subjectName &&
      a.classId && a.classId._id.toString() === classId &&
      a.year === this.year &&
      a.semester === this.semester
    );

    if (!assignment || !assignment.teacherId) return null; // null = ko gán giáo viên

    return {
      id: assignment.teacherId._id.toString(),
      name: assignment.teacherId.name
    };
  }

  // ✅ Sắp xếp môn học theo độ ưu tiên
  sortSubjectsByPriority(subjects) {
    return subjects.sort((a, b) => {
      // ✅ Ưu tiên 1: Môn học trước hoạt động (quan trọng nhất)
      if (a.type !== b.type) {
        return a.type === 'subject' ? -1 : 1;
      }
      
      // Ưu tiên 2: Môn học nhiều tiết trước
      if (a.periodsPerWeek !== b.periodsPerWeek) {
        return b.periodsPerWeek - a.periodsPerWeek;
      }
      
      // Ưu tiên 3: Toán và Ngữ văn (cho phép liên tiếp) trước
      const prioritySubjects = ['Toán', 'Ngữ văn'];
      const aIsPriority = prioritySubjects.includes(a.name);
      const bIsPriority = prioritySubjects.includes(b.name);
      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;
      
      // Ưu tiên 4: Theo tên (để có thứ tự nhất quán)
      return a.name.localeCompare(b.name);
    });
  }

  // ✅ CSP: Tạo thời khóa biểu cho một lớp sử dụng Constraint Satisfaction Problem
  generateScheduleForClass(classObj) {
    const grade = classObj.grade;
    const mainSession = this.getMainSessionForGrade(grade);
    let subjects = this.getSubjectsForGrade(grade);

    // ✅ Sắp xếp môn học theo độ ưu tiên
    subjects = this.sortSubjectsByPriority(subjects);
    
    // ✅ Cập nhật periodsPerWeek từ classPeriods cho từng item
    subjects = subjects.map(item => {
      const periodsForClass = this.getPeriodsForClass(item, classObj._id);
      if (periodsForClass > 0) {
        return { ...item, periodsPerWeek: periodsForClass };
      }
      return item;
    }).filter(item => item.periodsPerWeek > 0); // Chỉ giữ các môn có số tiết > 0

    // Khởi tạo timetable với các ngày và số tiết
    const timetable = [];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const day of dayNames) {
      // ✅ Hỗ trợ cả Map và Object
      const dayConfig = this.config.days instanceof Map 
        ? this.config.days.get(day) 
        : this.config.days[day];
      if (!dayConfig) continue;

      const totalPeriods = dayConfig.totalPeriods || 7; // fallback nếu config thiếu
      const periods = Array.from({ length: totalPeriods }, (_, idx) => ({
        period: idx + 1, // thêm số tiết
        subject: null,
        teacher: null,
        teacherId: null
      }));

      timetable.push({ day, periods });
    }

    // ✅ Bước 1: Xếp các hoạt động cố định trước
    this.placeFixedActivities(subjects, classObj, timetable);

    // ✅ Bước 2: Sử dụng CSP để xếp các môn học và hoạt động linh hoạt
    const flexibleItems = subjects.filter(item => {
      const hasFixedSlots = item.fixedSlots && (
        (typeof item.fixedSlots === 'object' && !Array.isArray(item.fixedSlots) && item.fixedSlots.dayOfWeek) ||
        (Array.isArray(item.fixedSlots) && item.fixedSlots.length > 0)
      );
      return !hasFixedSlots && !(item.type === 'activity' && item.dayOfWeek);
    });

    // ✅ Track các giáo viên đã được đếm cho lớp này
    const teachersCountedForThisClass = new Set();
    
    for (const item of flexibleItems) {
      if (item.type === 'subject') {
        const teacher = this.findTeacherForSubject(item.name, classObj._id.toString());
        if (teacher && teacher.id) {
          const teacherKey = `${teacher.id}-${classObj._id}`;
          
          if (!teachersCountedForThisClass.has(teacherKey)) {
            if (!this.canTeacherTakeMoreClasses(teacher.id, grade)) {
              console.log(`⚠️ Giáo viên ${teacher.name} đã đạt giới hạn số lớp cho khối ${grade}`);
              continue;
            }
            
            this.incrementTeacherClassCount(teacher.id, grade);
            teachersCountedForThisClass.add(teacherKey);
          }
        }
      }
    }

    // ✅ Sử dụng CSP để xếp lịch
    this.solveCSP(flexibleItems, classObj, timetable, mainSession);

    console.log(`📅 Generating schedule for ${classObj.className} (${grade})`);

    return {
      classId: classObj._id.toString(),
      className: classObj.className,
      year: this.year,
      semester: this.semester,
      timetable
    };
  }

  // ✅ CSP Solver: Sử dụng Backtracking + Heuristic
  solveCSP(items, classObj, timetable, mainSession) {
    const grade = classObj.grade;
    const mainSessionForGrade = this.getMainSessionForGrade(grade);
    
    // ✅ Tạo danh sách biến (variables) - mỗi môn cần xếp số tiết
    const variables = [];
    for (const item of items) {
      let teacher = item.type === 'subject' 
        ? this.findTeacherForSubject(item.name, classObj._id.toString())
        : { id: null, name: 'Hoạt động' };
      
      // ✅ Nếu không có giáo viên cho môn học, vẫn tạo variable (vẫn xếp môn đó vào)
      if (item.type === 'subject' && !teacher) {
        teacher = { id: null, name: 'Chưa phân công' };
      }
      
      variables.push({
        item,
        teacher: teacher || { id: null, name: 'Hoạt động' },
        periodsRemaining: item.periodsPerWeek,
        periodsPlaced: 0,
        placedSlots: [] // [{day, period}]
      });
    }

    // ✅ Backtracking với heuristic
    const success = this.backtrackCSP(variables, classObj, timetable, mainSessionForGrade, 0);
    
    if (!success) {
      console.warn(`⚠️ Không thể xếp đủ tất cả môn cho lớp ${classObj.className}, đã xếp:`, 
        variables.map(v => `${v.item.name}: ${v.periodsPlaced}/${v.item.periodsPerWeek}`).join(', '));
    }
  }

  // ✅ Backtracking algorithm với MRV (Minimum Remaining Values) và LCV (Least Constraining Value)
  backtrackCSP(variables, classObj, timetable, mainSessionForGrade, depth) {
    // ✅ Kiểm tra xem đã xếp hết chưa
    const allPlaced = variables.every(v => v.periodsPlaced >= v.item.periodsPerWeek);
    if (allPlaced) {
      return true; // ✅ Đã xếp xong
    }

    // ✅ MRV: Chọn biến có ít giá trị còn lại nhất (cần xếp nhiều tiết nhất)
    const unassigned = variables.filter(v => v.periodsPlaced < v.item.periodsPerWeek);
    if (unassigned.length === 0) return true;

    // ✅ Sắp xếp theo MRV: môn nào còn nhiều tiết chưa xếp nhất sẽ được ưu tiên
    unassigned.sort((a, b) => {
      const aRemaining = a.item.periodsPerWeek - a.periodsPlaced;
      const bRemaining = b.item.periodsPerWeek - b.periodsPlaced;
      if (aRemaining !== bRemaining) {
        return bRemaining - aRemaining; // Nhiều tiết còn lại hơn → ưu tiên
      }
      // Nếu bằng nhau, ưu tiên môn học trước hoạt động
      if (a.item.type !== b.item.type) {
        return a.item.type === 'subject' ? -1 : 1;
      }
      return 0;
    });

    const currentVar = unassigned[0];
    const { item, teacher } = currentVar;

    // ✅ Lấy danh sách các slot có thể xếp (LCV - Least Constraining Value)
    const availableSlots = this.getAvailableSlots(
      item, 
      teacher, 
      classObj, 
      timetable, 
      mainSessionForGrade,
      currentVar.placedSlots
    );

    // ✅ Sắp xếp slots theo LCV: slot nào ít ràng buộc nhất (ít conflict với các lớp khác)
    availableSlots.sort((a, b) => {
      const aScore = this.getSlotConstraintScore(a, item, teacher, classObj, timetable, currentVar.placedSlots);
      const bScore = this.getSlotConstraintScore(b, item, teacher, classObj, timetable, currentVar.placedSlots);
      return aScore - bScore; // Score thấp hơn = ít ràng buộc hơn → ưu tiên
    });

    // ✅ Thử từng slot theo thứ tự LCV
    for (const slot of availableSlots) {
      // ✅ Kiểm tra ràng buộc trước khi xếp
      if (!this.isValidAssignment(slot, item, teacher, classObj, timetable, currentVar.placedSlots)) {
        continue;
      }

      // ✅ Xếp vào slot này
      const period = timetable[slot.dayIdx].periods[slot.periodIdx];
      period.subject = item.name;
      period.teacher = teacher.name;
      if (teacher.id) {
        period.teacherId = teacher.id;
        if (this.teacherConflictCache) {
          const cacheKey = `${teacher.id}-${slot.day}-${slot.period}`;
          if (!this.teacherConflictCache.has(cacheKey)) {
            this.teacherConflictCache.set(cacheKey, new Set());
          }
          this.teacherConflictCache.get(cacheKey).add(classObj._id.toString());
        }
        this.incrementTeacherWeeklyLessons(teacher.id, 1);
      }

      currentVar.periodsPlaced++;
      currentVar.placedSlots.push({ day: slot.day, period: slot.period });

      // ✅ Recursive backtracking
      if (this.backtrackCSP(variables, classObj, timetable, mainSessionForGrade, depth + 1)) {
        return true; // ✅ Tìm thấy giải pháp
      }

      // ✅ Backtrack: Bỏ xếp và thử slot khác
      period.subject = null;
      period.teacher = null;
      period.teacherId = null;
      if (teacher.id) {
        if (this.teacherConflictCache) {
          const cacheKey = `${teacher.id}-${slot.day}-${slot.period}`;
          const cache = this.teacherConflictCache.get(cacheKey);
          if (cache) {
            cache.delete(classObj._id.toString());
          }
        }
        this.incrementTeacherWeeklyLessons(teacher.id, -1);
      }
      currentVar.periodsPlaced--;
      currentVar.placedSlots.pop();
    }

    return false; // ❌ Không tìm thấy giải pháp
  }

  // ✅ Lấy danh sách các slot có thể xếp cho một môn
  getAvailableSlots(item, teacher, classObj, timetable, mainSessionForGrade, placedSlots) {
    const slots = [];
    const grade = classObj.grade;
    const isMainSubject = item.session === 'main' || item.session === 'morning' || item.session === 'afternoon';
    const isExtraSubject = item.session === 'extra';

    // ✅ Xác định buổi chính và buổi phụ
    let targetPeriodRange = null;
    if (isMainSubject) {
      if (mainSessionForGrade === 'morning') {
        targetPeriodRange = { start: 1, end: 5 };
      } else if (mainSessionForGrade === 'afternoon') {
        targetPeriodRange = { start: 6, end: 10 };
      } else if (mainSessionForGrade === 'both') {
        targetPeriodRange = { start: 1, end: 10 };
      }
    } else if (isExtraSubject) {
      if (mainSessionForGrade === 'morning') {
        targetPeriodRange = { start: 6, end: 10 };
      } else if (mainSessionForGrade === 'afternoon') {
        targetPeriodRange = { start: 1, end: 5 };
      } else if (mainSessionForGrade === 'both') {
        targetPeriodRange = { start: 6, end: 10 };
      }
    }

    // ✅ Tính số tiết mỗi ngày để phân bổ đều (không thiên vị thứ đầu)
    const validDays = timetable.filter((dayEntry, idx) => {
      const dayConfig = this.config.days instanceof Map 
        ? this.config.days.get(dayEntry.day) 
        : this.config.days[dayEntry.day];
      return dayConfig && dayConfig.totalPeriods > 0;
    });

    const periodsPerDay = this.calculatePeriodsPerDay(item.periodsPerWeek, validDays.length);
    const dayPeriodsMap = new Map();
    validDays.forEach((dayEntry, idx) => {
      dayPeriodsMap.set(dayEntry.day, periodsPerDay[idx] || 0);
    });

    // ✅ Đếm số tiết đã xếp mỗi ngày
    const periodsPlacedPerDay = new Map();
    placedSlots.forEach(slot => {
      const count = periodsPlacedPerDay.get(slot.day) || 0;
      periodsPlacedPerDay.set(slot.day, count + 1);
    });

    // ✅ Nếu cho phép liên tiếp, ưu tiên tìm slot liên tiếp với slot đã xếp
    const consecutiveSlots = [];
    const otherSlots = [];

    // ✅ Tạo danh sách slot có thể xếp
    for (let dayIdx = 0; dayIdx < timetable.length; dayIdx++) {
      const dayEntry = timetable[dayIdx];
      const dayConfig = this.config.days instanceof Map 
        ? this.config.days.get(dayEntry.day) 
        : this.config.days[dayEntry.day];
      if (!dayConfig) continue;

      const periodsToPlaceToday = dayPeriodsMap.get(dayEntry.day) || 0;
      const alreadyPlacedToday = periodsPlacedPerDay.get(dayEntry.day) || 0;

      // ✅ Kiểm tra maxPeriodsPerDay/buổi
      const morningCount = dayConfig.morningPeriods || 0;
      const periodsInMainSession = placedSlots.filter(s => {
        if (s.day !== dayEntry.day) return false;
        const slotPeriod = s.period;
        if (mainSessionForGrade === 'morning') {
          return slotPeriod <= morningCount;
        } else if (mainSessionForGrade === 'afternoon') {
          return slotPeriod > morningCount;
        }
        return true;
      }).length;

      // ✅ Chỉ xét các slot trong targetPeriodRange
      if (targetPeriodRange) {
        for (let periodIdx = targetPeriodRange.start - 1; periodIdx < Math.min(targetPeriodRange.end, dayEntry.periods.length); periodIdx++) {
          const period = dayEntry.periods[periodIdx];
          if (period.subject) continue; // Đã có môn học

          const periodKey = `${dayEntry.day}-${periodIdx + 1}`;
          if (this.fixedPeriods.has(periodKey)) continue; // Đã cố định

          // ✅ Kiểm tra maxPeriodsPerDay
          if (alreadyPlacedToday >= periodsToPlaceToday) continue;
          if (alreadyPlacedToday >= (item.maxPeriodsPerDay || 2)) continue;

          // ✅ Kiểm tra maxPeriodsPerDay/buổi
          const isInMainSession = mainSessionForGrade === 'morning' 
            ? periodIdx < morningCount 
            : mainSessionForGrade === 'afternoon' 
            ? periodIdx >= morningCount 
            : true;
          
          if (isInMainSession && periodsInMainSession >= (item.maxPeriodsPerDay || 2)) {
            continue;
          }

          const slot = {
            day: dayEntry.day,
            period: periodIdx + 1,
            dayIdx,
            periodIdx
          };

          // ✅ Nếu cho phép liên tiếp và đã có slot đã xếp, kiểm tra xem có liên tiếp không
          if (item.allowConsecutive && placedSlots.length > 0) {
            const isConsecutive = placedSlots.some(placed => {
              if (placed.day !== dayEntry.day) return false;
              return Math.abs(placed.period - (periodIdx + 1)) === 1;
            });
            if (isConsecutive) {
              consecutiveSlots.push(slot);
              continue;
            }
          }

          otherSlots.push(slot);
        }
      }
    }

    // ✅ Ưu tiên slot liên tiếp nếu cho phép, sau đó là các slot khác
    // ✅ Shuffle để không thiên vị thứ đầu tuần
    const shuffledConsecutive = this.shuffleArray([...consecutiveSlots]);
    const shuffledOther = this.shuffleArray([...otherSlots]);
    
    return [...shuffledConsecutive, ...shuffledOther];
  }

  // ✅ Shuffle array để không thiên vị (Fisher-Yates shuffle)
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // ✅ Tính điểm ràng buộc của một slot (LCV heuristic)
  getSlotConstraintScore(slot, item, teacher, classObj, timetable, placedSlots = []) {
    let score = 0;
    const grade = classObj.grade;

    // ✅ Nếu có giáo viên, check trùng giáo viên với các lớp khác
    if (teacher.id) {
      if (!this.isTeacherAvailable(teacher.id, slot.day, slot.period, grade, classObj._id.toString())) {
        score += 1000; // Rất nhiều ràng buộc
      }
      if (!this.canTeacherTakeMoreLessons(teacher.id, 1)) {
        score += 500;
      }
    } else {
      // ✅ Nếu không có giáo viên, check trùng môn với các lớp khác (nhưng vẫn cho phép xếp)
      const conflictCount = this.countSubjectConflict(slot.day, slot.period, item.name, classObj._id.toString());
      score += conflictCount * 50; // Giảm penalty để vẫn có thể xếp
    }

    // ✅ Kiểm tra liên tiếp (nếu không cho phép)
    if (item.type === 'subject' && !item.allowConsecutive) {
      const dayEntry = timetable[slot.dayIdx];
      const hasConsecutive = this.hasConsecutivePeriod(dayEntry, item.name, slot.periodIdx);
      if (hasConsecutive) {
        score += 200;
      }
    }

    // ✅ Nếu cho phép liên tiếp, ưu tiên slot liên tiếp (giảm score)
    if (item.type === 'subject' && item.allowConsecutive && placedSlots.length > 0) {
      const isConsecutive = placedSlots.some(placed => {
        if (placed.day !== slot.day) return false;
        return Math.abs(placed.period - slot.period) === 1;
      });
      if (isConsecutive) {
        score -= 50; // Ưu tiên slot liên tiếp
      }
    }

    // ✅ Ưu tiên phân bổ đều: slot ở ngày có ít môn hơn sẽ có điểm thấp hơn
    const dayEntry = timetable[slot.dayIdx];
    const periodsInDay = dayEntry.periods.filter(p => p.subject).length;
    score += periodsInDay * 10; // Ngày có ít môn hơn → score thấp hơn

    // ✅ Không thiên vị thứ đầu: thêm random factor nhỏ để đảm bảo phân bổ đều
    const dayIndex = this.getDayIndex(slot.day);
    score += dayIndex * 0.1; // Thứ đầu có điểm thấp hơn một chút, nhưng không quá nhiều

    return score;
  }

  // ✅ Kiểm tra xem assignment có hợp lệ không
  isValidAssignment(slot, item, teacher, classObj, timetable, placedSlots) {
    const grade = classObj.grade;
    const period = timetable[slot.dayIdx].periods[slot.periodIdx];

    // ✅ Đã có môn học
    if (period.subject) return false;

    // ✅ Kiểm tra fixed periods
    const periodKey = `${slot.day}-${slot.period}`;
    if (this.fixedPeriods.has(periodKey)) return false;

    // ✅ Nếu có giáo viên, check trùng giáo viên
    if (teacher.id) {
      if (!this.isTeacherAvailable(teacher.id, slot.day, slot.period, grade, classObj._id.toString())) {
        return false;
      }
      if (!this.canTeacherTakeMoreLessons(teacher.id, 1)) {
        return false;
      }
    } else {
      // ✅ Nếu không có giáo viên, vẫn xếp môn đó vào và check trùng môn với các lớp khác
      // (Không block, chỉ cảnh báo trong score)
    }

    // ✅ Kiểm tra liên tiếp (nếu không cho phép)
    if (item.type === 'subject' && !item.allowConsecutive) {
      const dayEntry = timetable[slot.dayIdx];
      if (this.hasConsecutivePeriod(dayEntry, item.name, slot.periodIdx)) {
        return false;
      }
    }

    // ✅ Kiểm tra maxPeriodsPerDay
    const periodsInDay = placedSlots.filter(s => s.day === slot.day).length;
    if (periodsInDay >= (item.maxPeriodsPerDay || 2)) {
      return false;
    }

    // ✅ Kiểm tra maxPeriodsPerDay/buổi
    const dayEntry = timetable[slot.dayIdx];
    const dayConfig = this.config.days instanceof Map 
      ? this.config.days.get(slot.day) 
      : this.config.days[slot.day];
    if (dayConfig) {
      const morningCount = dayConfig.morningPeriods || 0;
      const mainSessionForGrade = this.getMainSessionForGrade(grade);
      
      const isInMainSession = mainSessionForGrade === 'morning' 
        ? slot.periodIdx < morningCount 
        : mainSessionForGrade === 'afternoon' 
        ? slot.periodIdx >= morningCount 
        : true;
      
      if (isInMainSession) {
        const periodsInMainSession = placedSlots.filter(s => {
          if (s.day !== slot.day) return false;
          const sPeriod = s.period - 1; // Convert to 0-based
          if (mainSessionForGrade === 'morning') {
            return sPeriod < morningCount;
          } else if (mainSessionForGrade === 'afternoon') {
            return sPeriod >= morningCount;
          }
          return true;
        }).length;
        
        if (periodsInMainSession >= (item.maxPeriodsPerDay || 2)) {
          return false;
        }
      }
    }

    return true;
  }

  // ✅ Kiểm tra xem có period liên tiếp không
  hasConsecutivePeriod(dayEntry, subjectName, periodIdx) {
    if (periodIdx > 0) {
      const prevPeriod = dayEntry.periods[periodIdx - 1];
      if (prevPeriod.subject === subjectName) return true;
    }
    if (periodIdx < dayEntry.periods.length - 1) {
      const nextPeriod = dayEntry.periods[periodIdx + 1];
      if (nextPeriod.subject === subjectName) return true;
    }
    return false;
  }

  // ✅ Kiểm tra xem có period kề bên không (để xếp liên tiếp)
  hasAdjacentPeriod(dayEntry, subjectName, periodIdx) {
    return this.hasConsecutivePeriod(dayEntry, subjectName, periodIdx);
  }

  // ✅ Đếm số conflict môn học với các lớp khác
  countSubjectConflict(day, period, subjectName, currentClassId) {
    let count = 0;
    for (const schedule of this.schedules) {
      if (schedule.classId === currentClassId) continue;
      for (const dayEntry of schedule.timetable) {
        if (dayEntry.day === day) {
          const periodIndex = period - 1;
          const conflict = dayEntry.periods[periodIndex];
          if (conflict && conflict.subject === subjectName) {
            count++;
          }
        }
      }
    }
    return count;
  }

  // ✅ Kiểm tra xem có conflict môn học với các lớp khác không
  hasSubjectConflict(day, period, subjectName, currentClassId) {
    // ✅ Cố gắng làm cho các lớp có thời khóa biểu khác nhau
    // Nhưng không block hoàn toàn, chỉ ưu tiên tránh (được xử lý trong score)
    // Cho phép xếp nếu cần thiết để đảm bảo tất cả môn đều được xếp
    return false; // Không block, chỉ ảnh hưởng đến score
  }
  // ✅ Cập nhật logic để xử lý session đã transform (morning/afternoon/main)
  isMainSession(dayName, gradeSession, periodIndex, dayConfig, itemSession) {
  const morningCount = dayConfig.morningPeriods || 0;
  const total = dayConfig.totalPeriods || 7;
    
    // ✅ Nếu itemSession đã được transform thành "morning" hoặc "afternoon"
    if (itemSession === 'morning') {
      return periodIndex < morningCount; // Chỉ sáng
    }
    if (itemSession === 'afternoon') {
      return periodIndex >= morningCount; // Chỉ chiều
    }
    
    // ✅ Xử lý "main" và "extra" như cũ (backward compatibility)
  if (gradeSession === 'morning') {
    // Chỉ sáng
    if (itemSession === 'main') return periodIndex < morningCount;
    if (itemSession === 'extra') return periodIndex >= morningCount;
  }
  
  if (gradeSession === 'both') {
    // Cả ngày → main có thể cả sáng chiều
    if (itemSession === 'main') return true;
    if (itemSession === 'extra') return periodIndex >= morningCount; // phụ xếp chiều
  }
    
  if (gradeSession === 'afternoon') {
    // Chỉ chiều
    if (itemSession === 'main') return periodIndex >= morningCount;
    if (itemSession === 'extra') return periodIndex < morningCount;
  }
    
  return false;
}

  // ✅ Tính số tiết mỗi ngày để phân bổ đều (không thiên vị thứ đầu)
  calculatePeriodsPerDay(totalPeriods, totalDays) {
    const basePeriods = Math.floor(totalPeriods / totalDays);
    const extraPeriods = totalPeriods % totalDays;
    const distribution = Array(totalDays).fill(basePeriods);
    
    // ✅ Phân bổ số tiết dư một cách đều đặn (round-robin) để không thiên vị thứ đầu
    // Thay vì chỉ phân vào các thứ đầu, phân đều vào tất cả các thứ
    if (extraPeriods > 0) {
      // ✅ Sử dụng round-robin: phân đều vào các thứ
      const step = Math.max(1, Math.floor(totalDays / extraPeriods));
      for (let i = 0; i < extraPeriods; i++) {
        const idx = (i * step) % totalDays;
        distribution[idx]++;
      }
    }
    
    return distribution;
}

  // Xếp một môn học hoặc hoạt động vào thời khóa biểu
  placeItemInSchedule(item, classObj, timetable, mainSession) {
    let teacher = null;

    // Tìm giáo viên cho môn học
    if (item.type === 'subject') {
      teacher = this.findTeacherForSubject(item.name, classObj._id.toString());
      if (!teacher) {
        console.log(`⚠️ Không tìm thấy giáo viên cho môn ${item.name} lớp ${classObj.className}`);
        return;
      }
    } else {
      // Hoạt động không cần giáo viên
      teacher = { id: null, name: 'Hoạt động' };
    }

    // ✅ Tính số tiết mỗi ngày để phân bổ đều (ưu tiên các thứ đầu)
    const validDays = timetable.filter(dayEntry => {
      const dayConfig = this.config.days instanceof Map 
        ? this.config.days.get(dayEntry.day) 
        : this.config.days[dayEntry.day];
      return dayConfig && dayConfig.totalPeriods > 0;
    });
    
    const periodsPerDay = this.calculatePeriodsPerDay(item.periodsPerWeek, validDays.length);
    const dayPeriodsMap = new Map(); // Map<dayIndex, periodsToPlace>
    validDays.forEach((dayEntry, idx) => {
      dayPeriodsMap.set(dayEntry.day, periodsPerDay[idx] || 0);
    });

    let periodsPlaced = 0;
    const grade = classObj.grade;
    const mainSessionForGrade = this.getMainSessionForGrade(grade);

    console.log(`⏰ Bắt đầu xếp ${item.name} (${item.type}) cho lớp ${classObj.className} - ${item.periodsPerWeek} tiết/tuần`);

    // ✅ Xếp môn học chính vào buổi chính, môn học phụ vào buổi trái
    const isMainSubject = item.session === 'main' || item.session === 'morning' || item.session === 'afternoon';
    const isExtraSubject = item.session === 'extra';
    
    // ✅ Xác định buổi chính và buổi phụ dựa trên gradeSessionRules
    let targetPeriodRange = null; // { start: 1, end: 5 } cho sáng hoặc { start: 6, end: 10 } cho chiều
    let oppositePeriodRange = null; // Buổi trái (nếu cần)
    
    if (isMainSubject) {
      // Môn học chính: xếp vào buổi chính
      if (mainSessionForGrade === 'morning') {
        targetPeriodRange = { start: 1, end: 5 }; // Sáng: tiết 1-5
        oppositePeriodRange = { start: 6, end: 10 }; // Chiều: tiết 6-10 (buổi trái)
      } else if (mainSessionForGrade === 'afternoon') {
        targetPeriodRange = { start: 6, end: 10 }; // Chiều: tiết 6-10
        oppositePeriodRange = { start: 1, end: 5 }; // Sáng: tiết 1-5 (buổi trái)
      } else if (mainSessionForGrade === 'both') {
        // Cả ngày: ưu tiên sáng trước
        targetPeriodRange = { start: 1, end: 10 }; // Cả ngày
        oppositePeriodRange = null;
      }
    } else if (isExtraSubject) {
      // Môn học phụ: xếp vào buổi trái
      if (mainSessionForGrade === 'morning') {
        targetPeriodRange = { start: 6, end: 10 }; // Chiều (buổi trái)
        oppositePeriodRange = { start: 1, end: 5 }; // Sáng (buổi chính)
      } else if (mainSessionForGrade === 'afternoon') {
        targetPeriodRange = { start: 1, end: 5 }; // Sáng (buổi trái)
        oppositePeriodRange = { start: 6, end: 10 }; // Chiều (buổi chính)
      } else if (mainSessionForGrade === 'both') {
        // Cả ngày: phụ xếp vào chiều
        targetPeriodRange = { start: 6, end: 10 }; // Chiều
        oppositePeriodRange = { start: 1, end: 5 }; // Sáng
      }
    }

    // ✅ Xếp vào các ngày theo thứ tự (ưu tiên các thứ đầu)
    for (let dayIdx = 0; dayIdx < validDays.length; dayIdx++) {
      const dayEntry = validDays[dayIdx];
      const periodsToPlaceToday = dayPeriodsMap.get(dayEntry.day) || 0;
      
      if (periodsPlaced >= item.periodsPerWeek) break;
      if (periodsToPlaceToday <= 0) continue;

      // ✅ Hỗ trợ cả Map và Object
      const dayConfig = this.config.days instanceof Map 
        ? this.config.days.get(dayEntry.day) 
        : this.config.days[dayEntry.day];
      if (!dayConfig) continue;

      let periodsInDay = 0; // Số tiết đã xếp trong ngày
      
      // ✅ Xếp vào buổi chính trước (nếu có targetPeriodRange)
      if (targetPeriodRange) {
        for (let i = targetPeriodRange.start - 1; i < Math.min(targetPeriodRange.end, dayEntry.periods.length); i++) {
        if (periodsPlaced >= item.periodsPerWeek) break;
          if (periodsInDay >= periodsToPlaceToday) break;
        if (periodsInDay >= (item.maxPeriodsPerDay || 2)) break;

        const periodKey = `${dayEntry.day}-${i + 1}`;
        const period = dayEntry.periods[i];

        if (period.subject || this.fixedPeriods.has(periodKey)) continue;

          // ✅ Kiểm tra giáo viên (đã bao gồm check trùng với các lớp khác)
        if (item.type === 'subject' && teacher.id) {
            if (!this.isTeacherAvailable(teacher.id, dayEntry.day, i + 1, classObj.grade, classObj._id.toString())) {
              continue;
            }
          if (!this.canTeacherTakeMoreLessons(teacher.id, 1)) {
              continue;
          }
        }

        // Kiểm tra liên tiếp
        if (item.type === 'subject' && !item.allowConsecutive) {
          const last = this.findLastPlacedPeriod(dayEntry, item.name);
          if (last !== -1 && Math.abs(i - last) === 1) continue;
        }

        // ✅ Xếp tiết
        period.subject = item.name;
        period.teacher = teacher.name;
          
          if (item.type === 'subject' && teacher.id) {
            period.teacherId = teacher.id;
            if (this.teacherConflictCache) {
              const cacheKey = `${teacher.id}-${dayEntry.day}-${i + 1}`;
              if (!this.teacherConflictCache.has(cacheKey)) {
                this.teacherConflictCache.set(cacheKey, new Set());
              }
              this.teacherConflictCache.get(cacheKey).add(classObj._id.toString());
            }
            this.incrementTeacherWeeklyLessons(teacher.id, 1);
          }
          
        periodsPlaced++;
        periodsInDay++;
          console.log(`✅ Xếp ${item.name} vào ${dayEntry.day} tiết ${i + 1} (buổi chính)`);
        }
      }
      
      // ✅ Nếu chưa đủ, thử xếp vào buổi trái (oppositePeriodRange)
      if (oppositePeriodRange && periodsPlaced < item.periodsPerWeek && periodsInDay < periodsToPlaceToday) {
        for (let i = oppositePeriodRange.start - 1; i < Math.min(oppositePeriodRange.end, dayEntry.periods.length); i++) {
          if (periodsPlaced >= item.periodsPerWeek) break;
          if (periodsInDay >= periodsToPlaceToday) break;
          if (periodsInDay >= (item.maxPeriodsPerDay || 2)) break;

          const periodKey = `${dayEntry.day}-${i + 1}`;
          const period = dayEntry.periods[i];

          if (period.subject || this.fixedPeriods.has(periodKey)) continue;

        if (item.type === 'subject' && teacher.id) {
            if (!this.isTeacherAvailable(teacher.id, dayEntry.day, i + 1, classObj.grade, classObj._id.toString())) {
              continue;
            }
            if (!this.canTeacherTakeMoreLessons(teacher.id, 1)) {
              continue;
            }
          }

          if (item.type === 'subject' && !item.allowConsecutive) {
            const last = this.findLastPlacedPeriod(dayEntry, item.name);
            if (last !== -1 && Math.abs(i - last) === 1) continue;
          }

          period.subject = item.name;
          period.teacher = teacher.name;
          
          if (item.type === 'subject' && teacher.id) {
            period.teacherId = teacher.id;
            if (this.teacherConflictCache) {
              const cacheKey = `${teacher.id}-${dayEntry.day}-${i + 1}`;
              if (!this.teacherConflictCache.has(cacheKey)) {
                this.teacherConflictCache.set(cacheKey, new Set());
              }
              this.teacherConflictCache.get(cacheKey).add(classObj._id.toString());
            }
          this.incrementTeacherWeeklyLessons(teacher.id, 1);
        }

          periodsPlaced++;
          periodsInDay++;
          console.log(`✅ Xếp ${item.name} vào ${dayEntry.day} tiết ${i + 1} (buổi trái)`);
        }
      }
    }

    if (periodsPlaced < item.periodsPerWeek) {
      const missing = item.periodsPerWeek - periodsPlaced;
      console.log(`⚠️ Chưa xếp đủ ${item.periodsPerWeek} tiết cho ${item.name}. Đã xếp: ${periodsPlaced}, thiếu: ${missing}`);
      
      // ✅ Retry logic: Thử xếp vào buổi phụ nếu chưa đủ
      if (item.type === 'subject' && missing > 0) {
        this.retryPlaceInExtraSession(item, classObj, timetable, mainSession, missing);
      }
    }
  }
  
  // ✅ Retry logic: Thử xếp vào buổi phụ (extra session) nếu buổi chính không đủ chỗ
  retryPlaceInExtraSession(item, classObj, timetable, mainSession, missingPeriods) {
    console.log(`🔄 Thử xếp ${missingPeriods} tiết còn lại của ${item.name} vào buổi phụ...`);
    
    let teacher = null;
    if (item.type === 'subject') {
      teacher = this.findTeacherForSubject(item.name, classObj._id.toString());
      if (!teacher) return;
    } else {
      teacher = { id: null, name: 'Hoạt động' };
    }
    
    let periodsPlaced = 0;
    
    for (const dayEntry of timetable) {
      if (periodsPlaced >= missingPeriods) break;
      
      const dayConfig = this.config.days instanceof Map 
        ? this.config.days.get(dayEntry.day) 
        : this.config.days[dayEntry.day];
      if (!dayConfig) continue;
      
      const morningCount = dayConfig.morningPeriods || 0;
      
      // ✅ Chỉ xếp vào buổi chiều (sau morningCount)
      for (let i = morningCount; i < dayEntry.periods.length; i++) {
        if (periodsPlaced >= missingPeriods) break;
        
        const period = dayEntry.periods[i];
        if (period.subject) continue; // Đã có môn học
        
        // ✅ Kiểm tra giáo viên (đã bao gồm check trùng với các lớp khác)
        if (item.type === 'subject' && teacher.id) {
          // ✅ isTeacherAvailable đã check cả lịch rảnh và trùng với các lớp khác
          if (!this.isTeacherAvailable(teacher.id, dayEntry.day, i + 1, classObj.grade, classObj._id.toString())) {
            continue;
          }
          if (!this.canTeacherTakeMoreLessons(teacher.id, 1)) {
            continue;
          }
        }
        
        // ✅ Xếp tiết
        period.subject = item.name;
        period.teacher = teacher.name;
        
        // ✅ Lưu teacher ID vào period để check trùng sau này
        if (item.type === 'subject' && teacher.id) {
          period.teacherId = teacher.id; // Lưu ID để check trùng
          
          // ✅ Cập nhật cache conflict
          if (this.teacherConflictCache) {
            const cacheKey = `${teacher.id}-${dayEntry.day}-${i + 1}`;
            if (!this.teacherConflictCache.has(cacheKey)) {
              this.teacherConflictCache.set(cacheKey, new Set());
            }
            this.teacherConflictCache.get(cacheKey).add(classObj._id.toString());
          }
        }
        
        periodsPlaced++;
        
        if (item.type === 'subject' && teacher.id) {
          this.incrementTeacherWeeklyLessons(teacher.id, 1);
        }
        
        console.log(`✅ Xếp ${item.name} vào buổi phụ: ${dayEntry.day} tiết ${i + 1}`);
      }
    }
    
    if (periodsPlaced < missingPeriods) {
      console.log(`❌ Vẫn còn thiếu ${missingPeriods - periodsPlaced} tiết cho ${item.name} sau khi thử buổi phụ`);
    }
  }

  // ✅ Kiểm tra sự trùng lặp giáo viên với các lớp khác (tối ưu với cache)
  isTeacherAssignedToOtherClasses(teacherId, day, period, currentClassId) {
    // ✅ Sử dụng cache để tối ưu
    const cacheKey = `${teacherId}-${day}-${period}`;
    if (this.teacherConflictCache && this.teacherConflictCache.has(cacheKey)) {
      const assignedClasses = this.teacherConflictCache.get(cacheKey);
      if (assignedClasses.has(currentClassId)) {
        // Nếu lớp hiện tại đã có trong cache, không có xung đột
        return false;
      }
      // Nếu có lớp khác đã được gán, có xung đột
      return assignedClasses.size > 0;
    }
    
    // ✅ Nếu chưa có cache, tìm kiếm và cache kết quả
    const assignedClasses = new Set();
    for (const schedule of this.schedules) {
      if (schedule.classId === currentClassId) continue; // Bỏ qua lớp hiện tại

      for (const dayEntry of schedule.timetable) {
        if (dayEntry.day === day) {
          const periodIndex = period - 1; // Chuyển đổi sang index 0-based
          const conflict = dayEntry.periods[periodIndex];

          if (conflict && conflict.teacher === teacherId) {
            assignedClasses.add(schedule.classId);
          }
        }
      }
    }
    
    // ✅ Cache kết quả
    if (this.teacherConflictCache) {
      this.teacherConflictCache.set(cacheKey, assignedClasses);
    }
    
    return assignedClasses.size > 0; // Có xung đột nếu có lớp khác đã được gán
  }

  // ✅ Helper: Parse timeSlot để lấy số tiết (hỗ trợ "Tiết 1", "07:00 - 07:45", "1")
  parseTimeSlotToPeriod(timeSlot) {
    if (!timeSlot) return null;
    
    // Thử parse "Tiết X" hoặc "X"
    const match = timeSlot.match(/tiết\s*(\d+)|^(\d+)$/i);
    if (match) {
      return parseInt(match[1] || match[2], 10) - 1; // Convert to 0-based index
    }
    
    // Nếu là khung giờ (ví dụ: "07:00 - 07:45"), ước tính tiết dựa vào giờ
    const timeMatch = timeSlot.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1], 10);
      const minute = parseInt(timeMatch[2], 10);
      // Ước tính: 07:00 = Tiết 1, 07:45 = Tiết 2, 08:30 = Tiết 3, ...
      // Giả sử mỗi tiết 45 phút, bắt đầu từ 07:00
      if (hour >= 7) {
        const totalMinutes = (hour - 7) * 60 + minute;
        return Math.floor(totalMinutes / 45); // Mỗi tiết 45 phút
      }
    }
    
    return null; // Không parse được
  }

  // ✅ Helper: Kiểm tra activity có áp dụng trong khoảng thời gian hiện tại không
  isActivityActive(activity, currentDate = new Date()) {
    // Nếu là hoạt động vĩnh viễn, luôn active
    if (activity.isPermanent) return true;
    
    // Nếu không có startDate và endDate, mặc định là active
    if (!activity.startDate && !activity.endDate) return true;
    
    const startDate = activity.startDate ? new Date(activity.startDate) : null;
    const endDate = activity.endDate ? new Date(activity.endDate) : null;
    
    // Kiểm tra currentDate có trong khoảng [startDate, endDate] không
    if (startDate && currentDate < startDate) return false;
    if (endDate && currentDate > endDate) return false;
    
    return true;
  }

  // ✅ Xếp tất cả môn học và hoạt động cố định trước (bao gồm fixedSlots, dayOfWeek + timeSlot)
  placeFixedActivities(subjects, classObj, timetable) {
    const currentDate = new Date(); // ✅ Có thể nhận từ year/semester để tính chính xác hơn
    
    // ✅ Bước 1: Kiểm tra conflict giữa các fixedSlots trước khi xếp
    const fixedSlotsMap = new Map(); // Map<"day-period", itemName>
    const conflicts = [];
    
    for (const item of subjects) {
      // ✅ Xử lý fixedSlots cho cả subjects và activities
      if (item.fixedSlots) {
        // Format mới: object { dayOfWeek, periods: [1, 2] } cho subjects hoặc { dayOfWeek, period: 1 } cho activities
        if (typeof item.fixedSlots === 'object' && !Array.isArray(item.fixedSlots)) {
          const dayOfWeek = item.fixedSlots.dayOfWeek;
          const periods = item.fixedSlots.periods || (item.fixedSlots.period ? [item.fixedSlots.period] : []);
          
          if (dayOfWeek && Array.isArray(periods) && periods.length > 0) {
            for (const periodNum of periods) {
              const slotKey = `${dayOfWeek}-${periodNum}`;
              
              // Kiểm tra conflict
              if (fixedSlotsMap.has(slotKey)) {
                const conflictingItem = fixedSlotsMap.get(slotKey);
                conflicts.push({
                  day: dayOfWeek,
                  period: periodNum,
                  item1: conflictingItem,
                  item2: item.name
                });
              } else {
                fixedSlotsMap.set(slotKey, item.name);
              }
            }
          }
        } else if (Array.isArray(item.fixedSlots) && item.fixedSlots.length > 0) {
          // Format cũ: array of { day, periods: [...] }
          for (const fixedSlot of item.fixedSlots) {
            for (const periodNum of fixedSlot.periods) {
              const slotKey = `${fixedSlot.day}-${periodNum}`;
              
              // Kiểm tra conflict
              if (fixedSlotsMap.has(slotKey)) {
                const conflictingItem = fixedSlotsMap.get(slotKey);
                conflicts.push({
                  day: fixedSlot.day,
                  period: periodNum,
                  item1: conflictingItem,
                  item2: item.name
                });
              } else {
                fixedSlotsMap.set(slotKey, item.name);
              }
            }
          }
        }
      }
    }
    
    // ✅ Báo lỗi nếu có conflict
    if (conflicts.length > 0) {
      console.error('❌ CONFLICT FIXED SLOTS:');
      for (const conflict of conflicts) {
        console.error(`  - ${conflict.day} tiết ${conflict.period}: "${conflict.item1}" và "${conflict.item2}" trùng nhau`);
      }
      // Vẫn tiếp tục nhưng sẽ bỏ qua các slot conflict
    }
    
    // ✅ Bước 2: Xếp các môn học và hoạt động có fixedSlots vào timetable
    for (const item of subjects) {
      // ✅ Xử lý fixedSlots cho subjects (format mới: { dayOfWeek, periods: [1, 2] })
      if (item.fixedSlots && typeof item.fixedSlots === 'object' && !Array.isArray(item.fixedSlots)) {
        const dayOfWeek = item.fixedSlots.dayOfWeek;
        const periods = item.fixedSlots.periods || [];
        
        if (dayOfWeek && Array.isArray(periods) && periods.length > 0) {
          const dayEntry = timetable.find(t => t.day === dayOfWeek);
          if (!dayEntry) continue;
          
          // Tìm giáo viên cho môn học
          let teacher = null;
          if (item.type === 'subject') {
            teacher = this.findTeacherForSubject(item.name, classObj._id.toString());
            if (!teacher) {
              console.log(`⚠️ Không tìm thấy giáo viên cho môn ${item.name} lớp ${classObj.className}, bỏ qua fixedSlots`);
              continue;
            }
          } else {
            teacher = { id: null, name: 'Hoạt động' };
          }
          
          // Xếp vào các tiết đã chỉ định
          for (const periodNum of periods) {
            const periodIndex = periodNum - 1; // Convert to 0-based
            if (periodIndex >= 0 && periodIndex < dayEntry.periods.length) {
              const period = dayEntry.periods[periodIndex];
              const slotKey = `${dayOfWeek}-${periodNum}`;
              
              // ✅ Kiểm tra conflict: nếu slot đã có item khác, bỏ qua
              const existingItem = fixedSlotsMap.get(slotKey);
              if (existingItem && existingItem !== item.name) {
                console.warn(`⚠️ Bỏ qua slot ${slotKey}: "${item.name}" conflict với "${existingItem}"`);
                continue;
              }
              
              // ✅ Kiểm tra giáo viên có rảnh và không trùng với các lớp khác (chỉ cho subjects)
              if (item.type === 'subject' && teacher.id) {
                if (!this.isTeacherAvailable(teacher.id, dayOfWeek, periodNum, classObj.grade, classObj._id.toString())) {
                  console.warn(`⚠️ Giáo viên ${teacher.name} không rảnh hoặc đã dạy lớp khác ở ${dayOfWeek} tiết ${periodNum}, bỏ qua fixedSlots`);
                  continue;
                }
              }
              
              if (!period.subject) {
                period.subject = item.name;
                period.teacher = teacher.name;
                
                // ✅ Lưu teacher ID vào period để check trùng sau này
                if (item.type === 'subject' && teacher.id) {
                  period.teacherId = teacher.id; // Lưu ID để check trùng
                }
                
                this.fixedPeriods.set(slotKey, {
                  subject: item.name,
                  teacher: teacher.name,
                  teacherId: teacher.id || null,
                  type: item.type,
                  source: 'fixedSlots'
                });
                
                // ✅ Cập nhật cache conflict nếu có
                if (item.type === 'subject' && teacher.id && this.teacherConflictCache) {
                  const cacheKey = `${teacher.id}-${dayOfWeek}-${periodNum}`;
                  if (!this.teacherConflictCache.has(cacheKey)) {
                    this.teacherConflictCache.set(cacheKey, new Set());
                  }
                  this.teacherConflictCache.get(cacheKey).add(classObj._id.toString());
                }
                
                // ✅ Cập nhật tracking: Tăng số tiết/tuần của giáo viên
                if (item.type === 'subject' && teacher.id) {
                  this.incrementTeacherWeeklyLessons(teacher.id, 1);
                }
              } else if (period.subject !== item.name) {
                // Slot đã bị chiếm bởi item khác
                console.warn(`⚠️ Slot ${slotKey} đã bị chiếm bởi "${period.subject}", không thể xếp "${item.name}"`);
              }
            }
          }
          continue; // Đã xử lý fixedSlots, bỏ qua dayOfWeek + timeSlot
        }
      }
      
      // ✅ Xử lý fixedSlots cho activities (format cũ: array)
      if (item.type === 'activity') {
      // ✅ Kiểm tra activity có active không (dựa vào isPermanent, startDate, endDate)
      if (!this.isActivityActive(item, currentDate)) {
        console.log(`⏭️ Bỏ qua hoạt động ${item.name} (không trong khoảng thời gian áp dụng)`);
        continue;
      }
      
        // ✅ Xử lý fixedSlots trước (ưu tiên cao nhất) - format cũ
      if (item.fixedSlots && Array.isArray(item.fixedSlots) && item.fixedSlots.length > 0) {
        for (const fixedSlot of item.fixedSlots) {
          const dayEntry = timetable.find(t => t.day === fixedSlot.day);
          if (!dayEntry) continue;
          
          // Xếp vào các tiết đã chỉ định
          for (const periodNum of fixedSlot.periods) {
            const periodIndex = periodNum - 1; // Convert to 0-based
            if (periodIndex >= 0 && periodIndex < dayEntry.periods.length) {
              const period = dayEntry.periods[periodIndex];
                const slotKey = `${fixedSlot.day}-${periodNum}`;
                
                // ✅ Kiểm tra conflict: nếu slot đã có hoạt động khác, bỏ qua
                const existingActivity = fixedSlotsMap.get(slotKey);
                if (existingActivity && existingActivity !== item.name) {
                  console.warn(`⚠️ Bỏ qua slot ${slotKey}: "${item.name}" conflict với "${existingActivity}"`);
                  continue;
                }
                
              if (!period.subject) {
                period.subject = item.name;
                period.teacher = 'Hoạt động';
                
                  this.fixedPeriods.set(slotKey, {
                  subject: item.name,
                  teacher: 'Hoạt động',
                  type: 'activity',
                  source: 'fixedSlots'
                });
                } else if (period.subject !== item.name) {
                  // Slot đã bị chiếm bởi hoạt động khác
                  console.warn(`⚠️ Slot ${slotKey} đã bị chiếm bởi "${period.subject}", không thể xếp "${item.name}"`);
              }
            }
          }
        }
        continue; // Đã xử lý fixedSlots, bỏ qua dayOfWeek + timeSlot
      }
      
        // ✅ Xử lý dayOfWeek + timeSlot (nếu có) - chỉ cho activities
      if (item.dayOfWeek) {
        const dayEntry = timetable.find(t => t.day === item.dayOfWeek);
        if (!dayEntry) continue;
        
        // Parse timeSlot để lấy số tiết
        let targetPeriod = this.parseTimeSlotToPeriod(item.timeSlot);
        if (targetPeriod === null) {
          // Nếu không parse được, thử parse số trực tiếp
          targetPeriod = parseInt(item.timeSlot, 10) - 1;
          if (isNaN(targetPeriod)) targetPeriod = 0; // fallback: Tiết 1
        }

          // Đảm bảo targetPeriod trong phạm vi hợp lệ
          if (targetPeriod >= 0 && targetPeriod < dayEntry.periods.length) {
          const period = dayEntry.periods[targetPeriod];
            // Kiểm tra tiết có trống không
          if (!period.subject) {
            period.subject = item.name;
            period.teacher = 'Hoạt động';
            
            const periodKey = `${item.dayOfWeek}-${targetPeriod + 1}`;
            this.fixedPeriods.set(periodKey, {
                subject: item.name,
                teacher: 'Hoạt động',
              type: 'activity',
              source: 'dayOfWeek+timeSlot'
              });
            } else {
              // Nếu tiết đã có môn học, tìm tiết trống gần nhất
              this.placeFixedActivityInNearestSlot(item, dayEntry);
            }
          } else {
            // Nếu tiết không hợp lệ, tìm tiết trống đầu tiên
            this.placeFixedActivityInNearestSlot(item, dayEntry);
          }
        }
      }
    }
  }

  // Xếp hoạt động cố định vào tiết trống gần nhất
  placeFixedActivityInNearestSlot(activity, dayEntry) {
    // Tìm tiết trống đầu tiên
    for (let i = 0; i < dayEntry.periods.length; i++) {
      if (!dayEntry.periods[i].subject) {
        dayEntry.periods[i].subject = activity.name;
        dayEntry.periods[i].teacher = 'Hoạt động';

        // Đánh dấu tiết này đã được cố định
        this.fixedPeriods.set(`${dayEntry.day}-${i + 1}`, {
          subject: activity.name,
          teacher: 'Hoạt động',
          type: 'activity'
        });
        break;
      }
    }
  }

  // Tìm tiết cuối cùng đã xếp môn học
  findLastPlacedPeriod(dayEntry, subjectName) {
    for (let i = dayEntry.periods.length - 1; i >= 0; i--) {
      if (dayEntry.periods[i].subject === subjectName) {
        return i;
      }
    }
    return -1;
  }

  // ✅ Validation: Kiểm tra tổng số tiết yêu cầu không vượt quá số tiết có sẵn
  validateTotalPeriods(grade, subjects) {
    // Tính tổng số tiết yêu cầu
    let totalRequired = 0;
    for (const item of subjects) {
      totalRequired += item.periodsPerWeek || 0;
    }
    
    // Tính tổng số tiết có sẵn trong tuần (chỉ buổi chính)
    let totalAvailable = 0;
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (const day of dayNames) {
      const dayConfig = this.config.days instanceof Map 
        ? this.config.days.get(day) 
        : this.config.days[day];
      if (!dayConfig) continue;
      
      // Chỉ tính buổi chính (morningPeriods)
      const mainPeriods = dayConfig.morningPeriods || 0;
      totalAvailable += mainPeriods;
    }
    
    if (totalRequired > totalAvailable) {
      console.warn(`⚠️ Cảnh báo: Khối ${grade} yêu cầu ${totalRequired} tiết/tuần nhưng chỉ có ${totalAvailable} tiết buổi chính có sẵn`);
      return false;
    }
    
    return true;
  }

  // ✅ Tạo thời khóa biểu cho tất cả lớp
  generateAllSchedules() {
    this.initializeTeacherAvailability();

    // ✅ Cache: Tối ưu kiểm tra xung đột giáo viên
    // teacherConflictCache: Map(teacherId-day-period -> Set(classIds))
    this.teacherConflictCache = new Map();

    // ✅ Validation trước khi tạo lịch
    const grades = [...new Set(this.classes.map(c => c.grade))];
    for (const grade of grades) {
      const subjects = this.getSubjectsForGrade(grade);
      if (!this.validateTotalPeriods(grade, subjects)) {
        console.warn(`⚠️ Khối ${grade} có thể không xếp đủ tiết do vượt quá số tiết có sẵn`);
      }
    }

    for (const classObj of this.classes) {
      const schedule = this.generateScheduleForClass(classObj);
      console.log(`⏳ Timetable vừa tạo cho ${classObj.className}:`, schedule.timetable);

      this.schedules.push(schedule);
    }

    // ✅ Báo cáo kết quả
    this.printGenerationReport();

    return this.schedules;
  }
  
  // ✅ In báo cáo kết quả tạo lịch
  printGenerationReport() {
    console.log('\n📊 === BÁO CÁO TẠO THỜI KHÓA BIỂU ===');
    console.log(`✅ Đã tạo lịch cho ${this.schedules.length} lớp`);
    
    // Thống kê giáo viên
    console.log('\n👨‍🏫 Thống kê giáo viên:');
    for (const [teacherId, info] of this.teacherInfo.entries()) {
      const classCountByGrade = this.teacherClassCountByGrade.get(teacherId) || new Map();
      const weeklyLessons = this.teacherWeeklyLessons.get(teacherId) || 0;
      // ✅ info.weeklyLessons đã là effectiveWeeklyLessons (đã áp dụng cap limit)
      const maxLessons = info.weeklyLessons || 17;
      
      console.log(`  - ${info.name}:`);
      console.log(`    + Số tiết/tuần: ${weeklyLessons}/${maxLessons}`);
      for (const [grade, count] of classCountByGrade.entries()) {
        const maxForGrade = info.maxClassPerGrade.get(grade) || 2;
        console.log(`    + Khối ${grade}: ${count}/${maxForGrade} lớp`);
      }
    }
    
    // Thống kê môn học chưa xếp đủ
    console.log('\n⚠️ Môn học chưa xếp đủ tiết:');
    // Logic này sẽ được thêm vào nếu cần
  }
}

// ✅ API: Kiểm tra điều kiện trước khi tạo lịch
exports.validateBeforeGenerate = async (req, res) => {
  try {
    const { grades, year, semester } = req.body;

    if (!grades || !Array.isArray(grades) || grades.length === 0) {
      return res.status(400).json({ 
        valid: false,
        message: 'Vui lòng chọn ít nhất một khối',
        errors: [{ field: 'grades', message: 'Chưa chọn khối nào' }]
      });
    }

    if (!year || !semester) {
      return res.status(400).json({ 
        valid: false,
        message: 'Vui lòng chọn năm học và học kỳ',
        errors: [
          { field: 'year', message: !year ? 'Chưa chọn năm học' : null },
          { field: 'semester', message: !semester ? 'Chưa chọn học kỳ' : null }
        ].filter(e => e.message)
      });
    }

    const errors = [];
    const warnings = [];
    const checks = {
      scheduleConfig: false,
      classes: false,
      subjects: false,
      activities: false,
      teachingAssignments: false,
      teachers: false,
      constraints: false,
      periods: false
    };

    // ✅ Bước 1: Kiểm tra ScheduleConfig
    const config = await ScheduleConfig.findOne();
    if (!config) {
      errors.push({
        step: 1,
        field: 'scheduleConfig',
        message: 'Chưa có cấu hình thời khóa biểu. Vui lòng cấu hình trước khi tạo lịch.',
        action: 'Cần tạo cấu hình thời khóa biểu trong phần "Cấu hình thời khóa biểu"'
      });
    } else {
      checks.scheduleConfig = true;
      
      // Kiểm tra cấu hình có đầy đủ không
      const hasDays = (config.days instanceof Map ? config.days.size > 0 : Object.keys(config.days || {}).length > 0);
      const hasGradeConfigs = (config.gradeConfigs instanceof Map ? config.gradeConfigs.size > 0 : Object.keys(config.gradeConfigs || {}).length > 0);
      
      if (!hasDays) {
        errors.push({
          step: 1,
          field: 'scheduleConfig.days',
          message: 'Cấu hình thời khóa biểu chưa có cấu hình ngày học',
          action: 'Cần cấu hình số tiết cho từng ngày trong tuần'
        });
      }
      
      // ✅ Kiểm tra gradeConfigs (cấu trúc mới)
      if (!hasGradeConfigs) {
        errors.push({
          step: 1,
          field: 'scheduleConfig.gradeConfigs',
          message: 'Cấu hình thời khóa biểu chưa có cấu hình số tiết cho môn học và hoạt động',
          action: 'Cần cấu hình số tiết/tuần cho từng môn học và hoạt động theo từng khối'
        });
      }
    }

    // ✅ Bước 2: Kiểm tra Classes
    const classes = await Class.find({ grade: { $in: grades } });
    if (classes.length === 0) {
      errors.push({
        step: 2,
        field: 'classes',
        message: `Không tìm thấy lớp nào cho khối ${grades.join(', ')}`,
        action: 'Cần tạo lớp học cho các khối đã chọn'
      });
    } else {
      checks.classes = true;
      
      // Kiểm tra từng khối có lớp không
      for (const grade of grades) {
        const gradeClasses = classes.filter(c => c.grade === grade);
        if (gradeClasses.length === 0) {
          warnings.push({
            step: 2,
            field: `classes.${grade}`,
            message: `Khối ${grade} chưa có lớp nào`,
            action: `Cần tạo ít nhất một lớp cho khối ${grade}`
          });
        }
      }
    }

    // ✅ Bước 3: Kiểm tra Subjects
    const subjects = await Subject.find({ isActive: { $ne: false } });
    if (subjects.length === 0) {
      errors.push({
        step: 3,
        field: 'subjects',
        message: 'Chưa có môn học nào được kích hoạt',
        action: 'Cần tạo và kích hoạt ít nhất một môn học'
      });
    } else {
      checks.subjects = true;
    }

    // ✅ Bước 4: Kiểm tra Activities (tùy chọn)
    const activities = await Activity.find({ isActive: true });
    if (activities.length === 0) {
      warnings.push({
        step: 4,
        field: 'activities',
        message: 'Chưa có hoạt động nào được kích hoạt',
        action: 'Có thể tạo hoạt động để thêm vào thời khóa biểu (tùy chọn)'
      });
    } else {
      checks.activities = true;
    }

    // ✅ Bước 5: Kiểm tra TeachingAssignment
    const assignments = await TeachingAssignment.find({
      year: year,
      semester: semester
    }).populate('teacherId').populate('subjectId').populate('classId');

    if (assignments.length === 0) {
      errors.push({
        step: 5,
        field: 'teachingAssignments',
        message: `Chưa có phân công giảng dạy cho năm học ${year}, học kỳ ${semester}`,
        action: 'Cần phân công giáo viên cho các lớp và môn học trước khi tạo lịch'
      });
    } else {
      checks.teachingAssignments = true;
      
      // Kiểm tra các lớp có phân công đầy đủ không
      const classIds = classes.map(c => c._id.toString());
      const assignedClassIds = [...new Set(assignments.map(a => a.classId?._id?.toString()).filter(Boolean))];
      const missingClasses = classIds.filter(id => !assignedClassIds.includes(id));
      
      if (missingClasses.length > 0) {
        warnings.push({
          step: 5,
          field: 'teachingAssignments.missing',
          message: `${missingClasses.length} lớp chưa có phân công giảng dạy`,
          action: 'Cần phân công giáo viên cho tất cả các lớp'
        });
      }
    }

    // ✅ Bước 6: Kiểm tra Teachers có availableMatrix
    const teacherIds = [...new Set(assignments.map(a => a.teacherId?._id?.toString()).filter(Boolean))];
    const teachers = await Teacher.find({ _id: { $in: teacherIds } });
    
    const teachersWithoutMatrix = teachers.filter(t => !t.availableMatrix || !Array.isArray(t.availableMatrix));
    if (teachersWithoutMatrix.length > 0) {
      warnings.push({
        step: 6,
        field: 'teachers.availableMatrix',
        message: `${teachersWithoutMatrix.length} giáo viên chưa có ma trận rảnh`,
        action: 'Cần cấu hình ma trận rảnh cho giáo viên để tối ưu việc xếp lịch',
        teachers: teachersWithoutMatrix.map(t => t.name)
      });
    } else {
      checks.teachers = true;
    }

    // ✅ Bước 7: Kiểm tra ràng buộc (maxClassPerGrade, weeklyLessons)
    if (config && classes.length > 0 && assignments.length > 0) {
      const constraintWarnings = [];
      
      for (const grade of grades) {
        const gradeClasses = classes.filter(c => c.grade === grade);
        const gradeAssignments = assignments.filter(a => 
          a.classId && gradeClasses.some(c => c._id.toString() === a.classId._id.toString())
        );
        
        // Đếm số lớp mỗi giáo viên đang dạy theo khối
        const teacherClassCount = new Map();
        for (const assignment of gradeAssignments) {
          if (!assignment.teacherId) continue;
          const teacherId = assignment.teacherId._id.toString();
          const currentCount = teacherClassCount.get(teacherId) || 0;
          teacherClassCount.set(teacherId, currentCount + 1);
        }
        
        // Kiểm tra maxClassPerGrade
        for (const [teacherId, count] of teacherClassCount.entries()) {
          const teacher = teachers.find(t => t._id.toString() === teacherId);
          if (!teacher) continue;
          
          let maxForGrade = 2; // Default
          if (teacher.maxClassPerGrade) {
            if (teacher.maxClassPerGrade instanceof Map) {
              maxForGrade = teacher.maxClassPerGrade.get(grade) || teacher.maxClassPerGrade.get(String(grade)) || 2;
            } else if (typeof teacher.maxClassPerGrade === 'object') {
              maxForGrade = teacher.maxClassPerGrade[grade] || teacher.maxClassPerGrade[String(grade)] || 2;
            }
          }
          
          if (count > maxForGrade) {
            constraintWarnings.push({
              teacher: teacher.name,
              grade: grade,
              current: count,
              max: maxForGrade
            });
          }
        }
      }
      
      if (constraintWarnings.length > 0) {
        warnings.push({
          step: 7,
          field: 'constraints.maxClassPerGrade',
          message: `${constraintWarnings.length} giáo viên vượt quá số lớp tối đa cho khối`,
          action: 'Cần điều chỉnh phân công hoặc tăng maxClassPerGrade cho giáo viên',
          details: constraintWarnings
        });
      } else {
        checks.constraints = true;
      }
    }

    // ✅ Bước 8: Kiểm tra tổng số tiết không vượt quá số tiết có sẵn
    if (config && classes.length > 0) {
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      let totalAvailable = 0;
      
      for (const day of dayNames) {
        const dayConfig = config.days instanceof Map 
          ? config.days.get(day) 
          : config.days[day];
        if (dayConfig) {
          totalAvailable += dayConfig.morningPeriods || 0;
        }
      }
      
      for (const grade of grades) {
        // Tính tổng số tiết yêu cầu cho khối này
        let totalRequired = 0;
        
        // ✅ Ưu tiên lấy từ gradeConfigs (cấu trúc mới)
        const gradeConfigData = config.gradeConfigs?.get?.(grade) || 
                                config.gradeConfigs?.get?.(String(grade)) ||
                                (typeof config.gradeConfigs === 'object' && config.gradeConfigs?.[grade]) ||
                                (typeof config.gradeConfigs === 'object' && config.gradeConfigs?.[String(grade)]);
        
        if (gradeConfigData) {
          // Lấy từ subjects (key là subjectId, periodsPerWeek là number)
          if (gradeConfigData.subjects) {
            const subjectsMap = gradeConfigData.subjects instanceof Map
              ? Array.from(gradeConfigData.subjects.entries())
              : Object.entries(gradeConfigData.subjects || {});
            
            for (const [subjectIdStr, subjectConfig] of subjectsMap) {
              const periodsPerWeek = typeof subjectConfig.periodsPerWeek === 'number' 
                ? subjectConfig.periodsPerWeek 
                : 0;
          totalRequired += periodsPerWeek || 0;
            }
          }
          
          // Lấy từ activities (periodsPerWeek là number)
          if (gradeConfigData.activities && Array.isArray(gradeConfigData.activities)) {
            for (const activityConfig of gradeConfigData.activities) {
              if (!activityConfig.activityId) continue;
              const periodsPerWeek = typeof activityConfig.periodsPerWeek === 'number' 
                ? activityConfig.periodsPerWeek 
                : 0;
          totalRequired += periodsPerWeek || 0;
            }
          }
        }
        
        if (totalRequired > totalAvailable) {
          warnings.push({
            step: 8,
            field: `periods.${grade}`,
            message: `Khối ${grade} yêu cầu ${totalRequired} tiết/tuần nhưng chỉ có ${totalAvailable} tiết buổi chính`,
            action: 'Cần giảm số tiết/tuần của các môn học hoặc tăng số tiết buổi chính',
            required: totalRequired,
            available: totalAvailable
          });
        } else {
          checks.periods = true;
        }
      }
    }

    // ✅ Tổng hợp kết quả
    const isValid = errors.length === 0;
    const hasWarnings = warnings.length > 0;

    return res.json({
      valid: isValid,
      canGenerate: isValid, // Có thể tạo lịch nếu không có lỗi
      hasWarnings: hasWarnings,
      checks: checks,
      errors: errors,
      warnings: warnings,
      summary: {
        totalErrors: errors.length,
        totalWarnings: warnings.length,
        stepsCompleted: Object.values(checks).filter(Boolean).length,
        stepsTotal: Object.keys(checks).length
      }
    });

  } catch (error) {
    console.error('❌ Lỗi khi kiểm tra điều kiện:', error);
    return res.status(500).json({
      valid: false,
      message: 'Lỗi khi kiểm tra điều kiện',
      error: error.message
    });
  }
};

// API endpoints
exports.autoGenerateSchedule = async (req, res) => {
  try {
    const { grades, year, semester } = req.body;

    // ✅ Validation request body
    if (!grades || !Array.isArray(grades) || grades.length === 0) {
      return res.status(400).json({ 
        message: 'Vui lòng chọn ít nhất một khối',
        error: 'grades is required and must be a non-empty array'
      });
    }

    if (!year || !semester) {
      return res.status(400).json({ 
        message: 'Vui lòng chọn năm học và học kỳ',
        error: 'year and semester are required'
      });
    }

    console.log(`🚀 Bắt đầu tạo thời khóa biểu cho: grades=${grades.join(',')}, year=${year}, semester=${semester}`);

    // ✅ Lấy cấu hình (KHÔNG dùng .lean() để có thể sử dụng method getEffectiveSession)
    const config = await ScheduleConfig.findOne();
    if (!config) {
      return res.status(400).json({ message: 'Chưa có cấu hình thời khóa biểu' });
    }
    console.log('Loaded config.days:', config.days instanceof Map ? Array.from(config.days.keys()) : Object.keys(config.days || {}));

    // ✅ Lấy dữ liệu cần thiết - Filter assignments theo year và semester
    console.log(`📥 Đang load dữ liệu: year=${year}, semester=${semester}, grades=${grades.join(',')}`);
    
    let subjects, activities, classes, allAssignments, classPeriodsData;
    try {
      [subjects, activities, classes, allAssignments, classPeriodsData] = await Promise.all([
        Subject.find({ isActive: { $ne: false } }),
        Activity.find({ isActive: true }),
        Class.find({ grade: { $in: grades } }),
        TeachingAssignment.find({ year, semester })
          .populate('teacherId', 'name availableMatrix maxClassPerGrade weeklyLessons maxClasses')
          .populate('subjectId', 'name grades')
          .populate('classId', 'className classCode grade year'),
        ClassPeriods.find({ year, semester, grade: { $in: grades } })
          .populate('classId', 'className classCode grade')
      ]);
      console.log(`✅ Loaded data: ${subjects.length} subjects, ${activities.length} activities, ${classes.length} classes, ${allAssignments.length} assignments, ${classPeriodsData.length} classPeriods`);
    } catch (dbError) {
      console.error('❌ Lỗi khi load dữ liệu từ database:', dbError);
      return res.status(500).json({ 
        message: 'Lỗi khi load dữ liệu từ database',
        error: dbError.message 
      });
    }
    
    // ✅ Filter assignments chỉ lấy những assignment cho các lớp đã chọn
    const classIds = classes.map(c => c._id.toString());
    const assignments = allAssignments.filter(a => 
      a.classId && classIds.includes(a.classId._id.toString())
    );
    
    console.log(`📊 Filtered assignments: ${assignments.length} assignments cho ${classes.length} lớp`);

    if (classes.length === 0) {
      return res.status(400).json({ message: 'Không tìm thấy lớp nào cho khối đã chọn' });
    }

    // ✅ Tạo thời khóa biểu
    console.log(`🔄 Bắt đầu tạo thời khóa biểu...`);
    let generator, schedules;
    try {
      generator = new AutoScheduleGenerator(config, subjects, activities, classes, assignments, year, semester, classPeriodsData);
      schedules = generator.generateAllSchedules();
      console.log(`✅ Đã tạo ${schedules.length} thời khóa biểu`);
    } catch (genError) {
      console.error('❌ Lỗi khi tạo thời khóa biểu:', genError);
      console.error('❌ Stack trace:', genError.stack);
      return res.status(500).json({ 
        message: 'Lỗi khi tạo thời khóa biểu',
        error: genError.message,
        stack: process.env.NODE_ENV === 'development' ? genError.stack : undefined
      });
    }

    // ✅ Lưu vào database
    console.log(`💾 Bắt đầu lưu ${schedules.length} thời khóa biểu vào database...`);
    const savedSchedules = [];
    for (let i = 0; i < schedules.length; i++) {
      const schedule = schedules[i];
      try {
        console.log(`💾 [${i + 1}/${schedules.length}] Lưu thời khóa biểu cho lớp ${schedule.className}...`);
        
        // ✅ Chuyển đổi classId từ string sang ObjectId nếu cần
        const classIdForQuery = mongoose.Types.ObjectId.isValid(schedule.classId) 
          ? schedule.classId 
          : new mongoose.Types.ObjectId(schedule.classId);
        
        // Xóa thời khóa biểu cũ nếu có
        await Schedule.deleteMany({
          classId: classIdForQuery,
          year: schedule.year,
          semester: schedule.semester
        });

        // Tạo mới
        const newSchedule = new Schedule({
          classId: classIdForQuery,
          className: schedule.className,
          year: schedule.year,
          semester: schedule.semester,
          timetable: schedule.timetable
        });

        await newSchedule.save();
        savedSchedules.push(newSchedule);
        console.log(`✅ [${i + 1}/${schedules.length}] Đã lưu thời khóa biểu cho lớp ${schedule.className}`);
      } catch (saveError) {
        console.error(`❌ Lỗi khi lưu thời khóa biểu cho lớp ${schedule.className}:`, saveError);
        console.error(`❌ Schedule data:`, JSON.stringify(schedule, null, 2));
        // Tiếp tục với các lớp khác thay vì dừng lại
        continue;
      }
    }
    
    if (savedSchedules.length === 0) {
      return res.status(500).json({ 
        message: 'Không thể lưu bất kỳ thời khóa biểu nào',
        error: 'Tất cả các lần lưu đều thất bại'
      });
    }
    
    console.log(`✅ Đã lưu thành công ${savedSchedules.length}/${schedules.length} thời khóa biểu`);

    res.json({
      message: `Đã tạo thời khóa biểu cho ${savedSchedules.length} lớp`,
      schedules: savedSchedules
    });

  } catch (error) {
    console.error('❌ Lỗi tạo thời khóa biểu:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Request body:', req.body);
    
    // ✅ Trả về lỗi chi tiết hơn để debug
    res.status(500).json({ 
      message: 'Lỗi server khi tạo thời khóa biểu',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// API cập nhật thời khóa biểu bằng kéo thả
exports.updateScheduleByDragDrop = async (req, res) => {
  try {
    const { classId, year, semester, fromDay, fromPeriod, toDay, toPeriod } = req.body;

    const schedule = await Schedule.findOne({
      classId,
      year,
      semester
    });

    if (!schedule) {
      return res.status(404).json({ message: 'Không tìm thấy thời khóa biểu' });
    }

    // Tìm tiết nguồn và đích
    const fromDayEntry = schedule.timetable.find(t => t.day === fromDay);
    const toDayEntry = schedule.timetable.find(t => t.day === toDay);

    if (!fromDayEntry || !toDayEntry) {
      return res.status(400).json({ message: 'Ngày không hợp lệ' });
    }

    const fromPeriodData = fromDayEntry.periods[fromPeriod - 1];
    const toPeriodData = toDayEntry.periods[toPeriod - 1];

    if (!fromPeriodData || !toPeriodData) {
      return res.status(400).json({ message: 'Tiết không hợp lệ' });
    }

    // Hoán đổi nội dung
    const tempSubject = fromPeriodData.subject;
    const tempTeacher = fromPeriodData.teacher;

    fromPeriodData.subject = toPeriodData.subject;
    fromPeriodData.teacher = toPeriodData.teacher;
    toPeriodData.subject = tempSubject;
    toPeriodData.teacher = tempTeacher;

    await schedule.save();

    res.json({
      message: 'Đã cập nhật thời khóa biểu',
      schedule: schedule
    });

  } catch (error) {
    console.error('Lỗi cập nhật thời khóa biểu:', error);
    res.status(500).json({ message: 'Lỗi server khi cập nhật thời khóa biểu' });
  }
};

// API tạo lớp tự động cho các khối
exports.createClassesForGrades = async (req, res) => {
  try {
    const { grades, year, classesPerGrade = 8, capacity = 45 } = req.body;
    const Room = require('../../models/room/room');

    const createdClasses = [];

    for (const grade of grades) {
      for (let i = 1; i <= classesPerGrade; i++) {
        const className = `${grade}A${i}`;
        const classCode = `${year}-${className}`;

        // Kiểm tra lớp đã tồn tại chưa
        const existingClass = await Class.findOne({ classCode });
        if (existingClass) continue;

        // 🏫 Tìm phòng có roomCode trùng với className
        let roomId = null;
        const matchingRoom = await Room.findOne({ roomCode: className });
        if (matchingRoom) {
          roomId = matchingRoom._id;
          console.log(`✅ Tìm thấy phòng ${className}, đã gán cho lớp ${className}`);
        }

        const newClass = new Class({
          classCode,
          className,
          year,
          grade,
          capacity,
          currentSize: 0,
          roomId: roomId // Gán phòng nếu tìm thấy
        });

        await newClass.save();
        createdClasses.push(newClass);
      }
    }

    res.json({
      message: `Đã tạo ${createdClasses.length} lớp`,
      classes: createdClasses
    });

  } catch (error) {
    console.error('Lỗi tạo lớp:', error);
    res.status(500).json({ message: 'Lỗi server khi tạo lớp' });
  }
};
