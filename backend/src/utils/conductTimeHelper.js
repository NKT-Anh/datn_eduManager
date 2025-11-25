/**
 * Helper functions để kiểm tra thời gian nhập hạnh kiểm
 */

const Setting = require('../models/settings');

/**
 * Kiểm tra xem có đang trong thời gian cho phép nhập hạnh kiểm không
 * @param {string} semester - 'HK1' hoặc 'HK2'
 * @param {boolean} isAdmin - Có phải admin không (admin có thể override)
 * @returns {Promise<{allowed: boolean, startDate: string, endDate: string, message: string}>}
 */
async function checkConductEntryTime(semester, isAdmin = false) {
  try {
    const setting = await Setting.findOne();
    if (!setting) {
      return {
        allowed: isAdmin, // Admin luôn được phép
        startDate: null,
        endDate: null,
        message: isAdmin ? 'Chưa có cấu hình thời gian. Admin có thể nhập.' : 'Chưa có cấu hình thời gian nhập hạnh kiểm'
      };
    }

    let startDate, endDate;
    if (semester === 'HK1') {
      startDate = setting.conductEntryStartHK1;
      endDate = setting.conductEntryEndHK1;
    } else if (semester === 'HK2') {
      startDate = setting.conductEntryStartHK2;
      endDate = setting.conductEntryEndHK2;
    } else {
      return {
        allowed: false,
        startDate: null,
        endDate: null,
        message: 'Học kỳ không hợp lệ'
      };
    }

    // Nếu chưa cấu hình thời gian
    if (!startDate || !endDate) {
      return {
        allowed: isAdmin,
        startDate: startDate || null,
        endDate: endDate || null,
        message: isAdmin ? 'Chưa cấu hình thời gian. Admin có thể nhập.' : 'Chưa cấu hình thời gian nhập hạnh kiểm cho học kỳ này'
      };
    }

    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Đảm bảo end date bao gồm cả ngày cuối (set time 23:59:59)
    end.setHours(23, 59, 59, 999);

    // Admin có thể override nếu allowAdminConductOverride = true
    if (isAdmin && setting.allowAdminConductOverride) {
      return {
        allowed: true,
        startDate: startDate,
        endDate: endDate,
        message: 'Admin có quyền nhập hạnh kiểm bất kỳ lúc nào'
      };
    }

    // Kiểm tra thời gian
    if (now < start) {
      return {
        allowed: false,
        startDate: startDate,
        endDate: endDate,
        message: `Chưa đến thời gian nhập hạnh kiểm. Thời gian cho phép: ${formatDate(startDate)} - ${formatDate(endDate)}`
      };
    }

    if (now > end) {
      return {
        allowed: false,
        startDate: startDate,
        endDate: endDate,
        message: `Đã hết thời gian nhập hạnh kiểm. Thời gian đã qua: ${formatDate(startDate)} - ${formatDate(endDate)}`
      };
    }

    return {
      allowed: true,
      startDate: startDate,
      endDate: endDate,
      message: 'Đang trong thời gian cho phép nhập hạnh kiểm'
    };
  } catch (error) {
    console.error('Error checking conduct entry time:', error);
    return {
      allowed: false,
      startDate: null,
      endDate: null,
      message: 'Lỗi kiểm tra thời gian nhập hạnh kiểm'
    };
  }
}

/**
 * Format date để hiển thị
 */
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Kiểm tra xem hạnh kiểm đã bị khóa (locked) chưa
 * @param {Object} record - StudentYearRecord
 * @param {boolean} isAdmin - Có phải admin không
 * @returns {Promise<boolean>}
 */
async function isConductLocked(record, isAdmin = false) {
  if (!record) return false;
  
  // Admin có thể override nếu allowAdminConductOverride = true
  if (isAdmin) {
    try {
      const Setting = require('../models/settings');
      const setting = await Setting.findOne();
      if (setting && setting.allowAdminConductOverride) {
        return false; // Admin có thể sửa
      }
    } catch (error) {
      console.error('Error checking admin override:', error);
    }
  }
  
  return record.conductStatus === 'locked';
}

module.exports = {
  checkConductEntryTime,
  formatDate,
  isConductLocked
};

