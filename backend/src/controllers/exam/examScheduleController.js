const {
  Exam,
  ExamSchedule,
  ExamRoom,
  ExamStudent,
  ExamGrade,
  RoomAssignment,
} = require("../../models/exam/examIndex");
const dayjs = require("dayjs");
const mongoose = require("mongoose");
const Subject = require("../../models/subject/subject");
const ScheduleConfig = require("../../models/subject/scheduleConfig");
// Helper: sync ExamStudent.subjects with schedule info
async function syncExamStudentSubjectsForSchedule(schedule) {
  try {
    if (!schedule || !schedule.exam || !schedule.grade || !schedule.subject) return;
    const examId = schedule.exam;
    const grade = String(schedule.grade);
    const subjectId = schedule.subject?._id || schedule.subject;

    // 1) Update existing subject entries to set examSchedule
    await ExamStudent.updateMany(
      {
        exam: examId,
        grade: grade,
        "subjects.subject": subjectId,
      },
      {
        $set: { "subjects.$[elem].examSchedule": schedule._id },
      },
      {
        arrayFilters: [{ "elem.subject": subjectId }],
      }
    );

    // 2) Push new subject entry if missing
    await ExamStudent.updateMany(
      {
        exam: examId,
        grade: grade,
        subjects: { $not: { $elemMatch: { subject: subjectId } } },
      },
      {
        $push: {
          subjects: {
            subject: subjectId,
            examSchedule: schedule._id,
            status: "registered",
            score: null,
          },
        },
      }
    );
  } catch (err) {
    console.error("⚠️ Lỗi syncExamStudentSubjectsForSchedule:", err.message);
  }
}
// === REUSABLE: Kiểm tra trùng lịch ===
const checkScheduleConflict = async ({
  exam,
  grade,
  date,
  startTime,
  duration = 90,
  excludeId,
}) => {
  const [h, m] = startTime.split(":").map(Number);
  const newStart = dayjs(date).hour(h).minute(m);
  const newEnd = newStart.add(duration, "minute");

  const conflict = await ExamSchedule.findOne({
    exam,
    grade,
    isDeleted: { $ne: true }, // ✅ Chỉ kiểm tra lịch thi chưa bị xóa
    date: {
      $gte: dayjs(date).startOf("day").toDate(),
      $lte: dayjs(date).endOf("day").toDate(),
    },
    ...(excludeId && { _id: { $ne: excludeId } }),
  }).lean();

  if (!conflict) return null;

  // Tính thời gian của lịch hiện có
  let conflictStart, conflictEnd;

  if (conflict.startTime && conflict.endTime) {
    const [ch, cm] = conflict.startTime.split(":").map(Number);
    const [eh, em] = conflict.endTime.split(":").map(Number);
    conflictStart = dayjs(conflict.date).hour(ch).minute(cm);
    conflictEnd = dayjs(conflict.date).hour(eh).minute(em);
  } else if (conflict.startTime && conflict.duration) {
    const [ch, cm] = conflict.startTime.split(":").map(Number);
    conflictStart = dayjs(conflict.date).hour(ch).minute(cm);
    conflictEnd = conflictStart.add(conflict.duration, "minute");
  } else {
    return null;
  }

  const hasConflict = conflictStart.isBefore(newEnd) && conflictEnd.isAfter(newStart);
  return hasConflict ? conflict : null;
};

