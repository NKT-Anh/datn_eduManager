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

// 🔄 Khởi tạo các khối cố định (Khối 10, 11, 12)
exports.initDefaultGrades = async (req, res) => {
  try {
    const defaultGrades = [
      {
        name: '10',
        code: 'GRADE10',
        level: 'high',
        order: 1,
        description: 'Khối 10'
      },
      {
        name: '11',
        code: 'GRADE11',
        level: 'high',
        order: 2,
        description: 'Khối 11'
      },
      {
        name: '12',
        code: 'GRADE12',
        level: 'high',
        order: 3,
        description: 'Khối 12'
      }
    ];

    let created = 0;
    let skipped = 0;
    const results = [];

    for (const gradeData of defaultGrades) {
      // Kiểm tra xem khối đã tồn tại chưa
      const existing = await Grade.findOne({ 
        $or: [
          { name: gradeData.name }, 
          { code: gradeData.code }
        ] 
      });

      if (existing) {
        results.push({
          name: gradeData.name,
          status: 'skipped',
          message: 'Đã tồn tại'
        });
        skipped++;
      } else {
        const grade = await Grade.create(gradeData);
        results.push({
          name: grade.name,
          status: 'created',
          message: 'Đã tạo thành công',
          data: grade
        });
        created++;
      }
    }

    res.json({
      success: true,
      message: `Đã khởi tạo ${created} khối mới, bỏ qua ${skipped} khối đã tồn tại`,
      data: {
        created,
        skipped,
        results
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi khởi tạo khối",
      error: err.message
    });
  }
};