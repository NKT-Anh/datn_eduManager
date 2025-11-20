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
      .populate({
        path: "subject",
        select: "name code"
      })
      .populate("exam", "name year semester type status")
      .sort({ date: 1, startTime: 1 });

    // ✅ Format dữ liệu để dễ hiển thị
    const formattedSchedules = schedules.map((schedule) => {
      const subjectName = schedule.subject?.name || schedule.subject || "Chưa có môn";
      const dateStr = schedule.date 
        ? new Date(schedule.date).toLocaleDateString("vi-VN")
        : "";
      const timeStr = schedule.startTime || "";
      const gradeStr = schedule.grade ? ` - Khối ${schedule.grade}` : "";

      return {
        ...schedule.toObject(),
        subjectName: subjectName,
        scheduleName: `${subjectName}${dateStr ? ` - ${dateStr}` : ""}${timeStr ? ` ${timeStr}` : ""}${gradeStr}`,
      };
    });

    res.json(formattedSchedules);
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

    // ✅ Tìm ExamStudent của học sinh này
    const examStudent = await ExamStudent.findOne({ student: studentId });
    if (!examStudent) {
      return res.status(404).json({ error: "Không tìm thấy học sinh trong kỳ thi." });
    }

    // ✅ Tìm RoomAssignment cho học sinh này trong schedule này
    const assignment = await RoomAssignment.findOne({
      schedule: scheduleId,
      examStudent: examStudent._id
    })
      .populate({
        path: "examStudent",
        populate: { path: "student", select: "name className studentCode gender" },
      })
      .populate({
        path: "examRoom",
        select: "roomCode type",
        populate: {
          path: "room",
          select: "roomCode type"
        }
      })
      .populate({
        path: "schedule",
        select: "subject date startTime endTime grade",
        populate: {
          path: "subject",
          select: "name code"
        }
      });

    if (!assignment)
      return res.status(404).json({ error: "Không tìm thấy thông tin chỗ ngồi." });

    const roomCode = assignment.examRoom?.roomCode || assignment.examRoom?.room?.roomCode;
    const roomType = assignment.examRoom?.type || assignment.examRoom?.room?.type;
    const subjectName = assignment.schedule?.subject?.name || assignment.schedule?.subject || "Chưa có môn";

    res.json({
      room: roomCode,
      roomType: roomType,
      seatNumber: assignment.seatNumber,
      sbd: assignment.sbd,
      status: assignment.status,
      schedule: {
        _id: assignment.schedule?._id,
        subject: {
          _id: assignment.schedule?.subject?._id,
          name: subjectName,
          code: assignment.schedule?.subject?.code,
        },
        date: assignment.schedule?.date,
        startTime: assignment.schedule?.startTime,
        endTime: assignment.schedule?.endTime,
        grade: assignment.schedule?.grade,
      },
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
