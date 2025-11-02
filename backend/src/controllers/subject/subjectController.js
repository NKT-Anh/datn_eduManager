const Subject = require('../../models/subject/subject');

// GET all
exports.getSubjects = async (req, res) => {
  try {
    const { grade } = req.query;
    const query = grade ? { grades: grade } : {};
    const subjects = await Subject.find(query);
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET by id
exports.getSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ error: "Subject not found" });
    res.json(subject);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// CREATE
exports.createSubject = async (req, res) => {
  try {
    const { name, code, grades, description } = req.body;

    if (!name || !grades || !Array.isArray(grades) || grades.length === 0) {
      return res.status(400).json({ error: "Name and at least one grade are required" });
    }
    const normalizeGrades = [...new Set(grades.map(String))].sort((a,b) => a-b)
    const newSubject = new Subject({ name, code, grades:normalizeGrades, description });
    const saved = await newSubject.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// UPDATE
exports.updateSubject = async (req, res) => {
  try {
    const { name, code, grades, description } = req.body;
    let normalizeGrades;
    if(grades && Array.isArray(grades)){
      normalizeGrades = [...Set(grades.map(String))].sort((a,b) => a-b);
    }
    const updated = await Subject.findByIdAndUpdate(
      req.params.id,
      { name, code, grades:normalizeGrades, description },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ error: "Subject not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE
exports.deleteSubject = async (req, res) => {
  try {
    const deleted = await Subject.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Subject not found" });
    res.json({ message: "Subject deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// controllers/subject/subjectController.js
exports.updateIncludeInAverage = async (req, res) => {
  try {
    const { id } = req.params;
    const { includeInAverage } = req.body;

    // 🧩 Kiểm tra kiểu dữ liệu
    if (typeof includeInAverage !== 'boolean') {
      return res.status(400).json({ message: "Trường 'includeInAverage' phải là kiểu boolean (true/false)" });
    }

    // 🛠 Cập nhật môn học
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

