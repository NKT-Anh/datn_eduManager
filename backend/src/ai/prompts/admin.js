/**
 * Admin Prompts - Prompt modules cho Admin
 */

const adminGeneral = require('./admin.general');
const adminStudent = require('./admin.student');
const adminTeacher = require('./admin.teacher');
const adminExam = require('./admin.exam');
const adminReport = require('./admin.report');
const adminTimetable = require('./admin.timetable');
const adminRoom = require('./admin.room');

class AdminPrompts {
  /**
   * Lấy base prompt cho admin
   */
  getBasePrompt(role, context = {}) {
    // ✅ Base prompt chung
    let basePrompt = adminGeneral.getPrompt();
    
    // ✅ Thêm prompt theo intent (nếu có thể detect)
    // Tạm thời dùng base prompt, có thể cải thiện sau với intent detection
    
    return basePrompt;
  }

  /**
   * Lấy prompt cho chức năng cụ thể
   */
  getPromptForIntent(intent) {
    switch (intent) {
      case 'student':
      case 'findStudent':
      case 'searchStudent':
        return adminStudent.getPrompt();
      
      case 'teacher':
      case 'findTeacher':
      case 'searchTeacher':
        return adminTeacher.getPrompt();
      
      case 'exam':
      case 'examRoom':
      case 'examSchedule':
        return adminExam.getPrompt();
      
      case 'report':
      case 'statistics':
      case 'export':
        return adminReport.getPrompt();
      
      case 'timetable':
      case 'schedule':
      case 'tkb':
        return adminTimetable.getPrompt();
      
      case 'room':
      case 'findRoom':
      case 'availableRoom':
        return adminRoom.getPrompt();
      
      default:
        return adminGeneral.getPrompt();
    }
  }
}

module.exports = new AdminPrompts();

