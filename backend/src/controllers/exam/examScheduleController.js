const {
  Exam,
  ExamSchedule,
  ExamRoom,
  ExamStudent,
  ExamGrade,
} = require("../../models/exam/examIndex");
const dayjs = require("dayjs");
const mongoose = require("mongoose");
const Subject = require("../../models/subject/subject");
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
        ? grade.map(Number).filter(n => !isNaN(n))
        : grade.split(",").map(g => Number(g.trim())).filter(n => !isNaN(n));
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

    const start = dayjs(date).hour(...startTime.split(":").map(Number));
    const end = start.add(Number(duration) || 90, "minute");
    const formattedStartTime = start.format("HH:mm");
    const endTime = end.format("HH:mm");

    const conflict = await checkScheduleConflict({
      exam,
      grade,
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
      grade,
      subject,
      date,
      startTime: formattedStartTime,
      endTime,
      duration: Number(duration) || 90,
      examType: examType || "midterm",
      notes,
    });

    res.status(201).json({ message: "Tạo lịch thi thành công.", data: schedule });
  } catch (err) {
    console.error("Lỗi tạo lịch thi:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   CẬP NHẬT LỊCH THI
========================================================= */
exports.updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { exam, grade, subject, date, startTime, duration, examType, notes } = req.body;

    if (!exam || !grade || !subject || !date || !startTime)
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc." });

    const start = dayjs(date).hour(...startTime.split(":").map(Number));
    const end = start.add(Number(duration) || 90, "minute");
    const formattedStartTime = start.format("HH:mm");
    const endTime = end.format("HH:mm");

    const conflict = await checkScheduleConflict({
      exam,
      grade,
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
        grade,
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
    const deleted = await ExamSchedule.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Không tìm thấy lịch thi." });
    res.json({ message: "Đã xóa lịch thi." });
  } catch (err) {
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
      query.grade = Number(grade); // ✅ ép kiểu số để Mongo lọc đúng
    }

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
    const schedule = await ExamSchedule.findById(req.params.id)
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
        const { examId, grade } = req.body;
        console.log("🔍 Auto generate request:", { examId, grade });

        // 🛑 Bước 1: Kiểm tra đầu vào cơ bản
        if (!examId || grade === undefined || grade === null)
            return res.status(400).json({ error: "Thiếu examId hoặc grade." });

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

        // --- Logic Xử lý Nhiều Khối (Đã được điều chỉnh theo yêu cầu) ---
        let targetGrades = [];
        const config = {
            startHour: 7, // 07:00 bắt đầu buổi sáng
            breakBetween: 30, // nghỉ 30 phút giữa 2 môn
            maxPerDay: 4, // tối đa 4 môn 1 ngày
        };

        if (Number(grade) === 0) {
            // **Tùy chỉnh: Thay đổi mảng này nếu bạn có các khối khác**
            targetGrades = [10, 11, 12];
            console.log("🔥 Chế độ 'Tất cả các khối' được kích hoạt:", targetGrades.join(", "));
        } else {
            targetGrades = [Number(grade)];
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
            const existing = await ExamSchedule.find({ exam: examId, grade: currentGrade })
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

            // ⚙️ Khởi tạo trạng thái cho khối hiện tại (ĐÚNG NHƯ LOGIC GỐC)
            const usedSlotsByDay = {}; // Trạng thái này là LOCAL cho từng khối
            const newSchedules = [];
            const conflicts = [];

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

                    // Nếu ngày này chưa đủ môn
                    if (usedSlotsByDay[dateKey].length < config.maxPerDay) {
                        // ⏰ Tính giờ bắt đầu môn tiếp theo
                        let slotStart;
                        if (usedSlotsByDay[dateKey].length === 0) {
                            // Môn đầu tiên trong ngày bắt đầu từ 07:30
                            slotStart = dayjs(curDate).hour(config.startHour).minute(30); 
                        } else {
                            // Bắt đầu sau môn trước + thời gian nghỉ
                            const last = usedSlotsByDay[dateKey][usedSlotsByDay[dateKey].length - 1];
                            slotStart = dayjs(curDate)
                                .hour(last.endHour)
                                .minute(last.endMinute)
                                .add(config.breakBetween, "minute");
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
                                examType: "midterm",
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
    const start = dayjs(normalizedDate).hour(...startTime.split(":").map(Number));
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