const { OpenAI } = require('openai');
const promptEngine = require('./ai.prompt');
const aiMemory = require('./ai.memory');
const aiTools = require('./ai.tools');

// Khởi tạo OpenAI client
const client = process.env.OPENAI_API_KEY 
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  : null;

/**
 * AI Service - Service chính xử lý AI requests
 */
class AIService {
  constructor() {
    this.client = client;
    this.promptEngine = promptEngine;
    this.memory = aiMemory;
    this.tools = aiTools;
  }

  /**
   * Kiểm tra AI có sẵn sàng không
   */
  isAvailable() {
    return this.client !== null;
  }

  /**
   * Chat với AI
   * @param {string} userMessage - Câu hỏi của người dùng
   * @param {string} role - Role của người dùng
   * @param {object} context - Context thông tin bổ sung
   * @param {array} conversationHistory - Lịch sử cuộc trò chuyện
   * @param {string} userId - ID người dùng để lưu memory
   * @returns {Promise<object>} - Response từ AI (có thể có function calls)
   */
  async chat(userMessage, role, context = {}, conversationHistory = [], userId = null) {
    if (!this.isAvailable()) {
      throw new Error('OpenAI API key chưa được cấu hình. Vui lòng thêm OPENAI_API_KEY vào file .env');
    }

    // ✅ Lấy memory của user (nếu có)
    const userMemory = userId ? this.memory.get(userId) : null;
    
    // ✅ Lấy prompt phù hợp với role và intent
    const systemPrompt = this.promptEngine.getSystemPrompt(role, context, userMemory);
    
    // ✅ Lấy tools/functions cho role này
    const tools = this.tools.getToolsForRole(role, context);
    
    // ✅ Xây dựng messages
    const messages = this.buildMessages(systemPrompt, conversationHistory, userMessage, userMemory);
    
    try {
      // ✅ Gọi OpenAI với tools
      const response = await this.client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
        temperature: 0.7,
        max_tokens: 2000,
        top_p: 0.9,
        frequency_penalty: 0.3,
        presence_penalty: 0.3,
      });

      const assistantMessage = response.choices[0].message;
      
