const GradeConfig = require('../../models/grade/gradeConfig');

/**
 * Lấy config theo năm học và học kỳ
 */
exports.getGradeConfig = async (req, res) => {
  try {
    const { schoolYear, semester } = req.query;
    const config = await GradeConfig.findOne({ schoolYear, semester });

    if (!config) {
      return res.status(404).json({ message: 'Chưa có cấu hình cho kỳ này' });
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error });
  }
};

/**
 * Cập nhật hoặc tạo mới config
 */
exports.upsertGradeConfig = async (req, res) => {
  try {
    const { schoolYear, semester, weights, columnCounts, rounding, classification, requiredSubjects } = req.body;

    if (!schoolYear || !semester) {
      return res.status(400).json({ message: 'Thiếu schoolYear hoặc semester' });
    }

    const updateData = {
      weights,
      rounding,
      updatedBy: req.user?._id,
    };

    // ✅ Cập nhật columnCounts nếu có
    if (columnCounts) {
      updateData.columnCounts = columnCounts;
    }

    // ✅ Cập nhật classification nếu có
    if (classification) {
      updateData.classification = classification;
    }

    // ✅ Cập nhật requiredSubjects nếu có
    if (requiredSubjects !== undefined) {
      updateData.requiredSubjects = requiredSubjects;
    }

    const config = await GradeConfig.findOneAndUpdate(
      { schoolYear, semester },
      {
        $set: updateData,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error });
  }
};
