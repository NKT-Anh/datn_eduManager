const Survey = require('../../models/survey/survey');
const SurveyResponse = require('../../models/survey/surveyResponse');
const Student = require('../../models/user/student');
const Teacher = require('../../models/user/teacher');
const TeachingAssignment = require('../../models/subject/teachingAssignment');

/**
 * ✅ Học sinh: Lấy danh sách khảo sát có thể tham gia
 */
exports.getAvailableSurveys = async (req, res) => {
  try {
    const studentId = req.user?.accountId;
    if (!studentId) {
      return res.status(401).json({ message: 'Không tìm thấy thông tin học sinh' });
    }

    // ✅ Lấy thông tin học sinh
    const student = await Student.findOne({ accountId: studentId })
      .populate('classId', 'className classCode grade year')
      .lean();

    if (!student) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin học sinh' });
    }

    const currentYear = student.classId?.year || req.query?.year;
    const currentSemester = req.query?.semester || '1';

    // ✅ Tự động đóng khảo sát đã hết hạn trước khi query
    const now = new Date();
    await Survey.updateMany(
      {
        endDate: { $lt: now },
        status: { $nin: ['closed', 'draft'] }
      },
      { $set: { status: 'closed', updatedAt: now } }
    );

    // ✅ Lấy khảo sát active cho lớp của học sinh
    const query = {
      status: 'active',
      isDeleted: { $ne: true },
      year: currentYear,
      semester: currentSemester,
      $or: [
        { allowedClasses: { $in: [student.classId?._id] } },
        { allowedStudents: { $in: [student._id] } },
        { allowedClasses: { $size: 0 }, allowedStudents: { $size: 0 } } // Tất cả học sinh
      ]
    };

    const surveys = await Survey.find(query)
      .populate('subjectId', 'name code')
      .select('title description subjectId questions minScore maxScore startDate endDate')
      .lean();

    // ✅ Kiểm tra học sinh đã submit chưa
    const surveysWithStatus = await Promise.all(surveys.map(async (survey) => {
      // Lấy giáo viên dạy môn này cho lớp của học sinh
      const assignments = await TeachingAssignment.find({
        subjectId: survey.subjectId._id,
        classId: student.classId?._id,
        year: currentYear,
        semester: currentSemester,
        isDeleted: { $ne: true }
      })
        .populate('teacherId', 'name teacherCode')
        .lean();

      const teachers = assignments.map(a => ({
        _id: a.teacherId?._id,
        name: a.teacherId?.name,
        teacherCode: a.teacherId?.teacherCode
      }));

      // ✅ Kiểm tra đã submit cho từng giáo viên
      const teachersWithStatus = await Promise.all(teachers.map(async (teacher) => {
        const response = await SurveyResponse.findOne({
          surveyId: survey._id,
          studentId: student._id,
          teacherId: teacher._id,
          year: currentYear,
          isDeleted: { $ne: true }
        }).lean();

        return {
          ...teacher,
          submitted: !!response,
          hasSubmitted: !!response, // ✅ Thêm hasSubmitted để tương thích với frontend
          submittedAt: response?.submittedAt || null
        };
      }));

      return {
        ...survey,
        teachers: teachersWithStatus,
        totalQuestions: survey.questions?.length || 0
      };
    }));

    res.json({
      surveys: surveysWithStatus,
      student: {
        _id: student._id,
        name: student.name,
        studentCode: student.studentCode,
        classId: student.classId
      }
    });
  } catch (error) {
    console.error('❌ Lỗi khi lấy danh sách khảo sát:', error);
    res.status(500).json({ 
      message: 'Lỗi khi lấy danh sách khảo sát', 
      error: error.message 
    });
  }
};

/**
 * ✅ Học sinh: Submit đánh giá giáo viên
 * Chỉ submit 1 lần / khảo sát / GV / năm học
 */
