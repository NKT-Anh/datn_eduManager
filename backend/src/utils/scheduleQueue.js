/**
 * ✅ Schedule Queue System - Hàng đợi xử lý gán tiết
 * 
 * Mục đích:
 * - Xử lý gán tiết một cách tuần tự để tránh race condition
 * - Đảm bảo không trùng giáo viên ở cùng timeslot
 * - Hỗ trợ lock mechanism khi commit
 */

class ScheduleQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.locks = new Map(); // Map<lockKey, timestamp> để track locks
    this.lockTimeout = 30000; // 30 giây timeout cho lock
  }

  /**
   * ✅ Thêm job vào queue
   * @param {Function} job - Async function để thực thi
   * @param {Object} options - { priority: number, retry: number }
   * @returns {Promise} Promise resolve khi job hoàn thành
   */
  async enqueue(job, options = {}) {
    const { priority = 0, retry = 0 } = options;
    
    return new Promise((resolve, reject) => {
      this.queue.push({
        job,
        priority,
        retry,
        resolve,
        reject,
      });
      
      // ✅ Sắp xếp queue theo priority (cao hơn = ưu tiên hơn)
      this.queue.sort((a, b) => b.priority - a.priority);
      
      // ✅ Bắt đầu xử lý nếu chưa đang xử lý
      if (!this.processing) {
        this.process();
      }
    });
  }

  /**
   * ✅ Xử lý queue tuần tự
   */
  async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      
      try {
        const result = await item.job();
        item.resolve(result);
      } catch (error) {
        // ✅ Retry nếu còn số lần retry
        if (item.retry > 0) {
          item.retry--;
          this.queue.unshift(item); // Thêm lại vào đầu queue
          await this.delay(1000); // Đợi 1 giây trước khi retry
        } else {
          item.reject(error);
        }
      }
    }

    this.processing = false;
  }

  /**
   * ✅ Tạo lock key từ thông tin timeslot
   */
  createLockKey(teacherId, day, period, year, semester) {
    return `${teacherId}_${day}_${period}_${year}_${semester}`;
  }

  /**
   * ✅ Acquire lock (khóa tài nguyên)
   * @returns {boolean} true nếu acquire thành công, false nếu đã bị lock
   */
  acquireLock(teacherId, day, period, year, semester) {
    const lockKey = this.createLockKey(teacherId, day, period, year, semester);
    const now = Date.now();
    
    // ✅ Kiểm tra xem có lock cũ không (timeout)
    const existingLock = this.locks.get(lockKey);
    if (existingLock) {
      const age = now - existingLock;
      if (age < this.lockTimeout) {
        // ✅ Lock vẫn còn hiệu lực
        return false;
      }
      // ✅ Lock đã hết hạn, xóa nó
      this.locks.delete(lockKey);
    }
    
    // ✅ Tạo lock mới
    this.locks.set(lockKey, now);
    return true;
  }

  /**
   * ✅ Release lock (mở khóa tài nguyên)
   */
  releaseLock(teacherId, day, period, year, semester) {
    const lockKey = this.createLockKey(teacherId, day, period, year, semester);
    this.locks.delete(lockKey);
  }

  /**
   * ✅ Kiểm tra xem có bị lock không
   */
  isLocked(teacherId, day, period, year, semester) {
    const lockKey = this.createLockKey(teacherId, day, period, year, semester);
    const existingLock = this.locks.get(lockKey);
    
    if (!existingLock) {
      return false;
    }
    
    const age = Date.now() - existingLock;
    if (age >= this.lockTimeout) {
      // ✅ Lock đã hết hạn
      this.locks.delete(lockKey);
      return false;
    }
    
    return true;
  }

  /**
   * ✅ Cleanup locks cũ (xóa locks đã hết hạn)
   */
  cleanupLocks() {
    const now = Date.now();
    for (const [lockKey, timestamp] of this.locks.entries()) {
      const age = now - timestamp;
      if (age >= this.lockTimeout) {
        this.locks.delete(lockKey);
      }
    }
  }

  /**
   * ✅ Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * ✅ Clear queue (dùng khi cần reset)
   */
  clear() {
    this.queue = [];
    this.locks.clear();
    this.processing = false;
  }

  /**
   * ✅ Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      activeLocks: this.locks.size,
    };
  }
}

// ✅ Export singleton instance
const scheduleQueue = new ScheduleQueue();

// ✅ Cleanup locks định kỳ (mỗi phút)
setInterval(() => {
  scheduleQueue.cleanupLocks();
}, 60000);

module.exports = scheduleQueue;

