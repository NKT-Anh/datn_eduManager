const ClassPeriods = require("../../models/class/classPeriods");
const Class = require("../../models/class/class");
const Subject = require("../../models/subject/subject");
const Activity = require("../../models/subject/activity");
const mongoose = require("mongoose");
const xlsx = require("xlsx");

/**
 * GET /api/classPeriods
 * Lấy phân bổ số tiết theo lớp
 * Query params: year, semester, grade, classId
 */
exports.getClassPeriods = async (req, res) => {
  try {
    const { year, semester, grade, classId } = req.query;

    const filter = {};
    if (year) filter.year = year;
    if (semester) filter.semester = semester;
    if (grade) filter.grade = grade;
    if (classId) filter.classId = classId;

    const classPeriods = await ClassPeriods.find(filter)
      .populate("classId", "className classCode grade")
      .sort({ grade: 1, "classId.className": 1 });

    // Convert Map to Object for JSON response
    const result = classPeriods.map((cp) => {
      const subjectPeriodsObj = {};
      if (cp.subjectPeriods instanceof Map) {
        for (const [subjectId, periods] of cp.subjectPeriods.entries()) {
          subjectPeriodsObj[subjectId.toString()] = periods;
        }
      } else if (cp.subjectPeriods) {
        Object.assign(subjectPeriodsObj, cp.subjectPeriods);
      }

      const activityPeriodsObj = {};
      if (cp.activityPeriods instanceof Map) {
        for (const [activityId, periods] of cp.activityPeriods.entries()) {
          activityPeriodsObj[activityId.toString()] = periods;
        }
      } else if (cp.activityPeriods) {
        Object.assign(activityPeriodsObj, cp.activityPeriods);
      }

      return {
        _id: cp._id,
        year: cp.year,
        semester: cp.semester,
        grade: cp.grade,
        classId: cp.classId,
        subjectPeriods: subjectPeriodsObj,
        activityPeriods: activityPeriodsObj,
        createdAt: cp.createdAt,
        updatedAt: cp.updatedAt,
      };
    });

    res.json(result);
  } catch (error) {
    console.error("❌ Lỗi khi lấy phân bổ số tiết:", error);
    res.status(500).json({ message: "Không thể tải phân bổ số tiết", error: error.message });
  }
};

/**
 * POST /api/classPeriods
 * Tạo hoặc cập nhật phân bổ số tiết cho một lớp
 */
exports.upsertClassPeriods = async (req, res) => {
  try {
    const { year, semester, grade, classId, subjectPeriods, activityPeriods } = req.body;

    // ✅ Validate
    if (!year || !semester || !grade || !classId) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc: year, semester, grade, classId" });
    }

    if (!["1", "2"].includes(semester)) {
      return res.status(400).json({ message: "semester phải là '1' hoặc '2'" });
    }

    if (!["10", "11", "12"].includes(grade)) {
      return res.status(400).json({ message: "grade phải là '10', '11' hoặc '12'" });
    }

    // ✅ Validate classId
    const classExists = await Class.findById(classId);
    if (!classExists) {
      return res.status(404).json({ message: "Không tìm thấy lớp học" });
    }

    // ✅ Convert subjectPeriods từ Object sang Map
    const subjectPeriodsMap = new Map();
    if (subjectPeriods && typeof subjectPeriods === "object") {
      for (const [subjectId, periods] of Object.entries(subjectPeriods)) {
        if (mongoose.Types.ObjectId.isValid(subjectId)) {
          const periodsNum = typeof periods === "number" ? Math.max(0, periods) : 0;
          subjectPeriodsMap.set(subjectId, periodsNum);
        }
      }
    }

    // ✅ Convert activityPeriods từ Object sang Map
    const activityPeriodsMap = new Map();
    if (activityPeriods && typeof activityPeriods === "object") {
      for (const [activityId, periods] of Object.entries(activityPeriods)) {
        if (mongoose.Types.ObjectId.isValid(activityId)) {
          const periodsNum = typeof periods === "number" ? Math.max(0, periods) : 0;
          activityPeriodsMap.set(activityId, periodsNum);
        }
      }
    }

    // ✅ Tìm hoặc tạo mới
    const existing = await ClassPeriods.findOne({
      year,
      semester,
      grade,
      classId,
    });

    if (existing) {
      existing.subjectPeriods = subjectPeriodsMap;
      existing.activityPeriods = activityPeriodsMap;
      await existing.save();
      res.json({ message: "Đã cập nhật phân bổ số tiết", data: existing });
    } else {
      const newClassPeriods = await ClassPeriods.create({
        year,
        semester,
        grade,
        classId,
        subjectPeriods: subjectPeriodsMap,
        activityPeriods: activityPeriodsMap,
      });
      res.status(201).json({ message: "Đã tạo phân bổ số tiết", data: newClassPeriods });
    }
  } catch (error) {
    console.error("❌ Lỗi khi lưu phân bổ số tiết:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Phân bổ số tiết cho lớp này đã tồn tại" });
    }
    res.status(500).json({ message: "Không thể lưu phân bổ số tiết", error: error.message });
  }
};

