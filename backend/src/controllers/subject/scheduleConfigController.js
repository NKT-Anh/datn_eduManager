const ScheduleConfig = require('../../models/subject/scheduleConfig');

// ✅ [GET] /api/scheduleConfig
exports.getScheduleConfig = async (req, res) => {
  try {
    const config = await ScheduleConfig.findOne();
    res.json(config);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi khi lấy cấu hình thời khóa biểu" });
  }
};

// ✅ [POST] /api/scheduleConfig
// Upsert toàn bộ config
exports.upsertScheduleConfig = async (req, res) => {
  try {
    console.log("📩 Body nhận được:", req.body);

    const data = req.body;

    let config = await ScheduleConfig.findOne();
    if (config) {
      console.log("🟡 Đã có config, cập nhật...");
      Object.assign(config, data);
      await config.save();
    } else {
      console.log("🟢 Chưa có config, tạo mới...");
      config = await ScheduleConfig.create(data);
    }

    res.status(200).json({ message: "Đã lưu cấu hình thành công", config });
  } catch (err) {
     console.error("🔥 [ScheduleConfig] Lỗi khi lưu cấu hình:");
  console.error(err.stack || err);
    res.status(500).json({ message: "Lỗi khi lưu cấu hình", error: err.message });
  }
};


// ✅ [PATCH] /api/scheduleConfig/day/:day
exports.updateDayConfig = async (req, res) => {
  try {
    const { day } = req.params;
    const { totalPeriods, morningPeriods } = req.body;

    let config = await ScheduleConfig.findOne();
    if (!config) config = await ScheduleConfig.create({});

    const currentDay = config.days.get(day) || {};
    const newConfig = {
      ...currentDay,
      totalPeriods: totalPeriods ?? currentDay.totalPeriods,
      morningPeriods: morningPeriods ?? currentDay.morningPeriods,
    };

    newConfig.afternoonPeriods = Math.max(0, newConfig.totalPeriods - newConfig.morningPeriods);

    config.days.set(day, newConfig);
    await config.save();

    res.status(200).json({
      message: `Đã cập nhật lịch cho thứ ${day}`,
      day: day,
      config: config.days.get(day),
    });
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi cập nhật ngày", error: err.message });
  }
};

// ✅ [PATCH] /api/scheduleConfig/subject-hours
// Cập nhật subjectHours theo model mới
exports.updateSubjectHours = async (req, res) => {
  try {
    const { subjectHours } = req.body;
    /**
     * subjectHours = {
     *   "Toán": { periodsPerWeek: 4, maxPeriodsPerDay: 2, allowConsecutive: true, session: "main" },
     *   "Văn": { periodsPerWeek: 3 }
     * }
     */

    if (!subjectHours || typeof subjectHours !== "object") {
      return res.status(400).json({ message: "Dữ liệu subjectHours không hợp lệ" });
    }

    let config = await ScheduleConfig.findOne();
    if (!config) config = await ScheduleConfig.create({});

    for (const [subject, data] of Object.entries(subjectHours)) {
      // Merge với default nếu chưa đầy đủ
      const current = config.subjectHours.get(subject) || {};
      const updated = {
        periodsPerWeek: data.periodsPerWeek ?? current.periodsPerWeek ?? 4,
        maxPeriodsPerDay: data.maxPeriodsPerDay ?? current.maxPeriodsPerDay ?? Math.ceil((data.periodsPerWeek ?? current.periodsPerWeek ?? 4) / 2),
        allowConsecutive: data.allowConsecutive ?? current.allowConsecutive ?? true,
        session: data.session ?? current.session ?? "main",
      };
      config.subjectHours.set(subject, updated);
    }

    await config.save();

    res.status(200).json({
      message: "Đã cập nhật số tiết / tuần cho môn học",
      subjectHours: Object.fromEntries(config.subjectHours),
    });
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi cập nhật số tiết / tuần", error: err.message });
  }
};
