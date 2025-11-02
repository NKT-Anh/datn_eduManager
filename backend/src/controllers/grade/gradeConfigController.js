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
    const { schoolYear, semester, weights, rounding } = req.body;

    if (!schoolYear || !semester) {
      return res.status(400).json({ message: 'Thiếu schoolYear hoặc semester' });
    }

    const config = await GradeConfig.findOneAndUpdate(
      { schoolYear, semester },
      {
        $set: {
          weights,
          rounding,
          updatedBy: req.user?._id,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error });
  }
};
