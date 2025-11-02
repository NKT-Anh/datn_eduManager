const Schedule = require('../../models/subject/schedule');
const ScheduleConfig = require('../../models/subject/scheduleConfig');
const Class = require('../../models/class/class');
const TeachingAssignment = require('../../models/subject/teachingAssignment');
const Subject = require('../../models/subject/subject');
const Activity = require('../../models/subject/activity');
const Teacher = require('../../models/user/teacher');

// Thuật toán tự động tạo thời khóa biểu
class AutoScheduleGenerator {
  constructor(config, subjects, activities, classes, assignments, year, semester) {
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
  }

  // Khởi tạo ma trận rảnh của giáo viên
  initializeTeacherAvailability() {
    for (const assignment of this.assignments) {
      if (assignment.teacherId && assignment.teacherId.availableMatrix) {
        this.teacherAvailability.set(assignment.teacherId._id.toString(), {
          matrix: assignment.teacherId.availableMatrix,
          name: assignment.teacherId.name
        });
      }
    }
  }

  // Lấy buổi học chính cho khối
  getMainSessionForGrade(grade) {
    const rule = this.config.gradeSessionRules.find(r => r.grade === grade);
    return rule ? rule.session : 'morning';
  }

  // Kiểm tra giáo viên có rảnh và không trùng lớp khác cùng tiết
  isTeacherAvailable(teacherId, day, period) {
    const availability = this.teacherAvailability.get(teacherId);
    if (availability) {
      const dayIndex = this.getDayIndex(day);
      const periodIndex = period - 1;

      if (dayIndex < 0 || periodIndex < 0 || !availability.matrix[dayIndex]) return false;
      if (availability.matrix[dayIndex][periodIndex] !== true) return false;
    }

    // Kiểm tra xem giáo viên đó có đang dạy lớp khác cùng tiết không
    for (const schedule of this.schedules) {
      for (const dayEntry of schedule.timetable) {
        if (dayEntry.day === day) {
          const periodIndex = period - 1;
          const conflict = dayEntry.periods[periodIndex];

          if (conflict && conflict.teacher === teacherId) {
            return false; // Giáo viên này đã dạy lớp khác cùng tiết
          }
        }
      }
    }

    return true; // Rảnh và không bị trùng
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

  // Lấy danh sách môn học và hoạt động cho khối
  getSubjectsForGrade(grade) {
    const mainSession = this.getMainSessionForGrade(grade);
    const items = [];

    // Thêm môn học chính
    for (const [subjectName, config] of Object.entries(this.config.subjectHours)) {
      if (config.session === 'main') {
        const subject = this.subjects.find(s => s.name === subjectName && s.grades.includes(grade));
        items.push({
          name: subjectName,
          type: 'subject',
          periodsPerWeek: config.periodsPerWeek,
          maxPeriodsPerDay: config.maxPeriodsPerDay,
          allowConsecutive: config.allowConsecutive,
          session: config.session
        });
      }
    }

    // Thêm môn học phụ (extra)
    for (const [subjectName, config] of Object.entries(this.config.subjectHours)) {
      if (config.session === 'extra') {
        items.push({
          name: subjectName,
          type: 'subject',
          periodsPerWeek: config.periodsPerWeek,
          maxPeriodsPerDay: config.maxPeriodsPerDay,
          allowConsecutive: config.allowConsecutive,
          session: config.session
        });
      }
    }

    // Thêm hoạt động từ cấu hình
    for (const activityConfig of this.config.activities) {
      if (activityConfig.session === 'extra') {
        const activity = this.activities.find(a => a._id.toString() === activityConfig.activityId.toString());
        if (activity && (!activity.grades || activity.grades.includes(grade))) {
          items.push({
            name: activity.name,
            type: 'activity',
            periodsPerWeek: activityConfig.periodsPerWeek,
            maxPeriodsPerDay: 1,
            allowConsecutive: false,
            session: 'extra',
            activityId: activity._id.toString()
          });
        }
      }
    }

    // Thêm hoạt động hàng tuần (weekly activities)
    for (const activity of this.activities) {
      if (activity.type === 'weekly' && 
          activity.isActive && 
          (!activity.grades || activity.grades.includes(grade))) {
        items.push({
          name: activity.name,
          type: 'activity',
          periodsPerWeek: 1, // Hoạt động hàng tuần thường 1 tiết/tuần
          maxPeriodsPerDay: 1,
          allowConsecutive: false,
          session: 'main', // Hoạt động hàng tuần thường ở buổi chính
          activityId: activity._id.toString(),
          dayOfWeek: activity.dayOfWeek,
          timeSlot: activity.timeSlot
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

  // Tạo thời khóa biểu cho một lớp
  generateScheduleForClass(classObj) {
    const grade = classObj.grade;
    const mainSession = this.getMainSessionForGrade(grade);
    const subjects = this.getSubjectsForGrade(grade);

    // Khởi tạo timetable với các ngày và số tiết
    const timetable = [];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const day of dayNames) {
      const dayConfig = this.config.days[day];
      if (!dayConfig) continue;

      const totalPeriods = dayConfig.totalPeriods || 7; // fallback nếu config thiếu
      const periods = Array.from({ length: totalPeriods }, (_, idx) => ({
        period: idx + 1, // thêm số tiết
        subject: null,
        teacher: null
      }));

      timetable.push({ day, periods });
    }

    // Bước 1: Xếp các hoạt động cố định trước
    this.placeFixedActivities(subjects, classObj, timetable);

    // Bước 2: Xếp các môn học và hoạt động linh hoạt
    for (const item of subjects) {
      // Bỏ qua hoạt động đã được cố định
      if (item.type === 'activity' && item.dayOfWeek) continue;

      this.placeItemInSchedule(item, classObj, timetable, mainSession);
    }

    console.log(`📅 Generating schedule for ${classObj.className} (${grade})`);

    return {
      classId: classObj._id.toString(),
      className: classObj.className,
      year: this.year,
      semester: this.semester,
      timetable
    };
  }
  isMainSession(dayName, gradeSession, periodIndex, dayConfig, itemSession) {
  const morningCount = dayConfig.morningPeriods || 0;
  const total = dayConfig.totalPeriods || 7;
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

    let periodsPlaced = 0;

    console.log(`⏰ Bắt đầu xếp ${item.name} (${item.type}) cho lớp ${classObj.className}`);

    for (const dayEntry of timetable) {
      if (periodsPlaced >= item.periodsPerWeek) break;

      const dayConfig = this.config.days[dayEntry.day];
      if (!dayConfig) continue;

      let periodsInDay = 0; // Số tiết đã xếp trong ngày
      for (let i = 0; i < dayEntry.periods.length; i++) {
        if (periodsPlaced >= item.periodsPerWeek) break;
        if (periodsInDay >= (item.maxPeriodsPerDay || 2)) break;

        const periodKey = `${dayEntry.day}-${i + 1}`;
        const period = dayEntry.periods[i];

        if (period.subject || this.fixedPeriods.has(periodKey)) continue;

        // Kiểm tra buổi chính/phụ
        const canPlace = this.isMainSession(dayEntry.day, this.getMainSessionForGrade(classObj.grade), i, dayConfig, item.session);
        if (!canPlace) continue; // Nếu trái buổi → bỏ qua

        // Kiểm tra giáo viên
        if (item.type === 'subject' && teacher.id && !this.isTeacherAvailable(teacher.id, dayEntry.day, i + 1)) continue;

        // Kiểm tra sự trùng lặp giáo viên với các lớp khác
        if (this.isTeacherAssignedToOtherClasses(teacher.id, dayEntry.day, i + 1, classObj._id.toString())) {
          continue; // Nếu giáo viên đã dạy lớp khác trong cùng tiết, bỏ qua
        }

        // Kiểm tra liên tiếp
        if (item.type === 'subject' && !item.allowConsecutive) {
          const last = this.findLastPlacedPeriod(dayEntry, item.name);
          if (last !== -1 && Math.abs(i - last) === 1) continue;
        }

        // Xếp tiết
        period.subject = item.name;
        period.teacher = teacher.name;
        periodsPlaced++;
        periodsInDay++;

        console.log(`✅ Xếp ${item.name} vào ${dayEntry.day} tiết ${i + 1}`);
      }
    }

    if (periodsPlaced < item.periodsPerWeek) {
      console.log(`⚠️ Chưa xếp đủ ${item.periodsPerWeek} tiết cho ${item.name}. Đã xếp: ${periodsPlaced}`);
    }
  }

  // Kiểm tra sự trùng lặp giáo viên với các lớp khác
  isTeacherAssignedToOtherClasses(teacherId, day, period, currentClassId) {
    for (const schedule of this.schedules) {
      if (schedule.classId === currentClassId) continue; // Bỏ qua lớp hiện tại

      for (const dayEntry of schedule.timetable) {
        if (dayEntry.day === day) {
          const periodIndex = period - 1; // Chuyển đổi sang index 0-based
          const conflict = dayEntry.periods[periodIndex];

          if (conflict && conflict.teacher === teacherId) {
            return true; // Giáo viên đã dạy lớp khác trong cùng tiết
          }
        }
      }
    }
    return false; // Không có sự trùng lặp
  }

  // Xếp tất cả hoạt động cố định trước
  placeFixedActivities(subjects, classObj, timetable) {
    for (const item of subjects) {
      if (item.type === 'activity' && item.dayOfWeek) {
        const dayEntry = timetable.find(t => t.day === item.dayOfWeek);

        if (dayEntry) {
          // Tìm tiết phù hợp dựa trên timeSlot
          let targetPeriod = parseInt(item.timeSlot, 10) - 1;
          if (isNaN(targetPeriod)) targetPeriod = 0; // fallback

          // Đảm bảo targetPeriod trong phạm vi hợp lệ
          if (targetPeriod >= 0 && targetPeriod < dayEntry.periods.length) {
            // Kiểm tra tiết có trống không
            if (!dayEntry.periods[targetPeriod].subject) {
              dayEntry.periods[targetPeriod].subject = item.name;
              dayEntry.periods[targetPeriod].teacher = 'Hoạt động';

              // Đánh dấu tiết này đã được cố định
              this.fixedPeriods.set(`${item.dayOfWeek}-${targetPeriod + 1}`, {
                subject: item.name,
                teacher: 'Hoạt động',
                type: 'activity'
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

  // Tạo thời khóa biểu cho tất cả lớp
  generateAllSchedules() {
    this.initializeTeacherAvailability();

    for (const classObj of this.classes) {
      const schedule = this.generateScheduleForClass(classObj);
      console.log('⏳ Timetable vừa tạo:', schedule.timetable);

      this.schedules.push(schedule);
    }

    return this.schedules;
  }
}

// API endpoints
exports.autoGenerateSchedule = async (req, res) => {
  try {
    const { grades, year, semester } = req.body;

    // Lấy cấu hình
    const config = await ScheduleConfig.findOne().lean();
    if (!config) {
      return res.status(400).json({ message: 'Chưa có cấu hình thời khóa biểu' });
    }
    console.log('Loaded config.days:', Object.keys(config.days));

    // Lấy dữ liệu cần thiết
    const [subjects, activities, classes, assignments] = await Promise.all([
      Subject.find(),
      Activity.find({ isActive: true }),
      Class.find({ grade: { $in: grades } }),
      TeachingAssignment.find().populate('teacherId').populate('subjectId').populate('classId')
    ]);

    if (classes.length === 0) {
      return res.status(400).json({ message: 'Không tìm thấy lớp nào cho khối đã chọn' });
    }

    // Tạo thời khóa biểu
    const generator = new AutoScheduleGenerator(config, subjects, activities, classes, assignments, year, semester);
    const schedules = generator.generateAllSchedules();

    // Lưu vào database
    const savedSchedules = [];
    for (const schedule of schedules) {
      // Xóa thời khóa biểu cũ nếu có
      await Schedule.deleteMany({
        classId: schedule.classId,
        year: schedule.year,
        semester: schedule.semester
      });

      // Tạo mới
      const newSchedule = new Schedule({
        classId: schedule.classId,
        className: schedule.className,
        year: schedule.year,
        semester: schedule.semester,
        timetable: schedule.timetable
      });
      console.log('📌 Timetable trước khi lưu:', schedule.timetable);

      await newSchedule.save();
      savedSchedules.push(newSchedule);
    }

    res.json({
      message: `Đã tạo thời khóa biểu cho ${savedSchedules.length} lớp`,
      schedules: savedSchedules
    });

  } catch (error) {
    console.error('Lỗi tạo thời khóa biểu:', error);
    res.status(500).json({ message: 'Lỗi server khi tạo thời khóa biểu' });
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

    const createdClasses = [];

    for (const grade of grades) {
      for (let i = 1; i <= classesPerGrade; i++) {
        const className = `${grade}A${i}`;
        const classCode = `${year}-${className}`;

        // Kiểm tra lớp đã tồn tại chưa
        const existingClass = await Class.findOne({ classCode });
        if (existingClass) continue;

        const newClass = new Class({
          classCode,
          className,
          year,
          grade,
          capacity,
          currentSize: 0
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
