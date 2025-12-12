/**
 * AI Memory System - Lưu trữ context ngắn hạn cho từng user
 * 
 * Memory lưu:
 * - lastIntent: Intent gần nhất (findStudent, findTeacher, etc.)
 * - lastData: Data từ intent trước (className, subject, etc.)
 * - lastMessage: Câu hỏi gần nhất
 * - lastResponse: Câu trả lời gần nhất
 * - timestamp: Thời gian
 */

class MemorySystem {
  constructor() {
    // ✅ In-memory storage (có thể migrate sang Redis sau)
    this.memory = new Map();
    
    // ✅ TTL: 30 phút
    this.TTL = 30 * 60 * 1000;
    
    // ✅ Cleanup interval: 5 phút
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Lấy memory của user
   * @param {string} userId - User ID
   * @returns {object|null} - Memory object hoặc null
   */
  get(userId) {
    const memory = this.memory.get(userId);
    
    if (!memory) {
      return null;
    }
    
    // ✅ Kiểm tra TTL
    if (Date.now() - memory.timestamp > this.TTL) {
      this.memory.delete(userId);
      return null;
    }
    
    return memory;
  }

  /**
   * Cập nhật memory của user
   * @param {string} userId - User ID
   * @param {object} data - Data cần lưu
   */
  update(userId, data) {
    const existing = this.memory.get(userId) || {};
    
    this.memory.set(userId, {
      ...existing,
      ...data,
      timestamp: Date.now()
    });
  }

  /**
   * Xóa memory của user
   * @param {string} userId - User ID
   */
  delete(userId) {
    this.memory.delete(userId);
  }

  /**
   * Xóa tất cả memory đã hết hạn
   */
  cleanup() {
    const now = Date.now();
    for (const [userId, memory] of this.memory.entries()) {
      if (now - memory.timestamp > this.TTL) {
        this.memory.delete(userId);
      }
    }
  }

  /**
   * Lấy tất cả memory (debug)
   */
  getAll() {
    return Array.from(this.memory.entries()).map(([userId, memory]) => ({
      userId,
      ...memory
    }));
  }
}

module.exports = new MemorySystem();

