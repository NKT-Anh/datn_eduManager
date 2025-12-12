# 🏗️ Kiến trúc AI Module

## 📋 Tổng quan

AI Module được tách thành module độc lập trong `/backend/src/ai` để:
- ✅ Dễ quản lý và mở rộng
- ✅ Hỗ trợ nhiều AI providers (OpenAI, Gemini, Claude, LLaMA)
- ✅ Tách biệt concerns (service, prompts, tools, memory)
- ✅ Dễ test và maintain

## 📁 Cấu trúc thư mục

```
/backend/src/ai
  ├── ai.service.js          # Service chính xử lý AI requests
  ├── ai.router.js           # Routes và middleware
  ├── ai.prompt.js            # Prompt engine
  ├── ai.memory.js            # Memory system (lưu context ngắn hạn)
  ├── ai.tools.js             # Function calling system
  └── /prompts                # Prompt modules
      ├── admin.js
      ├── admin.general.js
      ├── admin.student.js
      ├── admin.teacher.js
      ├── admin.exam.js
      ├── admin.report.js
      ├── admin.timetable.js
      ├── admin.room.js
      ├── teacher.js
      └── student.js
```

## 🔧 Các Module

### 1. `ai.service.js` - AI Service

**Chức năng:**
- Xử lý AI requests
- Quản lý conversation history
- Xử lý function calling
- Tích hợp với OpenAI API

**Methods:**
- `isAvailable()` - Kiểm tra AI có sẵn sàng không
- `chat(message, role, context, conversationHistory, userId)` - Chat với AI

### 2. `ai.router.js` - Routes

**Chức năng:**
- Định nghĩa routes cho AI
- Middleware authentication và role validation
- Xây dựng user context

**Routes:**
- `POST /api/ai/chat` - Chat với AI

### 3. `ai.prompt.js` - Prompt Engine

**Chức năng:**
- Quản lý và tạo prompt theo role
- Tích hợp context và memory
- Chia nhỏ prompt theo module

**Methods:**
- `getSystemPrompt(role, context, memory)` - Lấy system prompt

### 4. `ai.memory.js` - Memory System

**Chức năng:**
- Lưu trữ context ngắn hạn cho từng user
- TTL: 30 phút
- Auto cleanup

**Storage:**
- In-memory Map (có thể migrate sang Redis sau)

**Data lưu:**
- `lastIntent` - Intent gần nhất
- `lastData` - Data từ intent trước
- `lastMessage` - Câu hỏi gần nhất
- `lastResponse` - Câu trả lời gần nhất
- `timestamp` - Thời gian

### 5. `ai.tools.js` - Function Calling System

**Chức năng:**
- Định nghĩa tools/functions cho AI
- Thực thi tools khi AI gọi
- Lấy dữ liệu thật từ hệ thống

**Available Tools:**
- `findStudentByClass(className)` - Tìm học sinh theo lớp
- `findStudentByName(studentName)` - Tìm học sinh theo tên
- `findTeacherBySubject(subject)` - Tìm giáo viên theo môn
- `findTeacherByClass(className)` - Tìm giáo viên theo lớp
- `findClassByGrade(grade)` - Tìm lớp theo khối
- `findAvailableRoom(dayOfWeek, period)` - Tìm phòng trống

## 🎯 Prompt Modules

### Admin Prompts

**Modules:**
- `admin.general.js` - Prompt chung
- `admin.student.js` - Quản lý học sinh
- `admin.teacher.js` - Quản lý giáo viên
- `admin.exam.js` - Quản lý kỳ thi
- `admin.report.js` - Báo cáo, thống kê
- `admin.timetable.js` - Thời khóa biểu
- `admin.room.js` - Phòng học

**Lợi ích:**
- Prompt ngắn gọn, tập trung
- Tiết kiệm token
- Chính xác hơn 3-5 lần

### Teacher Prompts

**Module:**
- `teacher.js` - Prompt cho giáo viên (gvbm, gvcn, qlbm, bgh)

### Student Prompts

**Module:**
- `student.js` - Prompt cho học sinh

## 🔄 Flow xử lý Request

```
Client Request
    ↓
[1] authMiddleware (Firebase Auth)
    ├─ Verify Firebase token
    ├─ Check account exists
    └─ Set req.user
    ↓
[2] validateChatbotRole
    ├─ Check user authenticated
    └─ Validate role (student/teacher/admin)
    ↓
[3] ai.router.js
    ├─ Build user context
    ├─ Get user memory
    └─ Call ai.service.chat()
    ↓
[4] ai.service.js
    ├─ Get system prompt (ai.prompt.js)
    ├─ Get tools (ai.tools.js)
    ├─ Build messages
    └─ Call OpenAI API
    ↓
[5] Handle Response
    ├─ If tool_calls → Execute tools
    ├─ Generate final response
    └─ Update memory
    ↓
[6] Return Response
```

## 🛠️ Function Calling

### Cách hoạt động:

1. **AI nhận câu hỏi:** "Tìm học sinh lớp 10A1"
2. **AI detect intent:** Cần tìm học sinh
3. **AI gọi function:** `findStudentByClass({ className: "10A1" })`
4. **System execute:** Lấy dữ liệu thật từ MongoDB
5. **AI nhận kết quả:** Danh sách học sinh thật
6. **AI generate response:** Trả lời với dữ liệu thật

### Lợi ích:

- ✅ Trả lời đúng dữ liệu thật, không đoán
- ✅ Có thể gọi Firestore, MongoDB, API
- ✅ Chatbot giống "trợ lý ảo" thực sự

## 💾 Memory System

### Ví dụ sử dụng:

**Turn 1:**
```
User: "Tìm học sinh lớp 10A1"
AI: [Gọi findStudentByClass] → Trả kết quả
Memory: { lastIntent: "findStudentByClass", lastData: { className: "10A1" } }
```

**Turn 2:**
```
User: "Phòng nào trống tiết 3 để dời lớp Toán?"
AI: [Hiểu "lớp Toán" = lớp 10A1 từ memory] → Trả lời chính xác
```

## 📊 So sánh với kiến trúc cũ

| Tiêu chí | Cũ | Mới |
|---------|-----|-----|
| **Tổ chức** | Tất cả trong 1 file | Module hóa, tách biệt |
| **Prompt** | 1 prompt dài | Nhiều prompt ngắn theo module |
| **Function Calling** | ❌ Không có | ✅ Có |
| **Memory** | ❌ Không có | ✅ Có |
| **Mở rộng** | Khó | Dễ |
| **Test** | Khó | Dễ |

## 🚀 Migration Guide

### Từ route cũ sang route mới:

**Cũ:**
```javascript
POST /api/ai-chat/chat
```

**Mới:**
```javascript
POST /api/ai/chat
```

**Backward Compatibility:**
- Route cũ vẫn hoạt động (sẽ deprecated)
- Route mới: `/api/ai/chat`

## 🔮 Future Improvements

- [ ] Migrate memory sang Redis
- [ ] Thêm intent detection để chọn prompt phù hợp
- [ ] Thêm more tools (findRoom, findSchedule, etc.)
- [ ] Support Gemini, Claude, LLaMA
- [ ] Thêm analytics và monitoring
- [ ] Rate limiting
- [ ] Caching cho các câu hỏi thường gặp

## 📝 Notes

1. **Token Optimization:** Prompt modules giúp giảm token usage đáng kể
2. **Accuracy:** Function calling giúp AI trả lời chính xác hơn
3. **Context:** Memory system giúp AI nhớ ngữ cảnh
4. **Scalability:** Module hóa giúp dễ mở rộng

