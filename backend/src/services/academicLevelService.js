const GradeConfig = require('../models/grade/gradeConfig');
const GradeSummary = require('../models/grade/gradeSummary');

/**
 * ✅ Lấy cấu hình điểm số cho năm học và học kỳ
 */
async function getGradeConfig(schoolYear, semester) {
  try {
    const config = await GradeConfig.findOne({ schoolYear, semester }).lean();
    if (!config) {
      // ✅ Nếu không có config cho học kỳ này, thử lấy từ học kỳ khác hoặc dùng mặc định
      const defaultConfig = await GradeConfig.findOne({ schoolYear }).lean();
      return defaultConfig || null;
    }
    return config;
  } catch (err) {
    console.error('❌ Lỗi getGradeConfig:', err);
    return null;
  }
}

/**
 * ✅ Tính học lực dựa trên điểm trung bình và cấu hình
 * @param {number} yearAverage - Điểm trung bình cả năm
 * @param {Array} subjectAverages - Mảng điểm trung bình từng môn { subjectId, average }
 * @param {string} schoolYear - Năm học (VD: "2025-2026")
 * @param {string} semester - Học kỳ ("1" hoặc "2") - dùng "2" cho cả năm
 * @param {Object} gradeConfig - Cấu hình điểm số (optional, nếu không có sẽ fetch)
 * @returns {string|null} - "Giỏi" | "Khá" | "Trung bình" | "Yếu" | null
 */
async function calculateAcademicLevel(yearAverage, subjectAverages = [], schoolYear, semester = '2', gradeConfig = null) {
  try {
    // ✅ Lấy cấu hình nếu chưa có
    if (!gradeConfig) {
      gradeConfig = await getGradeConfig(schoolYear, semester);
    }

    if (!gradeConfig || !gradeConfig.classification) {
      // ✅ Fallback về logic cũ nếu không có config
      if (!yearAverage) return null;
      if (yearAverage >= 8.0) return 'Giỏi';
      if (yearAverage >= 6.5) return 'Khá';
      if (yearAverage >= 5.0) return 'Trung bình';
      return 'Yếu';
    }

    const classification = gradeConfig.classification;
    const requiredSubjects = gradeConfig.requiredSubjects || [];

    // ✅ 1. Kiểm tra xếp loại Yếu trước (điều kiện đơn giản nhất)
    if (classification.weak) {
      const weakMaxAverage = classification.weak.maxAverage || 5.0;
      const weakMaxSubjectScore = classification.weak.maxSubjectScore || 3.5;
      
      // Nếu điểm TB năm < ngưỡng yếu
      if (yearAverage && yearAverage < weakMaxAverage) {
        return 'Yếu';
      }
      
      // Nếu có môn nào < ngưỡng yếu
      if (subjectAverages.length > 0) {
        const hasWeakSubject = subjectAverages.some(sub => 
          sub.average !== null && sub.average !== undefined && sub.average < weakMaxSubjectScore
        );
        if (hasWeakSubject) {
          return 'Yếu';
        }
      }
    }

    // ✅ 2. Kiểm tra xếp loại Giỏi
    if (classification.excellent && yearAverage) {
      const excellentMinAverage = classification.excellent.minAverage || 8.0;
      const excellentMinSubjectScore = classification.excellent.minSubjectScore || 6.5;
      
      // Kiểm tra điểm TB năm
      if (yearAverage >= excellentMinAverage) {
        // Kiểm tra tất cả môn đều >= ngưỡng
        if (subjectAverages.length > 0) {
          const allSubjectsPass = subjectAverages.every(sub => 
            sub.average !== null && sub.average !== undefined && sub.average >= excellentMinSubjectScore
          );
          
          if (!allSubjectsPass) {
            // Nếu không đủ điều kiện Giỏi, kiểm tra điều kiện môn bắt buộc
            if (checkRequiredSubjects(requiredSubjects, subjectAverages, 'excellent')) {
              return 'Giỏi';
            }
            // Không đủ điều kiện Giỏi, tiếp tục kiểm tra Khá
          } else {
            // ✅ Đủ điều kiện Giỏi
            return 'Giỏi';
          }
        } else {
          // Nếu không có điểm từng môn, chỉ kiểm tra điểm TB năm
          if (yearAverage >= excellentMinAverage) {
            return 'Giỏi';
          }
        }
      }
    }

    // ✅ 3. Kiểm tra xếp loại Khá
    if (classification.good && yearAverage) {
      const goodMinAverage = classification.good.minAverage || 6.5;
      const goodMinSubjectScore = classification.good.minSubjectScore || 5.0;
      
      if (yearAverage >= goodMinAverage) {
        // Kiểm tra tất cả môn đều >= ngưỡng
        if (subjectAverages.length > 0) {
          const allSubjectsPass = subjectAverages.every(sub => 
            sub.average !== null && sub.average !== undefined && sub.average >= goodMinSubjectScore
          );
          
          if (!allSubjectsPass) {
            // Kiểm tra điều kiện môn bắt buộc
            if (checkRequiredSubjects(requiredSubjects, subjectAverages, 'good')) {
              return 'Khá';
            }
            // Không đủ điều kiện Khá, tiếp tục kiểm tra Trung bình
          } else {
            // ✅ Đủ điều kiện Khá
            return 'Khá';
          }
        } else {
          if (yearAverage >= goodMinAverage) {
            return 'Khá';
          }
        }
      }
    }

    // ✅ 4. Kiểm tra xếp loại Trung bình
    if (classification.average && yearAverage) {
      const averageMinAverage = classification.average.minAverage || 5.0;
      const averageMinSubjectScore = classification.average.minSubjectScore || 3.5;
      
      if (yearAverage >= averageMinAverage) {
        // Kiểm tra tất cả môn đều > ngưỡng (chú ý: > 3.5, không phải >=)
        if (subjectAverages.length > 0) {
          const allSubjectsPass = subjectAverages.every(sub => 
            sub.average !== null && sub.average !== undefined && sub.average > averageMinSubjectScore
          );
          
          if (!allSubjectsPass) {
            // Kiểm tra điều kiện môn bắt buộc
            if (checkRequiredSubjects(requiredSubjects, subjectAverages, 'average')) {
              return 'Trung bình';
            }
            // Không đủ điều kiện Trung bình → Yếu
            return 'Yếu';
          } else {
            // ✅ Đủ điều kiện Trung bình
            return 'Trung bình';
          }
        } else {
          if (yearAverage >= averageMinAverage) {
            return 'Trung bình';
          }
        }
      }
    }

    // ✅ 5. Mặc định: Yếu (nếu không đạt điều kiện nào)
    return 'Yếu';

  } catch (err) {
    console.error('❌ Lỗi calculateAcademicLevel:', err);
    // Fallback về logic cũ
    if (!yearAverage) return null;
    if (yearAverage >= 8.0) return 'Giỏi';
    if (yearAverage >= 6.5) return 'Khá';
    if (yearAverage >= 5.0) return 'Trung bình';
    return 'Yếu';
  }
}

