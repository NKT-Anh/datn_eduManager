const { RoomAssignment, ExamSchedule, ExamRoom, ExamStudent } = require("../../models/exam/examIndex");
const puppeteer = require("puppeteer");

/* =========================================================
   🪑 PHÂN PHÒNG THI TỰ ĐỘNG CHO LỊCH THI
========================================================= */
exports.autoAssignRooms = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const maxPerRoom = req.body.maxPerRoom || 24;

    // 1️⃣ Kiểm tra lịch thi
    const schedule = await ExamSchedule.findById(scheduleId)
      .populate("exam")
      .populate("subject");
    if (!schedule) return res.status(404).json({ error: "Không tìm thấy lịch thi." });

    // 2️⃣ Lấy danh sách học sinh theo kỳ + khối
    const students = await ExamStudent.find({
      exam: schedule.exam._id,
      grade: schedule.grade,
      status: "active",
    })
      .populate("student", "name className gender")
      .sort({ "student.name": 1 });

    if (!students.length)
      return res.status(400).json({ error: "Không có học sinh cần xếp phòng." });

    // 3️⃣ Lấy danh sách phòng thi theo lịch
    const examRooms = await ExamRoom.find({ schedule: scheduleId }).populate("room");
    if (!examRooms.length)
      return res.status(400).json({ error: "Chưa tạo phòng thi cho lịch này." });

    // 4️⃣ Xóa dữ liệu xếp phòng cũ
    await RoomAssignment.deleteMany({ schedule: scheduleId });

    // 5️⃣ Phân phòng & sinh SBD
    const assignments = [];
    const updates = [];
    let roomIndex = 0;
    let seatNumber = 1;
    let sbdCounter = 1;
    const sbdPrefix = `${schedule.exam.year.replace("-", "")}${schedule.semester}${schedule.grade}`;

    for (const student of students) {
      const room = examRooms[roomIndex];
      if (!room) break;

      const sbd = `${sbdPrefix}${String(sbdCounter).padStart(4, "0")}`;

      assignments.push({
        exam: schedule.exam._id,
        schedule: schedule._id,
        subject: schedule.subject?._id,
        examRoom: room._id,
        examStudent: student._id,
        sbd,
        seatNumber,
      });

      updates.push({
        updateOne: {
          filter: { _id: student._id },
          update: { room: room._id },
        },
      });

      // Cập nhật biến đếm
      seatNumber++;
      sbdCounter++;

      if (seatNumber > (room.capacity || maxPerRoom)) {
        roomIndex++;
        seatNumber = 1;
      }
    }

    // 6️⃣ Ghi vào database
    if (assignments.length > 0) {
      await RoomAssignment.insertMany(assignments, { ordered: false });
      if (updates.length > 0) await ExamStudent.bulkWrite(updates);

      await ExamSchedule.findByIdAndUpdate(scheduleId, {
        studentsCount: assignments.length,
        roomCount: examRooms.length,
      });
    }

    res.json({
      message: `✅ Đã xếp ${assignments.length} học sinh vào ${examRooms.length} phòng.`,
      total: assignments.length,
      rooms: examRooms.length,
    });
  } catch (err) {
    console.error("❌ Lỗi autoAssignRooms:", err);
    res.status(500).json({ error: "Lỗi khi xếp phòng thi", details: err.message });
  }
};

/* =========================================================
   📋 LẤY DANH SÁCH HỌC SINH TRONG LỊCH THI
========================================================= */
exports.getAssignmentsBySchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const data = await RoomAssignment.find({ schedule: scheduleId })
      .populate({
        path: "examStudent",
        populate: { path: "student", select: "name className gender studentCode" },
      })
      .populate("examRoom", "roomCode")
      .sort({ examRoom: 1, seatNumber: 1 });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   ✏️ CẬP NHẬT / SỬA CHỖ NGỒI
========================================================= */
exports.updateAssignment = async (req, res) => {
  try {
    const updated = await RoomAssignment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated)
      return res.status(404).json({ error: "Không tìm thấy dữ liệu xếp chỗ." });
    res.json({ message: "✅ Cập nhật chỗ ngồi thành công.", data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🗑️ XÓA / RESET XẾP CHỖ
========================================================= */
exports.resetAssignments = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const deleted = await RoomAssignment.deleteMany({ schedule: scheduleId });
    await ExamSchedule.findByIdAndUpdate(scheduleId, {
      studentsCount: 0,
    });
    res.json({ message: `🗑️ Đã xóa ${deleted.deletedCount} xếp chỗ.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🧾 XUẤT DANH SÁCH PHÒNG THI RA PDF (mỗi phòng 1 trang)
========================================================= */
exports.exportRoomList = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const assignments = await RoomAssignment.find({ schedule: scheduleId })
      .populate({
        path: "examStudent",
        populate: { path: "student", select: "name className gender studentCode" },
      })
      .populate("examRoom", "roomCode")
      .sort({ examRoom: 1, seatNumber: 1 });

    if (!assignments.length)
      return res.status(404).json({ error: "Không có học sinh trong lịch thi này." });

    // Gom theo từng phòng thi
    const grouped = {};
    for (const a of assignments) {
      const roomCode = a.examRoom?.roomCode || "Chưa có";
      if (!grouped[roomCode]) grouped[roomCode] = [];
      grouped[roomCode].push(a);
    }

    // Sinh HTML
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; font-size: 13px; margin: 40px; }
            h2 { text-align: center; margin-bottom: 15px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #000; padding: 5px; text-align: left; }
            th { background: #f0f0f0; }
          </style>
        </head>
        <body>
          ${Object.keys(grouped)
            .map(
              (roomCode) => `
                <h2>DANH SÁCH PHÒNG THI - ${roomCode}</h2>
                <table>
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>SBD</th>
                      <th>Họ tên</th>
                      <th>Lớp</th>
                      <th>Giới tính</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${grouped[roomCode]
                      .map(
                        (a, i) => `
                        <tr>
                          <td>${i + 1}</td>
                          <td>${a.sbd}</td>
                          <td>${a.examStudent?.student?.name || "-"}</td>
                          <td>${a.examStudent?.student?.className || "-"}</td>
                          <td>${a.examStudent?.student?.gender || ""}</td>
                        </tr>`
                      )
                      .join("")}
                  </tbody>
                </table>
                <div style="page-break-after: always;"></div>
              `
            )
            .join("")}
        </body>
      </html>
    `;

    // Tạo PDF
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4" });
    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="room_assignment_${scheduleId}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error("❌ exportRoomList:", err);
    res.status(500).json({ error: err.message });
  }
};