exports.submitSurveyResponse = async (req, res) => {
  try {
    const { surveyId, teacherId, answers } = req.body;
    const studentAccountId = req.user?.accountId;

    if (!surveyId || !teacherId || !answers || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }

    // ✅ Lấy thông tin học sinh (CHỈ HỌC SINH MỚI CÓ THỂ SUBMIT)
    const student = await Student.findOne({ 
      accountId: studentAccountId,
      studentCode: { $exists: true, $ne: null } // ✅ Đảm bảo có studentCode (học sinh mới có field này)
    }).lean();
    if (!student) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin học sinh hoặc tài khoản không phải học sinh' });
    }
    
    // ✅ Validate thêm: Đảm bảo có studentCode
    if (!student.studentCode) {
      return res.status(403).json({ message: 'Chỉ học sinh mới có thể tham gia khảo sát' });
    }

    // ✅ Kiểm tra khảo sát tồn tại và active
    const survey = await Survey.findById(surveyId)
      .populate('subjectId', 'name code')
      .lean();

    if (!survey) {
      return res.status(404).json({ message: 'Không tìm thấy khảo sát' });
    }

    if (survey.status !== 'active') {
      return res.status(400).json({ message: 'Khảo sát không còn active' });
    }

    if (survey.isDeleted) {
      return res.status(400).json({ message: 'Khảo sát đã bị xóa' });
    }

    // ✅ Kiểm tra thời gian khảo sát
    const now = new Date();
    if (survey.startDate && now < new Date(survey.startDate)) {
      return res.status(400).json({ 
        message: `Khảo sát chưa bắt đầu. Thời gian bắt đầu: ${new Date(survey.startDate).toLocaleString('vi-VN')}` 
      });
    }
    
    if (survey.endDate && now > new Date(survey.endDate)) {
      return res.status(400).json({ 
        message: `Khảo sát đã kết thúc. Thời gian kết thúc: ${new Date(survey.endDate).toLocaleString('vi-VN')}` 
      });
    }

    // ✅ Kiểm tra đã submit chưa
    const existingResponse = await SurveyResponse.findOne({
      surveyId,
      studentId: student._id,
      teacherId,
      year: survey.year,
      isDeleted: { $ne: true }
    });

    if (existingResponse) {
      return res.status(400).json({ 
        message: 'Bạn đã đánh giá giáo viên này cho khảo sát này rồi' 
      });
    }

    // ✅ Validate answers
    const surveyQuestions = survey.questions || [];
    if (answers.length !== surveyQuestions.length) {
      return res.status(400).json({ 
        message: `Số câu trả lời không khớp. Yêu cầu ${surveyQuestions.length} câu hỏi` 
      });
    }

    // ✅ Format answers với thông tin câu hỏi
    const formattedAnswers = answers.map((ans, index) => {
      const question = surveyQuestions.find(q => 
        q._id?.toString() === ans.questionId?.toString() || 
        q.order === (ans.order || index + 1)
      );

      if (!question) {
        throw new Error(`Không tìm thấy câu hỏi với ID: ${ans.questionId || ans.order}`);
      }

      if (ans.score < survey.minScore || ans.score > survey.maxScore) {
        throw new Error(`Điểm phải từ ${survey.minScore} đến ${survey.maxScore}`);
      }

      return {
        questionId: question._id,
        questionOrder: question.order,
        score: ans.score,
        question: question.question,
        weight: question.weight || 1
      };
    });

    // ✅ Tạo phản hồi
    const response = await SurveyResponse.create({
      surveyId,
      studentId: student._id,
      teacherId,
      answers: formattedAnswers,
      year: survey.year,
      semester: survey.semester,
      submittedAt: new Date()
    });

    res.status(201).json({
      message: 'Đã gửi đánh giá thành công',
      response: {
        _id: response._id,
        surveyId: response.surveyId,
        teacherId: response.teacherId,
        averageScore: response.averageScore,
        weightedAverageScore: response.weightedAverageScore,
        submittedAt: response.submittedAt
      }
    });
  } catch (error) {
    console.error('❌ Lỗi khi submit đánh giá:', error);
    res.status(500).json({ 
      message: error.message || 'Lỗi khi submit đánh giá', 
      error: error.message 
    });
  }
};

/**
 * ✅ Giáo viên: Xem thống kê điểm khảo sát của mình
 * Ẩn danh: không biết học sinh nào đánh giá
 */
