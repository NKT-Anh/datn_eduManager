const Survey = require('../../models/survey/survey');
const SurveyResponse = require('../../models/survey/surveyResponse');
const Teacher = require('../../models/user/teacher');
const Subject = require('../../models/subject/subject');
const Class = require('../../models/class/class');
const Department = require('../../models/subject/department');

/**
 * ✅ Tính điểm trung bình và phân loại giáo viên
 * Phân loại:
 * - Xuất sắc: >= 4.5
 * - Khá: >= 3.5 và < 4.5
 * - Trung bình: >= 2.5 và < 3.5
 * - Cần cải thiện: < 2.5
 */
function classifyTeacher(averageScore) {
  if (averageScore >= 4.5) return 'excellent';
  if (averageScore >= 3.5) return 'good';
  if (averageScore >= 2.5) return 'average';
  return 'needs_improvement';
}

/**
 * ✅ Tính điểm trung bình và cập nhật phân loại cho tất cả giáo viên
 * Chạy định kỳ hoặc khi cần
 */
exports.calculateTeacherRatings = async (req, res) => {
  try {
    const { year, semester } = req.query;

    const query = { isDeleted: { $ne: true } };
    if (year) query.year = year;
    if (semester) query.semester = semester;

    // ✅ Lấy tất cả phản hồi
    const responses = await SurveyResponse.find(query)
      .populate('teacherId', 'name teacherCode')
      .lean();

    // ✅ Nhóm theo giáo viên
    const teacherMap = new Map();
    responses.forEach(response => {
      const teacherId = response.teacherId?._id?.toString();
      if (!teacherId) return;

      if (!teacherMap.has(teacherId)) {
        teacherMap.set(teacherId, {
          teacherId: response.teacherId._id,
          teacher: response.teacherId,
          responses: [],
          scores: []
        });
      }

      teacherMap.get(teacherId).responses.push(response);
      if (response.averageScore) {
        teacherMap.get(teacherId).scores.push(response.averageScore);
      }
    });

    // ✅ Tính điểm trung bình và cập nhật phân loại
    const results = [];
    for (const [teacherId, data] of teacherMap.entries()) {
      if (data.scores.length === 0) continue;

      const averageScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      const rating = classifyTeacher(averageScore);

      // ✅ Cập nhật vào Teacher model
      await Teacher.findByIdAndUpdate(teacherId, {
        $set: {
          'currentRating.level': rating,
          'currentRating.averageScore': Number(averageScore.toFixed(2)),
          'currentRating.year': year || null,
          'currentRating.semester': semester || null,
          'currentRating.updatedAt': new Date()
        }
      });

      results.push({
        teacher: {
          _id: data.teacher._id,
          name: data.teacher.name,
          teacherCode: data.teacher.teacherCode
        },
        averageScore: Number(averageScore.toFixed(2)),
        rating,
        ratingLabel: {
          excellent: 'Xuất sắc',
          good: 'Khá',
          average: 'Trung bình',
          needs_improvement: 'Cần cải thiện'
        }[rating],
        responseCount: data.responses.length
      });
    }

    res.json({
      message: 'Đã tính điểm trung bình và phân loại giáo viên thành công',
      year: year || 'all',
      semester: semester || 'all',
      totalTeachers: results.length,
      results
    });
  } catch (error) {
    console.error('❌ Lỗi khi tính điểm trung bình:', error);
    res.status(500).json({ 
      message: 'Lỗi khi tính điểm trung bình', 
      error: error.message 
    });
  }
};

/**
 * ✅ Dashboard tổng hợp cho Admin/BGH
 * Hiển thị: số giáo viên, mức điểm trung bình theo môn, lớp, bộ môn
 */