/**
 * POST /api/classPeriods/bulk
 * Lưu phân bổ số tiết cho nhiều lớp cùng lúc
 */
exports.bulkUpsertClassPeriods = async (req, res) => {
  try {
    const { year, semester, grade, classPeriodsList } = req.body;

    if (!year || !semester || !grade || !Array.isArray(classPeriodsList)) {
      return res.status(400).json({
        message: "Thiếu thông tin: year, semester, grade, classPeriodsList (array)",
      });
    }

    const results = [];
    const errors = [];

    for (const item of classPeriodsList) {
      try {
        const { classId, subjectPeriods, activityPeriods } = item;

        if (!classId) {
          errors.push({ classId: "Thiếu classId" });
          continue;
        }

        // ✅ Convert to Map
        const subjectPeriodsMap = new Map();
        if (subjectPeriods && typeof subjectPeriods === "object") {
          for (const [subjectId, periods] of Object.entries(subjectPeriods)) {
            if (mongoose.Types.ObjectId.isValid(subjectId)) {
              subjectPeriodsMap.set(subjectId, Math.max(0, typeof periods === "number" ? periods : 0));
            }
          }
        }

        const activityPeriodsMap = new Map();
        if (activityPeriods && typeof activityPeriods === "object") {
          for (const [activityId, periods] of Object.entries(activityPeriods)) {
            if (mongoose.Types.ObjectId.isValid(activityId)) {
              activityPeriodsMap.set(activityId, Math.max(0, typeof periods === "number" ? periods : 0));
            }
          }
        }

        // ✅ Upsert
        const existing = await ClassPeriods.findOne({ year, semester, grade, classId });
        if (existing) {
          existing.subjectPeriods = subjectPeriodsMap;
          existing.activityPeriods = activityPeriodsMap;
          await existing.save();
          results.push({ classId, status: "updated" });
        } else {
          await ClassPeriods.create({
            year,
            semester,
            grade,
            classId,
            subjectPeriods: subjectPeriodsMap,
            activityPeriods: activityPeriodsMap,
          });
          results.push({ classId, status: "created" });
        }
      } catch (err) {
        errors.push({ classId: item.classId, error: err.message });
      }
    }

    res.json({
      message: `Đã xử lý ${results.length} lớp, ${errors.length} lỗi`,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("❌ Lỗi khi bulk upsert:", error);
    res.status(500).json({ message: "Không thể lưu phân bổ số tiết", error: error.message });
  }
};

/**
 * GET /api/classPeriods/:id
 * Lấy phân bổ số tiết theo ID
 */
exports.getClassPeriodsById = async (req, res) => {
  try {
    const { id } = req.params;
    const classPeriods = await ClassPeriods.findById(id).populate(
      "classId",
      "className classCode grade"
    );

    if (!classPeriods) {
      return res.status(404).json({ message: "Không tìm thấy phân bổ số tiết" });
    }

    // Convert Map to Object for JSON response
    const subjectPeriodsObj = {};
    if (classPeriods.subjectPeriods instanceof Map) {
      for (const [subjectId, periods] of classPeriods.subjectPeriods.entries()) {
        subjectPeriodsObj[subjectId.toString()] = periods;
      }
    } else if (classPeriods.subjectPeriods) {
      Object.assign(subjectPeriodsObj, classPeriods.subjectPeriods);
    }

    const activityPeriodsObj = {};
    if (classPeriods.activityPeriods instanceof Map) {
      for (const [activityId, periods] of classPeriods.activityPeriods.entries()) {
        activityPeriodsObj[activityId.toString()] = periods;
      }
    } else if (classPeriods.activityPeriods) {
      Object.assign(activityPeriodsObj, classPeriods.activityPeriods);
    }

    res.json({
      _id: classPeriods._id,
      year: classPeriods.year,
      semester: classPeriods.semester,
      grade: classPeriods.grade,
      classId: classPeriods.classId,
      subjectPeriods: subjectPeriodsObj,
      activityPeriods: activityPeriodsObj,
      createdAt: classPeriods.createdAt,
      updatedAt: classPeriods.updatedAt,
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy phân bổ số tiết:", error);
    res.status(500).json({ message: "Không thể tải phân bổ số tiết", error: error.message });
  }
};

/**
 * PUT /api/classPeriods/:id
 * Cập nhật phân bổ số tiết theo ID
 */
exports.updateClassPeriodsById = async (req, res) => {
  try {
    const { id } = req.params;
    const { subjectPeriods, activityPeriods } = req.body;

    const classPeriods = await ClassPeriods.findById(id);
    if (!classPeriods) {
      return res.status(404).json({ message: "Không tìm thấy phân bổ số tiết" });
    }

    // ✅ Convert subjectPeriods từ Object sang Map
    if (subjectPeriods !== undefined) {
      const subjectPeriodsMap = new Map();
      if (subjectPeriods && typeof subjectPeriods === "object") {
        for (const [subjectId, periods] of Object.entries(subjectPeriods)) {
          if (mongoose.Types.ObjectId.isValid(subjectId)) {
            const periodsNum = typeof periods === "number" ? Math.max(0, periods) : 0;
            subjectPeriodsMap.set(subjectId, periodsNum);
          }
        }
      }
      classPeriods.subjectPeriods = subjectPeriodsMap;
    }

    // ✅ Convert activityPeriods từ Object sang Map
    if (activityPeriods !== undefined) {
      const activityPeriodsMap = new Map();
      if (activityPeriods && typeof activityPeriods === "object") {
        for (const [activityId, periods] of Object.entries(activityPeriods)) {
          if (mongoose.Types.ObjectId.isValid(activityId)) {
            const periodsNum = typeof periods === "number" ? Math.max(0, periods) : 0;
            activityPeriodsMap.set(activityId, periodsNum);
          }
        }
      }
      classPeriods.activityPeriods = activityPeriodsMap;
    }

    await classPeriods.save();
    res.json({ message: "Đã cập nhật phân bổ số tiết", data: classPeriods });
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật phân bổ số tiết:", error);
    res.status(500).json({ message: "Không thể cập nhật phân bổ số tiết", error: error.message });
  }
};

/**
 * DELETE /api/classPeriods/:id
 * Xóa phân bổ số tiết
 */
exports.deleteClassPeriods = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ClassPeriods.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy phân bổ số tiết" });
    }
    res.json({ message: "Đã xóa phân bổ số tiết" });
  } catch (error) {
    console.error("❌ Lỗi khi xóa phân bổ số tiết:", error);
    res.status(500).json({ message: "Không thể xóa phân bổ số tiết", error: error.message });
  }
};

/**
 * GET /api/classPeriods/export/excel
 * Xuất file Excel phân bổ số tiết theo lớp với 3 tab cho 3 khối
 * Query params: year, semester
 */
exports.exportClassPeriodsToExcel = async (req, res) => {
  try {
    const { year, semester } = req.query;

    if (!year || !semester) {
      return res.status(400).json({ 
        message: "Thiếu thông tin: year và semester là bắt buộc" 
      });
    }

    // ✅ Lấy tất cả môn học và hoạt động để làm header
    const [allSubjects, allActivities] = await Promise.all([
      Subject.find({ isActive: { $ne: false } }).sort({ name: 1 }).lean(),
      Activity.find({ isActive: { $ne: false } }).sort({ name: 1 }).lean(),
    ]);

    // ✅ Tạo workbook mới
    const workbook = xlsx.utils.book_new();

    // ✅ Xử lý từng khối (10, 11, 12)
    for (const grade of ["10", "11", "12"]) {
      // ✅ Lấy tất cả lớp của khối này trong năm học
      const allClasses = await Class.find({
        year,
        grade,
      })
        .sort({ className: 1 })
        .lean();

      // ✅ Lấy tất cả ClassPeriods cho khối này
      const classPeriodsData = await ClassPeriods.find({
        year,
        semester,
        grade,
      })
        .populate("classId", "className classCode grade")
        .lean();

      // ✅ Tạo map để tra cứu nhanh ClassPeriods theo classId
      const classPeriodsMap = new Map();
      classPeriodsData.forEach(cp => {
        const classId = cp.classId?._id?.toString() || cp.classId?.toString();
        if (classId) {
          classPeriodsMap.set(classId, cp);
        }
      });

      if (allClasses.length === 0) {
        // Tạo sheet trống nếu không có lớp nào
        const emptyData = [["Khối " + grade, "Năm học: " + year, "Học kỳ: " + semester]];
        emptyData.push([]);
        emptyData.push(["Không có lớp nào cho khối này"]);
        const ws = xlsx.utils.aoa_to_sheet(emptyData);
        xlsx.utils.book_append_sheet(workbook, ws, `Khối ${grade}`);
        continue;
      }

      // ✅ Tạo header
      const headers = ["STT", "Lớp", "Mã lớp", "Năm học", "Học kỳ"];
      
      // Thêm cột cho từng môn học
      allSubjects.forEach(subj => {
        if (subj.grades && subj.grades.includes(grade)) {
          headers.push(subj.name || subj.code || "Môn học");
        }
      });

      // Thêm cột cho từng hoạt động
      allActivities.forEach(act => {
        if (act.grades && act.grades.includes(grade)) {
          headers.push(act.name || "Hoạt động");
        }
      });

      // ✅ Tạo dữ liệu cho sheet - Hiển thị TẤT CẢ lớp, kể cả chưa có phân bổ
      const rows = [headers];

      allClasses.forEach((cls, index) => {
        const classId = cls._id.toString();
        const cp = classPeriodsMap.get(classId); // Lấy ClassPeriods nếu có

        const row = [
          index + 1,
          cls.className || "",
          cls.classCode || "",
          year,
          `Học kỳ ${semester}`,
        ];

        // Thêm số tiết cho từng môn học
        allSubjects.forEach(subj => {
          if (subj.grades && subj.grades.includes(grade)) {
            const subjectId = subj._id.toString();
            let periods = 0;
            
            if (cp && cp.subjectPeriods) {
              if (cp.subjectPeriods instanceof Map) {
                periods = cp.subjectPeriods.get(subjectId) || 0;
              } else if (typeof cp.subjectPeriods === 'object') {
                periods = cp.subjectPeriods[subjectId] || 0;
              }
            }
            
            row.push(periods);
          }
        });

        // Thêm số tiết cho từng hoạt động
        allActivities.forEach(act => {
          if (act.grades && act.grades.includes(grade)) {
            const activityId = act._id.toString();
            let periods = 0;
            
            if (cp && cp.activityPeriods) {
              if (cp.activityPeriods instanceof Map) {
                periods = cp.activityPeriods.get(activityId) || 0;
              } else if (typeof cp.activityPeriods === 'object') {
                periods = cp.activityPeriods[activityId] || 0;
              }
            }
            
            row.push(periods);
          }
        });

        rows.push(row);
      });

      // ✅ Tạo worksheet
      const ws = xlsx.utils.aoa_to_sheet(rows);

      // ✅ Đặt độ rộng cột
      const colWidths = [
        { wch: 5 },  // STT
        { wch: 15 }, // Lớp
        { wch: 12 }, // Mã lớp
        { wch: 12 }, // Năm học
        { wch: 10 }, // Học kỳ
      ];
      
      // Độ rộng cho các cột môn học và hoạt động
      for (let i = 0; i < headers.length - 5; i++) {
        colWidths.push({ wch: 10 });
      }
      
      ws["!cols"] = colWidths;

      // ✅ Thêm sheet vào workbook
      xlsx.utils.book_append_sheet(workbook, ws, `Khối ${grade}`);
    }

    // ✅ Tạo buffer và gửi response
    const buffer = xlsx.write(workbook, { 
      type: "buffer", 
      bookType: "xlsx" 
    });

    const fileName = `Phan_bo_so_tiet_${year}_HK${semester}_${Date.now()}.xlsx`;

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(fileName)}"`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);

  } catch (error) {
    console.error("❌ Lỗi khi xuất Excel phân bổ số tiết:", error);
    res.status(500).json({ 
      message: "Không thể xuất file Excel", 
      error: error.message 
    });
  }
};

