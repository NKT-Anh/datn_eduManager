const { RoomAssignment, ExamSchedule, ExamRoom, ExamStudent } = require("../../models/exam/examIndex");
const Student = require("../../models/user/student");
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

    // 5️⃣ Tính số học sinh cho mỗi phòng (phân bổ đều)
    const totalStudents = students.length;
    const totalRooms = examRooms.length;
    
    // ✅ Tính số học sinh trung bình mỗi phòng
    const baseStudentsPerRoom = Math.floor(totalStudents / totalRooms);
    // ✅ Tính số học sinh dư (sẽ phân bổ vào các phòng đầu tiên)
    const extraStudents = totalStudents % totalRooms;
    
    // ✅ Tạo mảng số học sinh cho mỗi phòng
    const studentsPerRoom = examRooms.map((_, index) => {
      // Các phòng đầu tiên sẽ có thêm 1 học sinh nếu có dư
      return baseStudentsPerRoom + (index < extraStudents ? 1 : 0);
    });

    // ✅ Phân bổ học sinh đều vào các phòng (round-robin)
    const assignments = [];
    const updates = [];
    const sbdPrefix = `${schedule.exam.year.replace("-", "")}${schedule.semester}${schedule.grade}`;
    
    let sbdCounter = 1;
    let studentIndex = 0;
    
    // Duyệt qua từng phòng
    for (let roomIndex = 0; roomIndex < totalRooms; roomIndex++) {
      const room = examRooms[roomIndex];
      const targetCount = studentsPerRoom[roomIndex];
      let seatNumber = 1;
      
      // Phân bổ đúng số học sinh cho phòng này
      for (let i = 0; i < targetCount && studentIndex < totalStudents; i++) {
        const student = students[studentIndex];
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

        seatNumber++;
        sbdCounter++;
        studentIndex++;
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
   🧑‍🎓 GÁN THỦ CÔNG HỌC SINH VÀO 1 PHÒNG THI
   - Lọc học sinh theo niên khóa + khối của kỳ thi
   - Sắp xếp theo tên (A-Z) và tạo danh sách RoomAssignment
========================================================= */
exports.manualAssignRoom = async (req, res) => {
  try {
    const { roomId, studentIds } = req.body;

    if (!roomId || !Array.isArray(studentIds)) {
      return res
        .status(400)
        .json({ error: "Thiếu roomId hoặc danh sách học sinh." });
    }

    const uniqueStudentIds = [...new Set(studentIds.filter(Boolean))];

    const room = await ExamRoom.findById(roomId)
      .populate("exam", "year")
      .populate("schedule");

    if (!room) {
      return res.status(404).json({ error: "Không tìm thấy phòng thi." });
    }

    const exam = room.exam;
    const schedule =
      room.schedule && room.schedule.grade !== undefined
        ? room.schedule
        : await ExamSchedule.findById(room.schedule);

    if (!exam) {
      return res.status(404).json({ error: "Phòng thi chưa gắn với kỳ thi." });
    }

    // ✅ Kiểm tra exam có year
    if (!exam.year) {
      return res.status(400).json({ error: "Kỳ thi chưa có năm học." });
    }

    if (!schedule) {
      return res.status(404).json({ error: "Phòng thi chưa gắn lịch thi." });
    }

    const grade = schedule.grade ?? room.grade;
    if (grade === undefined || grade === null) {
      return res
        .status(400)
        .json({ error: "Không xác định được khối của phòng thi." });
    }

    const capacity =
      room.capacity ||
      exam?.config?.maxStudentsPerRoom ||
      24;

    if (uniqueStudentIds.length > capacity) {
      return res.status(400).json({
        error: `Số lượng học sinh vượt quá sức chứa (${capacity}) của phòng ${room.roomCode}.`,
      });
    }

    const students = await Student.find({ _id: { $in: uniqueStudentIds } })
      .populate("classId", "className classCode grade year")
      .lean();

    if (students.length !== uniqueStudentIds.length) {
      return res.status(400).json({
        error: "Một số học sinh không tồn tại hoặc đã bị xóa.",
      });
    }

    const studentsMap = new Map(
      students.map((s) => [String(s._id), s])
    );

    const gradeString = String(grade);
    const invalidStudent = students.find(
      (s) =>
        s.currentYear !== exam.year || String(s.grade) !== gradeString
    );

    if (invalidStudent) {
      return res.status(400).json({
        error: `Học sinh ${invalidStudent.name} không thuộc khối ${grade} của niên khóa ${exam.year}.`,
      });
    }

    const studentWithoutClass = students.find((s) => !s.classId);
    if (studentWithoutClass) {
      return res.status(400).json({
        error: `Học sinh ${studentWithoutClass.name} chưa được gán vào lớp học.`,
      });
    }

    const sortedStudents = [...students].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", "vi", {
        sensitivity: "base",
        ignorePunctuation: true,
      })
    );

    const sortedIds = sortedStudents.map((s) => String(s._id));

    const existingExamStudents = await ExamStudent.find({
      exam: exam._id,
      student: { $in: sortedIds },
    });

    const examStudentMap = new Map();
    existingExamStudents.forEach((doc) => {
      examStudentMap.set(String(doc.student), doc);
    });

    const missingStudentIds = sortedIds.filter(
      (id) => !examStudentMap.has(id)
    );

    let sequence = await ExamStudent.countDocuments({ exam: exam._id });
    const newExamStudentsPayload = [];

    for (const studentId of missingStudentIds) {
      const student = studentsMap.get(studentId);
      sequence += 1;
      const sbd = `${grade}${String(sequence).padStart(4, "0")}`;

      newExamStudentsPayload.push({
        exam: exam._id,
        student: student._id,
        class: student.classId._id || student.classId,
        grade: String(grade),
        sbd,
        status: "active",
      });
    }

    if (newExamStudentsPayload.length) {
      const inserted = await ExamStudent.insertMany(newExamStudentsPayload);
      inserted.forEach((doc) => {
        examStudentMap.set(String(doc.student), doc);
      });
    }

    // Reload map for completeness (existing docs may be lean objects)
    if (missingStudentIds.length) {
      const refreshed = await ExamStudent.find({
        exam: exam._id,
        student: { $in: sortedIds },
      });
      examStudentMap.clear();
      refreshed.forEach((doc) => {
        examStudentMap.set(String(doc.student), doc);
      });
    }

    const selectedExamStudentIds = sortedIds.map(
      (id) => examStudentMap.get(id)?._id
    );

    if (selectedExamStudentIds.some((id) => !id)) {
      return res.status(500).json({
        error: "Không thể khởi tạo danh sách học sinh dự thi.",
      });
    }

    const existingAssignments = await RoomAssignment.find({
      examRoom: room._id,
    }).select("examStudent");

    if (existingAssignments.length) {
      const selectedSet = new Set(
        selectedExamStudentIds.map((id) => String(id))
      );

      const needReset = existingAssignments
        .map((a) => a.examStudent)
        .filter((id) => id && !selectedSet.has(String(id)));

      await RoomAssignment.deleteMany({ examRoom: room._id });

      if (needReset.length) {
        // ✅ Không cần reset fixedRoomCode vì nó là mã phòng cố định, không phụ thuộc vào ExamRoom
        // fixedRoomCode vẫn giữ nguyên để dùng cho các lịch thi khác
      }
    }

    await ExamStudent.updateMany(
      { _id: { $in: selectedExamStudentIds } },
      {
        $set: {
          room: room._id,
          grade: String(grade),
          status: "active",
        },
      }
    );

    const assignmentsPayload = sortedIds.map((studentId, index) => {
      const examStudent = examStudentMap.get(studentId);

      return {
        exam: exam._id,
        schedule: schedule._id,
        subject: schedule.subject || undefined,
        examRoom: room._id,
        examStudent: examStudent._id,
        seatNumber: index + 1,
        sbd: examStudent.sbd,
      };
    });

    if (assignmentsPayload.length) {
      await RoomAssignment.insertMany(assignmentsPayload);
    }

    await ExamRoom.findByIdAndUpdate(room._id, {
      $set: {
        students: sortedStudents.map((s) => s._id),
        isFull: sortedStudents.length >= capacity,
      },
    });

    const [studentsCount, roomCount] = await Promise.all([
      RoomAssignment.countDocuments({ schedule: schedule._id }),
      ExamRoom.countDocuments({ schedule: schedule._id }),
    ]);

    await ExamSchedule.findByIdAndUpdate(schedule._id, {
      $set: { studentsCount, roomCount },
    });

    res.json({
      message: `✅ Đã gán ${sortedStudents.length} học sinh vào phòng ${room.roomCode}.`,
      total: sortedStudents.length,
      room: {
        id: room._id,
        roomCode: room.roomCode,
      },
    });
  } catch (err) {
    console.error("❌ Lỗi manualAssignRoom:", err);
    res.status(500).json({ error: err.message });
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
