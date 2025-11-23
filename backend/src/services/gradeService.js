const GradeItem = require('../models/grade/gradeItem');
const GradeSummary = require('../models/grade/gradeSummary');
const GradeConfig = require('../models/grade/gradeConfig');
const Subject = require('../models/subject/subject');

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

  // Lấy thông tin môn học để kiểm tra includeInAverage
  const subject = await Subject.findById(subjectId).lean();
  if (!subject) {
    throw new Error('Không tìm thấy môn học');
  }

  const items = await GradeItem.find({ studentId, subjectId, schoolYear, semester }).lean();
  
  let averages = {};
  let average = null;
  let result = null; // "D" hoặc "K" cho môn không tính điểm TB

  // Nếu môn học tính điểm trung bình
  if (subject.includeInAverage) {
    const config = await getActiveConfig(schoolYear, semester);
    const { weights, rounding } = config;
    const computed = computeAverages(items, weights, rounding);
    averages = computed.averages;
    average = computed.average;
  } else {
    // Môn không tính điểm TB - kiểm tra có điểm nào không để quyết định D/K
    // Nếu có ít nhất 1 điểm >= 5.0 thì D (đạt), ngược lại K (không đạt)
    // Nếu chưa có điểm nào thì result = null
    if (items.length > 0) {
      const allScores = items.map(item => item.score);
      const hasPassingScore = allScores.some(score => score >= 5.0);
      result = hasPassingScore ? 'D' : 'K';
    }
  }

  // 🔹 Đảm bảo không cập nhật classId nếu đã tồn tại (giữ nguyên classId của năm học đó)
  // Chỉ set classId khi tạo mới (upsert) hoặc khi classId chưa có
  const existingSummary = await GradeSummary.findOne({ studentId, subjectId, schoolYear, semester }).lean();
  
  const updateData = {
    averages,
    average,
    result,
    computedAt: new Date(),
    version: 'v1',
  };
  
  // Chỉ cập nhật classId nếu:
  // 1. Chưa có summary (tạo mới)
  // 2. Hoặc classId hiện tại là null/undefined
  if (!existingSummary || !existingSummary.classId) {
    updateData.classId = classId;
  }
  // Nếu đã có classId, giữ nguyên để tránh ghi đè khi học sinh lên lớp

  const summary = await GradeSummary.findOneAndUpdate(
    { studentId, subjectId, schoolYear, semester },
    { $set: updateData },
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
    .populate('studentId', 'name studentCode email')
    .populate('subjectId', 'name code')
    .lean();

  // ✅ Format dữ liệu để đảm bảo có name và _id của học sinh
  return summaries.map(summary => {
    const student = summary.studentId;
    return {
      ...summary,
      // ✅ Đảm bảo có _id và name của học sinh
      _id: summary._id, // ID của GradeSummary
      studentId: student?._id || summary.studentId, // ID của học sinh
      name: student?.name || 'Chưa có tên', // Tên học sinh
      studentCode: student?.studentCode || '', // Mã học sinh
      // Giữ nguyên các trường điểm
      averages: summary.averages || {},
      average: summary.average,
      result: summary.result,
    };
  });
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

/**
 * 🔹 Tự động tạo bảng điểm cho học sinh khi được thêm vào lớp
 * @param {Object} params - { studentId, classId, schoolYear, semester }
 */
async function initGradesForStudent({ studentId, classId, schoolYear, semester }) {
  if (!studentId || !classId || !schoolYear || !semester) {
    return { success: false, message: 'Thiếu thông tin studentId, classId, schoolYear, semester' };
  }

  try {
    // Lấy thông tin lớp để biết khối
    const Class = require('../models/class/class');
    const classItem = await Class.findById(classId).lean();
    if (!classItem) {
      return { success: false, message: 'Không tìm thấy lớp học' };
    }

    const grade = classItem.grade;

    // Lấy tất cả môn học phù hợp với khối
    const subjects = await Subject.find({ grades: grade }).lean();
    if (subjects.length === 0) {
      return { success: false, message: 'Không tìm thấy môn học cho khối này', created: 0 };
    }

    // Tạo GradeSummary cho mỗi môn học
    const summariesToCreate = [];
    for (const subject of subjects) {
      // Kiểm tra xem đã có GradeSummary chưa
      const exists = await GradeSummary.findOne({
        studentId,
        subjectId: subject._id,
        schoolYear,
        semester,
      });

      if (!exists) {
        summariesToCreate.push({
          studentId,
          subjectId: subject._id,
          classId,
          schoolYear,
          semester,
          averages: {},
          average: null,
          result: null,
          computedAt: new Date(),
          version: 'v1',
        });
      }
    }

    // Insert nhiều GradeSummary cùng lúc
    if (summariesToCreate.length > 0) {
      await GradeSummary.insertMany(summariesToCreate);
      return { success: true, created: summariesToCreate.length, skipped: subjects.length - summariesToCreate.length };
    }

    return { success: true, created: 0, skipped: subjects.length, message: 'Tất cả bản ghi đã tồn tại' };
  } catch (error) {
    console.error('[initGradesForStudent]', error);
    return { success: false, message: error.message, created: 0 };
  }
}

module.exports = {
  upsertGradeItem,
  recomputeSummary,
  getClassSubjectSummary,
  computeAverages,
  getActiveConfig,
  saveScores,
  initGradesForStudent,
};
