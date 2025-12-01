// const Subject = require('../../models/subject/subject');

// // GET all
// exports.getSubjects = async (req, res) => {
//   try {
//     const { grade } = req.query;
//     const query = grade ? { grades: grade } : {};
//     const subjects = await Subject.find(query);
//     res.json(subjects);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // GET by id
// exports.getSubject = async (req, res) => {
//   try {
//     const subject = await Subject.findById(req.params.id);
//     if (!subject) return res.status(404).json({ error: "Subject not found" });
//     res.json(subject);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // CREATE
// exports.createSubject = async (req, res) => {
//   try {
//     const { name, code, grades, description } = req.body;

//     if (!name || !grades || !Array.isArray(grades) || grades.length === 0) {
//       return res.status(400).json({ error: "Name and at least one grade are required" });
//     }
//     const normalizeGrades = [...new Set(grades.map(String))].sort((a,b) => a-b)
//     const newSubject = new Subject({ name, code, grades:normalizeGrades, description });
//     const saved = await newSubject.save();
//     res.status(201).json(saved);
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// };

// // UPDATE
// exports.updateSubject = async (req, res) => {
//   try {
//     const { name, code, grades, description } = req.body;
//     let normalizeGrades;
//     if(grades && Array.isArray(grades)){
//       normalizeGrades = [...Set(grades.map(String))].sort((a,b) => a-b);
//     }
//     const updated = await Subject.findByIdAndUpdate(
//       req.params.id,
//       { name, code, grades:normalizeGrades, description },
//       { new: true, runValidators: true }
//     );

//     if (!updated) return res.status(404).json({ error: "Subject not found" });
//     res.json(updated);
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// };

// // DELETE
// exports.deleteSubject = async (req, res) => {
//   try {
//     const deleted = await Subject.findByIdAndDelete(req.params.id);
//     if (!deleted) return res.status(404).json({ error: "Subject not found" });
//     res.json({ message: "Subject deleted" });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // controllers/subject/subjectController.js
// exports.updateIncludeInAverage = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { includeInAverage } = req.body;

//     // 🧩 Kiểm tra kiểu dữ liệu
//     if (typeof includeInAverage !== 'boolean') {
//       return res.status(400).json({ message: "Trường 'includeInAverage' phải là kiểu boolean (true/false)" });
//     }

//     // 🛠 Cập nhật môn học
//     const updatedSubject = await Subject.findByIdAndUpdate(
//       id,
//       { includeInAverage },
//       { new: true, runValidators: true }
//     );

//     if (!updatedSubject) {
//       return res.status(404).json({ message: "Không tìm thấy môn học" });
//     }

//     return res.status(200).json({
//       message: "Cập nhật cấu hình tính điểm trung bình thành công",
//       subject: updatedSubject,
//     });
//   } catch (err) {
//     console.error("❌ Lỗi updateIncludeInAverage:", err);
//     return res.status(500).json({ message: "Lỗi máy chủ khi cập nhật môn học" });
//   }
// };

const Subject = require('../../models/subject/subject');

/* =========================================================
   📋 LẤY DANH SÁCH MÔN HỌC
========================================================= */
exports.getSubjects = async (req, res) => {
  try {
    const { grade } = req.query;
    const query = grade ? { grades: grade } : {};

    // ✅ Soft Delete: Filter isDeleted != true mặc định (bao gồm false, null, không có trường)
    const { isDeleted = 'false' } = req.query;
    if (isDeleted !== 'true') {
      query.isDeleted = { $ne: true };
    }

    const subjects = await Subject.find(query);
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   🔍 LẤY THEO ID
========================================================= */
exports.getSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ error: "Subject not found" });
    res.json(subject);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   ➕ TẠO MỚI MÔN HỌC