/**
 * GET /api/classPeriods/calculate-teachers
 * Tính số giáo viên tự động dựa trên ClassPeriods
 * Query params: year, weeklyLessons (mặc định 19)
 * 
 * Logic:
 * 1. Lấy tất cả ClassPeriods của năm học (cả 2 học kỳ)
 * 2. Tính tổng số tiết cho từng môn học (tổng 3 khối, tất cả lớp)
 * 3. Số giáo viên cần cho môn X = ceil(tổng tiết môn X ÷ weeklyLessons)
 * 4. Chỉ tính môn học, không tính hoạt động
 */
exports.calculateRequiredTeachers = async (req, res) => {
  try {
    const { 
      year, 
      weeklyLessons = 17, // ✅ Mặc định 17 tiết/tuần theo quy tắc THPT
      homeroomReduction = 3,  // Số tiết trừ cho GVCN (mặc định 3)
      departmentHeadReduction = 3  // Số tiết trừ cho Tổ trưởng (mặc định 3)
    } = req.query;

    if (!year) {
      return res.status(400).json({ 
        message: "Thiếu thông tin: year là bắt buộc" 
      });
    }

    const weeklyLessonsNum = parseInt(weeklyLessons, 10);
    if (isNaN(weeklyLessonsNum) || weeklyLessonsNum <= 0) {
      return res.status(400).json({ 
        message: "weeklyLessons phải là số nguyên dương" 
      });
    }

    const homeroomReductionNum = parseInt(homeroomReduction, 10);
    if (isNaN(homeroomReductionNum) || homeroomReductionNum < 0) {
      return res.status(400).json({ 
        message: "homeroomReduction phải là số nguyên >= 0" 
      });
    }

    const departmentHeadReductionNum = parseInt(departmentHeadReduction, 10);
    if (isNaN(departmentHeadReductionNum) || departmentHeadReductionNum < 0) {
      return res.status(400).json({ 
        message: "departmentHeadReduction phải là số nguyên >= 0" 
      });
    }

    console.log(`📊 Tính số giáo viên cần cho năm học ${year}, weeklyLessons = ${weeklyLessonsNum}`);

    // ✅ Lấy tất cả ClassPeriods của năm học (cả 2 học kỳ)
    const classPeriods = await ClassPeriods.find({
      year,
      semester: { $in: ["1", "2"] },
    })
      .populate("classId", "className classCode grade")
      .lean();

    console.log(`📋 Tìm thấy ${classPeriods.length} bản ghi ClassPeriods`);

    // ✅ Lấy tất cả môn học để map tên
    const allSubjects = await Subject.find({ isActive: { $ne: false } })
      .select("_id name code grades")
      .lean();

    const subjectMap = new Map();
    allSubjects.forEach(subj => {
      subjectMap.set(subj._id.toString(), subj);
    });

    // ✅ Tính tổng số tiết cho từng môn học
    // Map: subjectId -> tổng số tiết
    const subjectPeriodsTotal = new Map();

    classPeriods.forEach(cp => {
      if (!cp.subjectPeriods) return;

      // Xử lý subjectPeriods (có thể là Map hoặc Object)
      let subjectPeriodsObj = {};
      if (cp.subjectPeriods instanceof Map) {
        for (const [subjectId, periods] of cp.subjectPeriods.entries()) {
          subjectPeriodsObj[subjectId] = periods;
        }
      } else if (typeof cp.subjectPeriods === 'object') {
        subjectPeriodsObj = cp.subjectPeriods;
      }

      // Cộng dồn số tiết cho từng môn
      Object.entries(subjectPeriodsObj).forEach(([subjectId, periods]) => {
        if (typeof periods === 'number' && periods > 0) {
          const currentTotal = subjectPeriodsTotal.get(subjectId) || 0;
          subjectPeriodsTotal.set(subjectId, currentTotal + periods);
        }
      });
    });

    console.log(`📚 Tìm thấy ${subjectPeriodsTotal.size} môn học có phân bổ số tiết`);

    // ✅ Hàm xác định số tiết/lớp/tuần cho môn học (từ ClassPeriods hoặc mặc định)
    const getPeriodsPerClassPerWeek = (subjectId, subject, classPeriods) => {
      // Tính số lớp có môn này và tổng số tiết
      let totalPeriods = 0;
      let classCount = 0;
      
      classPeriods.forEach(cp => {
        if (!cp.subjectPeriods) return;
        
        let subjectPeriodsObj = {};
        if (cp.subjectPeriods instanceof Map) {
          for (const [sid, periods] of cp.subjectPeriods.entries()) {
            subjectPeriodsObj[sid] = periods;
          }
        } else if (typeof cp.subjectPeriods === 'object') {
          subjectPeriodsObj = cp.subjectPeriods;
        }
        
        const periods = subjectPeriodsObj[subjectId];
        if (typeof periods === 'number' && periods > 0) {
          totalPeriods += periods;
          classCount++;
        }
      });
      
      // Nếu có dữ liệu từ ClassPeriods, tính trung bình
      if (classCount > 0) {
        return Math.round((totalPeriods / classCount) * 10) / 10; // Làm tròn 1 chữ số thập phân
      }
      
      // Fallback: Dùng mặc định theo tên môn
      const subjectName = (subject.name || "").toLowerCase();
      const subjectCode = (subject.code || "").toLowerCase();
      
      if (subjectName.includes("toán") || subjectCode.includes("toan") || subjectCode.includes("math")) {
        return 6;
      }
      if (subjectName.includes("văn") || subjectName.includes("van") || subjectCode.includes("van") || subjectCode.includes("lit")) {
        return 5;
      }
      if (subjectName.includes("tiếng anh") || subjectName.includes("tieng anh") || subjectCode.includes("ta") || subjectCode.includes("eng")) {
        return 4;
      }
      if (subjectName.includes("thể dục") || subjectName.includes("the duc") || subjectCode.includes("td") || subjectCode.includes("pe")) {
        return 2;
      }
      
      // Mặc định: 3 tiết/lớp/tuần
      return 3;
    };

    // ✅ Hàm xác định max lớp 1 GV có thể dạy cho môn học
    // Logic: Môn ít tiết/lớp → có thể dạy nhiều lớp hơn
    // Công thức: max lớp = floor(17 tiết/tuần ÷ số tiết/lớp/tuần)
    const getMaxClassesPerTeacher = (subject, periodsPerClassPerWeek) => {
      // Nếu đã có số tiết/lớp/tuần, tính theo công thức
      if (periodsPerClassPerWeek > 0) {
        // Max lớp = floor(17 / số tiết/lớp)
        // Đảm bảo tối thiểu 2 lớp, tối đa 8 lớp
        const calculatedMax = Math.floor(17 / periodsPerClassPerWeek);
        return Math.max(2, Math.min(8, calculatedMax));
      }
      
      // Fallback: Dùng mặc định theo tên môn
      const subjectName = (subject.name || "").toLowerCase();
      const subjectCode = (subject.code || "").toLowerCase();
      
      // Toán: 6 tiết/lớp → floor(17/6) = 2, nhưng cho phép 3-4 lớp
      if (subjectName.includes("toán") || subjectCode.includes("toan") || subjectCode.includes("math")) {
        return 4; // Toán: 3-4 lớp
      }
      // Văn: 5 tiết/lớp → floor(17/5) = 3, nhưng cho phép 3-4 lớp
      if (subjectName.includes("văn") || subjectName.includes("van") || subjectCode.includes("van") || subjectCode.includes("lit")) {
        return 4; // Văn: 3-4 lớp
      }
      // Tiếng Anh: 4 tiết/lớp → floor(17/4) = 4, cho phép 4-5 lớp
      if (subjectName.includes("tiếng anh") || subjectName.includes("tieng anh") || subjectCode.includes("ta") || subjectCode.includes("eng")) {
        return 5; // Tiếng Anh: 4-5 lớp
      }
      // Thể dục: 2 tiết/lớp → floor(17/2) = 8 lớp
      if (subjectName.includes("thể dục") || subjectName.includes("the duc") || subjectCode.includes("td") || subjectCode.includes("pe")) {
        return 8; // Thể dục: 8 lớp
      }
      
      // Mặc định: 4 lớp
      return 4;
    };

    // ✅ Tính số giáo viên cần cho từng môn
    const results = [];
    let totalTeachersNeeded = 0;

    for (const [subjectId, totalPeriods] of subjectPeriodsTotal.entries()) {
      const subject = subjectMap.get(subjectId);
      if (!subject) continue; // Bỏ qua nếu không tìm thấy môn học

      // ✅ Tính số tiết/lớp/tuần (từ ClassPeriods hoặc mặc định)
      const periodsPerClassPerWeek = getPeriodsPerClassPerWeek(subjectId, subject, classPeriods);
      
      // ✅ Tính số lớp có môn này
      let classCount = 0;
      classPeriods.forEach(cp => {
        if (!cp.subjectPeriods) return;
        let subjectPeriodsObj = {};
        if (cp.subjectPeriods instanceof Map) {
          for (const [sid, periods] of cp.subjectPeriods.entries()) {
            subjectPeriodsObj[sid] = periods;
          }
        } else if (typeof cp.subjectPeriods === 'object') {
          subjectPeriodsObj = cp.subjectPeriods;
        }
        if (typeof subjectPeriodsObj[subjectId] === 'number' && subjectPeriodsObj[subjectId] > 0) {
          classCount++;
        }
      });
      
      // ✅ Xác định max lớp 1 GV có thể dạy (dựa trên số tiết/lớp/tuần)
      const maxClassesPerTeacher = getMaxClassesPerTeacher(subject, periodsPerClassPerWeek);
      
      // ✅ Tính số giáo viên cần theo 2 cách:
      // 1. Dựa trên weeklyLessons (17 tiết/tuần cho GV bộ môn)
      const weeklyLessonsForSubject = 17; // GV bộ môn: 17 tiết/tuần
      const teachersByWeeklyLessons = Math.ceil(totalPeriods / weeklyLessonsForSubject);
      
      // 2. Dựa trên max lớp (nếu có cấu hình)
      const teachersByMaxClasses = maxClassesPerTeacher > 0 
        ? Math.ceil(classCount / maxClassesPerTeacher)
        : teachersByWeeklyLessons;
      
      // ✅ Lấy giá trị lớn hơn để đảm bảo đủ giáo viên
      const teachersNeeded = Math.max(teachersByWeeklyLessons, teachersByMaxClasses);
      totalTeachersNeeded += teachersNeeded;

      results.push({
        subjectId,
        subjectName: subject.name || subject.code || "Môn học",
        subjectCode: subject.code || "",
        totalPeriods,
        periodsPerClassPerWeek,
        classCount,
        maxClassesPerTeacher,
        weeklyLessons: weeklyLessonsForSubject,
        teachersByWeeklyLessons,
        teachersByMaxClasses,
        teachersNeeded,
        note: maxClassesPerTeacher > 0 
          ? `Max ${maxClassesPerTeacher} lớp/GV` 
          : "Dùng weeklyLessons",
      });
    }

    // ✅ Sắp xếp theo tên môn học
    results.sort((a, b) => (a.subjectName || "").localeCompare(b.subjectName || ""));

    // ✅ Tính số giáo viên chủ nhiệm, tổ trưởng (ước tính)
    // Lấy số lớp trong năm học
    const allClasses = await Class.find({ year }).lean();
    const totalClasses = allClasses.length;
    
    // Ước tính số giáo viên chủ nhiệm = số lớp (mỗi lớp 1 GVCN)
    const homeroomTeachersNeeded = totalClasses;
    
    // Ước tính số tổ trưởng (giả định mỗi tổ bộ môn có 1 tổ trưởng)
    // Lấy số tổ bộ môn từ Department
    const Department = require("../../models/subject/department");
    const departments = await Department.find().lean();
    const departmentHeadsNeeded = departments.length;

    console.log(`✅ Tổng số giáo viên cần: ${totalTeachersNeeded}`);
    console.log(`✅ Số giáo viên chủ nhiệm cần: ${homeroomTeachersNeeded}`);
    console.log(`✅ Số tổ trưởng cần: ${departmentHeadsNeeded}`);

    res.json({
      year,
      weeklyLessons: weeklyLessonsNum,
      totalTeachersNeeded,
      subjects: results,
      roles: {
        homeroomTeachers: {
          count: homeroomTeachersNeeded,
          weeklyLessons: 17 - homeroomReductionNum, // GVCN: 17 - số tiết trừ
          reduction: homeroomReductionNum,
          note: `Giảm ${homeroomReductionNum} tiết/tuần so với GV bộ môn`,
        },
        departmentHeads: {
          count: departmentHeadsNeeded,
          weeklyLessons: 17 - departmentHeadReductionNum, // Tổ trưởng: 17 - số tiết trừ
          reduction: departmentHeadReductionNum,
          note: `Giảm ${departmentHeadReductionNum} tiết/tuần so với GV bộ môn`,
        },
      },
      summary: {
        totalSubjects: results.length,
        totalPeriods: Array.from(subjectPeriodsTotal.values()).reduce((sum, p) => sum + p, 0),
        averageTeachersPerSubject: results.length > 0 
          ? (totalTeachersNeeded / results.length).toFixed(2) 
          : 0,
        totalClasses: totalClasses,
        regulations: {
          "GV bộ môn": "17 tiết/tuần",
          "GV Thể dục": "17 tiết/tuần",
          "GV Quốc phòng - An ninh": "17 tiết/tuần",
          "GV chủ nhiệm": `${17 - homeroomReductionNum} tiết/tuần (giảm ${homeroomReductionNum} tiết)`,
          "Tổ trưởng": `${17 - departmentHeadReductionNum} tiết/tuần (giảm ${departmentHeadReductionNum} tiết)`,
        },
        reductions: {
          homeroomReduction: homeroomReductionNum,
          departmentHeadReduction: departmentHeadReductionNum,
        },
      },
    });

  } catch (error) {
    console.error("❌ Lỗi khi tính số giáo viên:", error);
    res.status(500).json({ 
      message: "Không thể tính số giáo viên", 
      error: error.message 
    });
  }
};