exports.getSurveyDashboard = async (req, res) => {
  try {
    const { year, semester, subjectId, departmentId, classId } = req.query;

    const query = { isDeleted: { $ne: true } };
    if (year) query.year = year;
    if (semester) query.semester = semester;

    // ✅ Lấy tất cả phản hồi
    let responses = await SurveyResponse.find(query)
      .populate('surveyId', 'title subjectId')
      .populate({
        path: 'surveyId',
        populate: { path: 'subjectId', select: 'name code departmentId' }
      })
      .populate('teacherId', 'name teacherCode')
      .populate('studentId', 'name studentCode classId')
      .populate({
        path: 'studentId',
        populate: { path: 'classId', select: 'className classCode grade' }
      })
      .lean();

    // ✅ Filter theo subjectId nếu có
    if (subjectId) {
      responses = responses.filter(r => 
        r.surveyId?.subjectId?._id?.toString() === subjectId
      );
    }

    // ✅ Filter theo departmentId nếu có (từ yearRoles)
    if (departmentId) {
      // ✅ Lấy departmentId từ yearRoles của teachers
      const teacherIds = [...new Set(responses.map(r => r.teacherId?._id?.toString()).filter(Boolean))];
      const teachersWithYearRoles = await Teacher.find({ 
        _id: { $in: teacherIds },
        isDeleted: { $ne: true }
      })
        .select('_id yearRoles')
        .lean();
      
      const teacherYearRoleMap = new Map();
      teachersWithYearRoles.forEach(teacher => {
        if (teacher.yearRoles && Array.isArray(teacher.yearRoles)) {
          const yearRole = teacher.yearRoles.find(yr => String(yr.schoolYear) === String(year));
          if (yearRole && yearRole.departmentId) {
            teacherYearRoleMap.set(teacher._id.toString(), yearRole.departmentId.toString());
          }
        }
      });
      
      responses = responses.filter(r => {
        const teacherId = r.teacherId?._id?.toString();
        const teacherDeptId = teacherYearRoleMap.get(teacherId);
        const subjectDeptId = r.surveyId?.subjectId?.departmentId?._id?.toString() || r.surveyId?.subjectId?.departmentId?.toString();
        return teacherDeptId === departmentId || subjectDeptId === departmentId;
      });
    }

    // ✅ Filter theo classId nếu có
    if (classId) {
      responses = responses.filter(r => 
        r.studentId?.classId?._id?.toString() === classId
      );
    }

    // ✅ Thống kê tổng quan
    const totalResponses = responses.length;
    const allScores = responses.map(r => r.averageScore || 0).filter(score => score > 0);
    const overallAverage = allScores.length > 0
      ? Number((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2))
      : 0;

    // ✅ Phân bố điểm
    const scoreDistribution = {
      excellent: allScores.filter(s => s >= 4.5).length,
      good: allScores.filter(s => s >= 3.5 && s < 4.5).length,
      average: allScores.filter(s => s >= 2.5 && s < 3.5).length,
      needs_improvement: allScores.filter(s => s < 2.5).length
    };

    // ✅ Thống kê theo môn học
    const subjectMap = new Map();
    responses.forEach(response => {
      const subjectId = response.surveyId?.subjectId?._id?.toString();
      const subjectName = response.surveyId?.subjectId?.name;
      
      if (!subjectId) return;

      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, {
          subjectId,
          subjectName,
          responses: [],
          scores: []
        });
      }

      subjectMap.get(subjectId).responses.push(response);
      if (response.averageScore) {
        subjectMap.get(subjectId).scores.push(response.averageScore);
      }
    });

    const subjectStatistics = Array.from(subjectMap.values()).map(subjectData => {
      const average = subjectData.scores.length > 0
        ? Number((subjectData.scores.reduce((a, b) => a + b, 0) / subjectData.scores.length).toFixed(2))
        : 0;
      return {
        subjectId: subjectData.subjectId,
        subjectName: subjectData.subjectName,
        responseCount: subjectData.responses.length,
        averageScore: average,
        rating: classifyTeacher(average)
      };
    }).sort((a, b) => b.averageScore - a.averageScore);

    // ✅ Thống kê theo bộ môn (theo năm học)
    const departmentMap = new Map();
    
    // ✅ Lấy thông tin giáo viên với yearRoles để lấy departmentId theo năm học
    const teacherIds = [...new Set(responses.map(r => r.teacherId?._id?.toString()).filter(Boolean))];
    const teachersWithYearRoles = await Teacher.find({ 
      _id: { $in: teacherIds },
      isDeleted: { $ne: true }
    })
      .select('_id yearRoles')
      .lean();
    
    const teacherYearRoleMap = new Map();
    teachersWithYearRoles.forEach(teacher => {
      if (teacher.yearRoles && Array.isArray(teacher.yearRoles)) {
        const yearRole = teacher.yearRoles.find(yr => String(yr.schoolYear) === String(year));
        if (yearRole && yearRole.departmentId) {
          teacherYearRoleMap.set(teacher._id.toString(), yearRole.departmentId.toString());
        }
      }
    });
    
    responses.forEach(response => {
      // ✅ Ưu tiên lấy departmentId từ yearRoles của teacher trong năm học đó
      const teacherId = response.teacherId?._id?.toString();
      let deptId = teacherYearRoleMap.get(teacherId);
      
      // ✅ Fallback: Lấy từ subjectId.departmentId nếu không có trong yearRoles
      if (!deptId) {
        deptId = response.surveyId?.subjectId?.departmentId?._id?.toString() ||
                 response.surveyId?.subjectId?.departmentId?.toString();
      }
      
      if (!deptId) return;

      if (!departmentMap.has(deptId)) {
        departmentMap.set(deptId, {
          departmentId: deptId,
          responses: [],
          scores: []
        });
      }

      departmentMap.get(deptId).responses.push(response);
      if (response.averageScore) {
        departmentMap.get(deptId).scores.push(response.averageScore);
      }
    });

    // ✅ Lấy tên bộ môn (chỉ lấy departments của năm học đó)
    const departmentIds = Array.from(departmentMap.keys());
    const departmentQuery = { 
      _id: { $in: departmentIds },
      isDeleted: { $ne: true }
    };
    
    // ✅ Filter theo năm học nếu có
    if (year) {
      departmentQuery.year = year;
    }
    
    const departments = await Department.find(departmentQuery)
      .select('name code year')
      .lean();
    const departmentNameMap = new Map(departments.map(d => [d._id.toString(), d]));

    const departmentStatistics = Array.from(departmentMap.entries()).map(([deptId, deptData]) => {
      const deptInfo = departmentNameMap.get(deptId);
      const average = deptData.scores.length > 0
        ? Number((deptData.scores.reduce((a, b) => a + b, 0) / deptData.scores.length).toFixed(2))
        : 0;
      return {
        departmentId: deptId,
        departmentName: deptInfo?.name || 'Chưa xác định',
        departmentCode: deptInfo?.code || '',
        responseCount: deptData.responses.length,
        averageScore: average,
        rating: classifyTeacher(average)
      };
    }).sort((a, b) => b.averageScore - a.averageScore);

    // ✅ Thống kê theo lớp
    const classMap = new Map();
    responses.forEach(response => {
      const classId = response.studentId?.classId?._id?.toString();
      const className = response.studentId?.classId?.className;
      
      if (!classId) return;

      if (!classMap.has(classId)) {
        classMap.set(classId, {
          classId,
          className,
          responses: [],
          scores: []
        });
      }

      classMap.get(classId).responses.push(response);
      if (response.averageScore) {
        classMap.get(classId).scores.push(response.averageScore);
      }
    });

    const classStatistics = Array.from(classMap.values()).map(classData => {
      const average = classData.scores.length > 0
        ? Number((classData.scores.reduce((a, b) => a + b, 0) / classData.scores.length).toFixed(2))
        : 0;
      return {
        classId: classData.classId,
        className: classData.className,
        responseCount: classData.responses.length,
        averageScore: average,
        rating: classifyTeacher(average)
      };
    }).sort((a, b) => b.averageScore - a.averageScore);

    // ✅ Xếp hạng giáo viên
    const teacherMap = new Map();
    responses.forEach(response => {
      const teacherId = response.teacherId?._id?.toString();
      if (!teacherId) return;

      if (!teacherMap.has(teacherId)) {
        teacherMap.set(teacherId, {
          teacher: response.teacherId,
          responses: [],
          scores: []
        });
      }

      teacherMap.get(teacherId).responses.push(response);
      if (response.averageScore) {
        teacherMap.get(teacherId).scores.push(response.averageScore);
      }
    });

    const teacherRankings = Array.from(teacherMap.values())
      .map(teacherData => {
        const average = teacherData.scores.length > 0
          ? Number((teacherData.scores.reduce((a, b) => a + b, 0) / teacherData.scores.length).toFixed(2))
          : 0;
        return {
          teacher: {
            _id: teacherData.teacher._id,
            name: teacherData.teacher.name,
            teacherCode: teacherData.teacher.teacherCode
          },
          responseCount: teacherData.responses.length,
          averageScore: average,
          rating: classifyTeacher(average),
          ratingLabel: {
            excellent: 'Xuất sắc',
            good: 'Khá',
            average: 'Trung bình',
            needs_improvement: 'Cần cải thiện'
          }[classifyTeacher(average)]
        };
      })
      .sort((a, b) => b.averageScore - a.averageScore)
      .map((teacher, index) => ({
        ...teacher,
        rank: index + 1
      }));

    res.json({
      summary: {
        totalResponses,
        overallAverage,
        scoreDistribution,
        totalTeachers: teacherRankings.length,
        totalSubjects: subjectStatistics.length,
        totalDepartments: departmentStatistics.length,
        totalClasses: classStatistics.length
      },
      teacherRankings: teacherRankings.slice(0, 20), // Top 20
      subjectStatistics,
      departmentStatistics,
      classStatistics,
      filters: {
        year: year || 'all',
        semester: semester || 'all',
        subjectId: subjectId || 'all',
        departmentId: departmentId || 'all',
        classId: classId || 'all'
      }
    });
  } catch (error) {
    console.error('❌ Lỗi khi lấy dashboard:', error);
    res.status(500).json({ 
      message: 'Lỗi khi lấy dashboard', 
      error: error.message 
    });
  }
};

