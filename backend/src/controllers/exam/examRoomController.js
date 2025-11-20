const mongoose = require("mongoose");
const { Exam, ExamSchedule, ExamRoom, FixedExamRoom, ExamStudent, RoomAssignment } = require("../../models/exam/examIndex");
const Room = require("../../models/room/room");
const Teacher = require("../../models/user/teacher");
const puppeteer = require("puppeteer");
const Student = require("../../models/user/student");
const ScheduleConfig = require("../../models/subject/scheduleConfig");
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
      .populate({
        path: "schedule",
        select: "subject date startTime endTime grade",
        populate: {
          path: "subject",
          select: "name code"
        }
      })
      .populate("invigilators.teacher", "name teacherCode")
      .populate("fixedExamRoom", "code grade capacity students") // ✅ Populate FixedExamRoom
      .populate("room", "roomCode type status") // ✅ Populate Room (phòng vật lý)
      .sort({ roomCode: 1 });

    res.json({ success: true, total: rooms.length, data: rooms });
  } catch (err) {
    console.error("❌ Lỗi getRooms:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📊 LẤY SỐ PHÒNG KHẢ DỤNG (available + normal)
========================================================= */
exports.getAvailableRoomsCount = async (req, res) => {
  try {
    const count = await Room.countDocuments({
      status: "available",
      type: "normal",
    });
    res.json({ count, totalAvailableRooms: count });
  } catch (err) {
    console.error("❌ Lỗi getAvailableRoomsCount:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📋 LẤY DANH SÁCH PHÒNG HỌC KHẢ DỤNG (chưa được dùng trong kỳ thi)
   - Chỉ lấy phòng thường (type: "normal")
   - Loại bỏ các phòng đã được dùng trong kỳ thi này
========================================================= */
exports.getAvailableRooms = async (req, res) => {
  try {
    const { examId } = req.params;
    
    if (!examId || !mongoose.Types.ObjectId.isValid(examId)) {
      return res.status(400).json({ error: "examId không hợp lệ." });
    }

    // ✅ Lấy tất cả phòng học có status "available" (bao gồm cả phòng máy và phòng thí nghiệm)
    // Lưu ý: Khi tạo tự động chỉ lấy phòng thường, nhưng khi tạo thủ công có thể chọn tất cả
    const allRooms = await Room.find({ 
      status: "available"
      // ✅ Không lọc theo type để có thể chọn phòng máy/phòng thí nghiệm khi tạo thủ công
    }).sort({ roomCode: 1 });

    // ✅ Lấy danh sách phòng thi đã được dùng trong kỳ thi này
    const usedExamRooms = await ExamRoom.find({ exam: examId }).select("roomCode room").lean();
    const usedRoomCodes = new Set(usedExamRooms.map((er) => er.roomCode).filter(Boolean));
    const usedRoomIds = new Set(usedExamRooms.map((er) => er.room?.toString()).filter(Boolean));

    // ✅ Lọc ra những phòng chưa được dùng
    const availableRooms = allRooms.filter(
      (r) => !usedRoomCodes.has(r.roomCode) && !usedRoomIds.has(r._id.toString())
    );

    res.json({ 
      success: true, 
      total: availableRooms.length,
      data: availableRooms 
    });
  } catch (err) {
    console.error("❌ Lỗi getAvailableRooms:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   ➕ TẠO 1 PHÒNG THI
========================================================= */
exports.createRoom = async (req, res) => {
  try {
    const { exam, schedule, room, roomCode, capacity, type, note, grade, fixedExamRoom } = req.body;
    
    // ✅ Bắt buộc phải có room (phòng vật lý thật)
    if (!room) {
      return res.status(400).json({
        error: "Thiếu thông tin bắt buộc: phòng vật lý (room). FixedExamRoom là phòng lý thuyết, phải liên kết với Room vật lý thật.",
      });
    }

    // ✅ Lấy thông tin từ Room model (phòng vật lý thật)
    const physicalRoom = await Room.findById(room);
    if (!physicalRoom) {
      return res.status(404).json({ error: "Không tìm thấy phòng học vật lý." });
    }

    if (physicalRoom.status !== "available") {
      return res.status(400).json({ error: `Phòng ${physicalRoom.roomCode} không khả dụng (status: ${physicalRoom.status}).` });
    }

    const roomId = physicalRoom._id;
    const finalRoomCode = physicalRoom.roomCode; // ✅ Mã phòng vật lý thật
    const finalType = physicalRoom.type || "normal"; // ✅ Loại phòng vật lý thật

    if (!exam) {
      return res.status(400).json({
        error: "Thiếu thông tin bắt buộc (exam).",
      });
    }

    // ✅ Kiểm tra exam tồn tại và có year
    const examData = await Exam.findById(exam).select("year");
    if (!examData) {
      return res.status(404).json({ error: "Không tìm thấy kỳ thi." });
    }
    if (!examData.year) {
      return res.status(400).json({ error: "Kỳ thi chưa có năm học." });
    }

    // ✅ Nếu có schedule, kiểm tra schedule thuộc về exam này
    if (schedule) {
      const scheduleData = await ExamSchedule.findById(schedule).select("exam");
      if (!scheduleData) {
        return res.status(404).json({ error: "Không tìm thấy lịch thi." });
      }
      if (String(scheduleData.exam) !== String(exam)) {
        return res.status(400).json({ error: "Lịch thi không thuộc về kỳ thi này." });
      }
    }

    // ✅ Bắt buộc phải có fixedExamRoom (phòng lý thuyết)
    if (!fixedExamRoom) {
      return res.status(400).json({
        error: "Thiếu thông tin bắt buộc: phòng cố định (fixedExamRoom). FixedExamRoom là phòng lý thuyết chứa danh sách học sinh, phải được liên kết với Room vật lý thật.",
      });
    }

    // ✅ Kiểm tra fixedExamRoom thuộc về exam này
    const fixedRoomData = await FixedExamRoom.findById(fixedExamRoom).select("exam grade");
    if (!fixedRoomData) {
      return res.status(404).json({ error: "Không tìm thấy phòng cố định (FixedExamRoom)." });
    }
    if (String(fixedRoomData.exam) !== String(exam)) {
      return res.status(400).json({ error: "Phòng cố định không thuộc về kỳ thi này." });
    }
    // ✅ Nếu có grade, kiểm tra grade khớp với fixedExamRoom
    if (grade && String(fixedRoomData.grade) !== String(grade)) {
      return res.status(400).json({ error: "Khối không khớp với phòng cố định đã chọn." });
    }

    // ✅ Kiểm tra xem phòng đã được dùng chưa (trong cùng schedule nếu có)
    const existingRoomQuery = {
      exam,
      roomCode: finalRoomCode,
    };
    if (schedule) {
      existingRoomQuery.schedule = schedule;
    }
    const existingRoom = await ExamRoom.findOne(existingRoomQuery);

    if (existingRoom) {
      return res.status(400).json({
        error: `Phòng ${finalRoomCode} đã được sử dụng trong ${schedule ? "lịch thi này" : "kỳ thi này"}.`,
      });
    }

    const examRoom = await ExamRoom.create({
      exam,
      schedule: schedule || null, // ✅ schedule bắt buộc nếu có fixedExamRoom
      fixedExamRoom: fixedExamRoom || undefined, // ✅ Gắn với phòng cố định
      room: roomId,
      roomCode: finalRoomCode,
      capacity: capacity || 24,
      type: finalType,
      grade: grade || undefined,
      note,
    });
    res.status(201).json({ success: true, data: examRoom });
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
    const roomId = req.params.id;
    const { capacity, note, invigilators, grade } = req.body;

    // ✅ Kiểm tra phòng thi có tồn tại không
    const room = await ExamRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: "Không tìm thấy phòng thi." });
    }

    // ✅ Chỉ cho phép cập nhật các trường được phép
    const updateData = {};
    if (capacity !== undefined) {
      if (capacity < 1) {
        return res.status(400).json({ error: "Sức chứa phải lớn hơn 0." });
      }
      updateData.capacity = capacity;
      // ✅ Tự động cập nhật isFull dựa trên FixedExamRoom
      if (room.fixedExamRoom) {
        const fixedRoom = await FixedExamRoom.findById(room.fixedExamRoom);
        if (fixedRoom) {
          const studentCount = fixedRoom.students?.length || 0;
          updateData.isFull = studentCount >= capacity;
        }
      }
    }
    if (note !== undefined) updateData.note = note;
    if (grade !== undefined) updateData.grade = String(grade);
    if (invigilators !== undefined) {
      // ✅ Validate invigilators format
      if (Array.isArray(invigilators)) {
        updateData.invigilators = invigilators.map((inv) => ({
          teacher: inv.teacherId || inv.teacher,
          role: inv.role || "assistant",
        }));
      }
    }

    const updatedRoom = await ExamRoom.findByIdAndUpdate(roomId, { $set: updateData }, { new: true });
    res.json({ success: true, data: updatedRoom });
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
    const roomId = req.params.id;
    
    // ✅ Kiểm tra phòng thi có tồn tại không
    const room = await ExamRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: "Không tìm thấy phòng thi để xóa." });
    }

    // ✅ Kiểm tra xem có học sinh trong phòng không (qua FixedExamRoom)
    if (room.fixedExamRoom) {
      const fixedRoom = await FixedExamRoom.findById(room.fixedExamRoom);
      if (fixedRoom && fixedRoom.students && fixedRoom.students.length > 0) {
        return res.status(400).json({ 
          error: `Không thể xóa phòng thi. Phòng ${room.roomCode} đang có ${fixedRoom.students.length} học sinh. Vui lòng xóa hoặc chuyển học sinh trước.` 
        });
      }
    }

    // ✅ Xóa RoomAssignment liên quan (nếu có)
    const RoomAssignment = require("../../models/exam/roomAssignment");
    await RoomAssignment.deleteMany({ examRoom: roomId });

    // ✅ Xóa phòng thi
    await ExamRoom.findByIdAndDelete(roomId);

    // ✅ Cập nhật ExamStudent: xóa fixedRoomCode nếu có
    await ExamStudent.updateMany(
      { fixedRoomCode: room.roomCode }, // ✅ Tìm theo roomCode
      { $set: { fixedRoomCode: null } }
    );

    res.json({ success: true, message: `🗑️ Đã xóa phòng thi ${room.roomCode}.` });
  } catch (err) {
    console.error("❌ Lỗi deleteRoom:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   ⚡ TẠO PHÒNG TỰ ĐỘNG TỪ DANH SÁCH PHÒNG GỐC
   - Lấy TẤT CẢ phòng học (status: available) và chuyển thành phòng thi
   - Nếu đã có phòng thi rồi, chỉ tạo thêm những phòng còn thiếu
   - Không tạo mới phòng học, chỉ map từ phòng học có sẵn
========================================================= */
exports.autoGenerateRooms = async (req, res) => {
  try {
    const { examId, scheduleId } = req.body;
    if (!examId || !scheduleId) return res.status(400).json({ error: "Thiếu examId hoặc scheduleId." });

    // ✅ Kiểm tra exam tồn tại và có year
    const exam = await Exam.findById(examId).select("config year");
    if (!exam) {
      return res.status(404).json({ error: "Không tìm thấy kỳ thi." });
    }

    // ✅ Lấy thông tin lịch thi để biết grade
    const ExamSchedule = require("../../models/exam/examSchedule");
    const schedule = await ExamSchedule.findById(scheduleId).select("grade");
    if (!schedule) {
      return res.status(404).json({ error: "Không tìm thấy lịch thi." });
    }

    // ✅ Đếm số học sinh tham gia thi ở khối này
    const ExamStudent = require("../../models/exam/examIndex").ExamStudent;
    const studentCount = await ExamStudent.countDocuments({
      exam: examId,
      grade: String(schedule.grade), // ✅ Lấy số học sinh theo grade của lịch thi
      status: "active",
    });

    // ✅ Tính số phòng cần thiết: số học sinh / 20 (làm tròn lên)
    const requiredRooms = Math.ceil(studentCount / 20);

    if (requiredRooms === 0) {
      return res.json({
        success: true,
        message: `Không có học sinh tham gia thi khối ${schedule.grade}, không cần tạo phòng thi.`,
        total: 0,
        added: 0,
        studentCount: 0,
        requiredRooms: 0,
      });
    }

    // 1️⃣ Lấy phòng học có status "available" và type "normal" (chỉ phòng thường)
    const baseRooms = await Room.find({ 
      status: "available",
      type: "normal" // ✅ Chỉ lấy phòng thường
    }).sort({ roomCode: 1 });
    
    if (!baseRooms.length) {
      return res.status(404).json({ error: "Không có phòng học khả dụng." });
    }

    // 2️⃣ Lấy danh sách phòng thi đã tồn tại cho lịch này
    const existingExamRooms = await ExamRoom.find({ exam: examId, schedule: scheduleId });
    const existingRoomIds = new Set(existingExamRooms.map((er) => er.room?.toString()).filter(Boolean));

    // 3️⃣ Tính số phòng còn thiếu
    const roomsNeeded = Math.max(0, requiredRooms - existingExamRooms.length);

    if (roomsNeeded === 0) {
      return res.json({
        success: true,
        message: `Đã có đủ phòng thi cho lịch này (${existingExamRooms.length} phòng, cần ${requiredRooms} phòng cho ${studentCount} học sinh).`,
        total: existingExamRooms.length,
        added: 0,
        studentCount,
        requiredRooms,
      });
    }

    // 4️⃣ Kiểm tra xem đã có phòng thi cho khối này trong kỳ thi chưa (bất kỳ lịch thi nào)
    const existingRoomsForGrade = await ExamRoom.find({
      exam: examId,
      grade: String(schedule.grade),
      schedule: { $ne: scheduleId }, // ✅ Loại trừ lịch thi hiện tại
    }).sort({ roomCode: 1 }).limit(roomsNeeded);

    let examRooms = [];
    let copiedCount = 0;

    if (existingRoomsForGrade.length > 0) {
      // ✅ Sao chép dữ liệu từ phòng thi đã có (trừ invigilators)
      const copiedRooms = existingRoomsForGrade
        .filter((er) => !existingRoomIds.has(er.room?.toString())) // ✅ Loại bỏ phòng đã có trong lịch thi này
        .slice(0, roomsNeeded)
        .map((existingRoom) => ({
          exam: examId,
          schedule: scheduleId, // ✅ Gán schedule mới
          room: existingRoom.room, // ✅ Giữ nguyên room gốc
          roomCode: existingRoom.roomCode, // ✅ Sao chép roomCode
          type: existingRoom.type || "normal", // ✅ Sao chép type
          capacity: existingRoom.capacity || 24, // ✅ Sao chép capacity
          grade: String(schedule.grade), // ✅ Giữ nguyên grade
          note: existingRoom.note, // ✅ Sao chép note
          isFull: false, // ✅ Reset isFull
          _isCopied: true, // ✅ Đánh dấu phòng được sao chép
          // ✅ KHÔNG sao chép invigilators - mỗi lịch thi có giám thị riêng
        }));
      
      examRooms = copiedRooms;
      copiedCount = copiedRooms.length;
    }

    // 5️⃣ Nếu chưa đủ phòng, tạo thêm từ Room
    if (examRooms.length < roomsNeeded) {
      const remainingNeeded = roomsNeeded - examRooms.length;
      const usedRoomIds = new Set([
        ...Array.from(existingRoomIds),
        ...examRooms.map((er) => er.room?.toString()).filter(Boolean),
      ]);

      const roomsToAdd = baseRooms
        .filter((r) => !usedRoomIds.has(r._id.toString()))
        .slice(0, remainingNeeded);

      if (roomsToAdd.length < remainingNeeded) {
        return res.status(400).json({
          error: `Không đủ phòng học khả dụng. Cần ${remainingNeeded} phòng nhưng chỉ có ${roomsToAdd.length} phòng.`,
          studentCount,
          requiredRooms,
          existing: existingExamRooms.length,
          needed: roomsNeeded,
          copied: examRooms.length,
          available: roomsToAdd.length,
        });
      }

      // ✅ Lấy config của exam để lấy capacity mặc định
      const defaultCapacity = exam?.config?.maxStudentsPerRoom || 24;

      // ✅ Tạo ExamRoom từ những phòng học còn thiếu
      const newExamRooms = roomsToAdd.map((r) => ({
      exam: examId,
      schedule: scheduleId,
      room: r._id,
      roomCode: r.roomCode,
        type: r.type || "normal",
        capacity: defaultCapacity, // Dùng capacity từ exam config hoặc mặc định 24
        grade: String(schedule.grade), // ✅ Gán grade cho phòng thi
      isFull: false,
    }));

      examRooms = [...examRooms, ...newExamRooms];
    }

    // ✅ Loại bỏ field _isCopied trước khi insert (không phải field của schema)
    const examRoomsToInsert = examRooms.map(({ _isCopied, ...room }) => room);
    const insertedRooms = await ExamRoom.insertMany(examRoomsToInsert);

    // ✅ Tự động gán học sinh vào phòng thi đã sao chép
    if (copiedCount > 0 && existingRoomsForGrade.length > 0) {
      await assignStudentsToCopiedRooms(
        examId,
        scheduleId,
        String(schedule.grade),
        existingRoomsForGrade,
        insertedRooms.filter((r, index) => index < copiedCount)
      );
    }

    const newCount = examRooms.length - copiedCount;

    res.json({
      success: true,
      message: `Đã thêm ${examRooms.length} phòng thi${copiedCount > 0 ? ` (${copiedCount} phòng sao chép từ lịch thi khác, ${newCount} phòng mới)` : ""}. Tổng cộng: ${existingExamRooms.length + examRooms.length} phòng (${studentCount} học sinh khối ${schedule.grade}, cần ${requiredRooms} phòng).`,
      total: existingExamRooms.length + examRooms.length,
      added: examRooms.length,
      copied: copiedCount,
      new: newCount,
      existing: existingExamRooms.length,
      studentCount,
      requiredRooms,
    });
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
   🎯 TỰ ĐỘNG CHIA HỌC SINH THEO TÊN
   * Lưu ý: Học sinh được lưu trong FixedExamRoom, không phải ExamRoom
   * Hàm này gán ExamStudent.room = FixedExamRoom._id
========================================================= */
exports.autoDistributeStudents = async (req, res) => {
  try {
    const { examId, scheduleId, grade } = req.body;
    if (!examId || !scheduleId || !grade)
      return res.status(400).json({ error: "Thiếu thông tin (examId, scheduleId, grade)." });

    // ✅ Kiểm tra exam tồn tại và có year
    const exam = await Exam.findById(examId).select("year");
    if (!exam) {
      return res.status(404).json({ error: "Không tìm thấy kỳ thi." });
    }
    if (!exam.year) {
      return res.status(400).json({ error: "Kỳ thi chưa có năm học." });
    }

    const rooms = await ExamRoom.find({ exam: examId, schedule: scheduleId }).sort({ roomCode: 1 });
    if (!rooms.length) return res.status(404).json({ error: "Chưa có phòng thi nào." });

    // ✅ Lấy học sinh từ ExamStudent (không phải Student)
    const students = await ExamStudent.find({ 
      exam: examId, 
      grade: String(grade), 
      fixedRoomCode: null, // ✅ Chưa được gán phòng cố định
      status: "active"
    })
      .populate("student", "name")
      .sort({ "student.name": 1 });

    if (!students.length) return res.status(404).json({ error: "Không có học sinh cần phân." });

    // ✅ Lấy FixedExamRoom từ ExamRoom
    const fixedRoomIds = [...new Set(rooms.map(r => r.fixedExamRoom).filter(Boolean))];
    const fixedRooms = await FixedExamRoom.find({ _id: { $in: fixedRoomIds } });

    // ✅ Tính số học sinh cho mỗi phòng (phân bổ đều)
    const totalStudents = students.length;
    const totalRooms = rooms.length;
    
    // ✅ Tính số học sinh trung bình mỗi phòng
    const baseStudentsPerRoom = Math.floor(totalStudents / totalRooms);
    // ✅ Tính số học sinh dư (sẽ phân bổ vào các phòng đầu tiên)
    const extraStudents = totalStudents % totalRooms;
    
    // ✅ Tạo mảng số học sinh cho mỗi phòng
    const studentsPerRoom = rooms.map((_, index) => {
      // Các phòng đầu tiên sẽ có thêm 1 học sinh nếu có dư
      return baseStudentsPerRoom + (index < extraStudents ? 1 : 0);
    });

    // ✅ Phân bổ học sinh đều vào các FixedExamRoom
    const updates = [];
    const fixedRoomUpdates = [];
    let studentIndex = 0;

    // Duyệt qua từng phòng
    for (let roomIndex = 0; roomIndex < totalRooms; roomIndex++) {
      const currentRoom = rooms[roomIndex];
      const fixedRoom = fixedRooms.find(fr => String(fr._id) === String(currentRoom.fixedExamRoom));
      if (!fixedRoom) continue;

      const targetCount = studentsPerRoom[roomIndex];
      const roomStudentIds = [];
      
      // Phân bổ đúng số học sinh cho phòng này
      for (let i = 0; i < targetCount && studentIndex < totalStudents; i++) {
        const es = students[studentIndex];

        // ✅ Cập nhật ExamStudent.room = FixedExamRoom._id
      updates.push({
          updateOne: { filter: { _id: es._id }, update: { room: fixedRoom._id } },
        });

        roomStudentIds.push(es._id);
        studentIndex++;
      }
      
      // ✅ Cập nhật FixedExamRoom.students và capacity
      if (roomStudentIds.length > 0) {
        fixedRoomUpdates.push({
          updateOne: {
            filter: { _id: fixedRoom._id },
            update: {
              $set: {
                students: roomStudentIds,
                capacity: roomStudentIds.length
              }
            },
          },
        });
      }

      // ✅ Cập nhật trạng thái đầy của ExamRoom
      currentRoom.isFull = roomStudentIds.length >= (currentRoom.capacity || 24);
    }

    if (updates.length) {
      await ExamStudent.bulkWrite(updates);
    }
    if (fixedRoomUpdates.length) {
      await FixedExamRoom.bulkWrite(fixedRoomUpdates);
    }
    // ✅ Cập nhật isFull cho ExamRoom
    await Promise.all(rooms.map((r) => r.save()));

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
      .populate("invigilators.teacher", "name teacherCode")
      .populate("fixedExamRoom");

    if (!room) return res.status(404).json({ error: "Không tìm thấy phòng thi." });

    // ✅ Lấy danh sách học sinh từ FixedExamRoom
    let students = [];
    if (room.fixedExamRoom && room.fixedExamRoom.students) {
      students = await ExamStudent.find({ _id: { $in: room.fixedExamRoom.students } })
        .populate("student", "name studentCode gender")
        .populate("class", "className")
        .sort({ "student.name": 1 });
    }

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
        <p><b>Số thí sinh:</b> ${students.length || 0}</p>
        <table>
          <thead><tr><th>STT</th><th>SBD</th><th>Họ tên</th><th>Lớp</th><th>Giới tính</th></tr></thead>
          <tbody>
            ${students.length ? students.map((s, i) => `
              <tr>
                <td>${i+1}</td>
                <td>${s.sbd || s.student?.studentCode || "-"}</td>
                <td>${s.student?.name || "-"}</td>
                <td>${s.class?.className || "-"}</td>
                <td>${s.student?.gender || "-"}</td>
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
   - Hiển thị: Tên lịch thi, số phòng, số học sinh tham gia/tổng sức chứa
========================================================= */
exports.getRoomStats = async (req, res) => {
  try {
    const { examId } = req.params;
    
    // ✅ Lấy thống kê theo schedule
    const stats = await ExamRoom.aggregate([
      { $match: { exam: new mongoose.Types.ObjectId(examId) } },
      {
        $group: {
          _id: "$schedule",
          totalRooms: { $sum: 1 },
          totalSeats: { $sum: "$capacity" },
          fullRooms: { $sum: { $cond: ["$isFull", 1, 0] } },
          roomCodes: { $push: "$roomCode" }, // ✅ Lấy danh sách roomCodes để đếm học sinh
        },
      },
    ]);

    // ✅ Populate schedule và đếm số học sinh tham gia
    const ExamSchedule = require("../../models/exam/examSchedule");
    const RoomAssignment = require("../../models/exam/roomAssignment");
    const ExamStudent = require("../../models/exam/examIndex").ExamStudent;
    const Subject = require("../../models/subject/subject");

    const statsWithDetails = await Promise.all(
      stats.map(async (stat) => {
        let scheduleInfo = null;
        let studentCount = 0;

        if (stat._id) {
          // ✅ Lấy thông tin lịch thi
          scheduleInfo = await ExamSchedule.findById(stat._id)
            .populate("subject", "name")
            .lean();

          if (scheduleInfo) {
            // ✅ Đếm số học sinh tham gia trong lịch thi này (qua RoomAssignment hoặc ExamStudent)
            // Cách 1: Đếm qua RoomAssignment (chính xác hơn vì RoomAssignment gắn với schedule cụ thể)
            const assignmentCount = await RoomAssignment.countDocuments({
              schedule: stat._id,
            });

            // Cách 2: Đếm qua ExamStudent có fixedRoomCode trong danh sách roomCodes (backup)
            const roomCodes = stat.roomCodes || []; // ✅ Lấy roomCodes thay vì roomIds
            const studentCountByRoom = await ExamStudent.countDocuments({
              exam: new mongoose.Types.ObjectId(examId),
              fixedRoomCode: { $in: roomCodes }, // ✅ Tìm theo fixedRoomCode
              status: "active",
            });

            // ✅ Ưu tiên dùng RoomAssignment, nếu không có thì dùng ExamStudent
            studentCount = assignmentCount > 0 ? assignmentCount : studentCountByRoom;
          }
        }

        // ✅ Format tên lịch thi
        let scheduleName = "Chưa gắn lịch thi";
        if (scheduleInfo) {
          const subjectName = scheduleInfo.subject?.name || scheduleInfo.subject || "Chưa có môn";
          const dateStr = scheduleInfo.date 
            ? new Date(scheduleInfo.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
            : "";
          const timeStr = scheduleInfo.startTime || "";
          const gradeStr = scheduleInfo.grade ? ` - Khối ${scheduleInfo.grade}` : "";
          scheduleName = `${subjectName}${dateStr ? ` - ${dateStr}` : ""}${timeStr ? ` ${timeStr}` : ""}${gradeStr}`;
        }

        return {
          scheduleId: stat._id,
          scheduleName: scheduleName,
          scheduleDetails: scheduleInfo,
          totalRooms: stat.totalRooms,
          totalSeats: stat.totalSeats,
          studentCount: studentCount,
          fullRooms: stat.fullRooms,
        };
      })
    );

    res.json({ success: true, data: statsWithDetails });
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
    
    // ✅ Kiểm tra schedule tồn tại và có exam
    const schedule = await ExamSchedule.findById(scheduleId).populate("exam", "year");
    if (!schedule) {
      return res.status(404).json({ error: "Không tìm thấy lịch thi." });
    }
    if (!schedule.exam || !schedule.exam.year) {
      return res.status(400).json({ error: "Lịch thi chưa gắn với kỳ thi hoặc kỳ thi chưa có năm học." });
    }
    
    const rooms = await ExamRoom.find({ schedule: scheduleId })
      .populate("exam", "name year semester") // ✅ Populate exam để có year
      .populate("invigilators.teacher", "name teacherCode")
      .sort({ roomCode: 1 });
    res.json({ success: true, data: rooms, examYear: schedule.exam.year });
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
    
    // ✅ Kiểm tra exam tồn tại và có year
    const exam = await Exam.findById(examId).select("year");
    if (!exam) {
      return res.status(404).json({ error: "Không tìm thấy kỳ thi." });
    }
    
    const rooms = await ExamRoom.find({ exam: examId })
      .populate("exam", "name year semester") // ✅ Populate exam để có year
      .populate({
        path: "schedule",
        select: "subject date startTime endTime grade",
        populate: {
          path: "subject",
          select: "name code"
        }
      })
      .populate("invigilators.teacher", "name teacherCode")
      .populate("fixedExamRoom", "code grade capacity students") // ✅ Populate FixedExamRoom để hiển thị phòng nhóm
      .populate("room", "roomCode type status") // ✅ Populate Room (phòng vật lý) để hiển thị thông tin phòng thật
      .sort({ "schedule.date": 1, roomCode: 1 });

    if (!rooms.length) return res.status(404).json({ error: "Không có phòng nào cho kỳ thi này." });
    res.json({ success: true, data: rooms, examYear: exam.year });
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

    // ✅ Lấy lịch thi và phòng thi
    const schedule = await ExamSchedule.findById(scheduleId)
      .populate("exam", "startDate endDate")
      .lean();
    if (!schedule) return res.status(404).json({ error: "Không tìm thấy lịch thi." });

    const rooms = await ExamRoom.find({ exam: examId, schedule: scheduleId })
      .populate("fixedExamRoom", "code")
      .lean();
    if (!rooms.length) return res.status(404).json({ error: "Chưa có phòng thi nào cho lịch này." });

    // ✅ Lấy danh sách giáo viên
    const teachers = await Teacher.find({ status: "active" }).lean();
    if (!teachers.length) return res.status(404).json({ error: "Không có giáo viên khả dụng." });

    // ✅ Lấy tất cả lịch thi trong kỳ thi để kiểm tra lịch sử gán giám thị
    const allSchedules = await ExamSchedule.find({ exam: examId })
      .sort({ date: 1, startTime: 1 })
      .lean();
    
    // ✅ Lấy tất cả ExamRoom trong kỳ thi để kiểm tra lịch sử gán giám thị
    const allExamRooms = await ExamRoom.find({ exam: examId })
      .populate({
        path: "schedule",
        select: "date startTime endTime grade subject",
        populate: {
          path: "subject",
          select: "name code"
        }
      })
      .populate("fixedExamRoom", "code")
      .populate("invigilators.teacher", "_id")
      .lean();

    // ✅ Tạo map: fixedRoomCode -> danh sách cặp giám thị đã gán (theo schedule)
    // Mỗi fixedRoomCode trong 1 schedule chỉ được gán 1 cặp giám thị duy nhất
    const fixedRoomInvigilatorPairs = new Map(); // fixedRoomCode -> Map(scheduleId -> Set([teacherId1, teacherId2]))
    
    // ✅ Tạo map: scheduleId -> danh sách giám thị đã gán trong schedule đó (để track số lượng phòng mỗi giám thị gác)
    const scheduleInvigilatorCount = new Map(); // scheduleId -> Map(teacherId -> count)
    
    // ✅ Duyệt qua tất cả ExamRoom để xây dựng lịch sử
    for (const examRoom of allExamRooms) {
      const fixedRoomCode = examRoom.fixedExamRoom?.code;
      const scheduleIdForRoom = examRoom.schedule?._id || examRoom.schedule;
      
      if (!scheduleIdForRoom) continue;
      
      // ✅ Lưu số lượng phòng mỗi giám thị gác trong schedule
      if (!scheduleInvigilatorCount.has(scheduleIdForRoom)) {
        scheduleInvigilatorCount.set(scheduleIdForRoom, new Map());
      }
      
      if (examRoom.invigilators && Array.isArray(examRoom.invigilators) && examRoom.invigilators.length >= 2) {
        const teacherIds = examRoom.invigilators
          .map((inv) => {
            const teacherId = inv.teacher?._id || inv.teacher;
            return teacherId ? String(teacherId) : null;
          })
          .filter(Boolean)
          .sort(); // ✅ Sắp xếp để so sánh cặp giám thị
        
        // ✅ Lưu cặp giám thị theo fixedRoomCode và schedule
        if (fixedRoomCode && teacherIds.length === 2) {
          if (!fixedRoomInvigilatorPairs.has(fixedRoomCode)) {
            fixedRoomInvigilatorPairs.set(fixedRoomCode, new Map());
          }
          const fixedRoomMap = fixedRoomInvigilatorPairs.get(fixedRoomCode);
          if (!fixedRoomMap.has(scheduleIdForRoom)) {
            fixedRoomMap.set(scheduleIdForRoom, new Set());
          }
          // ✅ Lưu cặp giám thị dưới dạng string để so sánh
          const pairKey = teacherIds.join(",");
          fixedRoomMap.get(scheduleIdForRoom).add(pairKey);
        }
        
        // ✅ Đếm số phòng mỗi giám thị gác
        teacherIds.forEach((teacherId) => {
          const countMap = scheduleInvigilatorCount.get(scheduleIdForRoom);
          countMap.set(teacherId, (countMap.get(teacherId) || 0) + 1);
        });
      }
    }

    // ✅ Lấy danh sách giám thị đã gán trong schedule hiện tại
    const currentScheduleInvigilatorCount = scheduleInvigilatorCount.get(scheduleId) || new Map();

    // ✅ Logic gán giám thị: mỗi ExamRoom có 2 giám thị, không để cùng 1 cặp gác cùng fixedRoomCode
    const assignedRooms = [];
    const usedTeachersInCurrentSchedule = new Map(); // ✅ Track số phòng mỗi giám thị đã gác trong schedule này
    
    for (const room of rooms) {
      const fixedRoomCode = room.fixedExamRoom?.code;
      
      // ✅ Lấy danh sách cặp giám thị đã gán cho fixedRoomCode này trong schedule hiện tại
      const fixedRoomPairs = fixedRoomInvigilatorPairs.get(fixedRoomCode);
      const existingPairsInSchedule = fixedRoomPairs?.get(scheduleId) || new Set();
      
      // ✅ Tìm 2 giám thị chưa tạo thành cặp với fixedRoomCode này trong schedule hiện tại
      // ✅ Và chưa gác quá nhiều phòng trong schedule này
      const availableTeachers = teachers.filter((t) => {
        const teacherId = String(t._id);
        const countInSchedule = usedTeachersInCurrentSchedule.get(teacherId) || 0;
        // ✅ Không được gác quá 2 phòng trong cùng 1 schedule (để đảm bảo công bằng)
        return countInSchedule < 2;
      });
      
      // ✅ Tìm cặp giám thị chưa được dùng cho fixedRoomCode này
      // ✅ Tạo tất cả các cặp có thể từ availableTeachers
      const allPossiblePairs = [];
      for (let i = 0; i < availableTeachers.length - 1; i++) {
        for (let j = i + 1; j < availableTeachers.length; j++) {
          const teacherId1 = String(availableTeachers[i]._id);
          const teacherId2 = String(availableTeachers[j]._id);
          const pairKey = [teacherId1, teacherId2].sort().join(",");
          
          // ✅ Chỉ thêm cặp chưa được dùng cho fixedRoomCode này trong schedule hiện tại
          if (!existingPairsInSchedule.has(pairKey)) {
            allPossiblePairs.push([teacherId1, teacherId2]);
          }
        }
      }
      
      // ✅ Random chọn 1 cặp từ danh sách các cặp hợp lệ
      let selectedPair = null;
      if (allPossiblePairs.length > 0) {
        const randomIndex = Math.floor(Math.random() * allPossiblePairs.length);
        selectedPair = allPossiblePairs[randomIndex];
      } else if (availableTeachers.length >= 2) {
        // ✅ Nếu không có cặp nào hợp lệ, random từ availableTeachers (trường hợp thiếu giáo viên)
        const shuffled = [...availableTeachers].sort(() => Math.random() - 0.5);
        selectedPair = [
          String(shuffled[0]._id),
          String(shuffled[1]._id),
        ];
      }

      // ✅ Nếu không đủ giáo viên, bỏ qua phòng này
      if (!selectedPair) {
        console.warn(`⚠️ Không đủ giáo viên cho phòng ${room.roomCode} (fixedRoomCode: ${fixedRoomCode || "N/A"})`);
        continue;
      }
      
      // ✅ Gán 2 giám thị cho ExamRoom này
      await ExamRoom.findByIdAndUpdate(room._id, {
        $set: {
          invigilators: [
            { teacher: selectedPair[0], role: "main" },
            { teacher: selectedPair[1], role: "assistant" },
          ],
        },
      });
      
      // ✅ Cập nhật tracking
      selectedPair.forEach((teacherId) => {
        usedTeachersInCurrentSchedule.set(
          teacherId,
          (usedTeachersInCurrentSchedule.get(teacherId) || 0) + 1
        );
      });
      
      // ✅ Lưu cặp giám thị vào lịch sử
      if (fixedRoomCode) {
        if (!fixedRoomInvigilatorPairs.has(fixedRoomCode)) {
          fixedRoomInvigilatorPairs.set(fixedRoomCode, new Map());
        }
        const fixedRoomMap = fixedRoomInvigilatorPairs.get(fixedRoomCode);
        if (!fixedRoomMap.has(scheduleId)) {
          fixedRoomMap.set(scheduleId, new Set());
        }
        const pairKey = selectedPair.sort().join(",");
        fixedRoomMap.get(scheduleId).add(pairKey);
      }
      
      assignedRooms.push(room.roomCode);
    }

    res.json({
      success: true,
      message: `Đã tự động gán giám thị cho ${assignedRooms.length}/${rooms.length} phòng thi. Đảm bảo không trùng và đổi liên tục xuyên suốt kỳ thi.`,
      data: assignedRooms,
      total: rooms.length,
      assigned: assignedRooms.length,
    });
  } catch (err) {
    console.error("❌ Lỗi autoAssignInvigilators:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   👩‍🏫 TỰ ĐỘNG GÁN GIÁM THỊ CHO TOÀN BỘ KỲ THI
   - Gán giám thị cho tất cả ExamRoom trong exam
   - Đảm bảo không trùng và đổi liên tục xuyên suốt kỳ thi
========================================================= */
exports.autoAssignInvigilatorsForExam = async (req, res) => {
  try {
    const { examId } = req.body;
    if (!examId)
      return res.status(400).json({ error: "Thiếu examId." });

    // ✅ Lấy tất cả ExamRoom trong kỳ thi, sắp xếp theo schedule (date, startTime)
    const allRooms = await ExamRoom.find({ exam: examId })
      .populate({
        path: "schedule",
        select: "date startTime endTime grade subject",
        populate: {
          path: "subject",
          select: "name code"
        }
      })
      .populate("fixedExamRoom", "code")
      .populate("invigilators.teacher", "_id")
      .sort({ "schedule.date": 1, "schedule.startTime": 1, roomCode: 1 })
      .lean();
    
    if (!allRooms.length) {
      return res.status(404).json({ error: "Chưa có phòng thi nào trong kỳ thi này." });
    }

    // ✅ Lấy danh sách giáo viên
    const teachers = await Teacher.find({ status: "active" }).lean();
    if (!teachers.length) return res.status(404).json({ error: "Không có giáo viên khả dụng." });

    // ✅ Tạo map: fixedRoomCode -> danh sách cặp giám thị đã gán (theo schedule)
    const fixedRoomInvigilatorPairs = new Map(); // fixedRoomCode -> Map(scheduleId -> Set([teacherId1, teacherId2]))
    
    // ✅ Tạo map: scheduleId -> số lượng phòng mỗi giám thị đã gác
    const scheduleInvigilatorCount = new Map(); // scheduleId -> Map(teacherId -> count)
    
    // ✅ Duyệt qua tất cả ExamRoom để xây dựng lịch sử (nếu đã có giám thị)
    for (const examRoom of allRooms) {
      const fixedRoomCode = examRoom.fixedExamRoom?.code;
      const scheduleIdForRoom = examRoom.schedule?._id || examRoom.schedule;
      
      if (!scheduleIdForRoom) continue;
      
      // ✅ Lưu số lượng phòng mỗi giám thị gác trong schedule
      if (!scheduleInvigilatorCount.has(scheduleIdForRoom)) {
        scheduleInvigilatorCount.set(scheduleIdForRoom, new Map());
      }
      
      if (examRoom.invigilators && Array.isArray(examRoom.invigilators) && examRoom.invigilators.length >= 2) {
        const teacherIds = examRoom.invigilators
          .map((inv) => {
            const teacherId = inv.teacher?._id || inv.teacher;
            return teacherId ? String(teacherId) : null;
          })
          .filter(Boolean)
          .sort();
        
        // ✅ Lưu cặp giám thị theo fixedRoomCode và schedule
        if (fixedRoomCode && teacherIds.length === 2) {
          if (!fixedRoomInvigilatorPairs.has(fixedRoomCode)) {
            fixedRoomInvigilatorPairs.set(fixedRoomCode, new Map());
          }
          const fixedRoomMap = fixedRoomInvigilatorPairs.get(fixedRoomCode);
          if (!fixedRoomMap.has(scheduleIdForRoom)) {
            fixedRoomMap.set(scheduleIdForRoom, new Set());
          }
          const pairKey = teacherIds.join(",");
          fixedRoomMap.get(scheduleIdForRoom).add(pairKey);
        }
        
        // ✅ Đếm số phòng mỗi giám thị gác
        teacherIds.forEach((teacherId) => {
          const countMap = scheduleInvigilatorCount.get(scheduleIdForRoom);
          countMap.set(teacherId, (countMap.get(teacherId) || 0) + 1);
        });
      }
    }

    // ✅ Nhóm ExamRoom theo schedule để xử lý từng schedule
    const roomsBySchedule = new Map();
    for (const room of allRooms) {
      const scheduleId = room.schedule?._id || room.schedule;
      if (!scheduleId) continue;
      if (!roomsBySchedule.has(scheduleId)) {
        roomsBySchedule.set(scheduleId, []);
      }
      roomsBySchedule.get(scheduleId).push(room);
    }

    // ✅ Gán giám thị cho từng schedule
    const assignedRooms = [];
    const totalRooms = allRooms.length;
    
    for (const [scheduleId, rooms] of roomsBySchedule) {
      const usedTeachersInSchedule = new Map(); // Track số phòng mỗi giám thị đã gác trong schedule này
      
      for (const room of rooms) {
        // ✅ Bỏ qua nếu đã có giám thị (giữ nguyên)
        if (room.invigilators && Array.isArray(room.invigilators) && room.invigilators.length >= 2) {
          const existingTeacherIds = room.invigilators
            .map((inv) => inv.teacher?._id || inv.teacher)
            .filter(Boolean)
            .map(String);
          
          if (existingTeacherIds.length === 2) {
            // ✅ Cập nhật tracking nhưng không gán lại
            existingTeacherIds.forEach((teacherId) => {
              usedTeachersInSchedule.set(
                teacherId,
                (usedTeachersInSchedule.get(teacherId) || 0) + 1
              );
            });
            continue;
          }
        }
        
        const fixedRoomCode = room.fixedExamRoom?.code;
        
        // ✅ Lấy danh sách cặp giám thị đã gán cho fixedRoomCode này trong schedule hiện tại
        const fixedRoomPairs = fixedRoomInvigilatorPairs.get(fixedRoomCode);
        const existingPairsInSchedule = fixedRoomPairs?.get(scheduleId) || new Set();
        
        // ✅ Tìm 2 giám thị chưa tạo thành cặp với fixedRoomCode này trong schedule hiện tại
        const availableTeachers = teachers.filter((t) => {
          const teacherId = String(t._id);
          const countInSchedule = usedTeachersInSchedule.get(teacherId) || 0;
          // ✅ Không được gác quá 2 phòng trong cùng 1 schedule
          return countInSchedule < 2;
        });
        
        // ✅ Tìm cặp giám thị chưa được dùng cho fixedRoomCode này
        // ✅ Tạo tất cả các cặp có thể từ availableTeachers
        const allPossiblePairs = [];
        for (let i = 0; i < availableTeachers.length - 1; i++) {
          for (let j = i + 1; j < availableTeachers.length; j++) {
            const teacherId1 = String(availableTeachers[i]._id);
            const teacherId2 = String(availableTeachers[j]._id);
            const pairKey = [teacherId1, teacherId2].sort().join(",");
            
            // ✅ Chỉ thêm cặp chưa được dùng cho fixedRoomCode này trong schedule hiện tại
            if (!existingPairsInSchedule.has(pairKey)) {
              allPossiblePairs.push([teacherId1, teacherId2]);
            }
          }
        }
        
        // ✅ Random chọn 1 cặp từ danh sách các cặp hợp lệ
        let selectedPair = null;
        if (allPossiblePairs.length > 0) {
          const randomIndex = Math.floor(Math.random() * allPossiblePairs.length);
          selectedPair = allPossiblePairs[randomIndex];
        } else if (availableTeachers.length >= 2) {
          // ✅ Nếu không có cặp nào hợp lệ, random từ availableTeachers (trường hợp thiếu giáo viên)
          const shuffled = [...availableTeachers].sort(() => Math.random() - 0.5);
          selectedPair = [
            String(shuffled[0]._id),
            String(shuffled[1]._id),
          ];
        }
        
        // ✅ Nếu không đủ giáo viên, bỏ qua phòng này
        if (!selectedPair) {
          console.warn(`⚠️ Không đủ giáo viên cho phòng ${room.roomCode} (fixedRoomCode: ${fixedRoomCode || "N/A"})`);
          continue;
        }
        
        // ✅ Gán 2 giám thị cho ExamRoom này
        await ExamRoom.findByIdAndUpdate(room._id, {
          $set: {
            invigilators: [
              { teacher: selectedPair[0], role: "main" },
              { teacher: selectedPair[1], role: "assistant" },
            ],
          },
        });
        
        // ✅ Cập nhật tracking
        selectedPair.forEach((teacherId) => {
          usedTeachersInSchedule.set(
            teacherId,
            (usedTeachersInSchedule.get(teacherId) || 0) + 1
          );
        });
        
        // ✅ Lưu cặp giám thị vào lịch sử
        if (fixedRoomCode) {
          if (!fixedRoomInvigilatorPairs.has(fixedRoomCode)) {
            fixedRoomInvigilatorPairs.set(fixedRoomCode, new Map());
          }
          const fixedRoomMap = fixedRoomInvigilatorPairs.get(fixedRoomCode);
          if (!fixedRoomMap.has(scheduleId)) {
            fixedRoomMap.set(scheduleId, new Set());
          }
          const pairKey = selectedPair.sort().join(",");
          fixedRoomMap.get(scheduleId).add(pairKey);
        }
        
        assignedRooms.push(room.roomCode);
      }
    }

    res.json({
      success: true,
      message: `Đã tự động gán giám thị cho ${assignedRooms.length}/${totalRooms} phòng thi trong toàn bộ kỳ thi. Đảm bảo không trùng và đổi liên tục xuyên suốt kỳ thi.`,
      data: assignedRooms,
      total: totalRooms,
      assigned: assignedRooms.length,
    });
  } catch (err) {
    console.error("❌ Lỗi autoAssignInvigilatorsForExam:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🗑️ XÓA TOÀN BỘ GIÁM THỊ ĐÃ GÁN TRONG KỲ THI
   - Xóa tất cả invigilators của tất cả ExamRoom trong exam
========================================================= */
exports.removeAllInvigilatorsFromExam = async (req, res) => {
  try {
    const { examId } = req.body;
    if (!examId)
      return res.status(400).json({ error: "Thiếu examId." });

    // ✅ Lấy tất cả ExamRoom trong kỳ thi
    const result = await ExamRoom.updateMany(
      { exam: examId },
      { $set: { invigilators: [] } }
    );

    res.json({
      success: true,
      message: `Đã xóa giám thị khỏi ${result.modifiedCount} phòng thi trong kỳ thi.`,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("❌ Lỗi removeAllInvigilatorsFromExam:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🎯 HÀM PHỤ: GÁN HỌC SINH VÀO PHÒNG THI ĐÃ SAO CHÉP
   - Dựa trên ExamStudent.fixedRoomCode (mã phòng cố định) và grade
   - Map fixedRoomCode → scheduleRoom (phòng thi riêng từng môn)
   - Tạo RoomAssignment cho lịch thi mới
========================================================= */
async function assignStudentsToCopiedRooms(
  examId,
  newScheduleId,
  grade,
  originalRooms,
  newRooms
) {
  try {
    const RoomAssignment = require("../../models/exam/roomAssignment");
    const ExamSchedule = require("../../models/exam/examSchedule");
    const ExamStudent = require("../../models/exam/examIndex").ExamStudent;

    // ✅ Lấy thông tin lịch thi mới
    const newSchedule = await ExamSchedule.findById(newScheduleId)
      .populate("subject", "name")
      .lean();
    if (!newSchedule) return;

    // ✅ Tạo map: fixedRoomCode -> scheduleRoom (dựa trên roomCode để đảm bảo chính xác)
    const roomMap = new Map();
    originalRooms.forEach((origRoom) => {
      const origRoomCode = origRoom.roomCode || (origRoom.toObject ? origRoom.toObject().roomCode : null);
      const matchingNewRoom = newRooms.find((nr) => {
        const nrRoomCode = nr.roomCode || (nr.toObject ? nr.toObject().roomCode : null);
        return nrRoomCode === origRoomCode;
      });
      if (matchingNewRoom) {
        roomMap.set(origRoomCode, matchingNewRoom._id || matchingNewRoom);
      }
    });

    // ✅ Lấy tất cả học sinh có fixedRoomCode trong danh sách phòng gốc và cùng grade
    const originalRoomCodes = originalRooms.map((r) => r.roomCode || (r.toObject ? r.toObject().roomCode : null)).filter(Boolean);
    const students = await ExamStudent.find({
      exam: examId,
      grade: grade,
      fixedRoomCode: { $in: originalRoomCodes }, // ✅ Tìm theo fixedRoomCode
      status: "active",
    })
      .populate("student", "name")
      .sort({ "student.name": 1 })
      .lean();

    if (students.length === 0) {
      console.log(`ℹ️ Không có học sinh nào được gán vào phòng thi cho lịch thi ${newScheduleId}`);
      return;
    }

    // ✅ Nhóm học sinh theo fixedRoomCode
    const studentsByRoom = new Map();
    students.forEach((student) => {
      const roomCode = student.fixedRoomCode;
      if (!roomCode) return;
      if (!studentsByRoom.has(roomCode)) {
        studentsByRoom.set(roomCode, []);
      }
      studentsByRoom.get(roomCode).push(student);
    });

    // ✅ Tạo RoomAssignment cho từng phòng thi mới
    const assignments = [];

    for (const [fixedRoomCode, roomStudents] of studentsByRoom) {
      const scheduleRoomId = roomMap.get(fixedRoomCode);
      if (!scheduleRoomId) continue;

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
          examRoom: scheduleRoomId, // ✅ Dùng scheduleRoom (phòng thi riêng từng môn)
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
      console.log(`✅ Đã tự động gán ${assignments.length} học sinh vào ${newRooms.length} phòng thi cho lịch thi ${newScheduleId}`);
    }
  } catch (err) {
    console.error("⚠️ Lỗi khi gán học sinh vào phòng thi đã sao chép:", err);
    // Không throw error để không làm gián đoạn việc tạo phòng thi
  }
}

/* =========================================================
   🏫 LẤY DANH SÁCH PHÒNG CỐ ĐỊNH (FixedExamRoom)
========================================================= */
exports.getFixedRooms = async (req, res) => {
  try {
    const { examId, grade } = req.query;
    const filter = {};
    if (examId) filter.exam = examId;
    if (grade) filter.grade = String(grade);

    const fixedRooms = await FixedExamRoom.find(filter)
      .populate({
        path: "students",
        select: "sbd",
        populate: { 
          path: "student", 
          select: "name studentCode" 
        }
      })
      .sort({ code: 1 });

    res.json({ 
      success: true, 
      total: fixedRooms.length, 
      data: fixedRooms.map(fr => ({
        _id: fr._id,
        exam: fr.exam,
        grade: fr.grade,
        code: fr.code,
        studentsCount: fr.students?.length || 0,
        capacity: fr.capacity || 0,
        students: fr.students || [],
      }))
    });
  } catch (err) {
    console.error("❌ Lỗi getFixedRooms:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🏫 PHÂN HỌC SINH VÀO PHÒNG CỐ ĐỊNH (FixedExamRoom)
   - Tự động phân bổ học sinh đều vào các FixedExamRoom (A-Z)
   - Tạo FixedExamRoom nếu chưa có
========================================================= */
exports.assignStudentsToFixedRooms = async (req, res) => {
  try {
    const { examId, grade, fixedRoomId, maxStudentsPerRoom = 20, maxRooms } = req.body;

    if (!examId) {
      return res.status(400).json({ error: "Thiếu examId." });
    }

    // ✅ Lấy cấu hình thời khóa biểu
    const scheduleConfig = await ScheduleConfig.findOne();
    if (!scheduleConfig) {
      console.warn("⚠️ Không tìm thấy cấu hình thời khóa biểu, sử dụng giá trị mặc định.");
    }

    // ✅ Đếm số phòng tối đa từ Room có status="available" và type="normal"
    const totalAvailableRooms = await Room.countDocuments({
      status: "available",
      type: "normal",
    });
    console.log(`📊 Tổng số phòng khả dụng (available + normal): ${totalAvailableRooms}`);

    // ✅ Nếu grade là "all", xử lý tất cả các khối
    if (grade === "all") {
      const exam = await Exam.findById(examId).select("grades");
      if (!exam || !exam.grades || exam.grades.length === 0) {
        return res.status(400).json({ error: "Kỳ thi không có khối nào." });
      }
      
      // ✅ Lấy thông tin buổi học của các khối từ cấu hình
      const gradeSessionMap = {};
      const morningGrades = [];
      
      for (const g of exam.grades) {
        const gradeStr = String(g);
        // ✅ Sử dụng gradeConfigs (cấu trúc mới - mỗi khối có rules riêng)
        const gradeConfig = scheduleConfig?.gradeConfigs?.get?.(gradeStr) || 
                           scheduleConfig?.gradeConfigs?.get?.(String(gradeStr)) ||
                           (typeof scheduleConfig?.gradeConfigs === 'object' && scheduleConfig?.gradeConfigs?.[gradeStr]) ||
                           (typeof scheduleConfig?.gradeConfigs === 'object' && scheduleConfig?.gradeConfigs?.[String(gradeStr)]);
        const gradeSession = gradeConfig?.rules?.session || "morning";
        gradeSessionMap[gradeStr] = gradeSession;
        
        // ✅ Nếu khối học buổi sáng (morning hoặc both), thêm vào danh sách
        if (gradeSession === "morning" || gradeSession === "both") {
          morningGrades.push(gradeStr);
        }
      }
      
      console.log(`📅 Các khối học buổi sáng: ${morningGrades.join(", ")}`);
      
      // ✅ Tính số phòng tối đa cho mỗi khối
      // Nếu có 2 khối học buổi sáng, chia đều số phòng
      let maxRoomsPerGrade = maxRooms;
      if (morningGrades.length > 1 && !maxRooms) {
        // Nếu không có maxRooms từ frontend, tính từ số phòng khả dụng
        maxRoomsPerGrade = Math.floor(totalAvailableRooms / morningGrades.length);
        console.log(`📊 Chia ${totalAvailableRooms} phòng cho ${morningGrades.length} khối buổi sáng => ${maxRoomsPerGrade} phòng/khối`);
      } else if (morningGrades.length > 1 && maxRooms) {
        // Nếu có maxRooms, chia đều cho các khối buổi sáng
        maxRoomsPerGrade = Math.floor(maxRooms / morningGrades.length);
        console.log(`📊 Chia ${maxRooms} phòng (từ input) cho ${morningGrades.length} khối buổi sáng => ${maxRoomsPerGrade} phòng/khối`);
      } else if (!maxRooms) {
        // Nếu chỉ có 1 khối hoặc không có khối buổi sáng, dùng tất cả phòng
        maxRoomsPerGrade = totalAvailableRooms;
      }
      
      let totalStudents = 0;
      let totalRooms = 0;
      const results = [];
      
      for (const g of exam.grades) {
        try {
          const gradeStr = String(g);
          const isMorningGrade = morningGrades.includes(gradeStr);
          const gradeMaxRooms = isMorningGrade ? maxRoomsPerGrade : (maxRooms || totalAvailableRooms);
          
          const result = await assignStudentsToFixedRoomsByGrade(
            examId, 
            gradeStr, 
            null, 
            maxStudentsPerRoom, 
            gradeMaxRooms,
            totalAvailableRooms
          );
          totalStudents += result.total;
          totalRooms += result.rooms;
          results.push({ grade: gradeStr, ...result });
        } catch (err) {
          console.error(`❌ Lỗi khi phân học sinh khối ${g}:`, err);
          results.push({ grade: String(g), error: err.message });
        }
      }
      
      return res.json({
        message: `✅ Đã tự động tạo và phân ${totalStudents} học sinh vào ${totalRooms} phòng cố định cho tất cả các khối.`,
        total: totalStudents,
        rooms: totalRooms,
        details: results,
        totalAvailableRooms,
        morningGrades,
      });
    }

    if (!grade) {
      return res.status(400).json({ error: "Thiếu grade." });
    }

    // ✅ Lấy thông tin buổi học của khối từ cấu hình (cấu trúc mới)
    const gradeStr = String(grade);
    const gradeConfig = scheduleConfig?.gradeConfigs?.get?.(gradeStr) || 
                       scheduleConfig?.gradeConfigs?.get?.(String(gradeStr)) ||
                       (typeof scheduleConfig?.gradeConfigs === 'object' && scheduleConfig?.gradeConfigs?.[gradeStr]) ||
                       (typeof scheduleConfig?.gradeConfigs === 'object' && scheduleConfig?.gradeConfigs?.[String(gradeStr)]);
    const gradeSession = gradeConfig?.rules?.session || "morning";
    const isMorningGrade = gradeSession === "morning" || gradeSession === "both";
    
    // ✅ Tính số phòng tối đa cho khối này
    let gradeMaxRooms = maxRooms;
    if (!maxRooms) {
      // Nếu không có maxRooms từ frontend, dùng tất cả phòng khả dụng
      gradeMaxRooms = totalAvailableRooms;
    }
    
    console.log(`📅 Khối ${gradeStr} học buổi: ${gradeSession}, số phòng tối đa: ${gradeMaxRooms}`);
    
    // ✅ Gọi hàm helper để xử lý một khối
    const result = await assignStudentsToFixedRoomsByGrade(
      examId, 
      gradeStr, 
      fixedRoomId, 
      maxStudentsPerRoom, 
      gradeMaxRooms,
      totalAvailableRooms
    );
    return res.json({
      ...result,
      totalAvailableRooms,
      gradeSession,
    });
  } catch (err) {
    console.error("❌ Lỗi assignStudentsToFixedRooms:", err);
    res.status(500).json({ error: "Lỗi khi phân học sinh vào phòng cố định", details: err.message });
  }
};

/* =========================================================
   🏫 HELPER: PHÂN HỌC SINH VÀO PHÒNG CỐ ĐỊNH (THEO KHỐI)
========================================================= */
async function assignStudentsToFixedRoomsByGrade(examId, grade, fixedRoomId, maxStudentsPerRoom = 20, maxRooms = null, totalAvailableRooms = null) {
    // ✅ Lấy học sinh chưa được gán phòng
    const students = await ExamStudent.find({
      exam: examId,
      grade: String(grade),
      room: null,
      status: "active",
    })
      .populate("student", "name")
      .sort({ "student.name": 1 })
      .lean();

    if (students.length === 0) {
      return {
        message: `Không có học sinh cần phân phòng cho khối ${grade}.`,
        total: 0,
        rooms: 0,
        fixedRooms: [],
      };
    }

    // ✅ Tính số phòng cần thiết: số học sinh / maxStudentsPerRoom (làm tròn lên)
    const requiredRooms = Math.ceil(students.length / maxStudentsPerRoom);
    
    // ✅ Số phòng thực tế:
    // - Nếu có maxRooms: lấy min(requiredRooms, maxRooms)
    // - Nếu không có maxRooms nhưng có totalAvailableRooms: lấy min(requiredRooms, totalAvailableRooms)
    // - Nếu không có cả hai: lấy requiredRooms
    let actualRooms = requiredRooms;
    if (maxRooms) {
      actualRooms = Math.min(requiredRooms, maxRooms);
    } else if (totalAvailableRooms) {
      actualRooms = Math.min(requiredRooms, totalAvailableRooms);
    }
    
    console.log(`📊 Khối ${grade}: ${students.length} học sinh, cần ${requiredRooms} phòng, giới hạn ${maxRooms || totalAvailableRooms || 'không'}, tạo ${actualRooms} phòng`);

    // ✅ Nếu có fixedRoomId, chỉ sử dụng phòng đó
    let fixedRooms = [];
    if (fixedRoomId) {
      const fixedRoom = await FixedExamRoom.findById(fixedRoomId);
      if (!fixedRoom) {
        throw new Error("Không tìm thấy phòng cố định.");
      }
      if (String(fixedRoom.exam) !== String(examId) || String(fixedRoom.grade) !== String(grade)) {
        throw new Error("Phòng cố định không khớp với kỳ thi và khối đã chọn.");
      }
      fixedRooms = [fixedRoom];
    } else {
      // ✅ Kiểm tra xem đã có FixedExamRoom cho khối này chưa
      fixedRooms = await FixedExamRoom.find({
        exam: examId,
        grade: String(grade),
      }).sort({ code: 1 });

      // ✅ Nếu chưa có, tạo mới (sử dụng actualRooms - số phòng thực tế cần thiết)
      if (fixedRooms.length === 0) {
        const newFixedRooms = Array.from({ length: actualRooms }, (_, i) => ({
          exam: examId,
          grade: String(grade),
          code: `${grade}-${i + 1}`, // ✅ Mã code: Grade-i
          students: [],
          capacity: 0,
        }));

        fixedRooms = await FixedExamRoom.insertMany(newFixedRooms, { ordered: false });
        console.log(`✅ Đã tạo ${fixedRooms.length} FixedExamRoom cho khối ${grade} (cần ${requiredRooms} phòng, giới hạn ${maxRooms || 'không'}, tạo ${actualRooms} phòng)`);
      } else if (fixedRooms.length < actualRooms) {
        // ✅ Nếu có ít phòng hơn actualRooms, tạo thêm
        const additionalRooms = actualRooms - fixedRooms.length;
        const newFixedRooms = Array.from({ length: additionalRooms }, (_, i) => ({
          exam: examId,
          grade: String(grade),
          code: `${grade}-${fixedRooms.length + i + 1}`,
          students: [],
          capacity: 0,
        }));
        const created = await FixedExamRoom.insertMany(newFixedRooms, { ordered: false });
        fixedRooms = [...fixedRooms, ...created];
        console.log(`✅ Đã tạo thêm ${created.length} FixedExamRoom cho khối ${grade}`);
      } else if (fixedRooms.length > actualRooms) {
        // ✅ Nếu có nhiều phòng hơn actualRooms, chỉ sử dụng actualRooms phòng đầu tiên
        const originalCount = fixedRooms.length;
        fixedRooms = fixedRooms.slice(0, actualRooms);
        console.log(`⚠️ Chỉ sử dụng ${actualRooms} phòng đầu tiên cho khối ${grade} (có ${originalCount} phòng, giới hạn ${maxRooms || 'không'})`);
      }
    }

    // ✅ Nếu có fixedRoomId, gán tất cả học sinh vào phòng đó
    // ✅ Nếu không, phân bổ đều vào các phòng
    const studentUpdates = [];
    const fixedRoomUpdates = [];

    if (fixedRoomId && fixedRooms.length === 1) {
      // ✅ Gán tất cả học sinh vào phòng cố định đã chọn
      const fixedRoom = fixedRooms[0];
      const currentStudentIds = fixedRoom.students || [];
      const newStudentIds = students.map(s => s._id);
      const allStudentIds = [...new Set([...currentStudentIds, ...newStudentIds])];

      // ✅ Cập nhật ExamStudent.room = FixedExamRoom._id
      students.forEach(student => {
        studentUpdates.push({
          updateOne: {
            filter: { _id: student._id },
            update: { room: fixedRoom._id },
          },
        });
      });

      // ✅ Cập nhật FixedExamRoom.students và capacity
      fixedRoomUpdates.push({
        updateOne: {
          filter: { _id: fixedRoom._id },
          update: {
            $set: {
              students: allStudentIds,
              capacity: allStudentIds.length
            }
          },
        },
      });
    } else {
      // ✅ Tính số học sinh cho mỗi phòng (phân bổ đều)
      const totalStudents = students.length;
      const totalRooms = fixedRooms.length;

      const baseStudentsPerRoom = Math.floor(totalStudents / totalRooms);
      const extraStudents = totalStudents % totalRooms;

      const studentsPerRoom = fixedRooms.map((_, index) => {
        return baseStudentsPerRoom + (index < extraStudents ? 1 : 0);
      });

      // ✅ Phân bổ học sinh đều vào các FixedExamRoom (A-Z)
      let studentIndex = 0;

      for (let roomIndex = 0; roomIndex < totalRooms; roomIndex++) {
        const fixedRoom = fixedRooms[roomIndex];
        const targetCount = studentsPerRoom[roomIndex];
        const roomStudentIds = fixedRoom.students || [];

        for (let i = 0; i < targetCount && studentIndex < totalStudents; i++) {
          const student = students[studentIndex];

          // ✅ Cập nhật ExamStudent.room = FixedExamRoom._id
          studentUpdates.push({
            updateOne: {
              filter: { _id: student._id },
              update: { room: fixedRoom._id },
            },
          });

          roomStudentIds.push(student._id);
          studentIndex++;
        }

        // ✅ Cập nhật FixedExamRoom.students và capacity
        fixedRoomUpdates.push({
          updateOne: {
            filter: { _id: fixedRoom._id },
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
    if (studentUpdates.length > 0) {
      await ExamStudent.bulkWrite(studentUpdates);
    }
    if (fixedRoomUpdates.length > 0) {
      await FixedExamRoom.bulkWrite(fixedRoomUpdates);
    }

    return {
      message: fixedRoomId 
        ? `✅ Đã phân ${studentUpdates.length} học sinh vào phòng cố định ${fixedRooms[0]?.code || ""}.`
        : `✅ Đã tự động tạo và phân ${studentUpdates.length} học sinh vào ${fixedRooms.length} phòng cố định.`,
      total: studentUpdates.length,
      rooms: fixedRooms.length,
      fixedRooms: fixedRooms.map(r => ({ _id: r._id, code: r.code, studentsCount: r.students?.length || 0 })),
    };
}

/* =========================================================
   🏫 PHÂN PHÒNG CỐ ĐỊNH VÀO PHÒNG THI (ExamRoom)
   - Tạo ExamRoom từ FixedExamRoom
   - Gán với schedule và room thực tế (roomCode)
========================================================= */
exports.assignFixedRoomsToExamRooms = async (req, res) => {
  try {
    const { examId, scheduleId, roomMappings } = req.body;

    console.log("🔍 [assignFixedRoomsToExamRooms] Input:", { examId, scheduleId, roomMappingsCount: roomMappings?.length });

    if (!examId || !scheduleId || !Array.isArray(roomMappings)) {
      return res.status(400).json({ error: "Thiếu examId, scheduleId hoặc roomMappings." });
    }

    // ✅ Kiểm tra schedule
    const schedule = await ExamSchedule.findById(scheduleId)
      .populate("exam", "_id")
      .populate("subject", "_id name");
    if (!schedule) {
      console.error("❌ [assignFixedRoomsToExamRooms] Không tìm thấy schedule:", scheduleId);
      return res.status(404).json({ error: "Không tìm thấy lịch thi." });
    }

    console.log("✅ [assignFixedRoomsToExamRooms] Schedule found:", {
      scheduleId: schedule._id,
      exam: schedule.exam,
      subject: schedule.subject,
      grade: schedule.grade,
    });

    // ✅ Kiểm tra exam (có thể là ObjectId hoặc object đã populate)
    const scheduleExamId = schedule.exam?._id || schedule.exam;
    if (String(scheduleExamId) !== String(examId)) {
      console.error("❌ [assignFixedRoomsToExamRooms] Exam không khớp:", {
        scheduleExamId: String(scheduleExamId),
        examId: String(examId),
      });
      return res.status(400).json({ error: "Lịch thi không thuộc kỳ thi này." });
    }

    // ✅ Lấy FixedExamRoom theo exam và grade
    const grade = schedule.grade;
    const fixedRooms = await FixedExamRoom.find({
      exam: examId,
      grade: String(grade),
    }).sort({ code: 1 });

    console.log("✅ [assignFixedRoomsToExamRooms] FixedRooms found:", fixedRooms.length);

    if (fixedRooms.length === 0) {
      return res.status(400).json({ error: "Chưa có phòng cố định cho khối này." });
    }

    // ✅ Lấy thông tin Room thực tế
    const examData = await Exam.findById(examId).select("config");
    const defaultCapacity = examData?.config?.maxStudentsPerRoom || 24;

    const examRooms = [];
    const errors = [];

    for (const mapping of roomMappings) {
      const { fixedRoomId, roomId } = mapping;

      console.log("🔍 [assignFixedRoomsToExamRooms] Processing mapping:", { fixedRoomId, roomId });

      // ✅ Tìm FixedExamRoom
      const fixedRoom = fixedRooms.find(fr => String(fr._id) === String(fixedRoomId));
      if (!fixedRoom) {
        console.error("❌ [assignFixedRoomsToExamRooms] FixedRoom not found:", fixedRoomId);
        errors.push(`Không tìm thấy FixedExamRoom với ID: ${fixedRoomId}`);
        continue;
      }

      // ✅ Tìm Room thực tế
      const room = await Room.findById(roomId);
      if (!room) {
        console.error("❌ [assignFixedRoomsToExamRooms] Room not found:", roomId);
        errors.push(`Không tìm thấy Room với ID: ${roomId}`);
        continue;
      }

      console.log("✅ [assignFixedRoomsToExamRooms] Room found:", {
        roomId: room._id,
        roomCode: room.roomCode,
        type: room.type,
        status: room.status,
      });

      if (room.status !== "available") {
        errors.push(`Phòng ${room.roomCode} không khả dụng.`);
        continue;
      }

      // ✅ Kiểm tra xem đã có ExamRoom cho schedule và fixedExamRoom này chưa
      const existingExamRoom = await ExamRoom.findOne({
        exam: examId,
        schedule: scheduleId,
        fixedExamRoom: fixedRoomId,
      });

      // ✅ Kiểm tra xem roomCode đã được sử dụng trong schedule này chưa (unique constraint)
      const existingRoomCode = await ExamRoom.findOne({
        exam: examId,
        schedule: scheduleId,
        roomCode: room.roomCode,
        _id: { $ne: existingExamRoom?._id }, // Loại trừ ExamRoom hiện tại nếu có
      });

      if (existingRoomCode && String(existingRoomCode.fixedExamRoom) !== String(fixedRoomId)) {
        console.error("❌ [assignFixedRoomsToExamRooms] RoomCode đã được sử dụng:", room.roomCode);
        errors.push(`Phòng ${room.roomCode} đã được gán cho phòng cố định khác trong lịch thi này.`);
        continue;
      }

      if (existingExamRoom) {
        console.log("✅ [assignFixedRoomsToExamRooms] Updating existing ExamRoom:", existingExamRoom._id);
        // ✅ Cập nhật roomCode và room nếu khác
        if (String(existingExamRoom.room) !== String(roomId) || existingExamRoom.roomCode !== room.roomCode) {
          existingExamRoom.room = roomId;
          existingExamRoom.roomCode = room.roomCode;
          existingExamRoom.type = room.type || "normal";
          try {
            await existingExamRoom.save();
            console.log("✅ [assignFixedRoomsToExamRooms] ExamRoom updated successfully");
          } catch (saveErr) {
            console.error("❌ [assignFixedRoomsToExamRooms] Error saving ExamRoom:", saveErr);
            errors.push(`Lỗi khi cập nhật ExamRoom: ${saveErr.message}`);
            continue;
          }
        }
        examRooms.push(existingExamRoom);
      } else {
        console.log("✅ [assignFixedRoomsToExamRooms] Creating new ExamRoom");
        // ✅ Tạo ExamRoom mới
        try {
          const newExamRoom = await ExamRoom.create({
            exam: examId,
            schedule: scheduleId,
            fixedExamRoom: fixedRoomId,
            room: roomId,
            roomCode: room.roomCode,
            type: room.type || "normal",
            capacity: defaultCapacity,
            grade: String(grade),
          });
          console.log("✅ [assignFixedRoomsToExamRooms] ExamRoom created:", newExamRoom._id);
          examRooms.push(newExamRoom);
        } catch (createErr) {
          console.error("❌ [assignFixedRoomsToExamRooms] Error creating ExamRoom:", createErr);
          if (createErr.code === 11000) {
            errors.push(`Phòng ${room.roomCode} đã được sử dụng trong lịch thi này.`);
          } else {
            errors.push(`Lỗi khi tạo ExamRoom: ${createErr.message}`);
          }
        }
      }
    }

    // ✅ Tự động tạo RoomAssignment cho học sinh trong FixedExamRoom
    let assignmentsCreated = 0;
    const assignmentErrors = [];

    // ✅ Lấy subjectId một lần
    const subjectId = schedule.subject?._id || schedule.subject;
    if (!subjectId) {
      console.warn("⚠️ [assignFixedRoomsToExamRooms] Schedule không có subject:", scheduleId);
    }

    console.log(`✅ [assignFixedRoomsToExamRooms] Processing ${examRooms.length} ExamRooms for RoomAssignment creation`);

    for (const examRoom of examRooms) {
      try {
        const fixedRoom = await FixedExamRoom.findById(examRoom.fixedExamRoom);
        
        if (!fixedRoom) {
          console.error("❌ [assignFixedRoomsToExamRooms] FixedRoom not found for ExamRoom:", examRoom.fixedExamRoom);
          continue;
        }

        if (fixedRoom.students && fixedRoom.students.length > 0) {
          console.log(`✅ [assignFixedRoomsToExamRooms] Processing ${fixedRoom.students.length} students for ExamRoom:`, examRoom._id);
          
          // ✅ Lấy danh sách ExamStudent từ FixedExamRoom (students là array của ExamStudent IDs)
          const examStudents = await ExamStudent.find({
            _id: { $in: fixedRoom.students },
          })
            .populate("student", "name")
            .sort({ "student.name": 1 });

          console.log(`✅ [assignFixedRoomsToExamRooms] Found ${examStudents.length} ExamStudents`);

          // ✅ Xóa RoomAssignment cũ cho tất cả học sinh trong FixedExamRoom cho schedule này
          // (Xóa theo schedule và examStudent để đảm bảo không có duplicate)
          const studentIds = examStudents.map(s => s._id);
          const deletedCount = await RoomAssignment.deleteMany({
            schedule: scheduleId,
            examStudent: { $in: studentIds },
          });
          console.log(`✅ [assignFixedRoomsToExamRooms] Deleted ${deletedCount.deletedCount} old RoomAssignments for schedule ${scheduleId}`);
          
          // ✅ Đợi một chút để đảm bảo delete đã hoàn tất trước khi tạo mới (tránh race condition)
          await new Promise(resolve => setTimeout(resolve, 100));

          // ✅ Tạo RoomAssignment mới cho từng học sinh
          for (let index = 0; index < examStudents.length; index++) {
            const student = examStudents[index];
            const seatNumber = index + 1;
            
            // ✅ Validate dữ liệu trước khi tạo
            if (!scheduleId || !student._id || !examRoom._id) {
              console.error(`❌ [assignFixedRoomsToExamRooms] Missing required fields:`, {
                scheduleId,
                studentId: student._id,
                examRoomId: examRoom._id,
              });
              errors.push(`Lỗi khi tạo RoomAssignment cho học sinh ${student.sbd}: Thiếu thông tin bắt buộc`);
              continue;
            }
            
            try {
              // ✅ Tạo RoomAssignment mới (đã xóa cũ rồi nên không cần upsert)
              const assignment = await RoomAssignment.create({
                exam: examId,
                schedule: scheduleId,
                subject: subjectId,
                examRoom: examRoom._id,
                examStudent: student._id,
                seatNumber: seatNumber,
                sbd: student.sbd || "",
                status: "present",
              });
              
              if (assignment) {
                assignmentsCreated++;
                console.log(`✅ [assignFixedRoomsToExamRooms] Created RoomAssignment for student ${student.sbd || student._id} (seat ${seatNumber})`);
              }
            } catch (assignErr) {
              console.error(`❌ [assignFixedRoomsToExamRooms] Error creating RoomAssignment for student ${student._id}:`, assignErr);
              // ✅ Nếu vẫn bị duplicate (có thể do race condition), thử xóa và tạo lại hoặc update
              if (assignErr.code === 11000) {
                try {
                  // ✅ Thử xóa document cũ trước (nếu có)
                  await RoomAssignment.deleteMany({
                    schedule: scheduleId,
                    examStudent: student._id,
                  });
                  
                  // ✅ Sau đó tạo lại
                  const assignment = await RoomAssignment.create({
                    exam: examId,
                    schedule: scheduleId,
                    subject: subjectId,
                    examRoom: examRoom._id,
                    examStudent: student._id,
                    seatNumber: seatNumber,
                    sbd: student.sbd || "",
                    status: "present",
                  });
                  
                  if (assignment) {
                    assignmentsCreated++;
                    console.log(`✅ [assignFixedRoomsToExamRooms] Created RoomAssignment after delete for student ${student.sbd || student._id}`);
                  } else {
                    assignmentErrors.push(`Không thể tạo RoomAssignment cho học sinh ${student.sbd || student._id} sau khi xóa`);
                  }
                } catch (retryErr) {
                  console.error(`❌ [assignFixedRoomsToExamRooms] Error retrying RoomAssignment creation:`, retryErr);
                  assignmentErrors.push(`Lỗi khi tạo lại RoomAssignment cho học sinh ${student.sbd || student._id}: ${retryErr.message}`);
                }
              } else {
                assignmentErrors.push(`Lỗi khi tạo RoomAssignment cho học sinh ${student.sbd || student._id}: ${assignErr.message}`);
              }
            }
          }
          
          console.log(`✅ [assignFixedRoomsToExamRooms] Processed ${assignmentsCreated} RoomAssignments`);
        } else {
          console.log("⚠️ [assignFixedRoomsToExamRooms] FixedRoom has no students:", fixedRoom._id);
        }
      } catch (err) {
        console.error("❌ [assignFixedRoomsToExamRooms] Error processing ExamRoom:", examRoom._id, err);
        errors.push(`Lỗi khi xử lý ExamRoom ${examRoom._id}: ${err.message}`);
      }
    }

    // ✅ Thêm assignmentErrors vào errors nếu có
    if (assignmentErrors.length > 0) {
      errors.push(...assignmentErrors);
    }

    console.log(`✅ [assignFixedRoomsToExamRooms] Summary: ${examRooms.length} ExamRooms, ${assignmentsCreated} RoomAssignments created`);

    res.json({
      message: `✅ Đã tạo/cập nhật ${examRooms.length} phòng thi và ${assignmentsCreated} phân phòng.`,
      total: examRooms.length,
      assignments: assignmentsCreated,
      assignmentsCreated, // ✅ Giữ lại để tương thích
      examRooms: examRooms.map(er => ({
        _id: er._id,
        roomCode: er.roomCode,
        fixedExamRoom: er.fixedExamRoom,
        schedule: er.schedule,
      })),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("❌ [assignFixedRoomsToExamRooms] Lỗi:", err);
    console.error("❌ [assignFixedRoomsToExamRooms] Stack:", err.stack);
    res.status(500).json({ 
      error: "Lỗi khi phân phòng cố định vào phòng thi", 
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

/* =========================================================
   🏫 PHÂN PHÒNG NHÓM VÀO TẤT CẢ PHÒNG THI (TỰ ĐỘNG)
   - Tự động phân tất cả FixedExamRoom vào Room vật lý cho tất cả schedules
   - Tránh trùng phòng, trùng giờ
========================================================= */
exports.assignFixedRoomsToAllSchedules = async (req, res) => {
  try {
    const { examId } = req.body;

    if (!examId) {
      return res.status(400).json({ error: "Thiếu examId." });
    }

    // ✅ Lấy tất cả schedules của kỳ thi
    const schedules = await ExamSchedule.find({ exam: examId })
      .populate("subject", "_id name")
      .sort({ date: 1, startTime: 1 });

    if (schedules.length === 0) {
      return res.status(400).json({ error: "Kỳ thi chưa có lịch thi nào." });
    }

    // ✅ Lấy tất cả FixedExamRoom của kỳ thi
    const fixedRooms = await FixedExamRoom.find({ exam: examId }).sort({ grade: 1, code: 1 });

    if (fixedRooms.length === 0) {
      return res.status(400).json({ error: "Kỳ thi chưa có phòng nhóm nào." });
    }

    // ✅ Lấy tất cả Room vật lý khả dụng (available + normal)
    const availableRooms = await Room.find({
      status: "available",
      type: "normal",
    }).sort({ roomCode: 1 });

    if (availableRooms.length === 0) {
      return res.status(400).json({ error: "Không có phòng vật lý khả dụng." });
    }

    // ✅ Lấy thông tin exam
    const exam = await Exam.findById(examId).select("config");
    const defaultCapacity = exam?.config?.maxStudentsPerRoom || 24;

    const results = [];
    const errors = [];
    let totalExamRooms = 0;
    let totalAssignments = 0;

    // ✅ Nhóm schedules theo ngày và giờ để tránh trùng phòng
    const scheduleTimeSlots = {};
    for (const schedule of schedules) {
      const dateStr = schedule.date ? new Date(schedule.date).toISOString().split('T')[0] : "";
      const timeSlot = `${dateStr}_${schedule.startTime || ""}`;
      if (!scheduleTimeSlots[timeSlot]) {
        scheduleTimeSlots[timeSlot] = [];
      }
      scheduleTimeSlots[timeSlot].push(schedule);
    }

    // ✅ Xử lý từng schedule
    for (const schedule of schedules) {
      try {
        // ✅ Kiểm tra xem schedule đã có ExamRoom chưa
        const existingExamRooms = await ExamRoom.find({
          exam: examId,
          schedule: schedule._id,
        });

        // ✅ Nếu đã có ExamRoom, bỏ qua hoặc cập nhật
        if (existingExamRooms.length > 0) {
          console.log(`⚠️ Schedule ${schedule._id} đã có ${existingExamRooms.length} ExamRoom, bỏ qua`);
          results.push({
            scheduleId: schedule._id,
            scheduleName: `${schedule.subject?.name || schedule.subject} - Khối ${schedule.grade}`,
            status: "skipped",
            message: `Đã có ${existingExamRooms.length} phòng thi`,
          });
          continue;
        }

        // ✅ Lấy FixedExamRoom theo grade của schedule
        const gradeFixedRooms = fixedRooms.filter(
          (fr) => String(fr.grade) === String(schedule.grade)
        );

        if (gradeFixedRooms.length === 0) {
          errors.push({
            schedule: `${schedule.subject?.name || schedule.subject} - Khối ${schedule.grade}`,
            error: "Không có phòng nhóm cho khối này",
          });
          continue;
        }

        // ✅ Lấy các Room đã được sử dụng trong cùng time slot
        const dateStr = schedule.date ? new Date(schedule.date).toISOString().split('T')[0] : "";
        const timeSlot = `${dateStr}_${schedule.startTime || ""}`;
        const conflictingSchedules = scheduleTimeSlots[timeSlot] || [];
        const conflictingScheduleIds = conflictingSchedules
          .filter((s) => String(s._id) !== String(schedule._id))
          .map((s) => s._id);

        // ✅ Lấy các Room đã được sử dụng bởi các schedule trùng giờ
        const usedRoomIds = new Set();
        if (conflictingScheduleIds.length > 0) {
          const conflictingExamRooms = await ExamRoom.find({
            exam: examId,
            schedule: { $in: conflictingScheduleIds },
          }).select("room");
          conflictingExamRooms.forEach((er) => {
            if (er.room) usedRoomIds.add(String(er.room));
          });
        }

        // ✅ Lọc các Room khả dụng (chưa bị sử dụng trong cùng time slot)
        const freeRooms = availableRooms.filter(
          (r) => !usedRoomIds.has(String(r._id))
        );

        if (freeRooms.length < gradeFixedRooms.length) {
          errors.push({
            schedule: `${schedule.subject?.name || schedule.subject} - Khối ${schedule.grade}`,
            error: `Không đủ phòng khả dụng (cần ${gradeFixedRooms.length}, có ${freeRooms.length})`,
          });
          continue;
        }

        // ✅ Tự động map FixedExamRoom vào Room vật lý
        const roomMappings = gradeFixedRooms.map((fixedRoom, index) => ({
          fixedRoomId: fixedRoom._id,
          roomId: freeRooms[index]._id,
        }));

        // ✅ Gọi hàm assignFixedRoomsToExamRooms cho schedule này
        const assignmentResult = await assignFixedRoomsToExamRoomsInternal(
          examId,
          schedule._id,
          roomMappings,
          defaultCapacity
        );

        totalExamRooms += assignmentResult.examRooms.length;
        totalAssignments += assignmentResult.assignmentsCreated;

        results.push({
          scheduleId: schedule._id,
          scheduleName: `${schedule.subject?.name || schedule.subject} - Khối ${schedule.grade}`,
          status: "success",
          examRooms: assignmentResult.examRooms.length,
          assignments: assignmentResult.assignmentsCreated,
          errors: assignmentResult.errors,
        });
      } catch (err) {
        console.error(`❌ Lỗi khi phân phòng cho schedule ${schedule._id}:`, err);
        errors.push({
          schedule: `${schedule.subject?.name || schedule.subject} - Khối ${schedule.grade}`,
          error: err.message,
        });
      }
    }

    res.json({
      message: `✅ Đã phân phòng cho ${results.filter((r) => r.status === "success").length}/${schedules.length} lịch thi. Tổng ${totalExamRooms} phòng thi, ${totalAssignments} phân phòng.`,
      total: totalExamRooms,
      assignments: totalAssignments,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("❌ Lỗi assignFixedRoomsToAllSchedules:", err);
    res.status(500).json({
      error: "Lỗi khi phân phòng nhóm vào tất cả phòng thi",
      details: err.message,
    });
  }
};

/* =========================================================
   🔧 HELPER: Phân FixedExamRoom vào ExamRoom (internal)
========================================================= */
async function assignFixedRoomsToExamRoomsInternal(
  examId,
  scheduleId,
  roomMappings,
  defaultCapacity
) {
  const schedule = await ExamSchedule.findById(scheduleId)
    .populate("exam", "_id")
    .populate("subject", "_id name");

  if (!schedule) {
    throw new Error("Không tìm thấy lịch thi.");
  }

  const grade = schedule.grade;
  const fixedRooms = await FixedExamRoom.find({
    exam: examId,
    grade: String(grade),
  }).sort({ code: 1 });

  const examRooms = [];
  const errors = [];
  const RoomAssignment = require("../../models/exam/roomAssignment");

  for (const mapping of roomMappings) {
    const { fixedRoomId, roomId } = mapping;

    const fixedRoom = fixedRooms.find((fr) => String(fr._id) === String(fixedRoomId));
    if (!fixedRoom) {
      errors.push(`Không tìm thấy FixedExamRoom với ID: ${fixedRoomId}`);
      continue;
    }

    const room = await Room.findById(roomId);
    if (!room || room.status !== "available") {
      errors.push(`Phòng ${room?.roomCode || roomId} không khả dụng.`);
      continue;
    }

    // ✅ Kiểm tra xem đã có ExamRoom chưa
    const existingExamRoom = await ExamRoom.findOne({
      exam: examId,
      schedule: scheduleId,
      fixedExamRoom: fixedRoomId,
    });

    if (existingExamRoom) {
      // ✅ Cập nhật nếu cần
      if (String(existingExamRoom.room) !== String(roomId)) {
        existingExamRoom.room = roomId;
        existingExamRoom.roomCode = room.roomCode;
        existingExamRoom.type = room.type || "normal";
        await existingExamRoom.save();
      }
      examRooms.push(existingExamRoom);
    } else {
      // ✅ Tạo mới
      try {
        const newExamRoom = await ExamRoom.create({
          exam: examId,
          schedule: scheduleId,
          fixedExamRoom: fixedRoomId,
          room: roomId,
          roomCode: room.roomCode,
          type: room.type || "normal",
          capacity: defaultCapacity,
          grade: String(grade),
        });
        examRooms.push(newExamRoom);
      } catch (createErr) {
        if (createErr.code === 11000) {
          errors.push(`Phòng ${room.roomCode} đã được sử dụng trong lịch thi này.`);
        } else {
          errors.push(`Lỗi khi tạo ExamRoom: ${createErr.message}`);
        }
      }
    }
  }

  // ✅ Tạo RoomAssignment cho học sinh
  let assignmentsCreated = 0;
  const subjectId = schedule.subject?._id || schedule.subject;

  for (const examRoom of examRooms) {
    try {
      const fixedRoom = await FixedExamRoom.findById(examRoom.fixedExamRoom);
      if (!fixedRoom || !fixedRoom.students || fixedRoom.students.length === 0) {
        continue;
      }

      const examStudents = await ExamStudent.find({
        _id: { $in: fixedRoom.students },
      }).sort({ "student.name": 1 });

      // ✅ Xóa RoomAssignment cũ
      const studentIds = examStudents.map((s) => s._id);
      await RoomAssignment.deleteMany({
        schedule: scheduleId,
        examStudent: { $in: studentIds },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // ✅ Tạo RoomAssignment mới
      for (let index = 0; index < examStudents.length; index++) {
        const student = examStudents[index];
        const seatNumber = index + 1;

        try {
          await RoomAssignment.create({
            exam: examId,
            schedule: scheduleId,
            subject: subjectId,
            examRoom: examRoom._id,
            examStudent: student._id,
            seatNumber: seatNumber,
            sbd: student.sbd || "",
            status: "present",
          });
          assignmentsCreated++;
        } catch (assignErr) {
          if (assignErr.code === 11000) {
            // ✅ Retry: xóa và tạo lại
            await RoomAssignment.deleteMany({
              schedule: scheduleId,
              examStudent: student._id,
            });
            await RoomAssignment.create({
              exam: examId,
              schedule: scheduleId,
              subject: subjectId,
              examRoom: examRoom._id,
              examStudent: student._id,
              seatNumber: seatNumber,
              sbd: student.sbd || "",
              status: "present",
            });
            assignmentsCreated++;
          } else {
            errors.push(`Lỗi khi tạo RoomAssignment cho học sinh ${student.sbd || student._id}: ${assignErr.message}`);
          }
        }
      }
    } catch (err) {
      errors.push(`Lỗi khi xử lý ExamRoom ${examRoom._id}: ${err.message}`);
    }
  }

  return {
    examRooms: examRooms.map((er) => ({
      _id: er._id,
      roomCode: er.roomCode,
      fixedExamRoom: er.fixedExamRoom,
    })),
    assignmentsCreated,
    errors,
  };
}

/* =========================================================
   ✏️ CẬP NHẬT PHÒNG CỐ ĐỊNH
========================================================= */
exports.updateFixedRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const { students, capacity } = req.body;

    const fixedRoom = await FixedExamRoom.findById(id);
    if (!fixedRoom) {
      return res.status(404).json({ error: "Không tìm thấy phòng cố định." });
    }

    const updateData = {};
    if (students !== undefined) {
      updateData.students = students;
    }
    if (capacity !== undefined) {
      updateData.capacity = capacity;
    }

    const updated = await FixedExamRoom.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    res.json({ success: true, message: "✅ Cập nhật phòng cố định thành công.", data: updated });
  } catch (err) {
    console.error("❌ Lỗi updateFixedRoom:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🔄 DI CHUYỂN FIXEDEXAMROOM TỪ PHÒNG NÀY SANG PHÒNG KHÁC
   - Khi phòng bị hư, có thể kéo toàn bộ học sinh (FixedExamRoom) 
     từ phòng này sang phòng trống khác
   - Kiểm tra phòng đích phải trống (không có lịch thi trong cùng ca/ngày/giờ)
========================================================= */
exports.moveFixedRoom = async (req, res) => {
  try {
    const { examRoomId, newRoomId } = req.body;

    if (!examRoomId || !newRoomId) {
      return res.status(400).json({ error: "Thiếu examRoomId hoặc newRoomId." });
    }

    // ✅ Tìm ExamRoom hiện tại
    const currentExamRoom = await ExamRoom.findById(examRoomId)
      .populate({
        path: "schedule",
        select: "date startTime endTime grade subject",
        populate: {
          path: "subject",
          select: "name code"
        }
      })
      .populate("room", "roomCode type status")
      .populate("fixedExamRoom", "code students capacity");
    
    if (!currentExamRoom) {
      return res.status(404).json({ error: "Không tìm thấy phòng thi hiện tại." });
    }

    // ✅ Kiểm tra phòng đích (Room mới)
    const newRoom = await Room.findById(newRoomId);
    if (!newRoom) {
      return res.status(404).json({ error: "Không tìm thấy phòng đích." });
    }

    if (newRoom.status !== "available") {
      return res.status(400).json({ error: "Phòng đích không khả dụng." });
    }

    // ✅ Kiểm tra phòng đích có trống không (không có ExamRoom nào trong cùng schedule)
    const scheduleId = currentExamRoom.schedule?._id || currentExamRoom.schedule;
    const existingExamRoomInNewRoom = await ExamRoom.findOne({
      schedule: scheduleId,
      room: newRoomId,
      _id: { $ne: examRoomId }, // Loại trừ ExamRoom hiện tại
    });

    if (existingExamRoomInNewRoom) {
      return res.status(400).json({ 
        error: "Phòng đích đã được sử dụng cho lịch thi này." 
      });
    }

    // ✅ Cập nhật ExamRoom: thay đổi room và roomCode
    currentExamRoom.room = newRoomId;
    currentExamRoom.roomCode = newRoom.roomCode;
    currentExamRoom.type = newRoom.type || "normal";
    await currentExamRoom.save();

    console.log(`✅ [moveFixedRoom] Đã di chuyển ExamRoom ${examRoomId} từ ${currentExamRoom.roomCode} sang ${newRoom.roomCode}`);

    res.json({ 
      success: true, 
      message: `✅ Đã di chuyển phòng từ ${currentExamRoom.roomCode} sang ${newRoom.roomCode} thành công.`,
      data: currentExamRoom 
    });
  } catch (err) {
    console.error("❌ Lỗi moveFixedRoom:", err);
    res.status(500).json({ error: err.message });
  }
};