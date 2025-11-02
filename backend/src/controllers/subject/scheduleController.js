const Schedule = require("../../models/subject/schedule");
const TeachingAssignment = require("../../models/subject/teachingAssignment");
const Class = require("../../models/class/class");
exports.getAllSchedules = async (req, res) => {
  try {
    const schedules = await Schedule.find()
      .populate("classId", "className grade")
      .populate("timetable.periods.subject", "name")
      .populate("timetable.periods.teacher", "name");
    res.status(200).json(schedules);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🧩 Lấy thời khóa biểu theo lớp, năm và học kỳ
exports.getScheduleByClass = async (req, res) => {
  try {
    const { classId, year, semester } = req.params;
    const schedule = await Schedule.findOne({ classId, year, semester })
      .populate("timetable.periods.subject", "name")
      .populate("timetable.periods.teacher", "name");
    if (!schedule) return res.status(404).json({ message: "Không tìm thấy TKB." });
    res.status(200).json(schedule);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🧩 Tạo thời khóa biểu
exports.createSchedule = async (req, res) => {
  try {
    const { classId, timetable, year, semester } = req.body;

    if (!classId || !timetable || !year || !semester)
      return res.status(400).json({ message: "Thiếu dữ liệu bắt buộc." });

    // Lấy tên lớp để hiển thị (nếu có)
    const cls = await Class.findById(classId);
    const className = cls ? cls.className : undefined;

    const newSchedule = new Schedule({
      classId,
      className,
      timetable,
      year,
      semester,
    });

    await newSchedule.save();
    res.status(201).json(newSchedule);
  } catch (err) {
    console.error("❌ Lỗi khi tạo schedule:", err);
    res.status(500).json({ message: err.message });
  }
};

// 🧩 Cập nhật thời khóa biểu
exports.updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { timetable } = req.body;

    const updated = await Schedule.findByIdAndUpdate(
      id,
      { timetable },
      { new: true }
    );
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🧩 Xóa thời khóa biểu
exports.deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    await Schedule.findByIdAndDelete(id);
    res.status(200).json({ message: "Đã xóa thành công." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.deleteScheduleByGradeYearSemester = async (req, res) => {
  try {
    const { year, semester, grade } = req.body;

    if (!year || !semester || !grade) {
      return res.status(400).json({ message: "Thiếu thông tin year/semester/grade" });
    }

    // Lấy tất cả lớp của khối
    const classes = await Class.find({ grade });
    const classIds = classes.map(c => c._id);

    // Xóa tất cả lịch
    const result = await Schedule.deleteMany({
      classId: { $in: classIds },
      year,
      semester,
    });

    res.status(200).json({ message: "Đã xóa TKB thành công", deletedCount: result.deletedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi khi xóa TKB" });
  }
};

// 🧩 Lấy toàn bộ thời khóa biểu theo năm học (ví dụ: /api/schedules/year/2022-2023)
// 🧩 Lấy tất cả thời khóa biểu theo năm học và học kỳ (toàn trường)
// 🧩 Lấy TKB theo Năm + Học kỳ (toàn trường)
exports.getSchedulesByYearSemester = async (req, res) => {
  try {
    const { year, semester } = req.params;

    if (!year || !semester) {
      return res.status(400).json({ message: "Thiếu thông tin year/semester" });
    }

    const schedules = await Schedule.find({ year, semester })
      .populate("classId", "className grade")
      .populate("timetable.periods.subject", "name")
      .populate("timetable.periods.teacher", "name");

    res.status(200).json(schedules);
  } catch (err) {
    console.error("❌ Lỗi khi lấy TKB theo năm học & học kỳ:", err);
    res.status(500).json({ message: err.message });
  }
};

// 🧩 Lấy TKB theo Khối + Năm + Học kỳ  
exports.getSchedulesByGrade = async (req, res) => {
  try {
    const { grade, year, semester } = req.params;

    if (!grade || !year || !semester) {
      return res.status(400).json({ message: "Thiếu thông tin grade/year/semester" });
    }

    // Tìm tất cả lớp thuộc khối
    const classes = await Class.find({ grade });
    if (!classes.length)
      return res.status(404).json({ message: "Không tìm thấy lớp cho khối này." });

    const classIds = classes.map((c) => c._id);

    // Lấy tất cả TKB của các lớp thuộc khối đó
    const schedules = await Schedule.find({
      classId: { $in: classIds },
      year,
      semester,
    })
      .populate("classId", "className grade")
      .populate("timetable.periods.subject", "name")
      .populate("timetable.periods.teacher", "name");

    res.status(200).json(schedules);
  } catch (err) {
    console.error("❌ Lỗi khi lấy TKB theo khối:", err);
    res.status(500).json({ message: err.message });
  }
};
