const GradeItem = require('../models/grade/gradeItem');
const GradeSummary = require('../models/grade/gradeSummary');
const GradeConfig = require('../models/grade/gradeConfig');

/**
 * 🔹 Lấy cấu hình điểm động từ DB
 */
async function getActiveConfig(schoolYear, semester) {
  const config = await GradeConfig.findOne({ schoolYear, semester }).lean();
  return (
    config || {
      weights: { oral: 1, quiz15: 1, quiz45: 2, midterm: 2, final: 3 },
      rounding: 'half-up',
    }
  );
}

/**
 * 🔹 Làm tròn điểm theo cấu hình
 */
function roundScore(value, rounding) {
  if (value == null) return value;
  if (rounding === 'half-up') {
    return Math.round(value * 10) / 10; // làm tròn 0.1
  }
  return value;
}

/**
 * 🔹 Tính trung bình đơn giản
 */
function computeWeightedAverage(values) {
  if (!values || !values.length) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

/**
 * 🔹 Tính trung bình cho từng thành phần và điểm tổng
 */
function computeAverages(items, weights, rounding) {
  const w = { ...weights };

  const byComponent = {
    oral: [],
    quiz15: [],
    quiz45: [],
    midterm: [],
    final: [],
  };

  for (const it of items || []) {
    if (!byComponent[it.component]) continue;
    byComponent[it.component].push(it.score);
  }

  const averages = {
    oral: computeWeightedAverage(byComponent.oral),
    quiz15: computeWeightedAverage(byComponent.quiz15),
    quiz45: computeWeightedAverage(byComponent.quiz45),
    midterm: computeWeightedAverage(byComponent.midterm),
    final: computeWeightedAverage(byComponent.final),
  };

  let sum = 0;
  let weightSum = 0;
  for (const key of Object.keys(averages)) {
    const val = averages[key];
    if (val != null) {
      sum += val * (w[key] || 0);
      weightSum += w[key] || 0;
    }
  }
  const average = weightSum ? sum / weightSum : null;

  return {
    averages: {
      oral: averages.oral != null ? roundScore(averages.oral, rounding) : null,
      quiz15: averages.quiz15 != null ? roundScore(averages.quiz15, rounding) : null,
      quiz45: averages.quiz45 != null ? roundScore(averages.quiz45, rounding) : null,
      midterm: averages.midterm != null ? roundScore(averages.midterm, rounding) : null,
      final: averages.final != null ? roundScore(averages.final, rounding) : null,
    },
    average: average != null ? roundScore(average, rounding) : null,
  };
}

/**
 * 🔹 Thêm hoặc cập nhật điểm
 */
async function upsertGradeItem(payload) {
  const {
    studentId,
    subjectId,
    classId,
    schoolYear,
    semester,
    component,
    score,
    weight,
    attempt,
    teacherId,
    date,
    notes,
  } = payload;

  if (!studentId || !subjectId || !schoolYear || !semester || !component || score == null) {
    throw new Error('Thiếu trường bắt buộc: studentId, subjectId, schoolYear, semester, component, score');
  }

  const filter = {
    studentId,
    subjectId,
    schoolYear,
    semester,
    component,
    attempt: attempt || 1,
  };

  const updated = await GradeItem.findOneAndUpdate(
    filter,
    {
      $set: {
        classId: classId || undefined,
        score,
        weight,
        teacherId,
        date,
        notes,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await recomputeSummary({
    studentId,
    subjectId,
    classId: updated.classId,
    schoolYear,
    semester,
  });

  return updated;
}

/**
 * 🔹 Tính lại điểm trung bình cho học sinh + môn + kỳ
 */
async function recomputeSummary({ studentId, subjectId, classId, schoolYear, semester }) {
  if (!studentId || !subjectId || !schoolYear || !semester) {
    throw new Error('Thiếu trường bắt buộc: studentId, subjectId, schoolYear, semester');
  }

  const config = await getActiveConfig(schoolYear, semester);
  const { weights, rounding } = config;

  const items = await GradeItem.find({ studentId, subjectId, schoolYear, semester }).lean();
  const { averages, average } = computeAverages(items, weights, rounding);

  const summary = await GradeSummary.findOneAndUpdate(
    { studentId, subjectId, schoolYear, semester },
    {
      $set: {
        classId,
        averages,
        average,
        computedAt: new Date(),
        version: 'v1',
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return summary;
}

/**
 * 🔹 Lấy bảng điểm tóm tắt của cả lớp cho một môn
 */
async function getClassSubjectSummary({ classId, subjectId, schoolYear, semester }) {
  if (!classId || !subjectId || !schoolYear || !semester) {
    throw new Error('Thiếu tham số classId, subjectId, schoolYear, semester');
  }

  const summaries = await GradeSummary.find({ classId, subjectId, schoolYear, semester })
    .populate('studentId', 'name studentCode')
    .populate('subjectId', 'name code')
    .lean();

  return summaries;
}

async function saveScores({ classId, subjectId, schoolYear, semester, scores }) {
  if (!classId || !subjectId || !schoolYear || !semester || !Array.isArray(scores)) {
    throw new Error('Thiếu tham số classId, subjectId, schoolYear, semester hoặc scores');
  }

  const results = [];
  for (const s of scores) {
    const { studentId, components } = s || {};
    if (!studentId || !Array.isArray(components)) {
      results.push({ studentId, status: 'error', message: 'Sai định dạng' });
      continue;
    }
    for (const c of components) {
      try {
        const item = await upsertGradeItem({
          studentId,
          subjectId,
          classId,
          schoolYear,
          semester,
          component: c.component,
          score: c.score,
          weight: c.weight,
          attempt: c.attempt,
          teacherId: c.teacherId,
          date: c.date,
          notes: c.notes,
        });
        results.push({ studentId, component: c.component, status: 'ok', itemId: item._id });
      } catch (err) {
        results.push({ studentId, component: c.component, status: 'error', message: err.message });
      }
    }
    // recompute once per student after all components
    try {
      await recomputeSummary({ studentId, subjectId, classId, schoolYear, semester });
    } catch (e) {
      // push an aggregate error if recompute fails
      results.push({ studentId, status: 'error', message: `Recompute failed: ${e.message}` });
    }
  }

  // Return a brief summary
  const successCount = results.filter(r => r.status === 'ok').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  return { successCount, errorCount, results };
}

module.exports = {
  upsertGradeItem,
  recomputeSummary,
  getClassSubjectSummary,
  computeAverages,
  getActiveConfig,
  saveScores,
};