========================================================= */
exports.createSubject = async (req, res) => {
  try {
    const { name, code, grades, description, includeInAverage, defaultExamDuration, isActive } = req.body;

    if (!name || !grades || !Array.isArray(grades) || grades.length === 0) {
      return res.status(400).json({ error: "Name and at least one grade are required" });
    }

    // 🧩 Chuẩn hóa mảng khối
    const normalizeGrades = [...new Set(grades.map(String))].sort((a, b) => a.localeCompare(b));

    // 🧩 Tạo subject mới
    const newSubject = new Subject({
      name,
      code,
      grades: normalizeGrades,
      description,
      includeInAverage,
      defaultExamDuration,
      isActive: isActive !== undefined ? isActive : true // ✅ Mặc định là true
    });

    const saved = await newSubject.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/* =========================================================
   ✏️ CẬP NHẬT MÔN HỌC
========================================================= */
exports.updateSubject = async (req, res) => {
  try {
    const { name, code, grades, description, includeInAverage, defaultExamDuration, isActive } = req.body;
    let normalizeGrades;

    if (grades && Array.isArray(grades)) {
      // ⚠️ Lỗi cũ: thiếu "new" trước Set
      normalizeGrades = [...new Set(grades.map(String))].sort((a, b) => a.localeCompare(b));
    }

    const updateData = {
      name,
      code,
      grades: normalizeGrades,
      description,
      includeInAverage,
      defaultExamDuration
    };

    // ✅ Chỉ cập nhật isActive nếu có trong request
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const updated = await Subject.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ error: "Subject not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/* =========================================================
   🗑️ XÓA MÔN HỌC
========================================================= */
// ✅ Soft Delete - Xóa mềm môn học (chỉ đánh dấu, không xóa thật)
exports.deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const subject = await Subject.findById(id);
    
    if (!subject) {
      return res.status(404).json({ error: "Không tìm thấy môn học" });
    }

    // ✅ Đánh dấu isDeleted = true (soft delete)
    subject.isDeleted = true;
    await subject.save();

    res.json({ 
      message: "Đã xóa môn học thành công (soft delete)",
      subject: subject
    });
  } catch (err) {
    console.error('❌ Lỗi khi xóa môn học:', err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   ⚙️ CẬP NHẬT includeInAverage (tính vào TB)
========================================================= */
exports.updateIncludeInAverage = async (req, res) => {
  try {
    const { id } = req.params;
    const { includeInAverage } = req.body;

    if (typeof includeInAverage !== "boolean") {
      return res.status(400).json({ message: "Trường 'includeInAverage' phải là kiểu boolean (true/false)" });
    }

    const updatedSubject = await Subject.findByIdAndUpdate(
      id,
      { includeInAverage },
      { new: true, runValidators: true }
    );

    if (!updatedSubject) {
      return res.status(404).json({ message: "Không tìm thấy môn học" });
    }

    return res.status(200).json({
      message: "Cập nhật cấu hình tính điểm trung bình thành công",
      subject: updatedSubject,
    });
  } catch (err) {
    console.error("❌ Lỗi updateIncludeInAverage:", err);
    return res.status(500).json({ message: "Lỗi máy chủ khi cập nhật môn học" });
  }
};
exports.updateDefaultExamDuration = async (req, res) => {
  try {
    const { id } = req.params;
    const { defaultExamDuration } = req.body;

    if (
      typeof defaultExamDuration !== "number" ||
      isNaN(defaultExamDuration) ||
      defaultExamDuration < 15 ||
      defaultExamDuration > 300
    ) {
      return res
        .status(400)
        .json({ message: "Thời lượng thi phải là số từ 15–300 phút" });
    }

    const subject = await Subject.findByIdAndUpdate(
      id,
      { defaultExamDuration },
      { new: true, runValidators: true }
    );

    if (!subject)
      return res.status(404).json({ message: "Không tìm thấy môn học" });

    res.json({ message: "Cập nhật thành công", subject });
  } catch (err) {
    console.error("❌ updateDefaultExamDuration error:", err);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
};