exports.getTeacherStatistics = async (req, res) => {
  try {
    const teacherAccountId = req.user?.accountId;
    const { surveyId, year, semester, subjectId } = req.query;

    // ✅ Lấy thông tin giáo viên
    const teacher = await Teacher.findOne({ accountId: teacherAccountId }).lean();
    if (!teacher) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin giáo viên' });
    }

    const query = {
      teacherId: teacher._id,
      isDeleted: { $ne: true }
    };

    if (surveyId) query.surveyId = surveyId;
    if (year) query.year = year;
    if (semester) query.semester = semester;

    // ✅ Lấy tất cả phản hồi
    const responses = await SurveyResponse.find(query)
      .populate('surveyId', 'title subjectId questions')
      .populate({
        path: 'surveyId',
        populate: { path: 'subjectId', select: 'name code' }
      })
      .lean();

    if (responses.length === 0) {
      return res.json({
        teacher: {
          _id: teacher._id,
          name: teacher.name,
          teacherCode: teacher.teacherCode
        },
        statistics: [],
        summary: {
          totalResponses: 0,
          averageScore: 0,
          weightedAverageScore: 0
        }
      });
    }

    // ✅ Nhóm theo survey
    const surveyMap = new Map();
    responses.forEach(response => {
      const surveyId = response.surveyId?._id?.toString();
      if (!surveyId) return;

      if (!surveyMap.has(surveyId)) {
        surveyMap.set(surveyId, {
          survey: response.surveyId,
          responses: [],
          questionStats: {}
        });
      }

      surveyMap.get(surveyId).responses.push(response);
    });

    // ✅ Tính thống kê cho từng khảo sát
    const statistics = Array.from(surveyMap.values()).map(surveyData => {
      const { survey, responses: surveyResponses } = surveyData;
      const questions = survey.questions || [];

      // ✅ Tính điểm trung bình từng câu hỏi
      const questionStats = questions.map((question, index) => {
        const questionId = question._id?.toString();
        const questionResponses = surveyResponses
          .map(r => r.answers?.find(a => 
            a.questionId?.toString() === questionId || 
            a.questionOrder === question.order
          ))
          .filter(Boolean);

        if (questionResponses.length === 0) {
          return {
            questionId: questionId,
            questionOrder: question.order,
            question: question.question,
            averageScore: 0,
            responseCount: 0,
            scoreDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
          };
        }

        const totalScore = questionResponses.reduce((sum, ans) => sum + (ans.score || 0), 0);
        const averageScore = totalScore / questionResponses.length;

        // ✅ Phân bố điểm
        const scoreDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        questionResponses.forEach(ans => {
          const score = ans.score || 0;
          if (score >= 1 && score <= 5) {
            scoreDistribution[score] = (scoreDistribution[score] || 0) + 1;
          }
        });

        return {
          questionId: questionId,
          questionOrder: question.order,
          question: question.question,
          averageScore: Number(averageScore.toFixed(2)),
          responseCount: questionResponses.length,
          scoreDistribution
        };
      });

      // ✅ Điểm trung bình tổng thể
      const totalAverage = surveyResponses.reduce((sum, r) => sum + (r.averageScore || 0), 0) / surveyResponses.length;
      const totalWeightedAverage = surveyResponses.reduce((sum, r) => sum + (r.weightedAverageScore || 0), 0) / surveyResponses.length;

      return {
        survey: {
          _id: survey._id,
          title: survey.title,
          subjectId: survey.subjectId
        },
        responseCount: surveyResponses.length,
        questionStatistics: questionStats,
        overallAverage: Number(totalAverage.toFixed(2)),
        overallWeightedAverage: Number(totalWeightedAverage.toFixed(2))
      };
    });

    // ✅ Tổng hợp
    const allAverages = responses.map(r => r.averageScore || 0).filter(score => score > 0);
    const allWeightedAverages = responses.map(r => r.weightedAverageScore || 0).filter(score => score > 0);

    const summary = {
      totalResponses: responses.length,
      averageScore: allAverages.length > 0 
        ? Number((allAverages.reduce((a, b) => a + b, 0) / allAverages.length).toFixed(2))
        : 0,
      weightedAverageScore: allWeightedAverages.length > 0
        ? Number((allWeightedAverages.reduce((a, b) => a + b, 0) / allWeightedAverages.length).toFixed(2))
        : 0
    };

    res.json({
      teacher: {
        _id: teacher._id,
        name: teacher.name,
        teacherCode: teacher.teacherCode
      },
      statistics,
      summary
    });
  } catch (error) {
    console.error('❌ Lỗi khi lấy thống kê giáo viên:', error);
    res.status(500).json({ 
      message: 'Lỗi khi lấy thống kê giáo viên', 
      error: error.message 
    });
  }
};

/**
 * ✅ BGH: Xem báo cáo tổng hợp khảo sát
 * So sánh giáo viên, thống kê toàn trường
 */