/**
 * ✅ Trao danh hiệu/khen thưởng cho giáo viên
 * Admin/BGH có thể trao danh hiệu dựa trên điểm khảo sát
 */
exports.awardTeacher = async (req, res) => {
  try {
    const { teacherId, title, year, semester, reason, surveyAverageScore } = req.body;
    const awardedBy = req.user?.accountId;

    if (!teacherId || !title) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Không tìm thấy giáo viên' });
    }

    // ✅ Thêm danh hiệu
    if (!Array.isArray(teacher.awards)) {
      teacher.awards = [];
    }

    teacher.awards.push({
      title,
      year: year || null,
      semester: semester || null,
      reason: reason || null,
      awardedAt: new Date(),
      awardedBy,
      surveyAverageScore: surveyAverageScore || null
    });

    await teacher.save();

    const populatedTeacher = await Teacher.findById(teacher._id)
      .populate('awards.awardedBy', 'email')
      .lean();

    res.json({
      message: 'Đã trao danh hiệu/khen thưởng thành công',
      teacher: {
        _id: teacher._id,
        name: teacher.name,
        teacherCode: teacher.teacherCode,
        awards: populatedTeacher.awards
      }
    });
  } catch (error) {
    console.error('❌ Lỗi khi trao danh hiệu:', error);
    res.status(500).json({ 
      message: 'Lỗi khi trao danh hiệu', 
      error: error.message 
    });
  }
};

