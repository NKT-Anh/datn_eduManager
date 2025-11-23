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
    let generator, schedule;
    try {
      generator = new AutoScheduleGenerator(
        config, 
        subjects, 
        activities, 
        [classObj], // Chỉ tạo cho 1 lớp
        assignments, 
        year, 
        semester, 
        classPeriodsData
      );
      schedule = generator.generateScheduleForClass(classObj);
      console.log(`✅ Đã tạo thời khóa biểu cho lớp ${classObj.className}`);
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

// ✅ TODO: Implement các hàm này
exports.validateBeforeGenerate = async (req, res) => {
  res.status(501).json({ message: 'Function validateBeforeGenerate chưa được implement' });
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

    // ✅ Tạo lịch cho từng lớp (tạm thời gọi generateScheduleForSingleClass cho mỗi lớp)
    const results = [];
    const errors = [];

    for (const classObj of classes) {
      try {
        console.log(`🔄 Bắt đầu tạo lịch cho lớp ${classObj.className}...`);
        
        // ✅ Gọi generateScheduleForSingleClass cho từng lớp
        // TODO: Thay thế bằng logic tối ưu hơn khi có AutoScheduleGenerator
        const classAssignments = allAssignments.filter(a => 
          a.classId && a.classId._id.toString() === classObj._id.toString()
        );
        
        const classClassPeriods = classPeriodsData.filter(cp => 
          cp.classId && cp.classId._id.toString() === classObj._id.toString()
        );

        // ✅ Tạm thời: Gọi lại generateScheduleForSingleClass logic
        // Note: Cần import AutoScheduleGenerator khi có
        if (typeof AutoScheduleGenerator === 'undefined') {
          // ✅ Tạm thời trả về lỗi cho biết cần implement AutoScheduleGenerator
          errors.push({
            className: classObj.className,
            error: 'AutoScheduleGenerator class chưa được implement. Vui lòng sử dụng endpoint /auto-schedule/generate/:classId để tạo lịch từng lớp.'
          });
          continue;
        }

        // ✅ Khi có AutoScheduleGenerator, sử dụng logic tương tự generateScheduleForSingleClass
        // const generator = new AutoScheduleGenerator(
        //   config, 
        //   subjects, 
        //   activities, 
        //   [classObj],
        //   classAssignments, 
        //   year, 
        //   semester, 
        //   classClassPeriods
        // );
        // const schedule = generator.generateScheduleForClass(classObj);
        
        // ✅ Lưu schedule vào database...
        
        results.push({
          className: classObj.className,
          status: 'pending'
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

    res.json({
      message: `Đã tạo thời khóa biểu cho ${results.length} lớp`,
      success: results.length,
      failed: errors.length,
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
  res.status(501).json({ message: 'Function updateScheduleByDragDrop chưa được implement' });
};

exports.createClassesForGrades = async (req, res) => {
  res.status(501).json({ message: 'Function createClassesForGrades chưa được implement' });
};
