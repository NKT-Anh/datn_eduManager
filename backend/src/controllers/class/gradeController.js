const Grade = require("../../models/class/grade");

// 📥 Lấy danh sách khối
exports.getGrades = async (req, res) => {
  try {
    const grades = await Grade.find().sort({ order: 1 });
    res.json(grades);
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi tải danh sách khối" });
  }
};

// ➕ Thêm khối mới
exports.createGrade = async (req, res) => {
  try {
    const { name, level, order = 1, description } = req.body;

    // ✅ Tự sinh mã khối
    const code = `GRADE${name.trim().toUpperCase()}`;

    // ✅ Kiểm tra trùng mã hoặc tên
    const exist = await Grade.findOne({ $or: [{ name }, { code }] });
    if (exist) {
      return res.status(400).json({ message: "Khối đã tồn tại!" });
    }

    const grade = await Grade.create({ name, code, level, order, description });
    res.status(201).json(grade);
  } catch (err) {
    res.status(400).json({
      message: "Không thể tạo khối",
      error: err.message,
    });
  }
};


// ✏️ Cập nhật khối
exports.updateGrade = async (req, res) => {
  try {
    const { name, level, order, description } = req.body;
    const grade = await Grade.findById(req.params.id);
    if (!grade) return res.status(404).json({ message: "Không tìm thấy khối" });

    grade.name = name;
    grade.level = level;
    grade.order = order;
    grade.description = description;
    await grade.save();

    res.json(grade);
  } catch (err) {
    res.status(400).json({ message: "Không thể cập nhật khối", error: err.message });
  }
};

// ❌ Xóa khối
exports.deleteGrade = async (req, res) => {
  try {
    await Grade.findByIdAndDelete(req.params.id);
    res.json({ message: "Đã xóa khối thành công" });
  } catch (err) {
    res.status(400).json({ message: "Không thể xóa khối" });
  }
};
