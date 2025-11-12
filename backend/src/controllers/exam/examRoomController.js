const mongoose = require("mongoose");
const { ExamSchedule, ExamRoom, ExamStudent } = require("../../models/exam/examIndex");
const Room = require("../../models/room/room");
const Teacher = require("../../models/user/teacher");
const puppeteer = require("puppeteer");

/* =========================================================
   📋 LẤY DANH SÁCH PHÒNG THI
========================================================= */
exports.getRooms = async (req, res) => {
  try {
    const { examId, scheduleId, grade } = req.query;
    const filter = {};
    if (examId) filter.exam = examId;
    if (scheduleId) filter.schedule = scheduleId;
    if (grade) filter.grade = grade;

    const rooms = await ExamRoom.find(filter)
      .populate("schedule", "subject date startTime")
      .populate("invigilators.teacher", "name teacherCode")
      .sort({ roomCode: 1 });

    res.json({ success: true, total: rooms.length, data: rooms });
  } catch (err) {
    console.error("❌ Lỗi getRooms:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   ➕ TẠO 1 PHÒNG THI
========================================================= */
exports.createRoom = async (req, res) => {
  try {
    const { exam, schedule, roomCode, capacity, type, note } = req.body;
    if (!exam || !schedule || !roomCode) {
      return res.status(400).json({
        error: "Thiếu thông tin bắt buộc (exam, schedule, roomCode).",
      });
    }

    const room = await ExamRoom.create({
      exam,
      schedule,
      roomCode,
      capacity,
      type,
      note,
    });
    res.status(201).json({ success: true, data: room });
  } catch (err) {
    console.error("❌ Lỗi createRoom:", err);
    res.status(400).json({ error: err.message });
  }
};

/* =========================================================
   ✏️ CẬP NHẬT PHÒNG THI
========================================================= */
exports.updateRoom = async (req, res) => {
  try {
    const room = await ExamRoom.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!room) return res.status(404).json({ error: "Không tìm thấy phòng thi." });
    res.json({ success: true, data: room });
  } catch (err) {
    console.error("❌ Lỗi updateRoom:", err);
    res.status(400).json({ error: err.message });
  }
};

/* =========================================================
   🗑️ XÓA PHÒNG THI
========================================================= */
exports.deleteRoom = async (req, res) => {
  try {
    const deleted = await ExamRoom.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Không tìm thấy phòng thi để xóa." });
    res.json({ success: true, message: "🗑️ Đã xóa phòng thi." });
  } catch (err) {
    console.error("❌ Lỗi deleteRoom:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   ⚡ TẠO PHÒNG TỰ ĐỘNG TỪ DANH SÁCH PHÒNG GỐC
========================================================= */
exports.autoGenerateRooms = async (req, res) => {
  try {
    const { examId, scheduleId } = req.body;
    if (!examId || !scheduleId) return res.status(400).json({ error: "Thiếu examId hoặc scheduleId." });

    const baseRooms = await Room.find({ status: "available" }).sort({ roomCode: 1 });
    if (!baseRooms.length) return res.status(404).json({ error: "Không có phòng học khả dụng." });

    const existing = await ExamRoom.find({ exam: examId, schedule: scheduleId });
    if (existing.length) return res.status(400).json({ error: "Đã tồn tại phòng thi cho lịch này." });

    const examRooms = baseRooms.map((r) => ({
      exam: examId,
      schedule: scheduleId,
      room: r._id,
      roomCode: r.roomCode,
      type: r.type,
      capacity: r.capacity,
      students: [], // init nếu model có field này
      isFull: false,
    }));

    await ExamRoom.insertMany(examRooms);
    res.json({ success: true, message: `Đã tạo ${examRooms.length} phòng thi.`, total: examRooms.length });
  } catch (err) {
    console.error("❌ Lỗi autoGenerateRooms:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   👩‍🏫 GÁN GIÁM THỊ CHO PHÒNG THI
========================================================= */
exports.assignInvigilators = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { invigilators } = req.body; // [{ teacherId, role }]

    if (!invigilators?.length) return res.status(400).json({ error: "Thiếu danh sách giám thị." });

    const room = await ExamRoom.findById(roomId);
    if (!room) return res.status(404).json({ error: "Không tìm thấy phòng thi." });

    const teacherIds = invigilators.map((i) => i.teacherId);
    const teachers = await Teacher.find({ _id: { $in: teacherIds } });
    if (teachers.length !== invigilators.length) return res.status(400).json({ error: "Một số giáo viên không hợp lệ." });

    room.invigilators = invigilators.map((i) => ({ teacher: i.teacherId, role: i.role || "assistant" }));
    await room.save();

    res.json({ success: true, message: "Gán giám thị thành công.", data: room });
  } catch (err) {
    console.error("❌ Lỗi assignInvigilators:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🎯 TỰ ĐỘNG CHIA HỌC SINH THEO TÊN (phiên bản giữ lại)
   * Lưu ý: cần đảm bảo ExamRoom model có field `students: []` nếu dùng push()
   * Nếu bạn dùng RoomAssignment để phân môn, cân nhắc bỏ hàm này.
========================================================= */
exports.autoDistributeStudents = async (req, res) => {
  try {
    const { examId, scheduleId, grade } = req.body;
    if (!examId || !scheduleId || !grade)
      return res.status(400).json({ error: "Thiếu thông tin (examId, scheduleId, grade)." });

    const rooms = await ExamRoom.find({ exam: examId, schedule: scheduleId }).sort({ roomCode: 1 });
    if (!rooms.length) return res.status(404).json({ error: "Chưa có phòng thi nào." });

    const students = await ExamStudent.find({ exam: examId, grade, room: null })
      .populate("student", "name")
      .sort({ "student.name": 1 });

    if (!students.length) return res.status(404).json({ error: "Không có học sinh cần phân." });

    // đảm bảo currentRoom.students tồn tại
    for (const r of rooms) {
      if (!Array.isArray(r.students)) r.students = [];
    }

    let roomIndex = 0;
    const updates = [];

    for (const es of students) {
      const currentRoom = rooms[roomIndex];
      if (!currentRoom) break;

      updates.push({
        updateOne: { filter: { _id: es._id }, update: { room: currentRoom._id } },
      });

      currentRoom.students.push(es.student._id);

      if (currentRoom.students.length >= (currentRoom.capacity || 24)) {
        currentRoom.isFull = true;
        roomIndex++;
      }
    }

    if (updates.length) {
      await ExamStudent.bulkWrite(updates);
      // save rooms (bulk save)
      await Promise.all(rooms.map((r) => r.save()));
    }

    res.json({ success: true, message: "Đã chia phòng thi tự động.", totalStudents: students.length, totalRoomsUsed: Math.min(rooms.length, roomIndex + 1) });
  } catch (err) {
    console.error("❌ Lỗi autoDistributeStudents:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📄 XUẤT DANH SÁCH PHÒNG THI RA PDF (1 phòng theo roomId)
========================================================= */
exports.exportRoomList = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await ExamRoom.findById(roomId)
      .populate("students", "name className gender studentCode")
      .populate("invigilators.teacher", "name teacherCode");

    if (!room) return res.status(404).json({ error: "Không tìm thấy phòng thi." });

    const invigilatorText = room.invigilators?.length
      ? room.invigilators.map((i) => `${i.role === "main" ? "Chính" : "Phụ"}: ${i.teacher?.name || "N/A"}`).join(" | ")
      : "Chưa phân công";

    const html = `
      <html><head>
      <meta charset="utf-8"/>
      <style>
        body { font-family: "DejaVu Sans", Arial, sans-serif; font-size: 13px; margin: 40px; }
        h2 { text-align: center; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 6px; }
        th { background-color: #f2f2f2; text-align: center; }
      </style>
      </head><body>
        <h2>DANH SÁCH PHÒNG THI ${room.roomCode}</h2>
        <p><b>Loại phòng:</b> ${room.type}</p>
        <p><b>Giám thị:</b> ${invigilatorText}</p>
        <p><b>Số thí sinh:</b> ${room.students?.length || 0}</p>
        <table>
          <thead><tr><th>STT</th><th>SBD</th><th>Họ tên</th><th>Lớp</th><th>Giới tính</th></tr></thead>
          <tbody>
            ${room.students && room.students.length ? room.students.map((s, i) => `
              <tr>
                <td>${i+1}</td>
                <td>${s.studentCode || "-"}</td>
                <td>${s.name}</td>
                <td>${s.className || "-"}</td>
                <td>${s.gender || "-"}</td>
              </tr>`).join("") : `<tr><td colspan="5" align="center">Không có học sinh</td></tr>`}
          </tbody>
        </table>
        <p style="text-align:right; margin-top:20px; font-size:12px;">Ngày in: ${new Date().toLocaleDateString("vi-VN")}</p>
      </body></html>
    `;

    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    res.set({ "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="room_${room.roomCode}.pdf"` });
    res.send(pdfBuffer);
  } catch (err) {
    console.error("❌ Lỗi exportRoomList:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📊 THỐNG KÊ PHÒNG THEO KỲ THI
========================================================= */
exports.getRoomStats = async (req, res) => {
  try {
    const { examId } = req.params;
    const stats = await ExamRoom.aggregate([
      { $match: { exam: new mongoose.Types.ObjectId(examId) } },
      {
        $group: {
          _id: "$schedule",
          totalRooms: { $sum: 1 },
          totalSeats: { $sum: "$capacity" },
          fullRooms: { $sum: { $cond: ["$isFull", 1, 0] } },
        },
      },
    ]);
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error("❌ Lỗi getRoomStats:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📋 LẤY PHÒNG THEO LỊCH
========================================================= */
exports.getRoomsBySchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const rooms = await ExamRoom.find({ schedule: scheduleId })
      .populate("exam", "name year semester")
      .populate("invigilators.teacher", "name teacherCode")
      .sort({ roomCode: 1 });
    res.json({ success: true, data: rooms });
  } catch (err) {
    console.error("❌ Lỗi getRoomsBySchedule:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📋 LẤY TẤT CẢ PHÒNG THEO KỲ THI
========================================================= */
exports.getByExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const rooms = await ExamRoom.find({ exam: examId })
      .populate("schedule", "subject date startTime grade")
      .populate("invigilators.teacher", "name teacherCode")
      .sort({ "schedule.date": 1, roomCode: 1 });

    if (!rooms.length) return res.status(404).json({ error: "Không có phòng nào cho kỳ thi này." });
    res.json({ success: true, data: rooms });
  } catch (err) {
    console.error("❌ Lỗi getByExam:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   ➕ TẠO PHÒNG THI TỪ DANH SÁCH (UI) CHO 1 LỊCH
========================================================= */
exports.createRoomsForSchedule = async (req, res) => {
  try {
    const { scheduleId, rooms, grade } = req.body;
    const schedule = await ExamSchedule.findById(scheduleId).populate("exam");
    if (!schedule) return res.status(404).json({ error: "Không tìm thấy lịch thi." });

    const examRooms = rooms.map((r) => ({
      exam: schedule.exam._id,
      schedule: schedule._id,
      grade,
      roomCode: r.roomCode,
      capacity: r.capacity || 24,
      type: r.type || "normal",
      students: [],
      isFull: false,
    }));

    const created = await ExamRoom.insertMany(examRooms);
    res.json({ success: true, message: `Tạo ${created.length} phòng thi thành công.`, total: created.length });
  } catch (err) {
    console.error("❌ Lỗi createRoomsForSchedule:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🗑️ RESET PHÒNG CHO 1 LỊCH
========================================================= */
exports.resetRooms = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const deleted = await ExamRoom.deleteMany({ schedule: scheduleId });
    res.json({ success: true, message: `Đã xóa ${deleted.deletedCount} phòng thi.` });
  } catch (err) {
    console.error("❌ Lỗi resetRooms:", err);
    res.status(500).json({ error: err.message });
  }
};
exports.autoAssignInvigilators = async (req, res) => {
  try {
    const { examId, scheduleId } = req.body;
    if (!examId || !scheduleId)
      return res.status(400).json({ error: "Thiếu examId hoặc scheduleId." });

    // Lấy lịch thi và phòng thi
    const schedule = await ExamSchedule.findById(scheduleId);
    if (!schedule) return res.status(404).json({ error: "Không tìm thấy lịch thi." });

    const rooms = await ExamRoom.find({ exam: examId, schedule: scheduleId });
    if (!rooms.length) return res.status(404).json({ error: "Chưa có phòng thi nào cho lịch này." });

    // Lấy danh sách giáo viên và lịch rảnh
    const teachers = await Teacher.find({ "availability.availableMatrix": { $exists: true } });

    if (!teachers.length) return res.status(404).json({ error: "Không có giáo viên khả dụng." });

    // 👉 Logic đơn giản: chọn ngẫu nhiên 2 giáo viên khác nhau cho mỗi phòng
    const assignedRooms = [];
    for (const room of rooms) {
      const selected = [];

      while (selected.length < 2 && teachers.length) {
        const idx = Math.floor(Math.random() * teachers.length);
        const t = teachers[idx];
        if (!selected.includes(t._id)) selected.push(t._id);
      }

      room.invigilators = [
        { teacher: selected[0], role: "main" },
        { teacher: selected[1], role: "assistant" },
      ];
      await room.save();
      assignedRooms.push(room.roomCode);
    }

    res.json({
      success: true,
      message: `Đã tự động gán giám thị cho ${assignedRooms.length} phòng thi.`,
      data: assignedRooms,
    });
  } catch (err) {
    console.error("❌ Lỗi autoAssignInvigilators:", err);
    res.status(500).json({ error: err.message });
  }
};