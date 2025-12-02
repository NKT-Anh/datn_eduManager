// controllers/exam/examStudentController.js
const { ExamStudent, Exam } = require("../../models/exam/examIndex");
const Student = require("../../models/user/student");
const Class = require("../../models/class/class");
const mongoose = require("mongoose");
const xlsx = require("xlsx");

/* =========================================================
   ➕ GÁN HỌC SINH VÀO KỲ THI (TỰ ĐỘNG THEO KHỐI)
   - Tự động lấy học sinh có currentYear trùng với năm của kỳ thi
   - Lấy theo grades của kỳ thi (nếu có 10,11,12 thì lấy cả 3 khối)
========================================================= */
exports.addStudentsToExam = async (req, res) => {
  try {
    const { examId, grade } = req.body;
    if (!examId)
      return res.status(400).json({ error: "Thiếu examId." });

    // 🔍 Lấy thông tin kỳ thi
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ error: "Không tìm thấy kỳ thi." });
    }

    // 🎯 Xác định khối cần lấy
    let targetGrades = Array.isArray(exam.grades) ? [...exam.grades] : [];
    
    if (grade) {
      const gradeString = String(grade);
      if (!['10', '11', '12'].includes(gradeString)) {
        return res.status(400).json({ error: "Grade phải là '10', '11' hoặc '12'." });
      }
      if (targetGrades.length && !targetGrades.includes(gradeString)) {
        return res.status(400).json({ error: `Khối ${gradeString} không nằm trong kỳ thi.` });
      }
      targetGrades = [gradeString];
    }

    if (!targetGrades.length) {
      return res.status(400).json({ error: "Kỳ thi chưa cấu hình khối tham gia." });
    }

    // ✅ Lấy tất cả lớp thuộc năm học hiện tại
    const Class = require('../../models/class/class');
    const classesInCurrentYear = await Class.find({
      year: exam.year // ✅ Chỉ lấy lớp của năm học hiện tại
    }).select("_id").lean();
    
    const classIdsInCurrentYear = classesInCurrentYear.map(c => c._id);

    // 🔍 Lấy danh sách học sinh theo currentYear, grades và lớp của năm học hiện tại
    const students = await Student.find({
      status: "active",
      currentYear: exam.year, // ✅ Lấy học sinh có currentYear trùng với năm của kỳ thi
      grade: { $in: targetGrades }, // ✅ Lấy theo grades của kỳ thi
      classId: { $in: classIdsInCurrentYear }, // ✅ Chỉ lấy học sinh ở lớp của năm học hiện tại
      isDeleted: { $ne: true } // ✅ Không lấy học sinh đã bị xóa mềm
    })
      .populate({
        path: "classId",
        select: "_id year className", // ✅ Populate để kiểm tra year
        match: { year: exam.year } // ✅ Đảm bảo lớp thuộc năm học hiện tại
      })
      .select("_id classId grade")
      .lean();

    if (!students.length) {
      return res.status(404).json({ 
        error: `Không tìm thấy học sinh khối ${targetGrades.join(', ')} của niên khóa ${exam.year}.` 
      });
    }

    // 🚫 Bỏ trùng (đã có trong kỳ thi)
    const existing = await ExamStudent.find({
      exam: examId,
      student: { $in: students.map((s) => s._id) },
    }).distinct("student");

    const newStudents = students.filter(
      (s) => !existing.includes(String(s._id))
    );

    if (!newStudents.length) {
      return res.status(400).json({
        error: "Tất cả học sinh đã được gán vào kỳ thi này.",
      });
    }

    // 🔢 Sinh SBD duy nhất (prefix theo khối)
    const startNumber = await ExamStudent.countDocuments({ exam: examId });

    // ✅ Lọc bỏ học sinh chưa có lớp hoặc lớp không thuộc năm học hiện tại
    const studentsWithClass = newStudents.filter((s) => {
      return s.classId && s.classId._id && s.classId.year === exam.year;
    });
    if (studentsWithClass.length < newStudents.length) {
      const withoutClass = newStudents.length - studentsWithClass.length;
      console.warn(`⚠️ Có ${withoutClass} học sinh chưa được gán vào lớp hoặc lớp không thuộc năm học ${exam.year}, sẽ bỏ qua.`);
    }

    const examStudents = studentsWithClass.map((s, i) => ({
      exam: examId,
      student: s._id,
      class: s.classId._id, // ✅ Lấy từ student.classId, đảm bảo không null
      grade: String(s.grade), // ✅ Đảm bảo là String
      sbd: `${String(s.grade)}${String(startNumber + i + 1).padStart(4, "0")}`,
      status: "active",
    }));

    await ExamStudent.insertMany(examStudents, { ordered: false });
    
    let message = `✅ Đã thêm ${examStudents.length} học sinh vào kỳ thi.`;
    if (studentsWithClass.length < newStudents.length) {
      message += ` (${newStudents.length - studentsWithClass.length} học sinh chưa có lớp đã bỏ qua)`;
    }
    
    res.json({
      message,
      total: examStudents.length,
      grades: targetGrades,
      withoutClass: newStudents.length - studentsWithClass.length, // ✅ Số học sinh chưa có lớp
    });
  } catch (err) {
    console.error("❌ Lỗi addStudentsToExam:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   ➕ THÊM NHIỀU HỌC SINH VÀO KỲ THI (THEO DANH SÁCH ID)
   - Nhận danh sách studentIds
   - Tự động kiểm tra và chỉ thêm học sinh chưa có
   - Tự động sinh SBD
========================================================= */
exports.addMultipleStudents = async (req, res) => {
  try {
    const { examId, studentIds } = req.body;

    if (!examId || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: "Thiếu examId hoặc danh sách học sinh." });
    }

    // ✅ Kiểm tra exam tồn tại và có year
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ error: "Không tìm thấy kỳ thi." });
    }
    if (!exam.year) {
      return res.status(400).json({ error: "Kỳ thi chưa có năm học." });
    }

    // ✅ Lấy tất cả lớp thuộc năm học hiện tại
    const Class = require('../../models/class/class');
    const classesInCurrentYear = await Class.find({
      year: exam.year // ✅ Chỉ lấy lớp của năm học hiện tại
    }).select("_id").lean();
    
    const classIdsInCurrentYear = classesInCurrentYear.map(c => c._id);

    // 🔍 Lấy thông tin học sinh
    const students = await Student.find({
      _id: { $in: studentIds },
      status: "active",
      currentYear: exam.year, // ✅ Chỉ lấy học sinh cùng năm học
      grade: { $in: exam.grades }, // ✅ Chỉ lấy học sinh thuộc khối tham gia
      classId: { $in: classIdsInCurrentYear }, // ✅ Chỉ lấy học sinh ở lớp của năm học hiện tại
      isDeleted: { $ne: true } // ✅ Không lấy học sinh đã bị xóa mềm
    })
      .populate({
        path: "classId",
        select: "_id year className", // ✅ Populate để kiểm tra year
        match: { year: exam.year } // ✅ Đảm bảo lớp thuộc năm học hiện tại
      })
      .select("_id classId grade")
      .lean();

    if (students.length === 0) {
      return res.status(404).json({
        error: "Không tìm thấy học sinh hợp lệ. Vui lòng kiểm tra lại năm học và khối.",
      });
    }

    // 🚫 Bỏ trùng (đã có trong kỳ thi)
    const existing = await ExamStudent.find({
      exam: examId,
      student: { $in: students.map((s) => s._id) },
    }).distinct("student");

    const newStudents = students.filter(
      (s) => !existing.includes(String(s._id))
    );

    if (newStudents.length === 0) {
      return res.status(400).json({
        error: "Tất cả học sinh đã được gán vào kỳ thi này.",
      });
    }

    // ✅ Lọc bỏ học sinh chưa có lớp hoặc lớp không thuộc năm học hiện tại
    const studentsWithClass = newStudents.filter((s) => {
      return s.classId && s.classId._id && s.classId.year === exam.year;
    });
    if (studentsWithClass.length < newStudents.length) {
      const withoutClass = newStudents.length - studentsWithClass.length;
      console.warn(`⚠️ Có ${withoutClass} học sinh chưa được gán vào lớp hoặc lớp không thuộc năm học ${exam.year}, sẽ bỏ qua.`);
    }

    if (studentsWithClass.length === 0) {
      return res.status(400).json({
        error: `Tất cả học sinh được chọn đều chưa được gán vào lớp hoặc lớp không thuộc năm học ${exam.year}. Vui lòng gán lớp cho học sinh trước.`,
      });
    }

    // 🔢 Sinh SBD duy nhất
    const startNumber = await ExamStudent.countDocuments({ exam: examId });

    const examStudents = studentsWithClass.map((s, i) => ({
      exam: examId,
      student: s._id,
      class: s.classId._id, // ✅ Lấy từ student.classId, đảm bảo không null
      grade: String(s.grade),
      sbd: `${String(s.grade)}${String(startNumber + i + 1).padStart(4, "0")}`,
      status: "active",
    }));

    await ExamStudent.insertMany(examStudents, { ordered: false });

    res.json({
      message: `✅ Đã thêm ${examStudents.length} học sinh vào kỳ thi.`,
      total: examStudents.length,
      skipped: students.length - newStudents.length,
      withoutClass: newStudents.length - studentsWithClass.length, // ✅ Số học sinh chưa có lớp
    });
  } catch (err) {
    console.error("❌ Lỗi addMultipleStudents:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🎯 LẤY DANH SÁCH HỌC SINH ĐỦ ĐIỀU KIỆN THEO KỲ THI
   - Lọc theo niên khóa (năm học) và khối của kỳ thi
   - Trả về tình trạng đã gán hay chưa
========================================================= */
exports.getCandidatesForExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const { grade, keyword, limit } = req.query;

    if (!examId || !mongoose.Types.ObjectId.isValid(examId)) {
      return res.status(400).json({ error: "examId không hợp lệ." });
    }

    const exam = await Exam.findById(examId).select("year grades").lean();
    if (!exam) {
      return res.status(404).json({ error: "Không tìm thấy kỳ thi." });
    }
    if (!exam.year) {
      return res.status(400).json({ error: "Kỳ thi chưa có năm học." });
    }

    let targetGrades = Array.isArray(exam.grades) ? [...exam.grades] : [];

    if (grade !== undefined) {
      const gradeString = String(grade);
      if (!['10', '11', '12'].includes(gradeString)) {
        return res
          .status(400)
          .json({ error: "Giá trị grade phải là '10', '11' hoặc '12'." });
      }

      if (targetGrades.length && !targetGrades.includes(gradeString)) {
        return res.status(400).json({
          error: `Khối ${gradeString} không nằm trong kỳ thi.`,
        });
      }

      targetGrades = [gradeString];
    }

    if (!targetGrades.length) {
      return res.status(400).json({ error: "Kỳ thi chưa cấu hình khối tham gia." });
    }

    const gradeStrings = targetGrades; // Đã là String rồi

    // ✅ Lấy tất cả lớp thuộc năm học hiện tại
    const Class = require('../../models/class/class');
    const classesInCurrentYear = await Class.find({
      year: exam.year // ✅ Chỉ lấy lớp của năm học hiện tại
    }).select("_id").lean();
    
    const classIdsInCurrentYear = classesInCurrentYear.map(c => c._id);

    const filter = {
      status: "active",
      currentYear: exam.year,
      grade: { $in: gradeStrings },
      classId: { $in: classIdsInCurrentYear }, // ✅ Chỉ lấy học sinh ở lớp của năm học hiện tại
    };

    if (keyword && typeof keyword === "string" && keyword.trim()) {
      const regex = new RegExp(keyword.trim(), "i");
      filter.$or = [
        { name: regex },
        { studentCode: regex },
      ];
    }

    // ✅ Không lấy học sinh đã bị xóa mềm
    filter.isDeleted = { $ne: true };

    let query = Student.find(filter)
      .populate({
        path: "classId",
        select: "className classCode grade year", // ✅ Populate classId với className (đúng field trong Class model)
        match: { year: exam.year } // ✅ Đảm bảo lớp thuộc năm học hiện tại
      })
      .sort({ name: 1 });

    if (limit && !Number.isNaN(Number(limit))) {
      query = query.limit(Number(limit));
    }

    const students = await query.lean();

    if (!students.length) {
      return res.json({ total: 0, data: [] });
    }

    const studentIds = students.map((s) => s._id);
    const examStudents = await ExamStudent.find({
      exam: examId,
      student: { $in: studentIds },
    })
      .select("student room sbd status")
      .populate("room", "code grade")
      .lean();

    const examStudentMap = new Map(
      examStudents.map((es) => [String(es.student), es])
    );

    const data = students.map((s) => {
      const key = String(s._id);
      const matched = examStudentMap.get(key);

      // ✅ Đảm bảo lấy đầy đủ thông tin lớp từ classId
      const classInfo = s.classId ? {
        _id: s.classId._id,
        name: s.classId.className || null, // ✅ Class model dùng className, không phải name
        className: s.classId.className || null, // ✅ Giữ nguyên để tương thích
        classCode: s.classId.classCode || null,
        grade: s.classId.grade || null,
        year: s.classId.year || null,
      } : null;

      return {
        _id: s._id,
        name: s.name,
        studentCode: s.studentCode,
        gender: s.gender,
        grade: Number(s.grade),
        currentYear: s.currentYear,
        classId: s.classId?._id || null,
        className: classInfo?.className || classInfo?.name || null, // ✅ Lấy từ classInfo.className
        classInfo: classInfo, // ✅ Thông tin đầy đủ về lớp
        alreadyInExam: Boolean(matched),
        examStudentId: matched?._id || null,
        assignedRoomId: matched?.room?._id || matched?.room || null,
        assignedRoomCode: matched?.room?.roomCode || null,
        sbd: matched?.sbd || null,
        status: matched?.status || null,
      };
    });

    res.json({ total: data.length, data });
  } catch (err) {
    console.error("❌ Lỗi getCandidatesForExam:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📄 LẤY DANH SÁCH HỌC SINH THEO KỲ THI (CÓ PHÂN TRANG)
========================================================= */
exports.getStudentsByExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const { grade, page = 1, limit } = req.query;

    // ✅ Kiểm tra exam tồn tại và có year
    const exam = await Exam.findById(examId).select("year");
    if (!exam) {
      return res.status(404).json({ error: "Không tìm thấy kỳ thi." });
    }
    if (!exam.year) {
      return res.status(400).json({ error: "Kỳ thi chưa có năm học." });
    }

    const filter = { exam: examId };
    if (grade) filter.grade = String(grade);

    // ✅ Nếu limit = 0 hoặc không có limit, trả về tất cả (không phân trang)
    const limitNum = limit ? parseInt(limit) : 0;
    const pageNum = parseInt(page);
    const shouldPaginate = limitNum > 0;

    let query = ExamStudent.find(filter)
      .populate("exam", "name year semester") // ✅ Populate exam để có year
      .populate({
        path: "student",
        select: "name gender studentCode",
        populate: {
          path: "classId",
          select: "className classCode grade year" // ✅ Populate Student.classId (lớp gốc)
        }
      })
      .populate("class", "className classCode grade year") // ✅ ExamStudent.class (nhóm lớp trong kỳ thi)
      .populate("room", "code grade") // ✅ Populate FixedExamRoom (room) để hiển thị phòng nhóm
      .sort({ grade: 1, "student.name": 1 });

    // ✅ Chỉ phân trang nếu có limit > 0
    if (shouldPaginate) {
      query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
    }

    const data = await query.lean();
    const total = await ExamStudent.countDocuments(filter);

    res.json({
      total,
      totalPages: shouldPaginate ? Math.ceil(total / limitNum) : 1,
      page: pageNum,
      data,
      examYear: exam.year, // ✅ Trả về năm học
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📋 LẤY DANH SÁCH HỌC SINH THEO PHÒNG THI
   - Nếu roomId là FixedExamRoom: lấy từ ExamStudent.room
   - Nếu roomId là ExamRoom: lấy từ RoomAssignment và sắp xếp theo seatNumber
========================================================= */
exports.getStudentsByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { examRoomId, scheduleId } = req.query; // ✅ Thêm examRoomId và scheduleId để lấy từ RoomAssignment
    
    if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ error: "roomId không hợp lệ." });
    }

    // ✅ Nếu có examRoomId và scheduleId, lấy từ RoomAssignment (sắp xếp theo seatNumber)
    if (examRoomId && scheduleId) {
      const RoomAssignment = require("../../models/exam/roomAssignment");
      const assignments = await RoomAssignment.find({
        examRoom: examRoomId,
        schedule: scheduleId,
      })
        .populate("examStudent", "sbd status")
        .populate({
          path: "examStudent",
          populate: [
            { path: "student", select: "name studentCode gender" },
            { path: "class", select: "className classCode grade year" },
            { path: "exam", select: "name year semester" },
            { path: "room", select: "code grade" },
          ],
        })
        .sort({ seatNumber: 1 }) // ✅ Sắp xếp theo số thứ tự trong phòng
        .lean();

      const students = assignments.map((a) => ({
        ...a.examStudent,
        seatNumber: a.seatNumber, // ✅ Thêm seatNumber vào kết quả
        sbd: a.sbd || a.examStudent?.sbd,
      }));

      return res.json({
        total: students.length,
        data: students,
      });
    }

    // ✅ Nếu không có examRoomId, lấy từ ExamStudent.room (FixedExamRoom)
    const students = await ExamStudent.find({ room: roomId })
      .populate("student", "name className gender studentCode")
      .populate("class", "className classCode grade year")
      .populate("exam", "name year semester")
      .populate("room", "code grade")
      .sort({ "student.name": 1 })
      .lean();

    res.json({
      total: students.length,
      data: students,
    });
  } catch (err) {
    console.error("❌ Lỗi getStudentsByRoom:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🔍 LẤY CHI TIẾT 1 HỌC SINH DỰ THI
========================================================= */
exports.getExamStudentById = async (req, res) => {
  try {
    const student = await ExamStudent.findById(req.params.id)
      .populate("student", "name className gender studentCode")
      .populate("class", "name grade");
    if (!student)
      return res.status(404).json({ error: "Không tìm thấy học sinh dự thi." });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   ✏️ CẬP NHẬT HỌC SINH DỰ THI
========================================================= */
exports.updateExamStudent = async (req, res) => {
  try {
    const updated = await ExamStudent.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated)
      return res
        .status(404)
        .json({ error: "Không tìm thấy học sinh để cập nhật." });
    res.json({ message: "✅ Cập nhật học sinh thành công.", student: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   ✏️ CẬP NHẬT NHIỀU HỌC SINH DỰ THI
========================================================= */
exports.bulkUpdateExamStudents = async (req, res) => {
  try {
    const { updates } = req.body;
    
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: "Thiếu danh sách cập nhật." });
    }

    const bulkOps = updates.map(({ id, data }) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: data },
      },
    }));

    const result = await ExamStudent.bulkWrite(bulkOps);
    
    res.json({
      success: true,
      message: `✅ Đã cập nhật ${result.modifiedCount} học sinh.`,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("❌ Lỗi bulkUpdateExamStudents:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🗑️ RESET DANH SÁCH HỌC SINH CỦA KỲ THI
========================================================= */
exports.resetExamStudents = async (req, res) => {
  try {
    const { examId } = req.params;
    const deleted = await ExamStudent.deleteMany({ exam: examId });
    res.json({
      message: `🗑️ Đã xóa ${deleted.deletedCount} học sinh khỏi kỳ thi.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   ➕ THÊM TẤT CẢ HỌC SINH THEO KHỐI THAM GIA
   - Kiểm tra nếu học sinh chưa có thì mới thêm
   - Lấy học sinh có currentYear trùng với năm của kỳ thi
   - Lấy theo tất cả grades của kỳ thi
========================================================= */
exports.addAllStudentsByGrades = async (req, res) => {
  try {
    const { examId } = req.params;
    
    if (!examId || !mongoose.Types.ObjectId.isValid(examId)) {
      return res.status(400).json({ error: "examId không hợp lệ." });
    }

    // 🔍 Lấy thông tin kỳ thi
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ error: "Không tìm thấy kỳ thi." });
    }

    const targetGrades = Array.isArray(exam.grades) ? [...exam.grades] : [];
    if (!targetGrades.length) {
      return res.status(400).json({ error: "Kỳ thi chưa cấu hình khối tham gia." });
    }

    // ✅ Lấy tất cả lớp thuộc năm học hiện tại
    const Class = require('../../models/class/class');
    const classesInCurrentYear = await Class.find({
      year: exam.year // ✅ Chỉ lấy lớp của năm học hiện tại
    }).select("_id").lean();
    
    const classIdsInCurrentYear = classesInCurrentYear.map(c => c._id);

    // 🔍 Lấy tất cả học sinh có currentYear trùng với năm của kỳ thi, grades trùng với grades của kỳ thi, và lớp thuộc năm học hiện tại
    const students = await Student.find({
      status: "active",
      currentYear: exam.year,
      grade: { $in: targetGrades },
      classId: { $in: classIdsInCurrentYear }, // ✅ Chỉ lấy học sinh ở lớp của năm học hiện tại
      isDeleted: { $ne: true } // ✅ Không lấy học sinh đã bị xóa mềm
    })
      .populate({
        path: "classId",
        select: "_id year className", // ✅ Populate để kiểm tra year
        match: { year: exam.year } // ✅ Đảm bảo lớp thuộc năm học hiện tại
      })
      .select("_id classId grade")
      .lean();

    if (!students.length) {
      return res.json({
        message: `Không tìm thấy học sinh khối ${targetGrades.join(', ')} của niên khóa ${exam.year}.`,
        total: 0,
        added: 0,
        existing: 0,
      });
    }

    // 🚫 Lấy danh sách học sinh đã có trong kỳ thi
    const existingExamStudents = await ExamStudent.find({
      exam: examId,
      student: { $in: students.map((s) => s._id) },
    }).select("student").lean();

    const existingStudentIds = new Set(existingExamStudents.map((es) => String(es.student)));

    // 🔍 Lọc ra những học sinh chưa có trong kỳ thi
    const newStudents = students.filter(
      (s) => !existingStudentIds.has(String(s._id))
    );

    if (!newStudents.length) {
      return res.json({
        message: `Tất cả học sinh đã được thêm vào kỳ thi này (${existingExamStudents.length} học sinh).`,
        total: students.length,
        added: 0,
        existing: existingExamStudents.length,
      });
    }

    // ✅ Lọc bỏ học sinh chưa có lớp hoặc lớp không thuộc năm học hiện tại
    const studentsWithClass = newStudents.filter((s) => {
      return s.classId && s.classId._id && s.classId.year === exam.year;
    });
    if (studentsWithClass.length < newStudents.length) {
      const withoutClass = newStudents.length - studentsWithClass.length;
      console.warn(`⚠️ Có ${withoutClass} học sinh chưa được gán vào lớp hoặc lớp không thuộc năm học ${exam.year}, sẽ bỏ qua.`);
    }

    if (studentsWithClass.length === 0) {
      return res.json({
        message: `Tất cả học sinh đều chưa được gán vào lớp hoặc lớp không thuộc năm học ${exam.year}. Vui lòng gán lớp cho học sinh trước.`,
        total: students.length,
        added: 0,
        existing: existingExamStudents.length,
        skipped: students.length - existingExamStudents.length,
      });
    }

    // 🔢 Sinh SBD cho từng học sinh (theo khối)
    const startNumber = await ExamStudent.countDocuments({ exam: examId });
    const examStudents = studentsWithClass.map((s, i) => ({
      exam: examId,
      student: s._id,
      class: s.classId._id, // ✅ Lấy từ student.classId, đảm bảo không null
      grade: String(s.grade),
      sbd: `${String(s.grade)}${String(startNumber + i + 1).padStart(4, "0")}`,
      status: "active",
    }));

    await ExamStudent.insertMany(examStudents, { ordered: false });

    let message = `✅ Đã thêm ${examStudents.length} học sinh mới vào kỳ thi. Tổng cộng: ${existingExamStudents.length + examStudents.length} học sinh.`;
    if (studentsWithClass.length < newStudents.length) {
      message += ` (${newStudents.length - studentsWithClass.length} học sinh chưa có lớp đã bỏ qua)`;
    }

    res.json({
      message,
      total: students.length,
      added: examStudents.length,
      existing: existingExamStudents.length,
      withoutClass: newStudents.length - studentsWithClass.length, // ✅ Số học sinh chưa có lớp
      grades: targetGrades,
    });
  } catch (err) {
    console.error("❌ Lỗi addAllStudentsByGrades:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📊 THỐNG KÊ SỐ LƯỢNG HỌC SINH THEO KHỐI
========================================================= */
exports.countStudentsByGrade = async (req, res) => {
  try {
    const examId = req.params.examId;
    if (!mongoose.Types.ObjectId.isValid(examId))
      return res.status(400).json({ error: "ID kỳ thi không hợp lệ." });

    // ✅ Kiểm tra exam tồn tại và có year
    const exam = await Exam.findById(examId).select("year");
    if (!exam) {
      return res.status(404).json({ error: "Không tìm thấy kỳ thi." });
    }

    const stats = await ExamStudent.aggregate([
      { $match: { exam: new mongoose.Types.ObjectId(examId) } },
      { $group: { _id: "$grade", totalStudents: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // ✅ Format lại response để dễ sử dụng ở frontend
    const total = await ExamStudent.countDocuments({ exam: examId });
    const byGrade = {};
    stats.forEach((stat) => {
      byGrade[stat._id] = stat.totalStudents;
    });

    res.json({
      total,
      byGrade,
      examYear: exam.year,
      stats, // Giữ nguyên format cũ để tương thích
    });
  } catch (err) {
    console.error("❌ Lỗi countStudentsByGrade:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📥 IMPORT DANH SÁCH HỌC SINH TỪ EXCEL
========================================================= */
exports.importStudentsFromExcel = async (req, res) => {
  try {
    const { examId, grade } = req.body;
    if (!req.file)
      return res.status(400).json({ error: "Chưa tải file Excel." });

    const workbook = xlsx.readFile(req.file.path);
    const sheet = xlsx.utils.sheet_to_json(
      workbook.Sheets[workbook.SheetNames[0]]
    );
    if (!sheet.length)
      return res.status(400).json({ error: "File Excel trống." });

    const studentsData = [];
    for (const row of sheet) {
      const student = await Student.findOne({ studentCode: row.studentCode });
      if (!student) continue;
      const classObj = await Class.findOne({ name: row.className });
      if (!classObj) continue;

      studentsData.push({
        exam: examId,
        grade: grade || student.grade,
        student: student._id,
        class: classObj._id,
        sbd: `${grade}${String(studentsData.length + 1).padStart(4, "0")}`,
        status: "active",
      });
    }

    if (!studentsData.length)
      return res.status(400).json({ error: "Không có học sinh hợp lệ." });

    await ExamStudent.insertMany(studentsData);
    res.json({
      message: "✅ Import danh sách học sinh thành công.",
      total: studentsData.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
exports.deleteExamStudent = async (req, res) => {
  try {
    const deleted = await ExamStudent.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res
        .status(404)
        .json({ error: "Không tìm thấy học sinh để xóa." });

    res.json({ message: "🗑️ Đã xóa học sinh khỏi kỳ thi." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAvailableExams = async (req, res) => {
  try {
    // ✅ Lấy thông tin học sinh từ token hoặc query
    const student = req.user?.student || null;
    const grade = student?.grade || req.query.grade;

    if (!grade) {
      return res.status(400).json({ error: "Không xác định được khối của học sinh." });
    }

    // Lọc kỳ thi theo khối & trạng thái được phép
    const today = dayjs().startOf("day");

    const exams = await Exam.find({
      grades: grade,
      status: { $in: ["published", "locked"] },
      endDate: { $gte: today.toDate() }, // chỉ lấy kỳ thi chưa kết thúc
    })
      .select("name year semester type startDate endDate status grades")
      .sort({ startDate: 1 })
      .lean();

    res.json(exams);
  } catch (err) {
    console.error("❌ Lỗi getAvailableExams:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🗓️ LẤY LỊCH THI CỦA HỌC SINH TRONG KỲ THI
========================================================= */
exports.getExamScheduleForStudent = async (req, res) => {
  try {
    const { examId } = req.params;
    const student = req.user?.student || null;
    const grade = student?.grade || req.query.grade;

    if (!examId || !grade) {
      return res.status(400).json({ error: "Thiếu examId hoặc grade." });
    }

    const schedules = await ExamSchedule.find({
      exam: examId,
      grade: String(grade),
      isDeleted: { $ne: true } // ✅ Chỉ lấy lịch thi chưa bị xóa
    })
      .populate("subject", "name code")
      .sort({ date: 1, startTime: 1 })
      .lean();

    if (!schedules.length)
      return res.status(404).json({ error: "Không có lịch thi cho khối này." });

    res.json(schedules);
  } catch (err) {
    console.error("❌ Lỗi getExamScheduleForStudent:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   📄 XUẤT DANH SÁCH HỌC SINH THEO PHÒNG NHÓM (FixedExamRoom)
   - Xuất Excel danh sách học sinh trong các FixedExamRoom
========================================================= */
exports.exportStudentsByFixedRooms = async (req, res) => {
  try {
    const { examId, fixedRoomIds } = req.body;

    if (!examId) {
      return res.status(400).json({ error: "Thiếu examId." });
    }

    // ✅ Lấy thông tin kỳ thi
    const exam = await Exam.findById(examId).select("name year semester");
    if (!exam) {
      return res.status(404).json({ error: "Không tìm thấy kỳ thi." });
    }

    // ✅ Lấy FixedExamRoom
    const FixedExamRoom = require("../../models/exam/fixedExamRoom");
    let fixedRooms;
    
    if (fixedRoomIds && Array.isArray(fixedRoomIds) && fixedRoomIds.length > 0) {
      // ✅ Nếu có danh sách fixedRoomIds, chỉ lấy những phòng đó
      fixedRooms = await FixedExamRoom.find({
        _id: { $in: fixedRoomIds },
        exam: examId,
      }).sort({ grade: 1, code: 1 });
    } else {
      // ✅ Nếu không có, lấy tất cả FixedExamRoom của kỳ thi
      fixedRooms = await FixedExamRoom.find({
        exam: examId,
      }).sort({ grade: 1, code: 1 });
    }

    if (fixedRooms.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy phòng nhóm nào." });
    }

    // ✅ Lấy danh sách học sinh cho từng FixedExamRoom
    const workbook = xlsx.utils.book_new();

    for (const fixedRoom of fixedRooms) {
      // ✅ Lấy danh sách ExamStudent trong FixedExamRoom này
      const examStudents = await ExamStudent.find({
        exam: examId,
        room: fixedRoom._id,
      })
        .populate("student", "name studentCode gender")
        .populate("class", "className classCode")
        .sort({ "student.name": 1 })
        .lean();

      if (examStudents.length === 0) {
        continue; // Bỏ qua phòng không có học sinh
      }

      // ✅ Chuẩn bị dữ liệu cho Excel
      const sheetData = [
        // Header
        [
          "STT",
          "Mã HS",
          "Họ và tên",
          "Lớp",
          "Khối",
          "SBD",
          "Phòng nhóm",
          "Trạng thái",
        ],
      ];

      // ✅ Dữ liệu học sinh
      examStudents.forEach((es, index) => {
        const statusMap = {
          active: "Đăng ký",
          present: "Có mặt",
          absent: "Vắng",
          excluded: "Đình chỉ",
        };

        sheetData.push([
          index + 1,
          es.student?.studentCode || "",
          es.student?.name || "",
          es.class?.className || es.class?.name || "",
          es.grade || "",
          es.sbd || "",
          fixedRoom.code || "",
          statusMap[es.status] || es.status || "Đăng ký",
        ]);
      });

      // ✅ Tạo worksheet
      const worksheet = xlsx.utils.aoa_to_sheet(sheetData);

      // ✅ Đặt độ rộng cột
      worksheet["!cols"] = [
        { wch: 5 },  // STT
        { wch: 12 }, // Mã HS
        { wch: 25 }, // Họ và tên
        { wch: 10 }, // Lớp
        { wch: 6 },  // Khối
        { wch: 10 }, // SBD
        { wch: 12 }, // Phòng nhóm
        { wch: 12 }, // Trạng thái
      ];

      // ✅ Thêm worksheet vào workbook với tên sheet là mã phòng nhóm
      const sheetName = fixedRoom.code || `Phong_${fixedRoom._id.toString().slice(-4)}`;
      xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    // ✅ Tạo buffer Excel
    const excelBuffer = xlsx.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    // ✅ Tên file
    const fileName = `Danh_sach_hoc_sinh_phong_nhom_${exam.name || examId}_${Date.now()}.xlsx`;

    // ✅ Set headers để download file
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(fileName)}"`
    );

    res.send(excelBuffer);
  } catch (err) {
    console.error("❌ Lỗi exportStudentsByFixedRooms:", err);
    res.status(500).json({ error: "Lỗi khi xuất danh sách học sinh", details: err.message });
  }
};