const { Exam, ExamSchedule, ExamRoom, ExamStudent, ExamGrade, RoomAssignment } = require("../../models/exam/examIndex");
const mongoose = require("mongoose");

/* =========================================================
   📋 LẤY DANH SÁCH KỲ THI HỌC SINH ĐANG THAM GIA
   ✅ Chỉ lấy kỳ thi đã công bố (status = "published")
   ✅ Tìm học sinh bằng studentId, accountId hoặc studentCode
========================================================= */
exports.getExamsByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const Student = require("../../models/user/student");
    const Account = require("../../models/user/account");
    const Exam = require("../../models/exam/exam");

    // ✅ Tìm học sinh bằng studentId, accountId hoặc studentCode
    let student = null;
    
    // Thử tìm bằng studentId (ObjectId)
    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
      student = await Student.findById(studentId).lean();
    }
    
    // Nếu không tìm thấy, thử tìm bằng accountId
    if (!student && req.user?.accountId) {
      student = await Student.findOne({ accountId: req.user.accountId }).lean();
    }
    
    // Nếu vẫn không tìm thấy, thử tìm bằng accountId từ studentId (nếu studentId là accountId)
    if (!student && studentId && mongoose.Types.ObjectId.isValid(studentId)) {
      const account = await Account.findById(studentId).lean();
      if (account) {
        student = await Student.findOne({ accountId: account._id }).lean();
      }
    }
    
    // Nếu vẫn không tìm thấy, thử tìm bằng studentCode (nếu studentId là studentCode)
    if (!student && studentId) {
      student = await Student.findOne({ studentCode: String(studentId).toUpperCase() }).lean();
    }

    if (!student) {
      return res.status(404).json({ error: "Không tìm thấy thông tin học sinh" });
    }

    const actualStudentId = student._id;

    // ✅ Lấy tất cả ExamStudent của học sinh này
    const examStudents = await ExamStudent.find({ student: actualStudentId })
      .populate({
        path: "exam",
        select: "name year semester type status startDate endDate",
        match: { status: "published" } // ✅ Chỉ lấy exam đã công bố
      })
      .populate("class", "name grade")
      .sort({ createdAt: -1 })
      .lean();

    // ✅ Filter chỉ lấy những ExamStudent có exam (status = "published")
    let filteredData = examStudents.filter(es => es.exam && es.exam.status === "published");

    // ✅ Nếu không có ExamStudent, tìm tất cả exam đã công bố mà học sinh có thể tham gia (dựa vào lớp, khối)
    if (filteredData.length === 0 && student.classId && student.grade) {
      const publishedExams = await Exam.find({
        status: "published",
        grades: { $in: [String(student.grade)] },
        year: student.currentYear || { $exists: true }, // Có thể lọc theo năm học nếu có
      })
        .select("name year semester type status startDate endDate")
        .sort({ createdAt: -1 })
        .lean();

      // Format dữ liệu để trả về
      const formattedData = publishedExams.map(exam => ({
        _id: exam._id,
        name: exam.name,
        year: exam.year,
        semester: exam.semester,
        type: exam.type,
        status: exam.status,
        startDate: exam.startDate,
        endDate: exam.endDate,
        grade: student.grade,
        class: null, // Chưa có ExamStudent nên không có class
      }));

      return res.json(formattedData);
    }

    // ✅ Format dữ liệu để trả về
    const formattedData = filteredData.map(es => ({
      _id: es.exam._id,
      name: es.exam.name,
      year: es.exam.year,
      semester: es.exam.semester,
      type: es.exam.type,
      status: es.exam.status,
      startDate: es.exam.startDate,
      endDate: es.exam.endDate,
      grade: es.grade,
      class: es.class,
    }));

    res.json(formattedData);
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

    // ✅ Lấy RoomAssignment để có thông tin phòng thi và fixedExamRoom
    const assignments = await RoomAssignment.find({
      schedule: { $in: schedules.map(s => s._id) },
      examStudent: examStudent._id
    })
      .populate({
        path: "examRoom",
        select: "roomCode fixedExamRoom",
        populate: {
          path: "fixedExamRoom",
          select: "code"
        }
      })
      .lean();

    // ✅ Tạo map: scheduleId -> assignment
    const assignmentMap = new Map();
    assignments.forEach(assignment => {
      const scheduleId = String(assignment.schedule);
      assignmentMap.set(scheduleId, assignment);
    });

    // ✅ Format dữ liệu để dễ hiển thị
    const formattedSchedules = schedules.map((schedule) => {
      const subjectName = schedule.subject?.name || schedule.subject || "Chưa có môn";
      const dateStr = schedule.date 
        ? new Date(schedule.date).toLocaleDateString("vi-VN")
        : "";
      const timeStr = schedule.startTime || "";
      const gradeStr = schedule.grade ? ` - Khối ${schedule.grade}` : "";

      const assignment = assignmentMap.get(String(schedule._id));
      const roomCode = assignment?.examRoom?.roomCode || null;
      const fixedRoomCode = assignment?.examRoom?.fixedExamRoom?.code || null;
      const seatNumber = assignment?.seatNumber || null;

      return {
        ...schedule.toObject(),
        subjectName: subjectName,
        scheduleName: `${subjectName}${dateStr ? ` - ${dateStr}` : ""}${timeStr ? ` ${timeStr}` : ""}${gradeStr}`,
        room: roomCode ? { roomCode } : null,
        fixedRoomCode: fixedRoomCode,
        seatNumber: seatNumber,
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
