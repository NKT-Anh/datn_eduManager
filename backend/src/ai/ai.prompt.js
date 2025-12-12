const adminPrompts = require('./prompts/admin');
const teacherPrompts = require('./prompts/teacher');
const studentPrompts = require('./prompts/student');
const { formatMenuForPrompt } = require('./prompts/menu-structure');

/**
 * Prompt Engine - Quản lý và tạo prompt theo role và intent
 */
class PromptEngine {
  constructor() {
    this.prompts = {
      admin: adminPrompts,
      teacher: teacherPrompts,
      student: studentPrompts
    };
  }

  /**
   * Lấy system prompt phù hợp với role và context
   * @param {string} role - Role của user (admin, teacher, student, bgh, qlbm, gvcn, gvbm)
   * @param {object} context - Context thông tin user
   * @param {object} memory - Memory từ cuộc trò chuyện trước
   * @returns {string} - System prompt
   */
  getSystemPrompt(role, context = {}, memory = null) {
    // ✅ Map role để lấy đúng prompt module
    let promptRole = role;
    if (role === 'bgh' || role === 'qlbm' || role === 'gvcn' || role === 'gvbm') {
      promptRole = 'teacher';
    }

    const rolePrompts = this.prompts[promptRole] || this.prompts.admin;
    
    // ✅ Lấy base prompt
    let systemPrompt = typeof rolePrompts.getBasePrompt === 'function' 
      ? rolePrompts.getBasePrompt(role, context)
      : rolePrompts.getPrompt();
    
    // ✅ Thêm menu structure để AI có thể hướng dẫn sử dụng hệ thống
    systemPrompt += formatMenuForPrompt(role);
    
    // ✅ Thêm context info
    systemPrompt += this.buildContextInfo(context);
    
    // ✅ Thêm memory context nếu có
    if (memory) {
      systemPrompt += this.buildMemoryContext(memory);
    }
    
    return systemPrompt;
  }

  /**
   * Xây dựng context info từ user context
   */
  buildContextInfo(context) {
    let contextInfo = '\n\n**Thông tin người dùng hiện tại:**';
    
    if (context.userName) {
      contextInfo += `\n- Tên: ${context.userName}`;
    }
    if (context.className) {
      contextInfo += `\n- Lớp: ${context.className}`;
    }
    if (context.grade) {
      contextInfo += `\n- Khối: ${context.grade}`;
    }
    if (context.studentCode) {
      contextInfo += `\n- Mã số học sinh: ${context.studentCode}`;
    }
    if (context.subjects && context.subjects.length > 0) {
      contextInfo += `\n- Môn đang dạy: ${context.subjects.join(', ')}`;
    }
    if (context.classes && context.classes.length > 0) {
      contextInfo += `\n- Lớp đang dạy: ${context.classes.join(', ')}`;
    }
    if (context.isLeader !== undefined) {
      contextInfo += `\n- Là Ban Giám Hiệu: ${context.isLeader ? 'Có' : 'Không'}`;
    }
    if (context.isDepartmentHead !== undefined) {
      contextInfo += `\n- Là Quản lý bộ môn: ${context.isDepartmentHead ? 'Có' : 'Không'}`;
    }
    if (context.isHomeroom !== undefined) {
      contextInfo += `\n- Là Giáo viên chủ nhiệm: ${context.isHomeroom ? 'Có' : 'Không'}`;
    }
    if (context.homeroomClass) {
      contextInfo += `\n- Lớp chủ nhiệm: ${context.homeroomClass}`;
    }
    if (context.role) {
      contextInfo += `\n- Vai trò thực tế: ${context.role}`;
    }
    
    contextInfo += '\n\n**Lưu ý quan trọng:**';
    contextInfo += '\n- Hãy sử dụng thông tin trên để trả lời chính xác và cá nhân hóa câu trả lời cho người dùng.';
    contextInfo += '\n- Khi nhận được kết quả từ function calling, hãy format thành text dễ đọc, KHÔNG hiển thị raw JSON.';
    contextInfo += '\n- Trả lời ngắn gọn, súc tích, chỉ hiển thị thông tin cần thiết.';
    contextInfo += '\n- Sử dụng emoji phù hợp để làm câu trả lời sinh động nhưng không quá nhiều.';
    
    return contextInfo;
  }

  /**
   * Xây dựng memory context
   */
  buildMemoryContext(memory) {
    let memoryInfo = '\n\n**Ngữ cảnh từ cuộc trò chuyện trước:**';
    
    if (memory.lastIntent) {
      memoryInfo += `\n- Hành động gần nhất: ${memory.lastIntent}`;
    }
    if (memory.lastData) {
      try {
        const data = typeof memory.lastData === 'string' ? JSON.parse(memory.lastData) : memory.lastData;
        if (data.className) memoryInfo += `\n- Lớp đang tra cứu: ${data.className}`;
        if (data.subject) memoryInfo += `\n- Môn đang tra cứu: ${data.subject}`;
        if (data.studentName) memoryInfo += `\n- Học sinh đang tra cứu: ${data.studentName}`;
      } catch (e) {
        // Ignore parse error
      }
    }
    
    return memoryInfo;
  }
}

module.exports = new PromptEngine();

