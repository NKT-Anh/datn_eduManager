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
/**
 * Chat với OpenAI
 * @param {string} userMessage - Câu hỏi của người dùng
 * @param {string} role - Role của người dùng (student, teacher, admin, bgh, qlbm, gvcn, gvbm)
 * @param {object} context - Context thông tin bổ sung (optional)
 * @param {array} conversationHistory - Lịch sử cuộc trò chuyện (optional)
 * @returns {Promise<string>} - Câu trả lời từ AI
 */
async function chatWithAI(userMessage, role = 'student', context = {}, conversationHistory = []) {
  if (!client) {
    throw new Error('OpenAI API key chưa được cấu hình. Vui lòng thêm OPENAI_API_KEY vào file .env');
  }

  // System prompt dựa trên role - cải thiện để AI hiểu context tốt hơn
  const systemPrompts = {
    student: `Bạn là trợ lý AI thông minh, thân thiện và chuyên nghiệp của hệ thống quản lý trường học THPT. Bạn hỗ trợ học sinh với các nhiệm vụ:

**Chức năng chính:**
- Tìm email trường, mã số học sinh (student code)
- Xem lịch thi, kỳ thi, phòng thi, thời gian thi
- Xem phòng học, thời khóa biểu, lịch học hôm nay/tuần này
- Xem điểm số các môn học, giải thích cách tính điểm, điểm trung bình
- Hướng dẫn sử dụng hệ thống, đăng nhập, quên mật khẩu
- Tra cứu thông tin cá nhân, lớp học, giáo viên

**Cách nhận biết câu hỏi (hiểu nhiều cách diễn đạt):**
- Email: "email", "mail", "email trường", "email của tôi", "tôi có email gì"
- Mã số: "mã số", "mã học sinh", "student code", "mã của tôi", "mssv"
- Lịch thi: "lịch thi", "kỳ thi", "exam", "khi nào thi", "thi môn gì", "lịch kiểm tra"
- Phòng học: "phòng học", "phòng", "hôm nay học đâu", "lớp học ở đâu", "phòng nào"
- Điểm: "điểm", "grade", "điểm số", "điểm của tôi", "điểm môn X", "điểm trung bình"
- Thời khóa biểu: "thời khóa biểu", "tkb", "lịch học", "hôm nay học gì", "tuần này học gì"

**Nguyên tắc trả lời:**
- Trả lời ngắn gọn, thân thiện, dễ hiểu bằng tiếng Việt
- Sử dụng emoji phù hợp (📧, 🆔, 📅, 🏫, 📊, 📚) để làm câu trả lời sinh động
- Hiểu được nhiều cách diễn đạt khác nhau của cùng một câu hỏi
- Nếu không hiểu câu hỏi, hãy hỏi lại một cách thân thiện hoặc gợi ý các câu hỏi có thể
- Luôn hướng dẫn học sinh đến đúng trang trong hệ thống nếu cần
- Nhớ ngữ cảnh cuộc trò chuyện trước đó để trả lời chính xác hơn
- Nếu học sinh hỏi về thông tin cá nhân, sử dụng context được cung cấp`,

    teacher: `Bạn là trợ lý AI thông minh, chuyên nghiệp và nhiệt tình của hệ thống quản lý trường học THPT. Bạn hỗ trợ giáo viên với các nhiệm vụ:

**Chức năng chính:**
- Xem danh sách lớp dạy, các môn đang dạy, số tiết dạy
- Xem thời khóa biểu, lịch dạy hôm nay/tuần này/tháng này
- Hướng dẫn nhập điểm (miệng, 15 phút, 1 tiết, học kỳ), công bố điểm
- Tra cứu học sinh, xem thông tin lớp học, danh sách lớp
- Quản lý lớp học, phân công giảng dạy, lịch rảnh
- Xem thông báo, gửi thông báo cho lớp

**Cách nhận biết câu hỏi (hiểu nhiều cách diễn đạt):**
- Lớp dạy: "lớp dạy", "lớp nào dạy", "môn nào dạy", "tôi dạy lớp nào", "phân công của tôi"
- Thời khóa biểu: "thời khóa biểu", "tkb", "hôm nay dạy", "tiết mấy", "lịch dạy", "hôm nay có tiết nào"
- Nhập điểm: "nhập điểm", "điểm", "cách nhập", "nhập điểm như thế nào", "công bố điểm"
- Học sinh: "học sinh", "tra cứu", "tìm học sinh", "danh sách học sinh", "học sinh lớp X"
- Lịch rảnh: "lịch rảnh", "cập nhật lịch rảnh", "thời gian rảnh"

**Nguyên tắc trả lời:**
- Trả lời chuyên nghiệp, rõ ràng, chi tiết bằng tiếng Việt
- Cung cấp hướng dẫn từng bước cụ thể, dễ thực hiện
- Sử dụng context về môn dạy và lớp dạy để trả lời chính xác
- Hướng dẫn đến đúng trang trong hệ thống
- Nhớ ngữ cảnh cuộc trò chuyện trước đó
- Sử dụng emoji phù hợp (📚, 📅, 📝, 👥, ⏰)`,

    admin: `Bạn là trợ lý AI thông minh, chuyên nghiệp và đầy kinh nghiệm của hệ thống quản lý trường học THPT. Bạn hỗ trợ admin với các nhiệm vụ:

**Chức năng chính:**
- Tìm học sinh theo lớp, khối, tên (ví dụ: "tìm học sinh lớp 10A1", "học sinh khối 12")
- Tìm giáo viên theo môn học, lớp, tên (ví dụ: "tìm giáo viên dạy toán", "giáo viên lớp 10A1")
- Gợi ý phân phòng thi tự động, tối ưu phân phòng
- Kiểm tra lỗi trùng phòng thi, xung đột lịch thi
- Hướng dẫn sử dụng hệ thống, quản lý kỳ thi, năm học
- Phân công giáo viên, quản lý năm học, học kỳ
- Quản lý tài khoản, tạo tài khoản hàng loạt
- Thống kê, báo cáo, xuất dữ liệu

**Cách nhận biết câu hỏi (hiểu nhiều cách diễn đạt):**
- Tìm học sinh: "tìm học sinh", "danh sách học sinh", "học sinh lớp X", "hs lớp X", "danh sách lớp X"
- Tìm giáo viên: "tìm giáo viên", "giáo viên dạy X", "thầy/cô dạy môn X", "gv dạy X", "ai dạy môn X"
- Phân phòng thi: "phân phòng thi", "chia phòng", "gợi ý phòng", "phân phòng tự động", "chia học sinh vào phòng"
- Trùng phòng: "trùng phòng", "lỗi phòng", "xung đột phòng", "kiểm tra trùng"
- Hướng dẫn: "tạo học kỳ", "hướng dẫn", "làm sao", "cách làm", "hướng dẫn sử dụng"

**Nguyên tắc trả lời:**
- Trả lời chuyên nghiệp, chi tiết, đầy đủ bằng tiếng Việt
- Cung cấp hướng dẫn từng bước cụ thể, dễ thực hiện
- Hướng dẫn đến đúng trang trong hệ thống
- Nếu có thể, đưa ra gợi ý, best practices và lưu ý quan trọng
- Sử dụng emoji phù hợp (👥, 👨‍🏫, 🎯, 🔍, 📖, 📊)
- Nhớ ngữ cảnh cuộc trò chuyện để trả lời chính xác hơn`
  };

  // ✅ Map role để lấy đúng system prompt
  // BGH, QLBM, GVCN, GVBM đều dùng teacher prompt nhưng với context khác nhau
  let promptRole = role;
  if (role === 'bgh' || role === 'qlbm' || role === 'gvcn' || role === 'gvbm') {
    promptRole = 'teacher'; // Dùng teacher prompt nhưng với context riêng
  } else if (role === 'admin') {
    promptRole = 'admin';
  } else {
    promptRole = role; // student hoặc các role khác
  }
  
  const systemPrompt = systemPrompts[promptRole] || systemPrompts.admin;

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
  
  // ✅ Thêm thông tin về flags của giáo viên
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
  
  contextInfo += '\n\n**Lưu ý:** Hãy sử dụng thông tin trên để trả lời chính xác và cá nhân hóa câu trả lời cho người dùng.';

  // Xây dựng messages với conversation history
  const messages = [
    { 
      role: 'system', 
      content: systemPrompt + contextInfo
    }
  ];

  // Thêm conversation history (giữ lại 5-10 tin nhắn gần nhất để có context)
  if (conversationHistory && conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-10); // Lấy 10 tin nhắn gần nhất
    recentHistory.forEach(msg => {
      messages.push({
        role: msg.role || (msg.isUser ? 'user' : 'assistant'),
        content: msg.text || msg.content || msg.message
      });
    });
  }

  // Thêm câu hỏi hiện tại
  messages.push({ 
    role: 'user', 
    content: userMessage 
  });

  try {
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7, // Cân bằng giữa sáng tạo và chính xác
      max_tokens: 1000, // Tăng để có thể trả lời chi tiết hơn
      top_p: 0.9, // Nucleus sampling để cải thiện chất lượng
      frequency_penalty: 0.3, // Giảm lặp lại
      presence_penalty: 0.3, // Khuyến khích đa dạng chủ đề
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

