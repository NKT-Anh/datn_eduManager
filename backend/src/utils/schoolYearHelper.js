/**
 * ✅ Utility: Xác định năm học hiện tại (effective school year)
 * 
 * Thứ tự ưu tiên:
 * 1. Header `x-school-year` hoặc `x-school-year-code`
 * 2. Query parameter `year` hoặc `schoolYear`
 * 3. Body parameter `schoolYear`
 * 4. Active SchoolYear (isActive: true)
 * 5. Settings.currentSchoolYear
 * 6. Environment variable SCHOOL_YEAR
 * 
 * @param {Object} req - Express request object
 * @returns {Promise<string|null>} - Năm học hiện tại hoặc null
 */
async function getEffectiveSchoolYear(req) {
  // ✅ 1. Kiểm tra từ request headers
  const fromHeader = req.headers && (req.headers['x-school-year'] || req.headers['x-school-year-code']);
  if (fromHeader) {
    return String(fromHeader);
  }

  // ✅ 2. Kiểm tra từ query parameters
  const fromQuery = req.query && (req.query.year || req.query.schoolYear);
  if (fromQuery) {
    return String(fromQuery);
  }

  // ✅ 3. Kiểm tra từ body (nếu có)
  const fromBody = req.body && req.body.schoolYear;
  if (fromBody) {
    return String(fromBody);
  }

  // ✅ 4. Lấy từ active SchoolYear
  try {
    const SchoolYearModel = require('../models/schoolYear');
    const active = await SchoolYearModel.findOne({ isActive: true }).lean();
    if (active && active.code) {
      return String(active.code);
    }
  } catch (e) {
    // Ignore và fallback
  }

  // ✅ 5. Lấy từ Settings
  try {
    const Setting = require('../models/settings');
    const s = await Setting.findOne().lean();
    if (s && s.currentSchoolYear) {
      return String(s.currentSchoolYear);
    }
  } catch (e) {
    // Ignore và fallback
  }

  // ✅ 6. Fallback về environment variable
  return process.env.SCHOOL_YEAR || null;
}

/**
 * ✅ Utility: Lấy năm học hiện tại (không cần request)
 * 
 * Thứ tự ưu tiên:
 * 1. Active SchoolYear (isActive: true)
 * 2. Settings.currentSchoolYear
 * 3. Environment variable SCHOOL_YEAR
 * 
 * @returns {Promise<string|null>} - Năm học hiện tại hoặc null
 */
async function getCurrentSchoolYear() {
  // ✅ 1. Lấy từ active SchoolYear
  try {
    const SchoolYearModel = require('../models/schoolYear');
    const active = await SchoolYearModel.findOne({ isActive: true }).lean();
    if (active && active.code) {
      return String(active.code);
    }
  } catch (e) {
    // Ignore và fallback
  }

  // ✅ 2. Lấy từ Settings
  try {
    const Setting = require('../models/settings');
    const s = await Setting.findOne().lean();
    if (s && s.currentSchoolYear) {
      return String(s.currentSchoolYear);
    }
  } catch (e) {
    // Ignore và fallback
  }

  // ✅ 3. Fallback về environment variable
  return process.env.SCHOOL_YEAR || null;
}

module.exports = {
  getEffectiveSchoolYear,
  getCurrentSchoolYear,
};

