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
          
          // ✅ Cả hai điều kiện phải cùng đạt: tất cả môn >= ngưỡng VÀ đủ môn bắt buộc
          const hasRequiredSubjects = checkRequiredSubjects(requiredSubjects, subjectAverages, 'excellent');
          
          if (allSubjectsPass && hasRequiredSubjects) {
            // ✅ Đủ điều kiện Giỏi: tất cả môn >= ngưỡng VÀ đủ môn bắt buộc
            return 'Giỏi';
          }
          // ❌ Không đủ điều kiện Giỏi: thiếu một trong hai điều kiện
          // Tiếp tục kiểm tra Khá (có thể xếp Khá nếu đủ điều kiện)
        } else {
          // Nếu không có điểm từng môn, chỉ kiểm tra điểm TB năm và môn bắt buộc
          const hasRequiredSubjects = checkRequiredSubjects(requiredSubjects, subjectAverages, 'excellent');
          if (yearAverage >= excellentMinAverage && hasRequiredSubjects) {
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
          
          // ✅ Cả hai điều kiện phải cùng đạt: tất cả môn >= ngưỡng VÀ đủ môn bắt buộc
          const hasRequiredSubjects = checkRequiredSubjects(requiredSubjects, subjectAverages, 'good');
          
          if (allSubjectsPass && hasRequiredSubjects) {
            // ✅ Đủ điều kiện Khá: tất cả môn >= ngưỡng VÀ đủ môn bắt buộc
            return 'Khá';
          }
          // ❌ Không đủ điều kiện Khá: thiếu một trong hai điều kiện
          // Tiếp tục kiểm tra Trung bình (có thể xếp Trung bình nếu đủ điều kiện)
        } else {
          // Nếu không có điểm từng môn, chỉ kiểm tra điểm TB năm và môn bắt buộc
          const hasRequiredSubjects = checkRequiredSubjects(requiredSubjects, subjectAverages, 'good');
          if (yearAverage >= goodMinAverage && hasRequiredSubjects) {
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
          
          // ✅ Cả hai điều kiện phải cùng đạt: tất cả môn > ngưỡng VÀ đủ môn bắt buộc
          const hasRequiredSubjects = checkRequiredSubjects(requiredSubjects, subjectAverages, 'average');
          
          if (allSubjectsPass && hasRequiredSubjects) {
            // ✅ Đủ điều kiện Trung bình: tất cả môn > ngưỡng VÀ đủ môn bắt buộc
            return 'Trung bình';
          }
          // ❌ Không đủ điều kiện Trung bình → Yếu
          return 'Yếu';
        } else {
          // Nếu không có điểm từng môn, chỉ kiểm tra điểm TB năm và môn bắt buộc
          const hasRequiredSubjects = checkRequiredSubjects(requiredSubjects, subjectAverages, 'average');
          if (yearAverage >= averageMinAverage && hasRequiredSubjects) {
            return 'Trung bình';
          }
          return 'Yếu';
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

/**
 * ✅ Tính học lực và trả về thông tin chi tiết về cách xếp học lực
 * @param {number} yearAverage - Điểm trung bình cả năm
 * @param {Array} subjectAverages - Mảng điểm trung bình từng môn { subjectId, average }
 * @param {string} schoolYear - Năm học (VD: "2025-2026")
 * @param {string} semester - Học kỳ ("1" hoặc "2") - dùng "2" cho cả năm
 * @param {Object} gradeConfig - Cấu hình điểm số (optional, nếu không có sẽ fetch)
 * @returns {Object} - { academicLevel, details: { gpa, checkedLevels, finalLevel, reasons } }
 */
async function calculateAcademicLevelWithDetails(yearAverage, subjectAverages = [], schoolYear, semester = '2', gradeConfig = null) {
  try {
    // ✅ Lấy cấu hình nếu chưa có
    if (!gradeConfig) {
      gradeConfig = await getGradeConfig(schoolYear, semester);
    }

    const details = {
      gpa: yearAverage,
      checkedLevels: [],
      finalLevel: null,
      reasons: [],
      subjectAverages: subjectAverages.map(sa => ({
        subjectId: sa.subjectId,
        average: sa.average
      }))
    };

    if (!gradeConfig || !gradeConfig.classification) {
      // ✅ Fallback về logic cũ nếu không có config
      if (!yearAverage) {
        details.reasons.push('Chưa có điểm trung bình');
        return { academicLevel: null, details };
      }
      if (yearAverage >= 8.0) {
        details.finalLevel = 'Giỏi';
        details.reasons.push(`Điểm TB năm: ${yearAverage.toFixed(2)} >= 8.0`);
      } else if (yearAverage >= 6.5) {
        details.finalLevel = 'Khá';
        details.reasons.push(`Điểm TB năm: ${yearAverage.toFixed(2)} >= 6.5`);
      } else if (yearAverage >= 5.0) {
        details.finalLevel = 'Trung bình';
        details.reasons.push(`Điểm TB năm: ${yearAverage.toFixed(2)} >= 5.0`);
      } else {
        details.finalLevel = 'Yếu';
        details.reasons.push(`Điểm TB năm: ${yearAverage.toFixed(2)} < 5.0`);
      }
      return { academicLevel: details.finalLevel, details };
    }

    const classification = gradeConfig.classification;
    const requiredSubjects = gradeConfig.requiredSubjects || [];

    // ✅ 1. Kiểm tra xếp loại Yếu trước (điều kiện đơn giản nhất)
    if (classification.weak) {
      const weakMaxAverage = classification.weak.maxAverage || 5.0;
      const weakMaxSubjectScore = classification.weak.maxSubjectScore || 3.5;
      
      details.checkedLevels.push({
        level: 'Yếu',
        conditions: {
          maxAverage: weakMaxAverage,
          maxSubjectScore: weakMaxSubjectScore
        }
      });

      // Nếu điểm TB năm < ngưỡng yếu
      if (yearAverage && yearAverage < weakMaxAverage) {
        details.finalLevel = 'Yếu';
        details.reasons.push(`Điểm TB năm: ${yearAverage.toFixed(2)} < ${weakMaxAverage} (ngưỡng Yếu)`);
        return { academicLevel: 'Yếu', details };
      }
      
      // Nếu có môn nào < ngưỡng yếu
      if (subjectAverages.length > 0) {
        const weakSubjects = subjectAverages.filter(sub => 
          sub.average !== null && sub.average !== undefined && sub.average < weakMaxSubjectScore
        );
        if (weakSubjects.length > 0) {
          details.finalLevel = 'Yếu';
          details.reasons.push(`Có ${weakSubjects.length} môn < ${weakMaxSubjectScore} (ngưỡng Yếu)`);
          return { academicLevel: 'Yếu', details };
        }
      }
    }

    // ✅ 2. Kiểm tra xếp loại Giỏi
    if (classification.excellent && yearAverage) {
      const excellentMinAverage = classification.excellent.minAverage || 8.0;
      const excellentMinSubjectScore = classification.excellent.minSubjectScore || 6.5;
      
      details.checkedLevels.push({
        level: 'Giỏi',
        conditions: {
          minAverage: excellentMinAverage,
          minSubjectScore: excellentMinSubjectScore
        }
      });

      // Kiểm tra điểm TB năm
      if (yearAverage >= excellentMinAverage) {
        // Kiểm tra tất cả môn đều >= ngưỡng
        if (subjectAverages.length > 0) {
          const allSubjectsPass = subjectAverages.every(sub => 
            sub.average !== null && sub.average !== undefined && sub.average >= excellentMinSubjectScore
          );
          
          // ✅ Cả hai điều kiện phải cùng đạt: tất cả môn >= ngưỡng VÀ đủ môn bắt buộc
          const hasRequiredSubjects = checkRequiredSubjects(requiredSubjects, subjectAverages, 'excellent');
          
          if (allSubjectsPass && hasRequiredSubjects) {
            details.finalLevel = 'Giỏi';
            details.reasons.push(`Điểm TB năm: ${yearAverage.toFixed(2)} >= ${excellentMinAverage}`);
            details.reasons.push(`Tất cả môn >= ${excellentMinSubjectScore}`);
            details.reasons.push('Đủ môn bắt buộc');
            return { academicLevel: 'Giỏi', details };
          } else {
            if (!allSubjectsPass) {
              const failedSubjects = subjectAverages.filter(sub => 
                sub.average === null || sub.average === undefined || sub.average < excellentMinSubjectScore
              );
              details.reasons.push(`Không đạt Giỏi: ${failedSubjects.length} môn < ${excellentMinSubjectScore}`);
            }
            if (!hasRequiredSubjects) {
              details.reasons.push('Không đạt Giỏi: Chưa đủ môn bắt buộc');
            }
          }
        } else {
          // Nếu không có điểm từng môn, chỉ kiểm tra điểm TB năm và môn bắt buộc
          const hasRequiredSubjects = checkRequiredSubjects(requiredSubjects, subjectAverages, 'excellent');
          if (hasRequiredSubjects) {
            details.finalLevel = 'Giỏi';
            details.reasons.push(`Điểm TB năm: ${yearAverage.toFixed(2)} >= ${excellentMinAverage}`);
            details.reasons.push('Đủ môn bắt buộc');
            return { academicLevel: 'Giỏi', details };
          } else {
            details.reasons.push('Không đạt Giỏi: Chưa đủ môn bắt buộc');
          }
        }
      } else {
        details.reasons.push(`Không đạt Giỏi: Điểm TB năm ${yearAverage.toFixed(2)} < ${excellentMinAverage}`);
      }
    }

    // ✅ 3. Kiểm tra xếp loại Khá
    if (classification.good && yearAverage) {
      const goodMinAverage = classification.good.minAverage || 6.5;
      const goodMinSubjectScore = classification.good.minSubjectScore || 5.0;
      
      details.checkedLevels.push({
        level: 'Khá',
        conditions: {
          minAverage: goodMinAverage,
          minSubjectScore: goodMinSubjectScore
        }
      });

      if (yearAverage >= goodMinAverage) {
        // Kiểm tra tất cả môn đều >= ngưỡng
        if (subjectAverages.length > 0) {
          const allSubjectsPass = subjectAverages.every(sub => 
            sub.average !== null && sub.average !== undefined && sub.average >= goodMinSubjectScore
          );
          
          // ✅ Cả hai điều kiện phải cùng đạt: tất cả môn >= ngưỡng VÀ đủ môn bắt buộc
          const hasRequiredSubjects = checkRequiredSubjects(requiredSubjects, subjectAverages, 'good');
          
          if (allSubjectsPass && hasRequiredSubjects) {
            details.finalLevel = 'Khá';
            details.reasons.push(`Điểm TB năm: ${yearAverage.toFixed(2)} >= ${goodMinAverage}`);
            details.reasons.push(`Tất cả môn >= ${goodMinSubjectScore}`);
            details.reasons.push('Đủ môn bắt buộc');
            return { academicLevel: 'Khá', details };
          } else {
            if (!allSubjectsPass) {
              const failedSubjects = subjectAverages.filter(sub => 
                sub.average === null || sub.average === undefined || sub.average < goodMinSubjectScore
              );
              details.reasons.push(`Không đạt Khá: ${failedSubjects.length} môn < ${goodMinSubjectScore}`);
            }
            if (!hasRequiredSubjects) {
              details.reasons.push('Không đạt Khá: Chưa đủ môn bắt buộc');
            }
          }
        } else {
          // Nếu không có điểm từng môn, chỉ kiểm tra điểm TB năm và môn bắt buộc
          const hasRequiredSubjects = checkRequiredSubjects(requiredSubjects, subjectAverages, 'good');
          if (hasRequiredSubjects) {
            details.finalLevel = 'Khá';
            details.reasons.push(`Điểm TB năm: ${yearAverage.toFixed(2)} >= ${goodMinAverage}`);
            details.reasons.push('Đủ môn bắt buộc');
            return { academicLevel: 'Khá', details };
          } else {
            details.reasons.push('Không đạt Khá: Chưa đủ môn bắt buộc');
          }
        }
      } else {
        details.reasons.push(`Không đạt Khá: Điểm TB năm ${yearAverage.toFixed(2)} < ${goodMinAverage}`);
      }
    }

    // ✅ 4. Kiểm tra xếp loại Trung bình
    if (classification.average && yearAverage) {
      const averageMinAverage = classification.average.minAverage || 5.0;
      const averageMinSubjectScore = classification.average.minSubjectScore || 3.5;
      
      details.checkedLevels.push({
        level: 'Trung bình',
        conditions: {
          minAverage: averageMinAverage,
          minSubjectScore: averageMinSubjectScore
        }
      });

      if (yearAverage >= averageMinAverage) {
        // Kiểm tra tất cả môn đều > ngưỡng (chú ý: > 3.5, không phải >=)
        if (subjectAverages.length > 0) {
          const allSubjectsPass = subjectAverages.every(sub => 
            sub.average !== null && sub.average !== undefined && sub.average > averageMinSubjectScore
          );
          
          // ✅ Cả hai điều kiện phải cùng đạt: tất cả môn > ngưỡng VÀ đủ môn bắt buộc
          const hasRequiredSubjects = checkRequiredSubjects(requiredSubjects, subjectAverages, 'average');
          
          if (allSubjectsPass && hasRequiredSubjects) {
            details.finalLevel = 'Trung bình';
            details.reasons.push(`Điểm TB năm: ${yearAverage.toFixed(2)} >= ${averageMinAverage}`);
            details.reasons.push(`Tất cả môn > ${averageMinSubjectScore}`);
            details.reasons.push('Đủ môn bắt buộc');
            return { academicLevel: 'Trung bình', details };
          } else {
            if (!allSubjectsPass) {
              const failedSubjects = subjectAverages.filter(sub => 
                sub.average === null || sub.average === undefined || sub.average <= averageMinSubjectScore
              );
              details.reasons.push(`Không đạt Trung bình: ${failedSubjects.length} môn <= ${averageMinSubjectScore}`);
            }
            if (!hasRequiredSubjects) {
              details.reasons.push('Không đạt Trung bình: Chưa đủ môn bắt buộc');
            }
          }
        } else {
          // Nếu không có điểm từng môn, chỉ kiểm tra điểm TB năm và môn bắt buộc
          const hasRequiredSubjects = checkRequiredSubjects(requiredSubjects, subjectAverages, 'average');
          if (hasRequiredSubjects) {
            details.finalLevel = 'Trung bình';
            details.reasons.push(`Điểm TB năm: ${yearAverage.toFixed(2)} >= ${averageMinAverage}`);
            details.reasons.push('Đủ môn bắt buộc');
            return { academicLevel: 'Trung bình', details };
          } else {
            details.reasons.push('Không đạt Trung bình: Chưa đủ môn bắt buộc');
          }
        }
      } else {
        details.reasons.push(`Không đạt Trung bình: Điểm TB năm ${yearAverage.toFixed(2)} < ${averageMinAverage}`);
      }
    }

    // ✅ 5. Mặc định: Yếu (nếu không đạt điều kiện nào)
    details.finalLevel = 'Yếu';
    details.reasons.push('Không đạt các điều kiện trên → Xếp loại Yếu');
    return { academicLevel: 'Yếu', details };

  } catch (err) {
    console.error('❌ Lỗi calculateAcademicLevelWithDetails:', err);
    // Fallback về logic cũ
    if (!yearAverage) {
      return { academicLevel: null, details: { gpa: null, reasons: ['Chưa có điểm trung bình'] } };
    }
    if (yearAverage >= 8.0) {
      return { academicLevel: 'Giỏi', details: { gpa: yearAverage, reasons: [`Điểm TB năm: ${yearAverage.toFixed(2)} >= 8.0`] } };
    }
    if (yearAverage >= 6.5) {
      return { academicLevel: 'Khá', details: { gpa: yearAverage, reasons: [`Điểm TB năm: ${yearAverage.toFixed(2)} >= 6.5`] } };
    }
    if (yearAverage >= 5.0) {
      return { academicLevel: 'Trung bình', details: { gpa: yearAverage, reasons: [`Điểm TB năm: ${yearAverage.toFixed(2)} >= 5.0`] } };
    }
    return { academicLevel: 'Yếu', details: { gpa: yearAverage, reasons: [`Điểm TB năm: ${yearAverage.toFixed(2)} < 5.0`] } };
  }
}

module.exports = {
  calculateAcademicLevel,
  calculateAcademicLevelWithDetails,
  getGradeConfig,
  checkRequiredSubjects,
};