/**
 * ✅ Kiểm tra điều kiện môn bắt buộc cho từng loại xếp loại
 */
function checkRequiredSubjects(requiredSubjects, subjectAverages, classificationType) {
  if (!requiredSubjects || requiredSubjects.length === 0) {
    return true; // Không có môn bắt buộc → đạt điều kiện
  }

  // ✅ Lọc các môn bắt buộc cho loại xếp loại này
  const relevantRequiredSubjects = requiredSubjects.filter(rs => 
    rs.classificationType === classificationType
  );

  if (relevantRequiredSubjects.length === 0) {
    return true; // Không có môn bắt buộc cho loại này → đạt điều kiện
  }

  // ✅ Nhóm các môn theo groupId
  const groups = {};
  relevantRequiredSubjects.forEach(rs => {
    const groupId = rs.groupId || `single_${rs.subjectId}`;
    if (!groups[groupId]) {
      groups[groupId] = [];
    }
    groups[groupId].push(rs);
  });

  // ✅ Kiểm tra từng nhóm
  for (const [groupId, subjects] of Object.entries(groups)) {
    const subjectChecks = subjects.map(rs => {
      const subjectAvg = subjectAverages.find(sa => 
        String(sa.subjectId) === String(rs.subjectId)
      );
      const passed = subjectAvg && 
        subjectAvg.average !== null && 
        subjectAvg.average !== undefined && 
        subjectAvg.average >= rs.minScore;
      return { subjectId: rs.subjectId, passed };
    });

    // ✅ Kiểm tra điều kiện của nhóm
    const requireAll = subjects[0].requireAll || false;
    
    if (requireAll) {
      // Tất cả môn trong nhóm phải đạt
      const allPassed = subjectChecks.every(sc => sc.passed);
      if (!allPassed) {
        return false; // Nhóm này không đạt → không đủ điều kiện
      }
    } else {
      // Ít nhất 1 môn trong nhóm phải đạt
      const atLeastOnePassed = subjectChecks.some(sc => sc.passed);
      if (!atLeastOnePassed) {
        return false; // Nhóm này không đạt → không đủ điều kiện
      }
    }
  }

  // ✅ Tất cả nhóm đều đạt
  return true;
}

module.exports = {
  calculateAcademicLevel,
  getGradeConfig,
  checkRequiredSubjects,
};

