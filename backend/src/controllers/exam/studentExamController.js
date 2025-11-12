const { Exam, ExamSchedule, ExamRoom, ExamStudent, ExamGrade } = require("../../models/exam/examIndex");
const RoomAssignment = require("../../models/exam/roomAssignment");

/* =========================================================
   📋 LẤY DANH SÁCH KỲ THI HỌC SINH ĐANG THAM GIA
========================================================= */
exports.getExamsByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    const data = await ExamStudent.find({ student: studentId })
      .populate("exam", "name year semester type status")
      .populate("class", "name grade")
      .sort({ createdAt: -1 });

    res.json(data);
  } catch (err) {
    console.error("❌ Lỗi getExamsByStudent:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🗓️ LẤY LỊCH THI CỦA HỌC SINH TRONG KỲ THI
========================================================= */
exports.getScheduleByStudent = async (req, res) => {
  try {
    const { examId, studentId } = req.params;

    const examStudent = await ExamStudent.findOne({ exam: examId, student: studentId });
    if (!examStudent)
      return res.status(404).json({ error: "Học sinh chưa được gán vào kỳ thi này." });

    const schedules = await ExamSchedule.find({ exam: examId, grade: examStudent.grade })
      .populate("subject", "name subjectCode")
      .sort({ date: 1, startTime: 1 });

    res.json(schedules);
  } catch (err) {
    console.error("❌ Lỗi getScheduleByStudent:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🏫 LẤY THÔNG TIN PHÒNG THI & CHỖ NGỒI
========================================================= */
exports.getRoomByStudent = async (req, res) => {
  try {
    const { scheduleId, studentId } = req.params;

    const assignment = await RoomAssignment.findOne({
      schedule: scheduleId,
    })
      .populate({
        path: "examStudent",
        match: { student: studentId },
        populate: { path: "student", select: "name className studentCode gender" },
      })
      .populate("examRoom", "roomCode");

    if (!assignment || !assignment.examStudent)
      return res.status(404).json({ error: "Không tìm thấy thông tin chỗ ngồi." });

    res.json({
      room: assignment.examRoom?.roomCode,
      seatNumber: assignment.seatNumber,
      sbd: assignment.sbd,
      status: assignment.status,
    });
  } catch (err) {
    console.error("❌ Lỗi getRoomByStudent:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🧮 LẤY ĐIỂM CỦA HỌC SINH TRONG KỲ THI
========================================================= */
exports.getGradesByStudent = async (req, res) => {
  try {
    const { examId, studentId } = req.params;

    const examStudent = await ExamStudent.findOne({ exam: examId, student: studentId });
    if (!examStudent)
      return res.status(404).json({ error: "Không tìm thấy học sinh trong kỳ thi này." });

    const grades = await ExamGrade.find({ exam: examId, examStudent: examStudent._id })
      .populate("subject", "name subjectCode")
      .populate("teacher", "name")
      .lean();

    res.json(grades);
  } catch (err) {
    console.error("❌ Lỗi getGradesByStudent:", err);
    res.status(500).json({ error: err.message });
  }
};
