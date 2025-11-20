const { OpenAI } = require('openai');

// Khởi tạo OpenAI client
const client = process.env.OPENAI_API_KEY 
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  : null;

/**
 * Chat với OpenAI
 * @param {string} userMessage - Câu hỏi của người dùng
 * @param {string} role - Role của người dùng (student, teacher, admin)
 * @param {object} context - Context thông tin bổ sung (optional)
 * @returns {Promise<string>} - Câu trả lời từ AI
 */
async function chatWithAI(userMessage, role = 'student', context = {}) {
  if (!client) {
    throw new Error('OpenAI API key chưa được cấu hình. Vui lòng thêm OPENAI_API_KEY vào file .env');
  }

  // System prompt dựa trên role - cải thiện để AI hiểu context tốt hơn
  const systemPrompts = {
    student: `Bạn là trợ lý AI thông minh và thân thiện của hệ thống quản lý trường học THPT. Bạn hỗ trợ học sinh với các nhiệm vụ:

**Chức năng chính:**
- Tìm email trường, mã số học sinh (student code)
- Xem lịch thi, kỳ thi, phòng thi
- Xem phòng học, thời khóa biểu
- Xem điểm số các môn học, giải thích cách tính điểm
- Hướng dẫn sử dụng hệ thống

**Cách nhận biết câu hỏi:**
- "email", "mail" → Tìm email trường
- "mã số", "mã học sinh", "student code" → Tìm mã số
- "lịch thi", "kỳ thi", "exam" → Xem lịch thi
- "phòng học", "phòng", "hôm nay học đâu" → Tìm phòng học
- "điểm", "grade", "điểm số" → Xem điểm
- "học kỳ", "tính điểm", "cách tính" → Giải thích cách tính điểm

**Nguyên tắc trả lời:**
- Trả lời ngắn gọn, thân thiện, dễ hiểu bằng tiếng Việt
- Sử dụng emoji phù hợp để làm câu trả lời sinh động
- Nếu không hiểu câu hỏi, hãy hỏi lại hoặc gợi ý các câu hỏi có thể
- Luôn hướng dẫn học sinh đến đúng trang trong hệ thống nếu cần`,

    teacher: `Bạn là trợ lý AI thông minh và chuyên nghiệp của hệ thống quản lý trường học THPT. Bạn hỗ trợ giáo viên với các nhiệm vụ:

**Chức năng chính:**
- Xem danh sách lớp dạy, các môn đang dạy
- Xem thời khóa biểu, lịch dạy hôm nay/tuần này
- Hướng dẫn nhập điểm (miệng, 15 phút, 1 tiết, học kỳ)
- Tra cứu học sinh, xem thông tin lớp học
- Quản lý lớp học, phân công giảng dạy

**Cách nhận biết câu hỏi:**
- "lớp dạy", "lớp nào dạy", "môn nào dạy" → Danh sách lớp dạy
- "thời khóa biểu", "tkb", "hôm nay dạy", "tiết mấy" → Xem lịch dạy
- "nhập điểm", "điểm", "cách nhập" → Hướng dẫn nhập điểm
- "học sinh", "tra cứu", "tìm học sinh" → Tra cứu học sinh

**Nguyên tắc trả lời:**
- Trả lời chuyên nghiệp, rõ ràng bằng tiếng Việt
- Cung cấp hướng dẫn từng bước cụ thể
- Hướng dẫn đến đúng trang trong hệ thống`,

    admin: `Bạn là trợ lý AI thông minh và chuyên nghiệp của hệ thống quản lý trường học THPT. Bạn hỗ trợ admin với các nhiệm vụ:

**Chức năng chính:**
- Tìm học sinh theo lớp (ví dụ: "tìm học sinh lớp 10A1")
- Tìm giáo viên theo môn học (ví dụ: "tìm giáo viên dạy toán")
- Gợi ý phân phòng thi tự động
- Kiểm tra lỗi trùng phòng thi
- Hướng dẫn sử dụng hệ thống, quản lý kỳ thi
- Phân công giáo viên, quản lý năm học

**Cách nhận biết câu hỏi:**
- "tìm học sinh", "danh sách học sinh", "học sinh lớp X" → Tìm học sinh
- "tìm giáo viên", "giáo viên dạy X", "thầy/cô dạy môn X" → Tìm giáo viên
- "phân phòng thi", "chia phòng", "gợi ý phòng" → Phân phòng thi
- "trùng phòng", "lỗi phòng" → Kiểm tra trùng phòng
- "tạo học kỳ", "hướng dẫn", "làm sao" → Hướng dẫn sử dụng

**Nguyên tắc trả lời:**
- Trả lời chuyên nghiệp, chi tiết bằng tiếng Việt
- Cung cấp hướng dẫn từng bước cụ thể
- Hướng dẫn đến đúng trang trong hệ thống
- Nếu có thể, đưa ra gợi ý và best practices`
  };

  const systemPrompt = systemPrompts[role] || systemPrompts.admin;

  // Thêm context chi tiết để AI hiểu rõ hơn về người dùng
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
  
  contextInfo += '\n\n**Lưu ý:** Hãy sử dụng thông tin trên để trả lời chính xác và cá nhân hóa câu trả lời cho người dùng.';

  try {
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: systemPrompt + contextInfo
        },
        { 
          role: 'user', 
          content: userMessage 
        }
      ],
      temperature: 0.8, // Tăng lên để AI linh hoạt hơn trong việc hiểu câu hỏi
      max_tokens: 800, // Tăng để có thể trả lời chi tiết hơn
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('❌ [OpenAI Error]:', error);
    throw error;
  }
}

/**
 * Kiểm tra xem OpenAI có sẵn sàng không
 */
function isAvailable() {
  return client !== null;
}

module.exports = {
  chatWithAI,
  isAvailable
};

