const GradeItem = require('../models/grade/gradeItem');
const GradeSummary = require('../models/grade/gradeSummary');
const GradeConfig = require('../models/grade/gradeConfig');
const Subject = require('../models/subject/subject');
const StudentYearRecord = require('../models/user/studentYearRecord');
const Student = require('../models/user/student');
const Class = require('../models/class/class');
const { calculateAcademicLevel } = require('./academicLevelService');

/**
 * 🔹 Lấy cấu hình điểm động từ DB
 */
async function getActiveConfig(schoolYear, semester) {
  const config = await GradeConfig.findOne({ schoolYear, semester }).lean();
  return (
    config || {
      weights: { oral: 1, quiz15: 1, quiz45: 2, midterm: 2, final: 3 },
      columnCounts: { oral: 3, quiz15: 3, quiz45: 1, midterm: 1, final: 1 },
      completionPolicy: 'at-least-one',
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
 * ✅ Nếu có nhiều điểm cho cùng component (ví dụ: 3 điểm miệng), 
 *    tính tổng các điểm đó nhân với hệ số, không phải trung bình rồi nhân hệ số
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

  // ✅ Tính trung bình của từng component để hiển thị (cho UI)
  const averages = {
    oral: computeWeightedAverage(byComponent.oral),
    quiz15: computeWeightedAverage(byComponent.quiz15),
    quiz45: computeWeightedAverage(byComponent.quiz45),
    midterm: computeWeightedAverage(byComponent.midterm),
    final: computeWeightedAverage(byComponent.final),
  };

  // ✅ Tính điểm TB môn: mỗi điểm trong component được nhân với hệ số riêng
  // Ví dụ: 3 điểm miệng (8, 9, 6.4) với hệ số 1 → (8*1 + 9*1 + 6.4*1) = 23.4
  // Tổng hệ số = 3*1 = 3
  let sum = 0;
  let weightSum = 0;
  for (const key of Object.keys(byComponent)) {
    const scores = byComponent[key];
    const componentWeight = w[key] || 0;
    
    if (scores && scores.length > 0) {
      // Tổng điểm của component nhân với hệ số
      const componentSum = scores.reduce((a, b) => a + b, 0);
      sum += componentSum * componentWeight;
      // Tổng hệ số = số lượng điểm * hệ số của component
      weightSum += scores.length * componentWeight;
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

  // ✅ Tự động tính và lưu điểm TB cả năm sau khi cập nhật điểm
  // Chỉ tính khi đã có đủ điểm cho cả HK1 và HK2
  if (updated.classId) {
    try {
      await computeAndSaveYearGPA({
        studentId,
        classId: updated.classId,
        schoolYear,
      });
    } catch (yearGPAError) {
      // Không throw error để không ảnh hưởng đến việc lưu điểmd
      console.error('⚠️ Lỗi khi tính điểm TB cả năm (không ảnh hưởng đến việc lưu điểm):', yearGPAError);
    }
  }

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

  const items = await GradeItem.find({ studentId, subjectId, schoolYear, semester, isDeleted: { $ne: true } }).lean();
  
  let averages = {};
  let average = null;
  let result = null; // "D" hoặc "K" cho môn không tính điểm TB

  // Nếu môn học tính điểm trung bình (mặc định là true nếu không set)
  if (subject.includeInAverage !== false) {
    const config = await getActiveConfig(schoolYear, semester);
    const { weights, rounding } = config;
    const columnCounts = config.columnCounts || { oral: 3, quiz15: 3, quiz45: 1, midterm: 1, final: 1 };
    const completionPolicy = config.completionPolicy || 'at-least-one';

    // Kiểm tra đủ các thành phần có trọng số > 0 phải có ÍT NHẤT 1 cột điểm
    const requiredComponents = Object.entries(weights)
      .filter(([, w]) => (w ?? 0) > 0)
      .map(([k]) => k);

    // Gom điểm theo component để kiểm tra tính đầy đủ
    const byComponent = requiredComponents.reduce((acc, key) => {
      acc[key] = [];
      return acc;
    }, {});
    for (const it of items || []) {
      if (byComponent.hasOwnProperty(it.component)) {
        byComponent[it.component].push(it.score);
      }
    }
    // Hoàn tất theo policy: 'at-least-one' (mặc định) hoặc 'require-counts'
    let hasAllRequired = false;
    if (completionPolicy === 'require-counts') {
      hasAllRequired = requiredComponents.every((k) => {
        const need = Number(columnCounts?.[k] ?? 1);
        const have = (byComponent[k] || []).length;
        return have >= need;
      });
    } else {
      hasAllRequired = requiredComponents.every((k) => (byComponent[k] || []).length > 0);
    }

    const computed = computeAverages(items, weights, rounding);
    averages = computed.averages;
    average = hasAllRequired ? computed.average : null;

    console.log(`[recomputeSummary] Tính điểm trung bình:`, {
      studentId: String(studentId),
      subjectId: String(subjectId),
      subjectName: subject.name,
      includeInAverage: subject.includeInAverage,
      itemsCount: items.length,
      hasAllRequired,
      requiredComponents,
      completionPolicy,
      columnCounts,
      computedAverage: average,
      computedAverages: averages,
      weights,
    });
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

  console.log(`[recomputeSummary] Đã lưu điểm trung bình vào database:`, {
    studentId: String(studentId),
    subjectId: String(subjectId),
    schoolYear,
    semester,
    average,
    averages,
    summaryId: summary?._id,
    savedAverage: summary?.average,
    savedAverages: summary?.averages,
  });

  // ✅ Đảm bảo điểm trung bình đã được lưu
  if (summary && average !== null && average !== undefined) {
    if (summary.average !== average) {
      console.error(`[recomputeSummary] ⚠️ LỖI: Điểm trung bình không khớp! Tính được: ${average}, Lưu trong DB: ${summary.average}`);
      // Thử lưu lại
      await GradeSummary.findByIdAndUpdate(summary._id, { $set: { average, averages } });
      console.log(`[recomputeSummary] Đã cập nhật lại điểm trung bình`);
    }
  }

  return summary;
}

/**
 * 🔹 Tính và lưu điểm TB cả năm vào StudentYearRecord
 * Điểm TB cả năm = (TB tất cả các môn HK1 + TB tất cả các môn HK2) / 2
 * Chỉ tính các môn có includeInAverage !== false
 */
async function computeAndSaveYearGPA({ studentId, classId, schoolYear }) {
  if (!studentId || !schoolYear) {
    throw new Error('Thiếu trường bắt buộc: studentId, schoolYear');
  }

  try {
    // Lấy tất cả điểm của học sinh cho HK1 và HK2
    const hk1Summaries = await GradeSummary.find({
      studentId,
      schoolYear,
      semester: '1',
      average: { $ne: null }
    })
      .populate('subjectId', 'includeInAverage')
      .lean();

    const hk2Summaries = await GradeSummary.find({
      studentId,
      schoolYear,
      semester: '2',
      average: { $ne: null }
    })
      .populate('subjectId', 'includeInAverage')
      .lean();

    // Tính điểm TB tất cả các môn cho HK1 (chỉ môn tính điểm TB)
    const hk1Averages = hk1Summaries
      .filter(s => s.subjectId && s.subjectId.includeInAverage !== false)
      .map(s => s.average)
      .filter(avg => avg !== null && avg !== undefined);

    // Tính điểm TB tất cả các môn cho HK2 (chỉ môn tính điểm TB)
    const hk2Averages = hk2Summaries
      .filter(s => s.subjectId && s.subjectId.includeInAverage !== false)
      .map(s => s.average)
      .filter(avg => avg !== null && avg !== undefined);

    // Tính điểm TB cho từng học kỳ
    const hk1GPA = hk1Averages.length > 0
      ? hk1Averages.reduce((sum, avg) => sum + avg, 0) / hk1Averages.length
      : null;

    const hk2GPA = hk2Averages.length > 0
      ? hk2Averages.reduce((sum, avg) => sum + avg, 0) / hk2Averages.length
      : null;

    // Tính điểm TB cả năm = (TB HK1 + TB HK2) / 2
    let yearGPA = null;
    if (hk1GPA !== null && hk2GPA !== null) {
      yearGPA = (hk1GPA + hk2GPA) / 2;
    } else if (hk1GPA !== null) {
      yearGPA = hk1GPA;
    } else if (hk2GPA !== null) {
      yearGPA = hk2GPA;
    }

    // ⛔ Không tự động tính và lưu học lực tại đây nữa.
    // Việc xét học lực sẽ do GVCN chủ động bấm nút "Xét học lực" ở bảng điểm lớp CN.
    let academicLevel = null;

    // ✅ Lưu GPA cho từng học kỳ (HK1, HK2) và cả năm (CN)
    if (classId) {
      const updates = [];
      
      // Lưu GPA cho HK1 nếu có
      if (hk1GPA !== null) {
        updates.push(
          StudentYearRecord.findOneAndUpdate(
            { studentId, year: schoolYear, semester: 'HK1' },
            { $set: { gpa: hk1GPA, classId: classId } },
            { upsert: true, new: true }
          )
        );
      }
      
      // Lưu GPA cho HK2 nếu có
      if (hk2GPA !== null) {
        updates.push(
          StudentYearRecord.findOneAndUpdate(
            { studentId, year: schoolYear, semester: 'HK2' },
            { $set: { gpa: hk2GPA, classId: classId } },
            { upsert: true, new: true }
          )
        );
      }
      
      // Lưu GPA cả năm nếu có
      if (yearGPA !== null) {
        updates.push(
          StudentYearRecord.findOneAndUpdate(
            { studentId, year: schoolYear, semester: 'CN' },
            { $set: { gpa: yearGPA, classId: classId } },
            { upsert: true, new: true }
          )
        );
      }
      
      // Thực hiện tất cả các update
      if (updates.length > 0) {
        await Promise.all(updates);
        const savedGPAs = [];
        if (hk1GPA !== null) savedGPAs.push(`HK1: ${hk1GPA.toFixed(2)}`);
        if (hk2GPA !== null) savedGPAs.push(`HK2: ${hk2GPA.toFixed(2)}`);
        if (yearGPA !== null) savedGPAs.push(`CN: ${yearGPA.toFixed(2)}`);
        console.log(`✅ Đã lưu điểm TB cho học sinh ${studentId} (${schoolYear}): ${savedGPAs.join(', ')}`);
        
        // ✅ Tính lại rank cho lớp và khối sau khi cập nhật GPA (chỉ tính rank dựa trên GPA cả năm)
        try {
          // Tính rank theo lớp
          await recomputeRanksForClass({ classId, schoolYear, rankBy: 'class' });
          // Tính rank theo khối
          await recomputeRanksForClass({ classId, schoolYear, rankBy: 'grade' });
        } catch (rankError) {
          console.error('⚠️ Lỗi khi tính lại rank (không ảnh hưởng đến việc lưu điểm):', rankError);
        }
      }
    }

    return { hk1GPA, hk2GPA, yearGPA, academicLevel };
  } catch (error) {
    console.error('❌ Lỗi khi tính điểm TB cả năm:', error);
    throw error;
  }
}

/**
 * ✅ Tính lại rank cho tất cả học sinh trong lớp (theo lớp)
 * Rank được tính dựa trên GPA cả năm (semester='CN')
 */
async function recomputeRanksForClass({ classId, schoolYear, rankBy = 'class' }) {
  if (!classId || !schoolYear) {
    throw new Error('Thiếu trường bắt buộc: classId, schoolYear');
  }

  try {
    // Lấy thông tin lớp
    const classInfo = await Class.findById(classId).select('grade').lean();
    if (!classInfo) {
      throw new Error('Không tìm thấy lớp');
    }

    // Lấy tất cả học sinh trong lớp (hoặc khối nếu rankBy='grade')
    let studentQuery = {};
    if (rankBy === 'class') {
      studentQuery = { classId, status: 'active', isDeleted: { $ne: true } };
    } else if (rankBy === 'grade') {
      studentQuery = { 
        'classId.grade': classInfo.grade,
        status: 'active',
        isDeleted: { $ne: true }
      };
    }

    // Lấy tất cả StudentYearRecord có GPA cả năm
    let yearRecordQuery = { year: schoolYear, semester: 'CN', gpa: { $ne: null } };
    
    if (rankBy === 'class') {
      yearRecordQuery.classId = classId;
    } else if (rankBy === 'grade') {
      // Lấy tất cả lớp trong khối
      const classesInGrade = await Class.find({ 
        grade: classInfo.grade,
        year: schoolYear,
        isDeleted: { $ne: true }
      }).select('_id').lean();
      const classIds = classesInGrade.map(c => c._id);
      yearRecordQuery.classId = { $in: classIds };
    }

    const yearRecords = await StudentYearRecord.find(yearRecordQuery)
      .populate('classId', 'grade')
      .populate('studentId', 'name')
      .lean();

    if (yearRecords.length === 0) {
      console.log(`⚠️ Không có học sinh nào có GPA để tính rank (${rankBy === 'class' ? 'lớp' : 'khối'})`);
      return;
    }

    // Sắp xếp theo GPA giảm dần (cao nhất trước)
    yearRecords.sort((a, b) => {
      if (b.gpa === a.gpa) {
        // Nếu GPA bằng nhau, sắp xếp theo tên (A-Z)
        const nameA = a.studentId?.name || '';
        const nameB = b.studentId?.name || '';
        return nameA.localeCompare(nameB, 'vi');
      }
      return b.gpa - a.gpa;
    });

    // Gán rank (1, 2, 3, ...)
    // Nếu có nhiều học sinh cùng GPA, cùng rank (ví dụ: 2 học sinh cùng GPA cao nhất → cả 2 đều rank 1)
    // Logic: Học sinh đầu tiên luôn rank 1, nếu GPA thấp hơn học sinh trước thì rank = vị trí + 1
    let currentRank = 1;
    let previousGPA = null;
    
    const updatePromises = [];
    for (let i = 0; i < yearRecords.length; i++) {
      const record = yearRecords[i];
      const currentGPA = record.gpa;
      
      // Học sinh đầu tiên luôn rank 1
      if (i === 0) {
        currentRank = 1;
      } else {
        // Nếu GPA thấp hơn học sinh trước, rank = vị trí + 1 (bỏ qua các học sinh cùng rank)
        if (currentGPA < previousGPA) {
          currentRank = i + 1;
        }
        // Nếu GPA bằng học sinh trước, giữ nguyên rank (cùng rank)
        // Không cần làm gì, currentRank giữ nguyên
      }
      
      // Cập nhật rank theo loại (lớp hoặc khối)
      const updateData = {};
      if (rankBy === 'class') {
        if (record.rank !== currentRank) {
          updateData.rank = currentRank;
        }
      } else if (rankBy === 'grade') {
        if (record.rankGrade !== currentRank) {
          updateData.rankGrade = currentRank;
        }
      }
      
      if (Object.keys(updateData).length > 0) {
        updatePromises.push(
          StudentYearRecord.findByIdAndUpdate(
            record._id,
            { $set: updateData },
            { new: true }
          )
        );
      }
      
      previousGPA = currentGPA;
    }

    await Promise.all(updatePromises);
    console.log(`✅ Đã tính lại rank ${rankBy === 'class' ? 'lớp' : 'khối'} cho ${yearRecords.length} học sinh (${rankBy === 'class' ? 'lớp' : 'khối'} ${classInfo.grade})`);
  } catch (error) {
    console.error('❌ Lỗi khi tính lại rank:', error);
    throw error;
  }
}

/**
 * 🔹 Lấy bảng điểm tóm tắt của cả lớp cho một môn
 * ✅ Trả về cả GradeItem data để frontend có thể hiển thị nhiều điểm cho cùng component
 */
async function getClassSubjectSummary({ classId, subjectId, schoolYear, semester }) {
  if (!classId || !subjectId || !schoolYear || !semester) {
    throw new Error('Thiếu tham số classId, subjectId, schoolYear, semester');
  }

  // ✅ Lấy thông tin lớp để xác định năm học của lớp
  const classInfo = await Class.findById(classId).select('year').lean();
  const classYear = classInfo?.year || schoolYear;

  // ✅ Lấy danh sách học sinh đang hoạt động của lớp, đúng niên khóa
  const students = await Student.find({
    classId,
    status: 'active',
    currentYear: classYear,
    isDeleted: { $ne: true }
  }).select('_id name studentCode').lean();

  const studentIds = students.map(s => s._id);

  // ✅ Lấy summaries giới hạn theo danh sách học sinh ở trên
  const summaries = await GradeSummary.find({ classId, subjectId, schoolYear, semester, studentId: { $in: studentIds } })
    .populate('studentId', 'name studentCode email')
    .populate('subjectId', 'name code')
    .lean();

  // Map để truy cập nhanh summary theo studentId
  const summaryByStudent = new Map();
  for (const s of summaries) {
    summaryByStudent.set(String(s.studentId?._id || s.studentId), s);
  }

  // ✅ Lấy tất cả GradeItem để hiển thị các điểm riêng lẻ (chỉ lấy điểm chưa bị xóa)
  const allGradeItems = await GradeItem.find({ 
    classId, 
    subjectId, 
    schoolYear, 
    semester,
    studentId: { $in: studentIds },
    isDeleted: { $ne: true } // ✅ Chỉ lấy điểm chưa bị xóa
  })
    .select('studentId component score attempt')
    .sort({ studentId: 1, component: 1, attempt: 1 })
    .lean();

  // ✅ Trả về danh sách theo roster học sinh để đồng bộ sỉ số với "Lớp đang dạy"
  return students.map(stu => {
    const sid = String(stu._id);
    const summary = summaryByStudent.get(sid);

    // ✅ Lấy các GradeItem của học sinh này
    const studentItems = allGradeItems.filter(item => String(item.studentId) === sid);

    // ✅ Nhóm điểm theo component và sắp xếp theo attempt
    const gradeItemsByComponent = {
      oral: studentItems
        .filter(item => item.component === 'oral')
        .sort((a, b) => (a.attempt || 1) - (b.attempt || 1))
        .map(item => item.score),
      quiz15: studentItems
        .filter(item => item.component === 'quiz15')
        .sort((a, b) => (a.attempt || 1) - (b.attempt || 1))
        .map(item => item.score),
      quiz45: studentItems
        .filter(item => item.component === 'quiz45')
        .sort((a, b) => (a.attempt || 1) - (b.attempt || 1))
        .map(item => item.score),
      midterm: studentItems
        .filter(item => item.component === 'midterm')
        .sort((a, b) => (a.attempt || 1) - (b.attempt || 1))
        .map(item => item.score),
      final: studentItems
        .filter(item => item.component === 'final')
        .sort((a, b) => (a.attempt || 1) - (b.attempt || 1))
        .map(item => item.score),
    };

    // ✅ Nếu chưa có summary cho học sinh này, trả về placeholder để vẫn hiển thị đúng sỉ số
    if (!summary) {
      return {
        _id: undefined,
        studentId: stu._id,
        name: stu.name,
        studentCode: stu.studentCode || '',
        averages: {},
        average: null,
        result: null,
        gradeItems: gradeItemsByComponent,
        isOfficial: false,
        officialAt: null,
        officialBy: null,
      };
    }

    return {
      ...summary,
      _id: summary._id,
      studentId: stu._id,
      name: stu.name,
      studentCode: stu.studentCode || '',
      averages: summary.averages || {},
      average: summary.average,
      result: summary.result,
      gradeItems: gradeItemsByComponent,
      isOfficial: summary.isOfficial === true,
      officialAt: summary.officialAt || null,
      officialBy: summary.officialBy || null,
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
      
      // ✅ Tự động tính và lưu điểm TB cả năm sau khi cập nhật điểm
      if (classId) {
        try {
          await computeAndSaveYearGPA({
            studentId,
            classId,
            schoolYear,
          });
        } catch (yearGPAError) {
          // Không throw error để không ảnh hưởng đến việc lưu điểm
          console.error('⚠️ Lỗi khi tính điểm TB cả năm (không ảnh hưởng đến việc lưu điểm):', yearGPAError);
        }
      }
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
  computeAndSaveYearGPA,
  recomputeRanksForClass,
  saveScores,
  initGradesForStudent,
};
