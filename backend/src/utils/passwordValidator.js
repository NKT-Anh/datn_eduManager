const Setting = require('../models/settings');

/**
 * ✅ Validate mật khẩu theo chính sách từ Settings
 * @param {string} password - Mật khẩu cần validate
 * @param {string} policy - 'basic' | 'medium' | 'strong' (optional, nếu không có sẽ lấy từ settings)
 * @returns {Object} { valid: boolean, message: string }
 */
async function validatePassword(password, policy = null) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Mật khẩu không được để trống' };
  }

  // Lấy policy từ settings nếu không được truyền vào
  if (!policy) {
    try {
      const settings = await Setting.findOne().lean();
      policy = settings?.passwordPolicy || 'medium';
    } catch (error) {
      console.error('❌ Lỗi khi lấy password policy từ settings:', error);
      policy = 'medium'; // Fallback
    }
  }

  const errors = [];

  // ✅ Basic: Tối thiểu 6 ký tự
  if (policy === 'basic') {
    if (password.length < 6) {
      errors.push('Mật khẩu phải có ít nhất 6 ký tự');
    }
  }

  // ✅ Medium: Tối thiểu 8 ký tự, có chữ và số
  if (policy === 'medium') {
    if (password.length < 8) {
      errors.push('Mật khẩu phải có ít nhất 8 ký tự');
    }
    if (!/[a-zA-Z]/.test(password)) {
      errors.push('Mật khẩu phải chứa ít nhất một chữ cái');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Mật khẩu phải chứa ít nhất một chữ số');
    }
  }

  // ✅ Strong: Tối thiểu 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt
  if (policy === 'strong') {
    if (password.length < 8) {
      errors.push('Mật khẩu phải có ít nhất 8 ký tự');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Mật khẩu phải chứa ít nhất một chữ cái thường');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Mật khẩu phải chứa ít nhất một chữ cái hoa');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Mật khẩu phải chứa ít nhất một chữ số');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Mật khẩu phải chứa ít nhất một ký tự đặc biệt (!@#$%^&*)');
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      message: errors.join('. ')
    };
  }

  return { valid: true, message: 'Mật khẩu hợp lệ' };
}

/**
 * ✅ Validate mật khẩu đồng bộ (không cần await settings)
 * @param {string} password - Mật khẩu cần validate
 * @param {string} policy - 'basic' | 'medium' | 'strong'
 * @returns {Object} { valid: boolean, message: string }
 */
function validatePasswordSync(password, policy = 'medium') {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Mật khẩu không được để trống' };
  }

  const errors = [];

  // ✅ Basic: Tối thiểu 6 ký tự
  if (policy === 'basic') {
    if (password.length < 6) {
      errors.push('Mật khẩu phải có ít nhất 6 ký tự');
    }
  }

  // ✅ Medium: Tối thiểu 8 ký tự, có chữ và số
  if (policy === 'medium') {
    if (password.length < 8) {
      errors.push('Mật khẩu phải có ít nhất 8 ký tự');
    }
    if (!/[a-zA-Z]/.test(password)) {
      errors.push('Mật khẩu phải chứa ít nhất một chữ cái');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Mật khẩu phải chứa ít nhất một chữ số');
    }
  }

  // ✅ Strong: Tối thiểu 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt
  if (policy === 'strong') {
    if (password.length < 8) {
      errors.push('Mật khẩu phải có ít nhất 8 ký tự');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Mật khẩu phải chứa ít nhất một chữ cái thường');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Mật khẩu phải chứa ít nhất một chữ cái hoa');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Mật khẩu phải chứa ít nhất một chữ số');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Mật khẩu phải chứa ít nhất một ký tự đặc biệt (!@#$%^&*)');
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      message: errors.join('. ')
    };
  }

  return { valid: true, message: 'Mật khẩu hợp lệ' };
}

module.exports = {
  validatePassword,
  validatePasswordSync
};

