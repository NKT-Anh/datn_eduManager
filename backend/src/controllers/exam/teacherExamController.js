const { Exam, ExamSchedule, ExamRoom, FixedExamRoom, ExamStudent, RoomAssignment } = require("../../models/exam/examIndex");
const Room = require("../../models/room/room");
const Teacher = require("../../models/user/teacher");

/* =========================================================
   📋 LẤY DANH SÁCH PHÒNG THI GIÁO VIÊN ĐƯỢC PHÂN CÔNG
   - Lấy tất cả ExamRoom mà giáo viên là giám thị
========================================================= */
exports.getRoomsByTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    if (!teacherId) {
      return res.status(400).json({ error: "Thiếu teacherId." });
    }

    // ✅ Tìm tất cả Exam có status = "published" (đã công bố)
    const publishedExams = await Exam.find({ status: "published" })
      .select("_id")
      .lean();
    const publishedExamIds = publishedExams.map(ex => ex._id);

    // ✅ Tìm tất cả ExamRoom mà giáo viên này là giám thị
    // ✅ CHỈ lấy phòng thi của kỳ thi đã công bố (status = "published")
    const rooms = await ExamRoom.find({
      "invigilators.teacher": teacherId,
      exam: { $in: publishedExamIds } // ✅ CHỈ lấy phòng thi của kỳ thi đã công bố
    })
      .populate({
        path: "schedule",
        select: "subject date startTime endTime grade",
        populate: {
          path: "subject",
          select: "name code"
        }
      })
      .populate("exam", "name year semester type status")
      .populate("fixedExamRoom", "code grade capacity")
      .populate("room", "roomCode type status")
      .populate("invigilators.teacher", "name teacherCode")
      .sort({ "schedule.date": 1, "schedule.startTime": 1, roomCode: 1 })
      .lean();

    // ✅ Đảm bảo chỉ lấy phòng thi có exam và exam.status = "published"
    const filteredRooms = rooms.filter(room => 
      room.exam && 
      room.exam.status === "published" &&
      publishedExamIds.some(id => String(id) === String(room.exam._id))
    );

    // ✅ Format dữ liệu để dễ hiển thị
    const formattedRooms = filteredRooms.map((room) => {
      const invigilatorInfo = room.invigilators.find(
        (inv) => String(inv.teacher._id) === String(teacherId)
      );
      
      const schedule = room.schedule;
      const subjectName = schedule?.subject?.name || schedule?.subject || "Chưa có môn";
      const dateStr = schedule?.date 
        ? new Date(schedule.date).toLocaleDateString("vi-VN")
        : "";
      const timeStr = schedule?.startTime || "";
      const gradeStr = schedule?.grade ? ` - Khối ${schedule.grade}` : "";

      return {
        _id: room._id,
        exam: {
          _id: room.exam?._id,
          name: room.exam?.name,
          year: room.exam?.year,
          semester: room.exam?.semester,
          type: room.exam?.type,
          status: room.exam?.status,
        },
        schedule: {
          _id: schedule?._id,
          subject: {
            _id: schedule?.subject?._id,
            name: subjectName,
            code: schedule?.subject?.code,
          },
          date: schedule?.date,
          startTime: schedule?.startTime,
          endTime: schedule?.endTime,
          grade: schedule?.grade,
          scheduleName: `${subjectName}${dateStr ? ` - ${dateStr}` : ""}${timeStr ? ` ${timeStr}` : ""}${gradeStr}`,
        },
        room: {
          _id: room.room?._id,
          roomCode: room.roomCode || room.room?.roomCode,
          type: room.type || room.room?.type,
          status: room.room?.status,
        },
        fixedExamRoom: {
          _id: room.fixedExamRoom?._id,
          code: room.fixedExamRoom?.code,
          grade: room.fixedExamRoom?.grade,
          capacity: room.fixedExamRoom?.capacity,
        },
        invigilatorRole: invigilatorInfo?.role || "supervisor1",
        invigilators: room.invigilators.map((inv) => ({
          teacher: {
            _id: inv.teacher?._id,
            name: inv.teacher?.name,
            teacherCode: inv.teacher?.teacherCode,
          },
          role: inv.role,
        })),
        capacity: room.capacity || 24,
        studentCount: room.fixedExamRoom?.capacity || 0,
      };
    });

    res.json({ success: true, data: formattedRooms, total: formattedRooms.length });
  } catch (err) {
    console.error("❌ Lỗi getRoomsByTeacher:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🗓️ LẤY LỊCH COI THI CỦA GIÁO VIÊN
   - Lấy tất cả lịch thi mà giáo viên được phân công làm giám thị
========================================================= */
exports.getSchedulesByTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    if (!teacherId) {
      return res.status(400).json({ error: "Thiếu teacherId." });
    }

    // ✅ Tìm tất cả Exam có status = "published" (đã công bố)
    const publishedExams = await Exam.find({ status: "published" })
      .select("_id")
      .lean();
    const publishedExamIds = publishedExams.map(ex => ex._id);

    // ✅ Tìm tất cả ExamRoom mà giáo viên này là giám thị
    // ✅ CHỈ lấy phòng thi của kỳ thi đã công bố (status = "published")
    const rooms = await ExamRoom.find({
      "invigilators.teacher": teacherId,
      exam: { $in: publishedExamIds } // ✅ CHỈ lấy phòng thi của kỳ thi đã công bố
    })
      .populate({
        path: "schedule",
        select: "subject date startTime endTime grade exam",
        populate: {
          path: "subject",
          select: "name code"
        }
      })
      .populate("exam", "name year semester type status")
      .lean();

    // ✅ Đảm bảo chỉ lấy phòng thi có exam và exam.status = "published"
    const filteredRooms = rooms.filter(room => 
      room.exam && 
      room.exam.status === "published" &&
      publishedExamIds.some(id => String(id) === String(room.exam._id))
    );

    // ✅ Nhóm theo schedule (cùng 1 lịch thi có thể có nhiều phòng)
    const scheduleMap = new Map();
    
    filteredRooms.forEach((room) => {
      const schedule = room.schedule;
      if (!schedule) return;

      const scheduleId = String(schedule._id);
      if (!scheduleMap.has(scheduleId)) {
        const subjectName = schedule?.subject?.name || schedule?.subject || "Chưa có môn";
        const dateStr = schedule?.date 
          ? new Date(schedule.date).toLocaleDateString("vi-VN")
          : "";
        const timeStr = schedule?.startTime || "";
        const gradeStr = schedule?.grade ? ` - Khối ${schedule.grade}` : "";

        scheduleMap.set(scheduleId, {
          _id: schedule._id,
          exam: {
            _id: room.exam?._id,
            name: room.exam?.name,
            year: room.exam?.year,
            semester: room.exam?.semester,
            type: room.exam?.type,
            status: room.exam?.status,
          },
          subject: {
            _id: schedule?.subject?._id,
            name: subjectName,
            code: schedule?.subject?.code,
          },
          date: schedule?.date,
          startTime: schedule?.startTime,
          endTime: schedule?.endTime,
          grade: schedule?.grade,
          scheduleName: `${subjectName}${dateStr ? ` - ${dateStr}` : ""}${timeStr ? ` ${timeStr}` : ""}${gradeStr}`,
          rooms: [],
        });
      }

      // ✅ Thêm thông tin phòng vào schedule
      const scheduleData = scheduleMap.get(scheduleId);
      const invigilatorInfo = room.invigilators?.find(
        (inv) => String(inv.teacher) === String(teacherId)
      );
      
      scheduleData.rooms.push({
        _id: room._id,
        roomCode: room.roomCode,
        type: room.type,
        invigilatorRole: invigilatorInfo?.role || "supervisor1",
        studentCount: room.fixedExamRoom?.capacity || 0,
      });
    });

    // ✅ Chuyển Map thành Array và sắp xếp
    const schedules = Array.from(scheduleMap.values()).sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      if (dateA !== dateB) return dateA - dateB;
      return (a.startTime || "").localeCompare(b.startTime || "");
    });

    res.json({ success: true, data: schedules, total: schedules.length });
  } catch (err) {
    console.error("❌ Lỗi getSchedulesByTeacher:", err);
    res.status(500).json({ error: err.message });
  }
};


