// middlewares/checkGradeEntryPeriod.js
const Settings = require('../models/settings');

module.exports = async (req, res, next) => {
  try {
    const setting = await Settings.findOne({});
    if (!setting) {
      return res.status(404).json({ message: "Không tìm thấy cấu hình hệ thống." });
    }

    // 🧭 Lấy học kỳ từ query hoặc body (hỗ trợ cả term và semester)d
    let term = req.query.term || req.body.term || req.query.semester || req.body.semester;

    // Nếu không có, tự xác định theo tháng hiện tại
    if (!term) {
      const month = new Date().getMonth() + 1; // getMonth() trả 0-11
      term = month < 7 ? 1 : 2; // Tháng 1-6: HK1, Tháng 7-12: HK2
    }

    term = parseInt(term);

    if (![1, 2].includes(term)) {
      return res.status(400).json({ message: "Giá trị học kỳ (term) không hợp lệ, chỉ chấp nhận 1 hoặc 2." });
    }

    // 🗓️ Lấy thời gian bắt đầu / kết thúc theo học kỳ
    const startDate = term === 1 ? setting.gradeEntryStartHK1 : setting.gradeEntryStartHK2;
    const endDate = term === 1 ? setting.gradeEntryEndHK1 : setting.gradeEntryEndHK2;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: `Chưa cấu hình thời gian nhập điểm cho học kỳ ${term}.` });
    }

    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    // ⚠️ Ngoài khung thời gian cho phép
    if (now < start) {
      return res.status(403).json({
        success: false,
        message: `⏳ Chưa đến thời gian nhập điểm học kỳ ${term}. Bắt đầu từ: ${start.toLocaleString('vi-VN')}`,
      });
    }

    if (now > end) {
      return res.status(403).json({
        success: false,
        message: `⏰ Đã hết hạn nhập điểm học kỳ ${term}. Kết thúc vào: ${end.toLocaleString('vi-VN')}`,
      });
    }

    // ✅ Trong thời gian cho phép → tiếp tục
    next();
  } catch (error) {
    console.error("Lỗi kiểm tra thời gian nhập điểm:", error);
    return res.status(500).json({ message: "Lỗi máy chủ khi kiểm tra thời gian nhập điểm." });
  }
};