exports.getBGHReport = async (req, res) => {
  try {
    const { year, semester, subjectId, classId, surveyId } = req.query;

    const query = {
      isDeleted: { $ne: true }
    };

    if (year) query.year = year;
    if (semester) query.semester = semester;
    if (surveyId) query.surveyId = surveyId;

    // ✅ Lấy tất cả phản hồi
    let responses = await SurveyResponse.find(query)
      .populate('surveyId', 'title subjectId')
      .populate({
        path: 'surveyId',
        populate: { path: 'subjectId', select: 'name code' }
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

    // ✅ Filter theo classId nếu có
    if (classId) {
      responses = responses.filter(r => 
        r.studentId?.classId?._id?.toString() === classId
      );
    }

    // ✅ Nhóm theo giáo viên
    const teacherMap = new Map();
    responses.forEach(response => {
      const teacherId = response.teacherId?._id?.toString();
      if (!teacherId) return;

      if (!teacherMap.has(teacherId)) {
        teacherMap.set(teacherId, {
          teacher: response.teacherId,
          responses: [],
          surveys: new Set()
        });
      }

      teacherMap.get(teacherId).responses.push(response);
      if (response.surveyId?._id) {
        teacherMap.get(teacherId).surveys.add(response.surveyId._id.toString());
      }
    });

    // ✅ Tính thống kê cho từng giáo viên
    const teacherStatistics = Array.from(teacherMap.values()).map(teacherData => {
      const { teacher, responses: teacherResponses } = teacherData;
      
      const averages = teacherResponses.map(r => r.averageScore || 0).filter(score => score > 0);
      const weightedAverages = teacherResponses.map(r => r.weightedAverageScore || 0).filter(score => score > 0);

      // ✅ Nhóm theo môn học
      const subjectMap = new Map();
      teacherResponses.forEach(response => {
        const subjectId = response.surveyId?.subjectId?._id?.toString();
        const subjectName = response.surveyId?.subjectId?.name;
        
        if (!subjectId) return;

        if (!subjectMap.has(subjectId)) {
          subjectMap.set(subjectId, {
            subjectId,
            subjectName,
            responses: []
          });
        }

        subjectMap.get(subjectId).responses.push(response);
      });

      const subjectStatistics = Array.from(subjectMap.values()).map(subjectData => {
        const subjectAverages = subjectData.responses.map(r => r.averageScore || 0).filter(score => score > 0);
        return {
          subjectId: subjectData.subjectId,
          subjectName: subjectData.subjectName,
          responseCount: subjectData.responses.length,
          averageScore: subjectAverages.length > 0
            ? Number((subjectAverages.reduce((a, b) => a + b, 0) / subjectAverages.length).toFixed(2))
            : 0
        };
      });

      return {
        teacher: {
          _id: teacher._id,
          name: teacher.name,
          teacherCode: teacher.teacherCode
        },
        totalResponses: teacherResponses.length,
        totalSurveys: teacherData.surveys.size,
        averageScore: averages.length > 0
          ? Number((averages.reduce((a, b) => a + b, 0) / averages.length).toFixed(2))
          : 0,
        weightedAverageScore: weightedAverages.length > 0
          ? Number((weightedAverages.reduce((a, b) => a + b, 0) / weightedAverages.length).toFixed(2))
          : 0,
        subjectStatistics
      };
    });

    // ✅ Sắp xếp theo điểm trung bình (cao nhất trước)
    teacherStatistics.sort((a, b) => b.averageScore - a.averageScore);

    // ✅ Thống kê tổng hợp
    const allAverages = responses.map(r => r.averageScore || 0).filter(score => score > 0);
    const summary = {
      totalResponses: responses.length,
      totalTeachers: teacherStatistics.length,
      overallAverage: allAverages.length > 0
        ? Number((allAverages.reduce((a, b) => a + b, 0) / allAverages.length).toFixed(2))
        : 0,
      highestScore: teacherStatistics.length > 0 ? teacherStatistics[0] : null,
      lowestScore: teacherStatistics.length > 0 ? teacherStatistics[teacherStatistics.length - 1] : null
    };

    res.json({
      summary,
      teacherStatistics,
      filters: {
        year: year || 'all',
        semester: semester || 'all',
        subjectId: subjectId || 'all',
        classId: classId || 'all'
      }
    });
  } catch (error) {
    console.error('❌ Lỗi khi lấy báo cáo BGH:', error);
    res.status(500).json({ 
      message: 'Lỗi khi lấy báo cáo BGH', 
      error: error.message 
    });
  }
};

