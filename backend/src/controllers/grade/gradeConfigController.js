const GradeConfig = require('../../models/grade/gradeConfig');

/**
 * Lấy config theo năm học và học kỳs
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
    const { schoolYear, semester, weights, columnCounts, rounding, classification, requiredSubjects, completionPolicy, defaultMinRequiredScore } = req.body;

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

    // ✅ Cập nhật ngưỡng mặc định cho môn bắt buộc nếu có
    if (typeof defaultMinRequiredScore === 'number') {
      updateData.defaultMinRequiredScore = defaultMinRequiredScore;
    }

    // ✅ Cập nhật completionPolicy nếu có
    if (completionPolicy) {
      updateData.completionPolicy = completionPolicy;
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

/**
 * ✅ Reset tất cả minScore của requiredSubjects về defaultMinRequiredScore
 */
exports.resetRequiredSubjectsMinScore = async (req, res) => {
  try {
    const { schoolYear, semester } = req.body;
    if (!schoolYear || !semester) {
      return res.status(400).json({ message: 'Thiếu schoolYear hoặc semester' });
    }

    const cfg = await GradeConfig.findOne({ schoolYear, semester });
    if (!cfg) {
      return res.status(404).json({ message: 'Chưa có cấu hình cho kỳ này' });
    }

    const defMin = typeof cfg.defaultMinRequiredScore === 'number' ? cfg.defaultMinRequiredScore : 8.0;
    const updatedRequired = (cfg.requiredSubjects || []).map(rs => ({
      ...rs.toObject?.() || rs,
      minScore: defMin,
    }));

    cfg.requiredSubjects = updatedRequired;
    cfg.updatedBy = req.user?._id;
    await cfg.save();

    res.json({ success: true, message: 'Đã reset minScore về ngưỡng mặc định', defaultMinRequiredScore: defMin, requiredSubjects: cfg.requiredSubjects });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error });
  }
};