/* =========================================================
   LẤY TẤT CẢ LỊCH THI (có phân trang + lọc)
========================================================= */
exports.getAllSchedules = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      exam,
      grade,
      subject,
      status,
      dateFrom,
      dateTo,
      keyword,
      sortBy = "date",
      sortDir = "asc",
    } = req.query;

    page = Math.max(1, parseInt(page, 10));
    limit = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const filter = {};

    if (exam && mongoose.Types.ObjectId.isValid(exam)) filter.exam = exam;

    if (grade) {
      const grades = Array.isArray(grade)
        ? grade.map(String).filter(g => ['10', '11', '12'].includes(g))
        : grade.split(",").map(g => String(g.trim())).filter(g => ['10', '11', '12'].includes(g));
      filter.grade = grades.length === 1 ? grades[0] : { $in: grades };
    }

    if (subject && mongoose.Types.ObjectId.isValid(subject)) filter.subject = subject;

    if (status && status !== "Tất cả") filter.status = status;

    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) {
        const dt = new Date(dateTo);
        dt.setHours(23, 59, 59, 999);
        filter.date.$lte = dt;
      }
    }

    if (keyword && keyword.trim()) {
      const kw = keyword.trim();
      filter.$or = [{ notes: { $regex: kw, $options: "i" } }];
    }

    // ✅ Chỉ lấy lịch thi chưa bị xóa
    filter.isDeleted = { $ne: true };

    const query = ExamSchedule.find(filter)
      .populate("subject", "name code")
      .populate("exam", "name year semester")
      .sort({ [sortBy]: sortDir === "desc" ? -1 : 1, startTime: 1 })
      .lean();

    const total = await ExamSchedule.countDocuments(filter);
    const skip = (page - 1) * limit;
    const data = await query.skip(skip).limit(limit);

    // Lọc keyword theo subject.name (client-side nếu cần)
    let filteredData = data;
    if (keyword && keyword.trim()) {
      const kw = keyword.trim();
      filteredData = data.filter(s =>
        (s.subject?.name || "").match(new RegExp(kw, "i")) ||
        (s.notes || "").match(new RegExp(kw, "i"))
      );
    }

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: filteredData,
    });
  } catch (err) {
    console.error("Lỗi getAllSchedules:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   TẠO LỊCH THI
========================================================= */
exports.createSchedule = async (req, res) => {
  try {
    const { exam, grade, subject, date, startTime, duration, examType, notes } = req.body;

    if (!exam || !grade || !subject || !date || !startTime)
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc." });

    const examData = await Exam.findById(exam);
    if (!examData) return res.status(404).json({ error: "Không tìm thấy kỳ thi." });

    // ✅ Đảm bảo grade là String
    const stringGrade = String(grade);

    // ✅ Parse startTime và set vào dayjs
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const start = dayjs(date).hour(startHour).minute(startMinute);
    const end = start.add(Number(duration) || 90, "minute");
    const formattedStartTime = start.format("HH:mm");
    const endTime = end.format("HH:mm");

    const conflict = await checkScheduleConflict({
      exam,
      grade: stringGrade,
      date,
      startTime: formattedStartTime,
      duration: Number(duration) || 90,
    });

    if (conflict) {
      return res.status(400).json({
        error: `Lịch thi trùng với môn ${conflict.subject?.name || "khác"} (${conflict.startTime}-${conflict.endTime}) ngày ${dayjs(conflict.date).format("DD/MM/YYYY")}`,
      });
    }

    const schedule = await ExamSchedule.create({
      exam,
      grade: stringGrade,
      subject,
      date,
      startTime: formattedStartTime,
      endTime,
      duration: Number(duration) || 90,
      examType: examType || "midterm",
      notes,
    });

    // 🏫 TẠO PHÒNG THI CHO LỊCH THI NÀY (tự động tính số phòng dựa trên số học sinh)
    // ✅ Bỏ logic tự động tạo phòng thi khi tạo lịch thi
    // Phòng thi sẽ được tạo thủ công qua UI

    // 🔄 Đồng bộ ExamStudent.subjects với lịch vừa tạo
    try {
      await syncExamStudentSubjectsForSchedule(schedule);
    } catch (e) {
      console.error("⚠️ Không thể đồng bộ subjects cho ExamStudent sau khi tạo lịch:", e.message);
    }

    res.status(201).json({ 
      message: `Tạo lịch thi thành công.`, 
      data: schedule,
    });
  } catch (err) {
    console.error("❌ Lỗi tạo lịch thi:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🎯 HÀM PHỤ: PHÂN PHÒNG HỌC SINH CHO LỊCH THI ĐẦU TIÊN
   - Phân bổ học sinh đều vào các FixedExamRoom (A-Z theo tên)
   - Gán ExamStudent.room = FixedExamRoom._id
   - Cập nhật FixedExamRoom.students với danh sách học sinh
   - Tạo RoomAssignment với ExamRoom (phòng thi riêng từng môn)
========================================================= */
async function assignStudentsToFirstSchedule(
  examId,
  scheduleId,
  grade,
  fixedRooms,
  examRooms
) {
  try {
    const RoomAssignment = require("../../models/exam/roomAssignment");
    const ExamSchedule = require("../../models/exam/examSchedule");
    const { ExamStudent, FixedExamRoom } = require("../../models/exam/examIndex");

    // ✅ Lấy thông tin lịch thi
    const schedule = await ExamSchedule.findById(scheduleId)
      .populate("subject", "name")
      .populate("exam", "year semester")
      .lean();
    if (!schedule) return;

    // ✅ Lấy tất cả học sinh chưa được gán phòng (room = null) và cùng grade
    const students = await ExamStudent.find({
      exam: examId,
      grade: grade,
      room: null, // ✅ Chỉ lấy học sinh chưa được gán phòng
      status: "active",
    })
      .populate("student", "name")
      .sort({ "student.name": 1 }) // ✅ Sắp xếp A-Z theo tên
      .lean();

    if (students.length === 0) {
      console.log(`ℹ️ Không có học sinh nào cần phân phòng cho lịch thi ${scheduleId}`);
      return;
    }

    // ✅ Tạo map: FixedExamRoom._id -> ExamRoom._id
    const roomMap = new Map();
    fixedRooms.forEach((fixedRoom, index) => {
      const examRoom = examRooms[index];
      if (fixedRoom && examRoom) {
        roomMap.set(fixedRoom._id || fixedRoom, examRoom._id || examRoom);
      }
    });

    // ✅ Tính số học sinh cho mỗi phòng (phân bổ đều)
    const totalStudents = students.length;
    const totalRooms = fixedRooms.length;
    
    const baseStudentsPerRoom = Math.floor(totalStudents / totalRooms);
    const extraStudents = totalStudents % totalRooms;
    
    const studentsPerRoom = fixedRooms.map((_, index) => {
      return baseStudentsPerRoom + (index < extraStudents ? 1 : 0);
    });

    // ✅ Phân bổ học sinh đều vào các FixedExamRoom (A-Z)
    const assignments = [];
    const studentUpdates = [];
    const fixedRoomUpdates = [];
    let studentIndex = 0;

    for (let roomIndex = 0; roomIndex < totalRooms; roomIndex++) {
      const fixedRoom = fixedRooms[roomIndex];
      const fixedRoomId = fixedRoom._id || fixedRoom;
      const examRoomId = roomMap.get(fixedRoomId);
      if (!examRoomId) continue;

      const targetCount = studentsPerRoom[roomIndex];
      const roomStudentIds = [];
      let seatNumber = 1;

      for (let i = 0; i < targetCount && studentIndex < totalStudents; i++) {
        const student = students[studentIndex];

        // ✅ Tạo RoomAssignment với ExamRoom (phòng thi riêng từng môn)
        assignments.push({
          exam: examId,
          schedule: scheduleId,
          subject: schedule.subject?._id || schedule.subject,
          examRoom: examRoomId, // ✅ Dùng ExamRoom
          examStudent: student._id,
          seatNumber: seatNumber,
          sbd: student.sbd || "",
          status: "present",
        });

        // ✅ Cập nhật ExamStudent.room = FixedExamRoom._id
        studentUpdates.push({
          updateOne: {
            filter: { _id: student._id },
            update: { room: fixedRoomId }, // ✅ Gán FixedExamRoom
          },
        });

        roomStudentIds.push(student._id);
        seatNumber++;
        studentIndex++;
      }

      // ✅ Cập nhật FixedExamRoom.students và capacity
      if (roomStudentIds.length > 0) {
        fixedRoomUpdates.push({
          updateOne: {
            filter: { _id: fixedRoomId },
            update: { 
              $set: { 
                students: roomStudentIds,
                capacity: roomStudentIds.length 
              } 
            },
          },
        });
      }
    }

    // ✅ Lưu vào database
    if (assignments.length > 0) {
      await RoomAssignment.insertMany(assignments, { ordered: false });
      if (studentUpdates.length > 0) {
        await ExamStudent.bulkWrite(studentUpdates);
      }
      if (fixedRoomUpdates.length > 0) {
        await FixedExamRoom.bulkWrite(fixedRoomUpdates);
      }
      console.log(`✅ Đã tự động phân phòng ${assignments.length} học sinh vào ${fixedRooms.length} FixedExamRoom cho lịch thi đầu tiên ${scheduleId} (A-Z, phân bổ đều)`);
      console.log(`   - Gán ExamStudent.room = FixedExamRoom._id`);
      console.log(`   - Cập nhật FixedExamRoom.students và capacity`);
      console.log(`   - Tạo RoomAssignment với ExamRoom (phòng thi riêng từng môn)`);
    }
  } catch (err) {
    console.error("⚠️ Lỗi khi phân phòng học sinh cho lịch thi đầu tiên:", err);
    // Không throw error để không làm gián đoạn việc tạo lịch thi
  }
}

/* =========================================================
   🎯 HÀM PHỤ: GÁN HỌC SINH VÀO PHÒNG THI ĐÃ SAO CHÉP
   - Dựa trên ExamStudent.room (FixedExamRoom._id) và grade
   - Map FixedExamRoom -> ExamRoom (dựa trên fixedExamRoom reference)
   - Tạo RoomAssignment cho lịch thi mới
========================================================= */
async function assignStudentsToCopiedRooms(
  examId,
  newScheduleId,
  grade,
  originalFixedRooms,
  newExamRooms
) {
  try {
    const RoomAssignment = require("../../models/exam/roomAssignment");
    const ExamSchedule = require("../../models/exam/examSchedule");
    const { ExamStudent } = require("../../models/exam/examIndex");

    // ✅ Lấy thông tin lịch thi mới
    const newSchedule = await ExamSchedule.findById(newScheduleId)
      .populate("subject", "name")
      .lean();
    if (!newSchedule) return;

    // ✅ Tạo map: FixedExamRoom._id -> ExamRoom._id
    const roomMap = new Map();
    originalFixedRooms.forEach((fixedRoom) => {
      const fixedRoomId = fixedRoom._id || fixedRoom;
      const matchingExamRoom = newExamRooms.find((nr) => {
        const nrFixedRoomId = nr.fixedExamRoom || (nr.toObject ? nr.toObject().fixedExamRoom : null);
        return String(nrFixedRoomId) === String(fixedRoomId);
      });
      if (matchingExamRoom) {
        roomMap.set(fixedRoomId, matchingExamRoom._id || matchingExamRoom);
      }
    });

    // ✅ Lấy tất cả học sinh có room trong danh sách FixedExamRoom và cùng grade
    const originalFixedRoomIds = originalFixedRooms.map((r) => r._id || r).filter(Boolean);
    const students = await ExamStudent.find({
      exam: examId,
      grade: grade,
      room: { $in: originalFixedRoomIds }, // ✅ Tìm theo FixedExamRoom._id
      status: "active",
    })
      .populate("student", "name")
      .sort({ "student.name": 1 })
      .lean();

    if (students.length === 0) {
      console.log(`ℹ️ Không có học sinh nào được gán vào phòng thi cho lịch thi ${newScheduleId}`);
      return;
    }

    // ✅ Nhóm học sinh theo FixedExamRoom._id
    const studentsByRoom = new Map();
    students.forEach((student) => {
      const fixedRoomId = String(student.room);
      if (!fixedRoomId) return;
      if (!studentsByRoom.has(fixedRoomId)) {
        studentsByRoom.set(fixedRoomId, []);
      }
      studentsByRoom.get(fixedRoomId).push(student);
    });

    // ✅ Tạo RoomAssignment cho từng phòng thi mới
    const assignments = [];

    for (const [fixedRoomId, roomStudents] of studentsByRoom) {
      const examRoomId = roomMap.get(fixedRoomId);
      if (!examRoomId) continue;

      // ✅ Sắp xếp học sinh theo tên
      const sortedStudents = [...roomStudents].sort((a, b) => {
        const nameA = a.student?.name || "";
        const nameB = b.student?.name || "";
        return nameA.localeCompare(nameB, "vi", { sensitivity: "base" });
      });

      // ✅ Tạo RoomAssignment cho từng học sinh
      sortedStudents.forEach((student, index) => {
        assignments.push({
          exam: examId,
          schedule: newScheduleId,
          subject: newSchedule.subject?._id || newSchedule.subject,
          examRoom: examRoomId, // ✅ Dùng ExamRoom (phòng thi riêng từng môn)
          examStudent: student._id,
          seatNumber: index + 1, // ✅ Số thứ tự trong phòng (bắt đầu từ 1)
          sbd: student.sbd || "", // ✅ Sử dụng SBD từ ExamStudent
          status: "present",
        });
      });
    }

    // ✅ Lưu RoomAssignment
    if (assignments.length > 0) {
      await RoomAssignment.insertMany(assignments, { ordered: false });
      console.log(`✅ Đã tự động gán ${assignments.length} học sinh vào ${newExamRooms.length} phòng thi cho lịch thi ${newScheduleId}`);
    }
  } catch (err) {
    console.error("⚠️ Lỗi khi gán học sinh vào phòng thi đã sao chép:", err);
    // Không throw error để không làm gián đoạn việc tạo lịch thi
  }
}

/* =========================================================
   CẬP NHẬT LỊCH THI
========================================================= */
exports.updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { exam, grade, subject, date, startTime, duration, examType, notes } = req.body;

    if (!exam || !grade || !subject || !date || !startTime)
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc." });

    // ✅ Đảm bảo grade là String
    const stringGrade = String(grade);

    // ✅ Parse startTime và set vào dayjs
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const start = dayjs(date).hour(startHour).minute(startMinute);
    const end = start.add(Number(duration) || 90, "minute");
    const formattedStartTime = start.format("HH:mm");
    const endTime = end.format("HH:mm");

    const conflict = await checkScheduleConflict({
      exam,
      grade: stringGrade,
      date,
      startTime: formattedStartTime,
      duration: Number(duration) || 90,
      excludeId: id,
    });

    if (conflict) {
      return res.status(400).json({
        error: `Lịch thi trùng với môn ${conflict.subject?.name || "khác"} (${conflict.startTime}-${conflict.endTime}) ngày ${dayjs(conflict.date).format("DD/MM/YYYY")}`,
      });
    }

    const updated = await ExamSchedule.findByIdAndUpdate(
      id,
      {
        exam,
        grade: stringGrade,
        subject,
        date,
        startTime: formattedStartTime,
        endTime,
        duration: Number(duration) || 90,
        examType,
        notes,
      },
      { new: true }
    ).populate("subject", "name code");

    if (!updated) return res.status(404).json({ error: "Không tìm thấy lịch thi." });
    // 🔄 Đồng bộ ExamStudent.subjects với lịch sau cập nhật
    try {
      await syncExamStudentSubjectsForSchedule(updated);
    } catch (e) {
      console.error("⚠️ Không thể đồng bộ subjects cho ExamStudent sau khi cập nhật lịch:", e.message);
    }

    res.json({ message: "Cập nhật thành công.", data: updated });
  } catch (err) {
    console.error("Lỗi cập nhật:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   XÓA LỊCH THI
========================================================= */
exports.deleteSchedule = async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const deleted = await ExamSchedule.findByIdAndDelete(scheduleId);
    if (!deleted) return res.status(404).json({ error: "Không tìm thấy lịch thi." });

    // ✅ Xóa tất cả dữ liệu liên quan đến lịch thi này
    await Promise.all([
      ExamRoom.deleteMany({ schedule: scheduleId }),
      RoomAssignment.deleteMany({ schedule: scheduleId }),
    ]);

    // 🔄 Gỡ liên kết examSchedule khỏi ExamStudent.subjects (không xóa entry)
    try {
      const subjectId = deleted.subject?._id || deleted.subject;
      await ExamStudent.updateMany(
        { exam: deleted.exam, grade: String(deleted.grade), "subjects.subject": subjectId },
        { $set: { "subjects.$[elem].examSchedule": null } },
        { arrayFilters: [{ "elem.subject": subjectId }] }
      );
    } catch (e) {
      console.error("⚠️ Không thể gỡ liên kết examSchedule khỏi ExamStudent.subjects:", e.message);
    }

    res.json({ message: "Đã xóa lịch thi và các dữ liệu liên quan." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   XÓA HÀNG LOẠT LỊCH THI
========================================================= */
exports.deleteMultipleSchedules = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Danh sách ID lịch thi không hợp lệ." });
    }

    // ✅ Validate tất cả IDs là ObjectId hợp lệ
    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return res.status(400).json({ error: "Không có ID lịch thi hợp lệ." });
    }

    if (validIds.length !== ids.length) {
      console.warn(`⚠️ Có ${ids.length - validIds.length} ID không hợp lệ đã bị bỏ qua.`);
    }

    // ✅ Xóa lịch thi
    const deleteResult = await ExamSchedule.deleteMany({ _id: { $in: validIds } });

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({ error: "Không tìm thấy lịch thi nào để xóa." });
    }

    // ✅ Xóa tất cả dữ liệu liên quan (ExamRoom và RoomAssignment)
    await Promise.all([
      ExamRoom.deleteMany({ schedule: { $in: validIds } }),
      RoomAssignment.deleteMany({ schedule: { $in: validIds } }),
    ]);

    res.json({
      message: `✅ Đã xóa ${deleteResult.deletedCount} lịch thi và các dữ liệu liên quan.`,
      deletedCount: deleteResult.deletedCount,
    });
  } catch (err) {
    console.error("❌ Lỗi xóa hàng loạt lịch thi:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   LẤY THEO KỲ THI
========================================================= */
exports.getSchedulesByExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const { grade } = req.query;

    const query = { exam: examId };

    // ⚙️ Chỉ lọc nếu grade hợp lệ và khác "0"
    if (grade && grade !== "0") {
      query.grade = String(grade); // ✅ ép kiểu String để Mongo lọc đúng
    }

    // ✅ Thêm filter isDeleted vào query
    query.isDeleted = { $ne: true }; // ✅ Chỉ lấy lịch thi chưa bị xóa
    
    const schedules = await ExamSchedule.find(query)
      .populate("subject", "name code")
      .sort({ grade: 1, date: 1, startTime: 1 })
      .lean();

    if (!schedules.length)
      return res.status(404).json({ error: "Không có lịch thi." });

    res.json(schedules);
  } catch (err) {
    console.error("❌ Lỗi khi lấy lịch thi:", err);
    res.status(500).json({ error: err.message });
  }
};



/* =========================================================
   LẤY CHI TIẾT
========================================================= */
exports.getScheduleById = async (req, res) => {
  try {
    const schedule = await ExamSchedule.findOne({
      _id: req.params.id,
      isDeleted: { $ne: true } // ✅ Chỉ lấy lịch thi chưa bị xóa
    })
      .populate("exam", "name year semester")
      .populate("subject", "name code");
    if (!schedule) return res.status(404).json({ error: "Không tìm thấy." });
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   CẬP NHẬT TRẠNG THÁI
========================================================= */
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["draft", "confirmed", "completed"].includes(status))
      return res.status(400).json({ error: "Trạng thái không hợp lệ." });

    const schedule = await ExamSchedule.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!schedule) return res.status(404).json({ error: "Không tìm thấy." });

    res.json({ message: "Cập nhật trạng thái thành công.", data: schedule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   THỐNG KÊ NHANH
========================================================= */
exports.getScheduleStats = async (req, res) => {
  try {
    const { examId } = req.params;
    const [totalSchedules, totalRooms, totalStudents, totalGrades] = await Promise.all([
      ExamSchedule.countDocuments({ exam: examId }),
      ExamRoom.countDocuments({ exam: examId }),
      ExamStudent.countDocuments({ exam: examId }),
      ExamGrade.countDocuments({ exam: examId }),
    ]);

    res.json({ totalSchedules, totalRooms, totalStudents, totalGrades });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   TỰ ĐỘNG TẠO LỊCH THI (TÁCH RIÊNG, AN TOÀN)
========================================================= */
exports.autoGenerateSchedules = async (req, res) => {
    try {
        const { examId, grade, examType } = req.body;
        console.log("🔍 Auto generate request:", { examId, grade, examType });

        // 🛑 Bước 1: Kiểm tra đầu vào cơ bản
        if (!examId || grade === undefined || grade === null)
            return res.status(400).json({ error: "Thiếu examId hoặc grade." });
        
        // ✅ Đảm bảo examType có giá trị hợp lệ
        const validExamType = examType && ["midterm", "final"].includes(examType) ? examType : "midterm";

        // 🗓️ Lấy thông tin kỳ thi
        const exam = await Exam.findById(examId).select("startDate endDate name");
        if (!exam) return res.status(404).json({ error: "Không tìm thấy kỳ thi." });

        if (!exam.startDate || !exam.endDate)
            return res.status(400).json({ error: "Kỳ thi chưa có ngày bắt đầu hoặc kết thúc." });

        const startDate = dayjs(exam.startDate).startOf("day");
        const endDate = dayjs(exam.endDate).startOf("day");
        const daysCount = endDate.diff(startDate, "day") + 1;

        console.log(
            `🗓️ Kỳ thi: ${exam.name} (${startDate.format("DD/MM")} → ${endDate.format("DD/MM")}, ${daysCount} ngày)`
        );

        // ✅ Lấy cấu hình thời khóa biểu
        const scheduleConfig = await ScheduleConfig.findOne();
        if (!scheduleConfig) {
            console.warn("⚠️ Không tìm thấy cấu hình thời khóa biểu, sử dụng giá trị mặc định.");
        }

        // ✅ Lấy giờ bắt đầu buổi sáng và chiều từ cấu hình
        const defaultStartTimeMorning = scheduleConfig?.defaultStartTimeMorning || "07:00";
        const defaultStartTimeAfternoon = scheduleConfig?.defaultStartTimeAfternoon || "13:00";
        
        // ✅ Parse giờ bắt đầu
        const [morningHour, morningMinute] = defaultStartTimeMorning.split(":").map(Number);
        const [afternoonHour, afternoonMinute] = defaultStartTimeAfternoon.split(":").map(Number);

        // --- Logic Xử lý Nhiều Khối (Đã được điều chỉnh theo yêu cầu) ---
        let targetGrades = [];
        const config = {
            breakBetween: 30, // nghỉ 30 phút giữa 2 môn
            maxPerDay: 4, // tối đa 4 môn 1 ngày
        };

        if (String(grade) === "0") {
            // **Tùy chỉnh: Thay đổi mảng này nếu bạn có các khối khác**
            targetGrades = ['10', '11', '12'];
            console.log("🔥 Chế độ 'Tất cả các khối' được kích hoạt:", targetGrades.join(", "));
        } else {
            targetGrades = [String(grade)];
        }

        const allNewSchedules = [];
        const allConflicts = [];
        const allDistributions = {};
        const successfulGrades = [];

        // 🔁 Bắt đầu lặp qua từng khối mục tiêu
        for (const currentGrade of targetGrades) {
            console.log(`\n--- Bắt đầu xử lý Khối: ${currentGrade} ---`);

            // 🔹 Lấy danh sách môn học cho khối hiện tại
            const subjects = await Subject.find({ grades: String(currentGrade) })
                .sort({ code: 1 })
                .select("_id name code defaultExamDuration");

            if (!subjects.length) {
                console.log(`⚠️ Bỏ qua: Không có môn học cho Khối ${currentGrade}.`);
                allConflicts.push({ grade: currentGrade, reason: "Không có môn học cho khối này." });
                continue;
            }

            // 🔹 Bỏ môn đã có lịch cho khối hiện tại
            const existing = await ExamSchedule.find({ 
              exam: examId, 
              grade: currentGrade,
              isDeleted: { $ne: true } // ✅ Chỉ lấy lịch thi chưa bị xóa
            })
                .populate("subject", "name")
                .select("subject date startTime endTime duration")
                .lean();

            const existingSubjectIds = new Set(
                existing.map(s => s.subject?._id?.toString() || s.subject?.toString())
            );

            const availableSubjects = subjects.filter(
                s => !existingSubjectIds.has(s._id.toString())
            );
            const totalSubjects = availableSubjects.length;

            if (!totalSubjects) {
                console.log(`☑️ Khối ${currentGrade}: Tất cả môn đã có lịch thi.`);
                continue;
            }

            console.log(`📚 Khối ${currentGrade}: ${totalSubjects} môn cần xếp.`);

            // ✅ Lấy thông tin buổi học của khối từ cấu hình (cấu trúc mới)
            const gradeConfig = scheduleConfig?.gradeConfigs?.get?.(String(currentGrade)) || 
                               scheduleConfig?.gradeConfigs?.get?.(currentGrade) ||
                               (typeof scheduleConfig?.gradeConfigs === 'object' && scheduleConfig?.gradeConfigs?.[String(currentGrade)]) ||
                               (typeof scheduleConfig?.gradeConfigs === 'object' && scheduleConfig?.gradeConfigs?.[currentGrade]);
            const gradeSession = gradeConfig?.rules?.session || "morning"; // Mặc định buổi sáng
            console.log(`📅 Khối ${currentGrade} học buổi: ${gradeSession}`);

            // ✅ Xác định giờ bắt đầu dựa trên buổi học
            let sessionStartHour, sessionStartMinute;
            let useAfternoonSession = false; // Flag để đánh dấu khi nào chuyển sang buổi chiều (cho trường hợp "both")
            
            if (gradeSession === "afternoon") {
                sessionStartHour = afternoonHour;
                sessionStartMinute = afternoonMinute;
                useAfternoonSession = true;
            } else if (gradeSession === "both") {
                // Nếu học cả hai buổi, bắt đầu từ buổi sáng, sau đó có thể chuyển sang chiều
                sessionStartHour = morningHour;
                sessionStartMinute = morningMinute;
            } else {
                // Mặc định buổi sáng
                sessionStartHour = morningHour;
                sessionStartMinute = morningMinute;
            }

            // ⚙️ Khởi tạo trạng thái cho khối hiện tại (ĐÚNG NHƯ LOGIC GỐC)
            const usedSlotsByDay = {}; // Trạng thái này là LOCAL cho từng khối
            const newSchedules = [];
            const conflicts = [];
            const afternoonSessionByDay = {}; // Track buổi chiều cho từng ngày (cho trường hợp "both")

            // 💡 Phân bổ đều (round robin)
            let dayIndex = 0; // Bắt đầu từ ngày 0
            
            // 🔄 Bắt đầu vòng lặp Round Robin
            for (const subj of availableSubjects) {
                let scheduled = false;
                let attempts = 0;

                const duration = subj.defaultExamDuration || 90;

                // Thử xếp lịch cho môn này
                while (!scheduled && attempts < daysCount * 2) {
                    const curDate = startDate.add(dayIndex % daysCount, "day");
                    const dateKey = curDate.format("YYYY-MM-DD");

                    usedSlotsByDay[dateKey] = usedSlotsByDay[dateKey] || [];
                    // ✅ Reset flag buổi chiều cho mỗi ngày mới (nếu chưa được set)
                    if (!afternoonSessionByDay.hasOwnProperty(dateKey)) {
                        afternoonSessionByDay[dateKey] = useAfternoonSession; // Khởi tạo với giá trị ban đầu
                    }

                    // Nếu ngày này chưa đủ môn
                    if (usedSlotsByDay[dateKey].length < config.maxPerDay) {
                        // ⏰ Tính giờ bắt đầu môn tiếp theo dựa trên buổi học của khối
                        let slotStart;
                        if (usedSlotsByDay[dateKey].length === 0) {
                            // Môn đầu tiên trong ngày bắt đầu từ giờ buổi học của khối
                            // ✅ Nếu khối học buổi chiều hoặc đã chuyển sang buổi chiều, dùng giờ chiều
                            if (afternoonSessionByDay[dateKey] || gradeSession === "afternoon") {
                                slotStart = dayjs(curDate).hour(afternoonHour).minute(afternoonMinute);
                            } else {
                                slotStart = dayjs(curDate).hour(sessionStartHour).minute(sessionStartMinute);
                            } 
                        } else {
                            // Bắt đầu sau môn trước + thời gian nghỉ
                            const last = usedSlotsByDay[dateKey][usedSlotsByDay[dateKey].length - 1];
                            slotStart = dayjs(curDate)
                                .hour(last.endHour)
                                .minute(last.endMinute)
                                .add(config.breakBetween, "minute");
                            
                            // ✅ Nếu khối học cả hai buổi và đã hết slot buổi sáng, chuyển sang buổi chiều
                            if (gradeSession === "both" && !afternoonSessionByDay[dateKey]) {
                                // Kiểm tra xem có vượt quá giờ kết thúc buổi sáng không (giả sử buổi sáng kết thúc lúc 12:00)
                                const morningEndTime = dayjs(curDate).hour(12).minute(0);
                                if (slotStart.isAfter(morningEndTime) || slotStart.hour() >= 12) {
                                    // Chuyển sang buổi chiều
                                    slotStart = dayjs(curDate).hour(afternoonHour).minute(afternoonMinute);
                                    afternoonSessionByDay[dateKey] = true;
                                    console.log(`🔄 Khối ${currentGrade} chuyển sang buổi chiều cho ngày ${dateKey}`);
                                }
                            }
                        }

                        const startTime = slotStart.format("HH:mm");
                        const endTime = slotStart.add(duration, "minute").format("HH:mm");

                        const candidateDate = curDate.toDate();

                        // Kiểm tra conflict trong DB (sử dụng currentGrade)
                        const conflict = await checkScheduleConflict({
                            exam: examId,
                            grade: currentGrade, // Dùng khối hiện tại
                            date: candidateDate,
                            startTime,
                            duration,
                        });

                        if (!conflict) {
                            newSchedules.push({
                                exam: examId,
                                grade: currentGrade, // Dùng khối hiện tại
                                subject: subj._id,
                                date: candidateDate,
                                startTime,
                                endTime,
                                duration,
                                examType: validExamType, // ✅ Sử dụng loại kỳ thi từ frontend
                                status: "draft",
                            });

                            // 🧠 Lưu slot để tính giờ kế tiếp
                            const [eh, em] = endTime.split(":").map(Number);
                            usedSlotsByDay[dateKey].push({
                                subject: subj.name,
                                start: startTime,
                                end: endTime,
                                endHour: eh,
                                endMinute: em,
                            });

                            console.log(
                                `✅ Khối ${currentGrade}: Xếp ${subj.name} → ${curDate.format("DD/MM")} (${startTime} - ${endTime}, ${duration} phút)`
                            );

                            scheduled = true;
                        }
                    }

                    // Chuyển sang ngày tiếp theo (Round Robin)
                    dayIndex = (dayIndex + 1) % daysCount;
                    attempts++;
                } // End while loop

                if (!scheduled) {
                    conflicts.push({
                        grade: currentGrade,
                        subject: subj.name,
                        reason: `Không còn slot trống trong ${startDate.format("DD/MM")} → ${endDate.format("DD/MM")}`,
                    });
                }
            } // End subjects loop
            
            // --- Kết thúc Xử lý Khối hiện tại ---
            
            // 📊 Thu thập kết quả
            if (newSchedules.length > 0) {
                allNewSchedules.push(...newSchedules);
                successfulGrades.push(currentGrade);
            }
            allConflicts.push(...conflicts.map(c => ({ ...c, grade: currentGrade })));
            
            // Lưu phân bổ kết quả của khối này vào tổng
            allDistributions[currentGrade] = Object.entries(usedSlotsByDay).map(([date, slots]) => ({
                date,
                count: slots.length,
                subjects: slots.map(s => `${s.subject} (${s.start}-${s.end})`),
            }));
        } // End targetGrades loop

        // 🛑 Bước cuối: Lưu và Trả về kết quả tổng hợp
        if (!allNewSchedules.length)
            return res.status(400).json({ error: "Không thể tạo lịch mới cho bất kỳ khối nào.", details: allConflicts });

        await ExamSchedule.insertMany(allNewSchedules);
        console.log(`✅ Tổng cộng tạo ${allNewSchedules.length} lịch thi.`);

        res.json({
            message: `Đã tạo ${allNewSchedules.length} lịch thi mới cho các khối: ${successfulGrades.join(", ")}.`,
            created: allNewSchedules.length,
            total: allNewSchedules.length,
            conflicts: allConflicts.length ? allConflicts : undefined,
            distribution: targetGrades.length > 1 ? allDistributions : allDistributions[targetGrades[0]],
        });
    } catch (err) {
        console.error("❌ Lỗi autoGenerateSchedules:", err);
        res.status(500).json({ error: err.message });
    }
};


exports.updateDateTime = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startTime } = req.body;

    console.log("📩 Nhận yêu cầu updateDateTime:", { id, date, startTime });
     console.log("📩 Nhận yêu cầu updateDateTime 2:", {
      id,
      date,
      startTime,
      rawBody: req.body,
    });

    // 🟡 Validate
    if (!date || !startTime)
      return res.status(400).json({ error: "Thiếu ngày hoặc giờ bắt đầu." });

    // 🔍 Kiểm tra lịch thi tồn tại
    const schedule = await ExamSchedule.findById(id).populate("subject", "name");
    if (!schedule)
      return res.status(404).json({ error: "Không tìm thấy lịch thi." });
const normalizedDate = dayjs(date).startOf("day").toDate();


    // 🧩 Kiểm tra trùng lịch cùng khối + kỳ thi
    const conflict = await checkScheduleConflict({
      exam: schedule.exam,
      grade: schedule.grade,
      date: normalizedDate,
      startTime,
      duration: schedule.duration,
      excludeId: id,
    });

    if (conflict) {
      console.warn(
        `⚠️ Conflict detected:
         - Current: ${dayjs(normalizedDate).format("DD/MM")} ${startTime}
         - With: ${conflict.subject?.name || "Môn khác"} (${conflict.startTime}–${conflict.endTime})`
      );

      return res.status(400).json({
        error: `⛔ Trùng với môn ${
          conflict.subject?.name || "khác"
        } (${conflict.startTime}–${conflict.endTime}) ngày ${dayjs(
          conflict.date
        ).format("DD/MM/YYYY")}`,
      });
    }

    // 🔧 Tính toán giờ kết thúc
    // ✅ Parse startTime và set vào dayjs
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const start = dayjs(normalizedDate).hour(startHour).minute(startMinute);
    const end = start.add(schedule.duration || 90, "minute");
    const endTime = end.format("HH:mm");

    // 💾 Lưu thay đổi
    schedule.date = normalizedDate;
    schedule.startTime = startTime;
    schedule.endTime = endTime;

    await schedule.save();

    console.log(
      `✅ Đã cập nhật lịch thi: ${schedule.subject?.name || "(môn không rõ)"} → ${dayjs(
        normalizedDate
      ).format("DD/MM")} ${startTime} - ${endTime}`
    );

    res.json({
      message: "✅ Cập nhật ngày & giờ thành công.",
      data: schedule,
    });
  } catch (err) {
    console.error("❌ Lỗi updateDateTime:", err);
    res.status(500).json({ error: err.message });
  }
};