/**
 * ✅ Lấy danh sách giáo viên có danh hiệu/khen thưởng
 */
exports.getTeachersWithAwards = async (req, res) => {
  try {
    const { year } = req.query;

    const query = {
      isDeleted: { $ne: true },
      awards: { $exists: true, $ne: [] }
    };

    const teachers = await Teacher.find(query)
      .select('name teacherCode awards currentRating')
      .populate('awards.awardedBy', 'email')
      .lean();

    // ✅ Filter theo năm nếu có
    let filteredTeachers = teachers;
    if (year) {
      filteredTeachers = teachers.filter(teacher => 
        teacher.awards?.some(award => award.year === year)
      );
    }

    res.json({
      teachers: filteredTeachers.map(teacher => ({
        _id: teacher._id,
        name: teacher.name,
        teacherCode: teacher.teacherCode,
        currentRating: teacher.currentRating,
        awards: teacher.awards || [],
        totalAwards: teacher.awards?.length || 0
      })),
      count: filteredTeachers.length
    });
  } catch (error) {
    console.error('❌ Lỗi khi lấy danh sách giáo viên có danh hiệu:', error);
    res.status(500).json({ 
      message: 'Lỗi khi lấy danh sách giáo viên có danh hiệu', 
      error: error.message 
    });
  }
};

/**
 * ✅ Giáo viên: Xem danh hiệu/khen thưởng của chính mình
 */
exports.getMyAwards = async (req, res) => {
  try {
    const teacherAccountId = req.user?.accountId;
    const { year, semester } = req.query;

    // ✅ Lấy thông tin giáo viên
    const teacher = await Teacher.findOne({ accountId: teacherAccountId })
      .select('name teacherCode awards currentRating')
      .populate('awards.awardedBy', 'email')
      .lean();

    if (!teacher) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin giáo viên' });
    }

    // ✅ Filter awards theo năm và học kỳ nếu có
    let filteredAwards = teacher.awards || [];
    if (year) {
      filteredAwards = filteredAwards.filter(award => award.year === year);
    }
    if (semester && semester !== 'all') {
      filteredAwards = filteredAwards.filter(award => award.semester === semester);
    }

    res.json({
      teacher: {
        _id: teacher._id,
        name: teacher.name,
        teacherCode: teacher.teacherCode,
      },
      currentRating: teacher.currentRating || null,
      awards: filteredAwards,
      totalAwards: filteredAwards.length
    });
  } catch (error) {
    console.error('❌ Lỗi khi lấy danh hiệu của giáo viên:', error);
    res.status(500).json({ 
      message: 'Lỗi khi lấy danh hiệu của giáo viên', 
      error: error.message 
    });
  }
};

