const Schedule = require('../models/subject/schedule');
const scheduleQueue = require('../utils/scheduleQueue');

/**
 * ✅ Schedule Assignment Service
 * 
 * Service để quản lý gán giáo viên vào timeslot trong Schedule với Lock + Queue
 * Đảm bảo không trùng giáo viên ở cùng timeslot thông qua:
 * 1. Queue system: Xử lý tuần tự các thao tác gán
 * 2. Lock mechanism: Kiểm tra và lock trước khi commit
 * 3. Unique constraint check: Kiểm tra trong Schedule collection
 */

class ScheduleAssignmentService {
  /**
   * ✅ Kiểm tra conflict teacherId + timeslot (với queue và lock)
   * @param {Object} params - { teacherId, classId, day, period, year, semester }
   * @returns {Promise<boolean>} true nếu có conflict
   */
  async checkConflict(teacherId, day, period, year, semester, excludeClassId = null) {
    if (!teacherId) return false;
    
    return scheduleQueue.enqueue(async () => {
      const conflict = await Schedule.checkTeacherConflict(
        teacherId,
        day,
        period,
        year,
        semester,
        excludeClassId
      );
      return conflict;
    }, {
      priority: 2, // Priority cao hơn để check nhanh
      retry: 0,
    });
  }

  /**
   * ✅ Gán nhiều giáo viên cùng lúc (batch)
   * @param {Array} assignments - Array of assignment params
   * @returns {Promise<Array>} Array of results (success hoặc error)
   */
  async assignTeachersBatch(assignments) {
    const results = [];

    for (const assignment of assignments) {
      try {
        const result = await this.assignTeacherToTimeslot(assignment);
        results.push({ success: true, assignment: result });
      } catch (error) {
        results.push({ success: false, error: error.message, assignment });
      }
    }

    return results;
  }

  /**
   * ✅ Xóa tất cả assignments của một schedule (không cần thiết vì Schedule đã bị xóa)
   * @param {string} classId
   * @param {string} year
   * @param {string} semester
   */
  async deleteBySchedule(classId, year, semester) {
    // ✅ Không cần làm gì vì khi xóa Schedule thì tự động xóa assignments
    return Promise.resolve();
  }

  /**
   * ✅ Lấy tất cả assignments (periods) của một lớp từ Schedule
   * @param {string} classId
   * @param {string} year
   * @param {string} semester
   * @returns {Promise<Array>} Array of periods với teacherId
   */
  async getByClass(classId, year, semester) {
    const schedule = await Schedule.findOne({ classId, year, semester })
      .populate('classId', 'className classCode grade')
      .lean();
    
    if (!schedule || !schedule.timetable) {
      return [];
    }
    
    // ✅ Flatten timetable thành array of periods với thông tin đầy đủ
    const periods = [];
    for (const dayEntry of schedule.timetable) {
      for (const periodEntry of dayEntry.periods) {
        if (periodEntry.teacherId) {
          periods.push({
            day: dayEntry.day,
            period: periodEntry.period,
            teacherId: periodEntry.teacherId,
            teacherName: periodEntry.teacher,
            subjectId: periodEntry.subjectId,
            subjectName: periodEntry.subject,
            classId: schedule.classId,
            className: schedule.className,
            year: schedule.year,
            semester: schedule.semester,
          });
        }
      }
    }
    
    return periods;
  }

  /**
   * ✅ Lấy tất cả assignments (periods) của một giáo viên từ Schedule
   * @param {string} teacherId
   * @param {string} year
   * @param {string} semester
   * @returns {Promise<Array>} Array of periods
   */
  async getByTeacher(teacherId, year, semester) {
    const schedules = await Schedule.find({ 
      year, 
      semester,
      'timetable.periods.teacherId': teacherId
    })
      .populate('classId', 'className classCode grade')
      .lean();
    
    if (!schedules || schedules.length === 0) {
      return [];
    }
    
    // ✅ Flatten timetable thành array of periods
    const periods = [];
    for (const schedule of schedules) {
      if (!schedule.timetable) continue;
      
      for (const dayEntry of schedule.timetable) {
        for (const periodEntry of dayEntry.periods) {
          if (periodEntry.teacherId && periodEntry.teacherId.toString() === teacherId.toString()) {
            periods.push({
              day: dayEntry.day,
              period: periodEntry.period,
              teacherId: periodEntry.teacherId,
              teacherName: periodEntry.teacher,
              subjectId: periodEntry.subjectId,
              subjectName: periodEntry.subject,
              classId: schedule.classId,
              className: schedule.className,
              year: schedule.year,
              semester: schedule.semester,
            });
          }
        }
      }
    }
    
    return periods;
  }

  /**
   * ✅ Get queue status
   */
  getQueueStatus() {
    return scheduleQueue.getStatus();
  }
}

// ✅ Export singleton instance
const scheduleAssignmentService = new ScheduleAssignmentService();

module.exports = scheduleAssignmentService;