      // ✅ Nếu AI muốn gọi function
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        return await this.handleToolCalls(assistantMessage, userId, context);
      }
      
      // ✅ Lưu memory nếu có userId
      if (userId) {
        this.memory.update(userId, {
          lastMessage: userMessage,
          lastResponse: assistantMessage.content,
          timestamp: new Date()
        });
      }
      
      return {
        text: assistantMessage.content,
        type: 'text'
      };
    } catch (error) {
      console.error('❌ [AI Service Error]:', error);
      throw error;
    }
  }

  /**
   * Xây dựng messages array
   */
  buildMessages(systemPrompt, conversationHistory, userMessage, userMemory) {
    const messages = [
      { 
        role: 'system', 
        content: systemPrompt
      }
    ];

    // ✅ Thêm memory context nếu có
    if (userMemory && userMemory.lastIntent) {
      messages.push({
        role: 'system',
        content: `**Ngữ cảnh từ cuộc trò chuyện trước:** ${JSON.stringify(userMemory)}`
      });
    }

    // ✅ Thêm conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-10);
      recentHistory.forEach(msg => {
        messages.push({
          role: msg.role || (msg.isUser ? 'user' : 'assistant'),
          content: msg.text || msg.content || msg.message
        });
      });
    }

    // ✅ Thêm câu hỏi hiện tại
    messages.push({ 
      role: 'user', 
      content: userMessage 
    });

    return messages;
  }

  /**
   * Format tool result thành text dễ đọc
   */
  formatToolResult(functionName, result) {
    if (!result.success) {
      return result.message || 'Không tìm thấy dữ liệu';
    }

    try {
      switch (functionName) {
        // Tìm học sinh
        case 'findStudentByClass':
          if (result.students && result.students.length > 0) {
            const studentList = result.students.slice(0, 10).map((s, idx) => 
              `${idx + 1}. ${s.name} (${s.studentCode})`
            ).join('\n');
            const more = result.students.length > 10 ? `\n... và ${result.students.length - 10} học sinh khác` : '';
            return `Tìm thấy ${result.count} học sinh trong lớp ${result.className}:\n${studentList}${more}`;
          }
          return `Không tìm thấy học sinh nào trong lớp ${result.className}`;

        case 'findStudentByName':
          if (result.students && result.students.length > 0) {
            const studentList = result.students.slice(0, 10).map((s, idx) => 
              `${idx + 1}. ${s.name} (${s.studentCode}) - Lớp: ${s.className}`
            ).join('\n');
            const more = result.students.length > 10 ? `\n... và ${result.students.length - 10} học sinh khác` : '';
            return `Tìm thấy ${result.count} học sinh:\n${studentList}${more}`;
          }
          return 'Không tìm thấy học sinh nào';

        case 'findStudentByCode':
          if (result.student) {
            return `Học sinh: ${result.student.name} (${result.student.studentCode})\nLớp: ${result.student.className}\nEmail: ${result.student.email || 'N/A'}`;
          }
          return result.message || 'Không tìm thấy học sinh';

        // Tìm giáo viên
        case 'findTeacherBySubject':
          if (result.teachers && result.teachers.length > 0) {
            const teacherList = result.teachers.map((t, idx) => {
              const classNames = t.classes
                ?.map(c => typeof c === 'string' ? c : (c.className || c))
                .filter(c => c && c !== 'undefined') || [];
              const uniqueClasses = Array.from(new Set(classNames));
              const classes = uniqueClasses.length > 0 ? uniqueClasses.join(', ') : 'Chưa có lớp';
              const teacherCode = t.teacher?.teacherCode || 'N/A';
              return `${idx + 1}. ${t.teacher?.name || 'N/A'} (${teacherCode}) - Dạy: ${classes}`;
            }).join('\n');
            return `Có ${result.count} giáo viên dạy môn ${result.subject}:\n\n${teacherList}`;
          }
          return `Không tìm thấy giáo viên nào dạy môn ${result.subject}`;

        case 'findTeacherByClass':
          if (result.teachers && result.teachers.length > 0) {
            const teacherList = result.teachers.map((t, idx) => 
              `${idx + 1}. ${t.teacher?.name || 'N/A'} - Môn: ${t.subject?.name || 'N/A'}`
            ).join('\n');
            return `Lớp ${result.className} có ${result.count} giáo viên:\n${teacherList}`;
          }
          return `Không tìm thấy giáo viên nào dạy lớp ${result.className}`;

        case 'findTeacherByName':
          if (result.teachers && result.teachers.length > 0) {
            const teacherList = result.teachers.map((t, idx) => 
              `${idx + 1}. ${t.name} (${t.teacherCode}) - Tổ: ${t.department}`
            ).join('\n');
            return `Tìm thấy ${result.count} giáo viên:\n${teacherList}`;
          }
          return 'Không tìm thấy giáo viên nào';

        // Tìm lớp học
        case 'findClassByGrade':
          if (result.classes && result.classes.length > 0) {
            const classList = result.classes.map(c => c.className).join(', ');
            return `Khối ${result.grade} có ${result.count} lớp: ${classList}`;
          }
          return `Không tìm thấy lớp nào trong khối ${result.grade}`;

        case 'findClassByName':
          if (result.class) {
            return `Lớp: ${result.class.className}\nKhối: ${result.class.grade}\nNăm học: ${result.class.year || 'N/A'}`;
          }
          return result.message || 'Không tìm thấy lớp';

        // Phòng học
        case 'findAvailableRoom':
          if (result.rooms && result.rooms.length > 0) {
            const roomList = result.rooms.map((r, idx) => 
              `${idx + 1}. ${r.roomCode} (Sức chứa: ${r.capacity})`
            ).join('\n');
            return `Tìm thấy ${result.count} phòng trống ${result.dayOfWeek} tiết ${result.period}:\n${roomList}`;
          }
          return `Không có phòng trống ${result.dayOfWeek} tiết ${result.period}`;

        case 'checkRoomConflict':
          if (result.conflict) {
            const conflictList = result.conflicts.map((c, idx) => 
              `${idx + 1}. ${c.className} - ${c.subject} (GV: ${c.teacher})`
            ).join('\n');
            return `⚠️ Phòng ${result.roomCode} bị xung đột:\n${conflictList}`;
          }
          return `✅ Phòng ${result.roomCode} không bị xung đột`;

        case 'getRoomCapacity':
          return `Phòng ${result.roomCode}: Sức chứa ${result.capacity} người, Loại: ${result.type}, Trạng thái: ${result.status}`;

        // Kỳ thi
        case 'checkExamRoomConflict':
          if (result.conflictCount > 0) {
            const conflictList = result.conflicts.slice(0, 5).map((c, idx) => 
              `${idx + 1}. Phòng ${c.roomCode} - ${c.date} ${c.time}: ${c.schedule1.subject} vs ${c.schedule2.subject}`
            ).join('\n');
            const more = result.conflicts.length > 5 ? `\n... và ${result.conflicts.length - 5} xung đột khác` : '';
            return `⚠️ Kỳ thi "${result.examName}" có ${result.conflictCount} xung đột phòng:\n${conflictList}${more}`;
          }
          return `✅ Kỳ thi "${result.examName}" không có xung đột phòng`;

        case 'suggestExamRoomAssignment':
          if (result.canAccommodate) {
            const roomList = result.suggestedRooms.map((r, idx) => 
              `${idx + 1}. ${r.roomCode} (${r.suggestedStudents} học sinh)`
            ).join('\n');
            return `✅ Gợi ý phân phòng:\n- Tổng học sinh: ${result.totalStudents}\n- Số phòng: ${result.suggestedRoomCount}\n\nDanh sách phòng:\n${roomList}`;
          }
          return `⚠️ Không đủ phòng: Cần ${result.totalStudents} chỗ nhưng chỉ có ${result.totalCapacity} chỗ`;

        case 'getExamStudents':
          if (result.students && result.students.length > 0) {
            const studentList = result.students.slice(0, 10).map((s, idx) => 
              `${idx + 1}. ${s.name} (${s.studentCode}) - ${s.className}`
            ).join('\n');
            const more = result.students.length > 10 ? `\n... và ${result.students.length - 10} học sinh khác` : '';
            return `Kỳ thi có ${result.count} học sinh dự thi:\n${studentList}${more}`;
          }
          return 'Không có học sinh dự thi';

        case 'getExamSchedule':
          if (result.schedules && result.schedules.length > 0) {
            const scheduleList = result.schedules.map((s, idx) => 
              `${idx + 1}. ${s.subject} - ${s.date} ${s.startTime}-${s.endTime} (Khối ${s.grade})`
            ).join('\n');
            return `Lịch thi (${result.count} môn):\n${scheduleList}`;
          }
          return 'Chưa có lịch thi';

        case 'getExamRoomStats':
          return `Thống kê phòng thi:\n- Tổng phòng: ${result.totalRooms}\n- Sức chứa: ${result.totalCapacity}\n- Đã phân: ${result.assignedStudents}\n- Tỷ lệ sử dụng: ${result.utilizationRate}%`;

        // Thời khóa biểu
        case 'suggestScheduleGeneration':
          if (result.classesWithoutSchedule > 0) {
            return `📋 Gợi ý: Có ${result.classesWithoutSchedule}/${result.totalClasses} lớp chưa có TKB.\n${result.suggestion}`;
          }
          return `✅ Tất cả lớp đã có thời khóa biểu`;

        case 'checkScheduleConflict':
          if (result.conflictCount > 0) {
            const conflictList = result.conflicts.slice(0, 5).map((c, idx) => 
              `${idx + 1}. GV ${c.teacherId} - ${c.day} tiết ${c.period}: ${c.className1} vs ${c.className2}`
            ).join('\n');
            const more = result.conflicts.length > 5 ? `\n... và ${result.conflicts.length - 5} xung đột khác` : '';
            return `⚠️ Phát hiện ${result.conflictCount} xung đột:\n${conflictList}${more}`;
          }
          return `✅ Không có xung đột thời khóa biểu`;

        case 'getClassSchedule':
          if (result.schedule) {
            return `✅ Lớp ${result.className} đã có thời khóa biểu cho ${result.year} HK${result.semester}`;
          }
          return result.message || 'Chưa có thời khóa biểu';

        case 'getTeacherSchedule':
          if (result.schedule && result.schedule.length > 0) {
            const scheduleList = result.schedule.slice(0, 10).map((s, idx) => 
              `${idx + 1}. ${s.day} tiết ${s.period}: ${s.subject} - ${s.className}`
            ).join('\n');
            const more = result.schedule.length > 10 ? `\n... và ${result.schedule.length - 10} tiết khác` : '';
            return `Lịch dạy của ${result.teacherName} (${result.count} tiết):\n${scheduleList}${more}`;
          }
          return `Giáo viên ${result.teacherName} chưa có lịch dạy`;

        // Giáo viên
        case 'findAvailableTeachers':
          if (result.teachers && result.teachers.length > 0) {
            const teacherList = result.teachers.slice(0, 10).map((t, idx) => 
              `${idx + 1}. ${t.name} (${t.teacherCode})`
            ).join('\n');
            const more = result.teachers.length > 10 ? `\n... và ${result.teachers.length - 10} giáo viên khác` : '';
            return `Tìm thấy ${result.count} giáo viên rảnh ${result.dayOfWeek} tiết ${result.period}:\n${teacherList}${more}`;
          }
          return `Không có giáo viên rảnh ${result.dayOfWeek} tiết ${result.period}`;

        case 'getTeacherWorkload':
          return `Khối lượng công việc ${result.teacherName}:\n- Số lớp: ${result.classCount}\n- Số môn: ${result.subjectCount}\n- Lớp: ${result.classes.join(', ')}\n- Môn: ${result.subjects.join(', ')}`;

        case 'checkTeacherAvailability':
          return result.available 
            ? `✅ Giáo viên ${result.teacherName} rảnh ${result.dayOfWeek} tiết ${result.period}`
            : `❌ Giáo viên ${result.teacherName} không rảnh ${result.dayOfWeek} tiết ${result.period}`;

        // Thống kê
        case 'getClassStatistics':
          return `Thống kê lớp ${result.className}:\n- Số học sinh: ${result.studentCount}\n- Số giáo viên: ${result.teacherCount}\n- Khối: ${result.grade}`;

        case 'getSubjectStatistics':
          return `Thống kê môn ${result.subjectName}:\n- Số lớp: ${result.classCount}\n- Số giáo viên: ${result.teacherCount}\n- Lớp: ${result.classes.join(', ')}\n- Giáo viên: ${result.teachers.join(', ')}`;

        case 'getSystemStatistics':
          return `📊 Thống kê hệ thống:\n- Học sinh: ${result.statistics.students}\n- Giáo viên: ${result.statistics.teachers}\n- Lớp học: ${result.statistics.classes}\n- Môn học: ${result.statistics.subjects}\n- Phòng học: ${result.statistics.rooms}\n- Kỳ thi: ${result.statistics.exams}`;

        // Thông báo
        case 'generateNotification':
          return `💡 Gợi ý thông báo:\n\n${result.suggestedContent}\n\n${result.note}`;

        default:
          // Fallback: format JSON một cách dễ đọc
          if (typeof result === 'object') {
            const keyValuePairs = Object.entries(result)
              .filter(([key]) => key !== 'success')
              .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.length : value}`)
              .join('\n');
            return keyValuePairs || 'Đã thực hiện thành công';
          }
          return String(result);
      }
    } catch (error) {
      console.error(`❌ [Format Tool Result Error] ${functionName}:`, error);
      return result.message || 'Đã xảy ra lỗi khi format kết quả';
    }
  }

  /**
   * Xử lý tool calls từ AI
   */
  async handleToolCalls(assistantMessage, userId, context) {
    const toolCalls = assistantMessage.tool_calls;
    const toolResults = [];

    // ✅ Thực thi từng tool call
    for (const toolCall of toolCalls) {
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments || '{}');
      
      try {
        // ✅ Gọi function từ aiTools (truyền context để các function có thể lấy thông tin user)
        const result = await this.tools.executeTool(functionName, functionArgs, context);
        
        // ✅ Format result thành text dễ đọc thay vì JSON
        const formattedResult = this.formatToolResult(functionName, result);
        
        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: functionName,
          content: formattedResult
        });
      } catch (error) {
        console.error(`❌ [Tool Execution Error] ${functionName}:`, error);
        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: functionName,
          content: `Lỗi: ${error.message}`
        });
      }
    }

    // ✅ Gửi kết quả về cho AI để generate final response
    const messages = [
      { role: 'assistant', content: assistantMessage.content, tool_calls: toolCalls },
      ...toolResults
    ];

    try {
      // ✅ Thêm instruction để AI format response ngắn gọn
      messages.push({
        role: 'system',
        content: '**QUAN TRỌNG:** Bạn đã nhận được kết quả từ function calling. Hãy sử dụng kết quả đó để trả lời người dùng một cách ngắn gọn, dễ đọc. KHÔNG hiển thị raw JSON, KHÔNG lặp lại toàn bộ dữ liệu. Chỉ hiển thị thông tin cần thiết, format đẹp với emoji phù hợp.'
      });

      const finalResponse = await this.client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000 // Giảm để response ngắn gọn hơn
      });

      const finalMessage = finalResponse.choices[0].message.content;
      
      // ✅ Lưu memory với intent và data
      if (userId) {
        this.memory.update(userId, {
          lastIntent: toolCalls[0]?.function.name,
          lastData: toolCalls[0]?.function.arguments,
          lastMessage: messages[messages.length - 2]?.content,
          lastResponse: finalMessage,
          timestamp: new Date()
        });
      }

      return {
        text: finalMessage,
        type: 'text',
        toolCalls: toolCalls.map(tc => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments)
        }))
      };
    } catch (error) {
      console.error('❌ [Final Response Error]:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new AIService();

