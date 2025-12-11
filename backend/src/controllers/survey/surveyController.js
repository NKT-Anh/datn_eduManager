const Survey = require('../../models/survey/survey');
const SurveyResponse = require('../../models/survey/surveyResponse');
const Student = require('../../models/user/student');
const Teacher = require('../../models/user/teacher');
const Class = require('../../models/class/class');
const Subject = require('../../models/subject/subject');
const TeachingAssignment = require('../../models/subject/teachingAssignment');

/**
 * ✅ Tạo khảo sát mới
 * Admin: Tạo khảo sát với mặc định 5 câu hỏi
 */
exports.createSurvey = async (req, res) => {
  try {
    const { title, description, subjectId, semester, year, questions, minScore, maxScore, allowedClasses, startDate, endDate } = req.body;
    const createdBy = req.user?.accountId;

    // ✅ Validation đầy đủ
    if (!title || !subjectId || !semester || !year) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc: title, subjectId, semester, year' });
    }

    if (!createdBy) {
      return res.status(401).json({ message: 'Không xác định được người tạo. Vui lòng đăng nhập lại.' });
    }

    // ✅ Kiểm tra subjectId có tồn tại không
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({ message: 'subjectId không hợp lệ' });
    }

    const subjectExists = await Subject.findById(subjectId);
    if (!subjectExists) {
      return res.status(404).json({ message: 'Không tìm thấy môn học với ID này' });
    }

    // ✅ Validate semester
    if (semester !== '1' && semester !== '2') {
      return res.status(400).json({ message: 'Học kỳ phải là "1" hoặc "2"' });
    }

    // ✅ Validate year format
    if (!/^\d{4}-\d{4}$/.test(year)) {
      return res.status(400).json({ message: 'Năm học phải có định dạng YYYY-YYYY (ví dụ: 2024-2025)' });
    }

    // ✅ Mặc định 5 câu hỏi nếu không có
    let surveyQuestions = questions || [];
    if (surveyQuestions.length === 0) {
      surveyQuestions = [
        { question: 'Giáo viên chuẩn bị bài giảng kỹ lưỡng và đầy đủ.', order: 1, weight: 1 },
        { question: 'Giáo viên giảng bài rõ ràng, dễ hiểu.', order: 2, weight: 1 },
        { question: 'Giáo viên khuyến khích học sinh đặt câu hỏi và tham gia bài học.', order: 3, weight: 1 },
        { question: 'Giáo viên đánh giá công bằng và khách quan trong việc chấm điểm.', order: 4, weight: 1 },
        { question: 'Giáo viên quan tâm, hỗ trợ học sinh khi gặp khó khăn trong môn học.', order: 5, weight: 1 },
      ];
    }

    // ✅ Đảm bảo order được sắp xếp
    surveyQuestions = surveyQuestions.map((q, index) => ({
      ...q,
      order: q.order || index + 1,
      weight: q.weight || 1
    })).sort((a, b) => a.order - b.order);

    // ✅ Validate dates
    let parsedStartDate = null;
    let parsedEndDate = null;
    if (startDate) {
      parsedStartDate = new Date(startDate);
      if (isNaN(parsedStartDate.getTime())) {
        return res.status(400).json({ message: 'Ngày bắt đầu không hợp lệ' });
      }
    }
    if (endDate) {
      parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({ message: 'Ngày kết thúc không hợp lệ' });
      }
    }
    if (parsedStartDate && parsedEndDate && parsedStartDate >= parsedEndDate) {
      return res.status(400).json({ message: 'Ngày kết thúc phải sau ngày bắt đầu' });
    }

    // ✅ Validate allowedClasses nếu có
    if (allowedClasses && Array.isArray(allowedClasses) && allowedClasses.length > 0) {
      for (const classId of allowedClasses) {
        if (!mongoose.Types.ObjectId.isValid(classId)) {
          return res.status(400).json({ message: `ClassId không hợp lệ: ${classId}` });
        }
      }
    }

    const survey = await Survey.create({
      title: title.trim(),
      description: description ? description.trim() : '',
      subjectId,
      semester,
      year,
      questions: surveyQuestions,
      minScore: minScore || 1,
      maxScore: maxScore || 5,
      allowedClasses: allowedClasses || [],
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      status: 'draft',
      createdBy,
      updatedBy: createdBy
    });

    const populatedSurvey = await Survey.findById(survey._id)
      .populate('subjectId', 'name code')
      .populate('allowedClasses', 'className classCode grade')
      .populate('createdBy', 'email')
      .lean();

    res.status(201).json({
      message: 'Đã tạo khảo sát thành công',
      survey: populatedSurvey
    });
  } catch (error) {
    console.error('❌ Lỗi khi tạo khảo sát:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Lỗi khi tạo khảo sát', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * ✅ Lấy danh sách khảo sát
 * Admin/BGH: Xem tất cả
 * Teacher: Xem khảo sát liên quan đến mình
 */
exports.getAllSurveys = async (req, res) => {
  try {
    const { subjectId, semester, year, status, isDeleted = 'false' } = req.query;
    const user = req.user;
    const role = user?.role;

    const query = {};

    // ✅ Soft Delete filter
    if (isDeleted !== 'true') {
      query.isDeleted = { $ne: true };
    }

    // ✅ Filter theo query params
    if (subjectId) query.subjectId = subjectId;
    if (semester) query.semester = semester;
    if (year) query.year = year;
    if (status) query.status = status;

    // ✅ Teacher chỉ xem khảo sát của môn mình dạy
    if (role === 'teacher' && !user?.teacherFlags?.isLeader) {
      const teacher = await Teacher.findOne({ accountId: user.accountId }).lean();
      if (teacher) {
        // Lấy các môn giáo viên dạy
        const assignments = await TeachingAssignment.find({ 
          teacherId: teacher._id,
          isDeleted: { $ne: true }
        }).select('subjectId').lean();
        
        const subjectIds = [...new Set(assignments.map(a => a.subjectId?.toString()).filter(Boolean))];
        if (subjectIds.length > 0) {
          query.subjectId = { $in: subjectIds };
        } else {
          // Nếu không có môn nào, trả về rỗng
          return res.json({ surveys: [], count: 0 });
        }
      }
    }

    const surveys = await Survey.find(query)
      .populate('subjectId', 'name code')
      .populate('allowedClasses', 'className classCode grade')
      .populate('createdBy', 'email')
      .select('title description subjectId semester year questions minScore maxScore status allowedClasses allowedStudents startDate endDate notificationSent notificationSentAt createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    // ✅ Tự động đóng khảo sát đã hết hạn (endDate đã qua và status chưa phải 'closed')
    const now = new Date();
    const expiredSurveys = surveys.filter(survey => {
      if (!survey.endDate) return false;
      const endDate = new Date(survey.endDate);
      return endDate < now && survey.status !== 'closed' && survey.status !== 'draft';
    });

    if (expiredSurveys.length > 0) {
      const expiredIds = expiredSurveys.map(s => s._id);
      await Survey.updateMany(
        { _id: { $in: expiredIds } },
        { $set: { status: 'closed', updatedAt: now } }
      );
      console.log(`✅ Đã tự động đóng ${expiredIds.length} khảo sát đã hết hạn`);
      
      // ✅ Cập nhật lại status trong kết quả trả về
      surveys.forEach(survey => {
        if (expiredIds.some(id => String(id) === String(survey._id))) {
          survey.status = 'closed';
        }
      });
    }

    // ✅ Đếm số phản hồi cho mỗi khảo sát (CHỈ ĐẾM PHẢN HỒI TỪ HỌC SINH)
    // SurveyResponse.studentId là required và ref đến Student -> đảm bảo chỉ có học sinh mới submit được
    const surveysWithStats = await Promise.all(surveys.map(async (survey) => {
      const responseCount = await SurveyResponse.countDocuments({ 
        surveyId: survey._id,
        isDeleted: { $ne: true }
        // ✅ studentId trong SurveyResponse là required và ref đến Student -> chỉ học sinh mới có thể submit
      });
      
      return {
        ...survey,
        responseCount,
        totalQuestions: survey.questions?.length || 0
      };
    }));

    res.json({
      surveys: surveysWithStats,
      count: surveysWithStats.length
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
 * ✅ Lấy chi tiết 1 khảo sát
 */
exports.getSurvey = async (req, res) => {
  try {
    const { id } = req.params;
    const { isDeleted } = req.query;

    const query = { _id: id };
    if (isDeleted !== 'true') {
      query.isDeleted = { $ne: true };
    }

    const survey = await Survey.findOne(query)
      .populate('subjectId', 'name code')
      .populate('allowedClasses', 'className classCode grade')
      .populate('createdBy', 'email')
      .populate('updatedBy', 'email')
      .lean();

    if (!survey) {
      return res.status(404).json({ message: 'Không tìm thấy khảo sát' });
    }

    // ✅ Tự động đóng khảo sát nếu đã hết hạn (endDate đã qua và status chưa phải 'closed' hoặc 'draft')
    const now = new Date();
    if (survey.endDate && new Date(survey.endDate) < now && survey.status !== 'closed' && survey.status !== 'draft') {
      await Survey.findByIdAndUpdate(survey._id, { 
        $set: { status: 'closed', updatedAt: now } 
      });
      survey.status = 'closed';
      console.log(`✅ Đã tự động đóng khảo sát ${survey._id} vì đã hết hạn`);
    }

    // ✅ Đếm số phản hồi (CHỈ ĐẾM PHẢN HỒI TỪ HỌC SINH)
    // SurveyResponse.studentId là required và ref đến Student -> đảm bảo chỉ có học sinh mới submit được
    const responseCount = await SurveyResponse.countDocuments({ 
      surveyId: survey._id,
      isDeleted: { $ne: true }
      // ✅ studentId trong SurveyResponse là required và ref đến Student -> chỉ học sinh mới có thể submit
    });

    res.json({
      ...survey,
      responseCount,
      totalQuestions: survey.questions?.length || 0
    });
  } catch (error) {
    console.error('❌ Lỗi khi lấy khảo sát:', error);
    res.status(500).json({ 
      message: 'Lỗi khi lấy khảo sát', 
      error: error.message 
    });
  }
};

/**
 * ✅ Cập nhật khảo sát
 * Khi sửa khảo sát active → đảm bảo dữ liệu cũ không bị ảnh hưởng
 */
exports.updateSurvey = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const updatedBy = req.user?.accountId;

    const survey = await Survey.findById(id);
    if (!survey) {
      return res.status(404).json({ message: 'Không tìm thấy khảo sát' });
    }

    // ✅ Nếu khảo sát đang active và có phản hồi, không cho sửa câu hỏi
    if (survey.status === 'active') {
      // ✅ Đếm số phản hồi (CHỈ ĐẾM PHẢN HỒI TỪ HỌC SINH)
      // SurveyResponse.studentId là required và ref đến Student -> đảm bảo chỉ có học sinh mới submit được
      const responseCount = await SurveyResponse.countDocuments({ 
        surveyId: survey._id,
        isDeleted: { $ne: true }
        // ✅ studentId trong SurveyResponse là required và ref đến Student -> chỉ học sinh mới có thể submit
      });
      
      if (responseCount > 0 && updateData.questions) {
        return res.status(400).json({ 
          message: 'Không thể sửa câu hỏi khi khảo sát đang active và đã có phản hồi. Vui lòng tạo khảo sát mới.' 
        });
      }
    }

    // ✅ Cập nhật dữ liệu
    if (updateData.questions) {
      updateData.questions = updateData.questions.map((q, index) => ({
        ...q,
        order: q.order || index + 1
      })).sort((a, b) => a.order - b.order);
    }

    updateData.updatedBy = updatedBy;
    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
    if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);

    const updatedSurvey = await Survey.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate('subjectId', 'name code')
      .populate('allowedClasses', 'className classCode grade')
      .populate('updatedBy', 'email')
      .lean();

    res.json({
      message: 'Đã cập nhật khảo sát thành công',
      survey: updatedSurvey
    });
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật khảo sát:', error);
    res.status(500).json({ 
      message: 'Lỗi khi cập nhật khảo sát', 
      error: error.message 
    });
  }
};

/**
 * ✅ Xóa mềm khảo sát
 * Soft-delete: giữ dữ liệu phản hồi để tính trung bình
 */
exports.deleteSurvey = async (req, res) => {
  try {
    const { id } = req.params;

    const survey = await Survey.findById(id);
    if (!survey) {
      return res.status(404).json({ message: 'Không tìm thấy khảo sát' });
    }

    // ✅ Soft delete
    survey.isDeleted = true;
    survey.deletedAt = new Date();
    survey.status = 'inactive';
    await survey.save();

    res.json({
      message: 'Đã xóa khảo sát thành công',
      survey: {
        _id: survey._id,
        title: survey.title,
        isDeleted: survey.isDeleted,
        deletedAt: survey.deletedAt
      }
    });
  } catch (error) {
    console.error('❌ Lỗi khi xóa khảo sát:', error);
    res.status(500).json({ 
      message: 'Lỗi khi xóa khảo sát', 
      error: error.message 
    });
  }
};

/**
 * ✅ Mở khảo sát cho học sinh
 * Chọn lớp, gửi thông báo
 */
exports.openSurveyForStudents = async (req, res) => {
  try {
    const { id } = req.params;
    const { classIds, studentIds, sendNotification } = req.body || {};

    const survey = await Survey.findById(id);
    if (!survey) {
      return res.status(404).json({ message: 'Không tìm thấy khảo sát' });
    }

    // ✅ Cập nhật lớp/học sinh được phép tham gia
    if (classIds) {
      survey.allowedClasses = classIds;
    }
    if (studentIds) {
      survey.allowedStudents = studentIds;
    }

    // ✅ Kích hoạt khảo sát
    survey.status = 'active';
    if (sendNotification) {
      survey.notificationSent = true;
      survey.notificationSentAt = new Date();
    }

    await survey.save();

    // ✅ Gửi thông báo đến học sinh (nếu có)
    let notificationSent = false;
    if (sendNotification !== false) {
      try {
        const Student = require('../../models/user/student');
        const Account = require('../../models/user/account');
        const { sendNotification } = require('../notification/notificationController');

        // Lấy danh sách học sinh cần thông báo (chỉ học sinh đúng năm học)
        let targetStudentIds = [];
        const surveyYear = survey.year; // Năm học của khảo sát
        
        if (studentIds && studentIds.length > 0) {
          // ✅ Kiểm tra học sinh có đúng năm học không
          const validStudents = await Student.find({
            _id: { $in: studentIds },
            currentYear: surveyYear, // ✅ Chỉ lấy học sinh đúng năm học
            status: 'active',
            isDeleted: { $ne: true }
          }).select('accountId').lean();
          targetStudentIds = validStudents
            .map(s => s.accountId?.toString())
            .filter(Boolean);
        } else if (classIds && classIds.length > 0) {
          // ✅ Lấy học sinh từ các lớp (chỉ học sinh đúng năm học)
          const Class = require('../../models/class/class');
          const classes = await Class.find({ _id: { $in: classIds } }).lean();
          const classIdsArray = classes.map(c => c._id);
          
          const students = await Student.find({
            classId: { $in: classIdsArray },
            currentYear: surveyYear, // ✅ Chỉ lấy học sinh đúng năm học
            status: 'active',
            isDeleted: { $ne: true }
          }).select('accountId').lean();
          
          targetStudentIds = students
            .map(s => s.accountId?.toString())
            .filter(Boolean);
        } else if (survey.allowedClasses && survey.allowedClasses.length > 0) {
          // ✅ Lấy học sinh từ các lớp được phép (chỉ học sinh đúng năm học)
          const Class = require('../../models/class/class');
          const classes = await Class.find({ _id: { $in: survey.allowedClasses } }).lean();
          const classIdsArray = classes.map(c => c._id);
          
          const students = await Student.find({
            classId: { $in: classIdsArray },
            currentYear: surveyYear, // ✅ Chỉ lấy học sinh đúng năm học
            status: 'active',
            isDeleted: { $ne: true }
          }).select('accountId').lean();
          
          targetStudentIds = students
            .map(s => s.accountId?.toString())
            .filter(Boolean);
        } else {
          // ✅ Tất cả học sinh (chỉ học sinh đúng năm học)
          const allStudents = await Student.find({
            currentYear: surveyYear, // ✅ Chỉ lấy học sinh đúng năm học
            status: 'active',
            isDeleted: { $ne: true }
          }).select('accountId').lean();
          targetStudentIds = allStudents
            .map(s => s.accountId?.toString())
            .filter(Boolean);
        }

        // Lấy Firebase UIDs từ Account IDs
        if (targetStudentIds.length > 0) {
          const uniqueAccountIds = [...new Set(targetStudentIds)];
          const accounts = await Account.find({ _id: { $in: uniqueAccountIds } })
            .select('uid')
            .lean();
          const targetUids = accounts.map(acc => acc.uid).filter(Boolean);

          if (targetUids.length > 0) {
            await sendNotification({
              title: `Khảo sát mới: ${survey.title}`,
              content: `Bạn có một khảo sát đánh giá giáo viên mới cần hoàn thành. Vui lòng truy cập hệ thống để tham gia.`,
              recipientType: 'user',
              recipientIds: targetUids,
              sender: req.user.accountId,
              link: `/student/surveys`,
            });
            notificationSent = true;
          }
        }
      } catch (notifError) {
        console.error('❌ Lỗi khi gửi thông báo:', notifError);
        // Không throw error, chỉ log để không ảnh hưởng đến việc mở khảo sát
      }
    }

    const populatedSurvey = await Survey.findById(survey._id)
      .populate('allowedClasses', 'className classCode grade')
      .populate('allowedStudents', 'name studentCode')
      .lean();

    res.json({
      message: notificationSent
        ? 'Đã mở khảo sát cho học sinh thành công và gửi thông báo'
        : 'Đã mở khảo sát cho học sinh thành công',
      survey: populatedSurvey,
      notificationSent
    });
  } catch (error) {
    console.error('❌ Lỗi khi mở khảo sát:', error);
    res.status(500).json({ 
      message: 'Lỗi khi mở khảo sát', 
      error: error.message 
    });
  }
};

/**
 * ✅ Theo dõi tiến độ khảo sát
 * Xem số HS đã submit, danh sách HS chưa làm
 */
exports.getSurveyProgress = async (req, res) => {
  try {
    const { id } = req.params;

    const survey = await Survey.findById(id)
      .populate('allowedClasses', 'className classCode grade')
      .lean();

    if (!survey) {
      return res.status(404).json({ message: 'Không tìm thấy khảo sát' });
    }

    // ✅ Lấy danh sách học sinh được phép tham gia (CHỈ LẤY HỌC SINH, KHÔNG LẤY GIÁO VIÊN)
    // Đảm bảo chỉ query từ Student model, không query từ Teacher model
    let allowedStudentIds = [];
    const surveyYear = survey.year; // Năm học của khảo sát
    
    if (survey.allowedStudents && survey.allowedStudents.length > 0) {
      // Nếu có danh sách học sinh cụ thể, kiểm tra xem học sinh có đúng năm học và ĐANG HỌC không
      // ✅ CHỈ LẤY TỪ STUDENT MODEL - KHÔNG LẤY GIÁO VIÊN
      // ✅ CHỈ LẤY HỌC SINH ĐANG HỌC (status = 'active')
      const studentIds = survey.allowedStudents.map(s => s._id || s);
      const students = await Student.find({
        _id: { $in: studentIds },
        currentYear: surveyYear, // ✅ Chỉ lấy học sinh đúng năm học
        status: 'active', // ✅ CHỈ LẤY HỌC SINH ĐANG HỌC
        isDeleted: { $ne: true },
        studentCode: { $exists: true, $ne: null } // ✅ Đảm bảo có studentCode
        // ✅ Không có field teacherCode, departmentId -> đảm bảo chỉ lấy học sinh
      }).select('_id studentCode status').lean(); // ✅ Select status để validate
      
      // ✅ Validate: Đảm bảo tất cả đều có studentCode (học sinh mới có field này)
      const validStudents = students.filter(s => s.studentCode);
      allowedStudentIds = validStudents.map(s => s._id);
      
      if (students.length !== validStudents.length) {
        console.warn(`⚠️ Có ${students.length - validStudents.length} bản ghi không có studentCode (có thể không phải học sinh)`);
      }
    } else if (survey.allowedClasses && survey.allowedClasses.length > 0) {
      // ✅ Lấy học sinh từ các lớp - QUAN TRỌNG: Lấy theo currentYear (niên khóa) từ thông tin học sinh
      const Class = require('../../models/class/class');
      const classIds = survey.allowedClasses.map(c => c._id || c);
      
      // ✅ Lọc lớp theo năm học trước
      const classes = await Class.find({
        _id: { $in: classIds },
        year: surveyYear, // ✅ Chỉ lấy lớp đúng năm học
        isDeleted: { $ne: true }
      }).select('_id year').lean();
      
      const validClassIds = classes.map(c => c._id);
      
      // ✅ QUAN TRỌNG: Lấy học sinh theo currentYear (niên khóa) từ thông tin học sinh
      // Điều kiện QUAN TRỌNG NHẤT: currentYear phải trùng với surveyYear
      // Sau đó mới filter theo classId (nếu có)
      // Điều này đảm bảo chỉ lấy học sinh đúng niên khóa, không phụ thuộc vào dữ liệu lớp có thể không nhất quán
      const students = await Student.find({
        currentYear: surveyYear, // ✅ QUAN TRỌNG NHẤT: Lấy theo niên khóa hiện tại từ thông tin học sinh
        classId: { $in: validClassIds }, // ✅ Sau đó mới filter theo lớp (nếu có)
        status: 'active',
        isDeleted: { $ne: true },
        studentCode: { $exists: true, $ne: null } // ✅ Đảm bảo có studentCode (học sinh mới có)
      })
        .select('_id studentCode classId currentYear')
        .lean();
      
      // ✅ Validate: Đảm bảo tất cả đều có studentCode và currentYear đúng
      // QUAN TRỌNG: Validate lại currentYear một lần nữa để chắc chắn
      const validStudents = students.filter(s => {
        if (!s.studentCode) return false;
        // ✅ Kiểm tra currentYear có trùng với surveyYear không (quan trọng nhất)
        if (!s.currentYear || String(s.currentYear) !== String(surveyYear)) {
          console.warn(`⚠️ Học sinh ${s._id} có currentYear=${s.currentYear} không khớp với surveyYear=${surveyYear}`);
          return false;
        }
        return true;
      });
      
      // ✅ Loại bỏ trùng lặp (nếu có) - đảm bảo mỗi học sinh chỉ được đếm 1 lần
      const uniqueStudentIds = [...new Set(validStudents.map(s => String(s._id)))];
      allowedStudentIds = uniqueStudentIds.map(id => {
        // Tìm student object tương ứng
        const student = validStudents.find(s => String(s._id) === id);
        return student ? student._id : id;
      });
      
      if (students.length !== validStudents.length) {
        console.warn(`⚠️ Có ${students.length - validStudents.length} học sinh không hợp lệ (không có studentCode hoặc currentYear không đúng)`);
      }
      
      // ✅ Debug: Kiểm tra học sinh có currentYear không đúng
      const studentsWithWrongYear = students.filter(s => s.currentYear && String(s.currentYear) !== String(surveyYear));
      if (studentsWithWrongYear.length > 0) {
        console.warn(`⚠️ Có ${studentsWithWrongYear.length} học sinh có currentYear không đúng:`, studentsWithWrongYear.map(s => ({ id: s._id, currentYear: s.currentYear, expected: surveyYear })));
      }
      
      console.log(`📊 Khảo sát ${survey._id}: Tìm thấy ${validClassIds.length}/${classIds.length} lớp đúng năm học ${surveyYear}, ${students.length} học sinh query được (currentYear=${surveyYear}), ${validStudents.length} học sinh hợp lệ, ${allowedStudentIds.length} học sinh sau khi loại trùng`);
    } else {
      // ✅ Tất cả học sinh ĐANG HỌC - QUAN TRỌNG: Lấy theo currentYear (niên khóa) từ thông tin học sinh
      // Nếu không có allowedClasses, có thể là khảo sát cho tất cả học sinh đang học
      // ✅ CHỈ QUERY TỪ STUDENT MODEL - KHÔNG QUERY TỪ TEACHER MODEL
      // ✅ CHỈ LẤY HỌC SINH ĐANG HỌC (status = 'active')
      // ✅ QUAN TRỌNG NHẤT: Phải filter theo currentYear và lớp thuộc năm học đó
      const query = {
        status: 'active', // ✅ CHỈ LẤY HỌC SINH ĐANG HỌC
        isDeleted: { $ne: true },
        studentCode: { $exists: true, $ne: null } // ✅ Đảm bảo có studentCode (học sinh mới có field này)
      };
      
      // ✅ QUAN TRỌNG: Nếu có surveyYear, phải filter theo currentYear và lớp thuộc năm học đó
      if (surveyYear) {
        query.currentYear = surveyYear; // ✅ Lấy theo niên khóa hiện tại từ thông tin học sinh
        
        // ✅ Lấy tất cả lớp thuộc năm học này để filter học sinh
        const Class = require('../../models/class/class');
        const classesInYear = await Class.find({
          year: surveyYear,
          isDeleted: { $ne: true }
        }).select('_id').lean();
        
        const classIdsInYear = classesInYear.map(c => c._id);
        
        // ✅ Chỉ lấy học sinh có lớp thuộc năm học này
        if (classIdsInYear.length > 0) {
          query.classId = { $in: classIdsInYear };
        } else {
          // Nếu không có lớp nào, trả về rỗng
          allowedStudentIds = [];
          console.log(`📊 Khảo sát ${survey._id}: Không có lớp nào thuộc năm học ${surveyYear}`);
          return res.json({
            survey: {
              _id: survey._id,
              title: survey.title,
              status: survey.status
            },
            totalAllowed: 0,
            totalCount: 0,
            submittedCount: 0,
            notSubmittedCount: 0,
            completionRate: 0,
            notSubmittedStudents: []
          });
        }
      }
      
      const students = await Student.find(query)
        .select('_id currentYear classId studentCode status')
        .populate({
          path: 'classId',
          select: '_id year',
          match: surveyYear ? { year: surveyYear } : {} // ✅ Đảm bảo lớp thuộc năm học đúng
        })
        .lean();
      
      // ✅ Debug: Kiểm tra học sinh có currentYear không đúng hoặc null
      if (surveyYear) {
        const studentsWithNullYear = students.filter(s => !s.currentYear);
        const studentsWithWrongYear = students.filter(s => s.currentYear && String(s.currentYear) !== String(surveyYear));
        const studentsWithCorrectYear = students.filter(s => s.currentYear && String(s.currentYear) === String(surveyYear));
        
        if (studentsWithNullYear.length > 0) {
          console.warn(`⚠️ Có ${studentsWithNullYear.length} học sinh có currentYear = null/undefined (surveyYear=${surveyYear}):`, studentsWithNullYear.slice(0, 3).map(s => ({ id: s._id, studentCode: s.studentCode })));
        }
        if (studentsWithWrongYear.length > 0) {
          console.warn(`⚠️ Có ${studentsWithWrongYear.length} học sinh có currentYear không đúng (surveyYear=${surveyYear}):`, studentsWithWrongYear.slice(0, 5).map(s => ({ id: s._id, studentCode: s.studentCode, currentYear: s.currentYear, expected: surveyYear })));
        }
        console.log(`🔍 Debug: ${studentsWithCorrectYear.length} học sinh có currentYear đúng, ${studentsWithNullYear.length} học sinh có currentYear null, ${studentsWithWrongYear.length} học sinh có currentYear sai`);
      }
      
      // ✅ Validate: Đảm bảo tất cả đều có studentCode, status = 'active', currentYear đúng, và lớp hợp lệ
      let validStudents = students.filter(s => {
        if (!s.studentCode) {
          console.warn(`⚠️ Học sinh ${s._id} không có studentCode`);
          return false;
        }
        if (s.status !== 'active') {
          console.warn(`⚠️ Học sinh ${s._id} (${s.studentCode}) có status=${s.status} không phải 'active'`);
          return false;
        }
        // ✅ QUAN TRỌNG: Kiểm tra currentYear có trùng với surveyYear không
        if (surveyYear) {
          if (!s.currentYear) {
            console.warn(`⚠️ Học sinh ${s._id} (${s.studentCode}) không có currentYear (surveyYear=${surveyYear})`);
            return false;
          }
          if (String(s.currentYear) !== String(surveyYear)) {
            console.warn(`⚠️ Học sinh ${s._id} (${s.studentCode}) có currentYear=${s.currentYear} không khớp với surveyYear=${surveyYear}`);
            return false;
          }
          // ✅ QUAN TRỌNG: Kiểm tra lớp có thuộc năm học không
          if (!s.classId || !s.classId._id) {
            console.warn(`⚠️ Học sinh ${s._id} (${s.studentCode}) không có lớp hoặc lớp không hợp lệ`);
            return false;
          }
          // ✅ Kiểm tra year của lớp có trùng với surveyYear không
          if (s.classId.year && String(s.classId.year) !== String(surveyYear)) {
            console.warn(`⚠️ Học sinh ${s._id} (${s.studentCode}) có lớp thuộc năm học ${s.classId.year} không khớp với surveyYear=${surveyYear}`);
            return false;
          }
        }
        return true;
      });
      
      // ✅ Loại bỏ trùng lặp (nếu có) - đảm bảo mỗi học sinh chỉ được đếm 1 lần
      const uniqueStudentIds = [...new Set(validStudents.map(s => String(s._id)))];
      allowedStudentIds = uniqueStudentIds.map(id => {
        const student = validStudents.find(s => String(s._id) === id);
        return student ? student._id : id;
      });
      
      if (students.length !== validStudents.length) {
        console.warn(`⚠️ Có ${students.length - validStudents.length} học sinh không hợp lệ (không có studentCode, status không phải 'active', hoặc currentYear không đúng)`);
      }
      
      if (validStudents.length !== allowedStudentIds.length) {
        console.warn(`⚠️ Có ${validStudents.length - allowedStudentIds.length} học sinh trùng lặp đã được loại bỏ`);
      }
      
      console.log(`📊 Khảo sát ${survey._id}: Không có allowedClasses/allowedStudents, query được ${students.length} học sinh (currentYear=${surveyYear || 'tất cả'}), ${validStudents.length} học sinh hợp lệ, ${allowedStudentIds.length} học sinh sau khi loại trùng`);
    }

    // ✅ Lấy danh sách học sinh đã submit (CHỈ LẤY PHẢN HỒI TỪ HỌC SINH, KHÔNG LẤY TỪ GIÁO VIÊN)
    // SurveyResponse có: studentId (người submit - học sinh), teacherId (người được đánh giá - giáo viên)
    // Chỉ lấy phản hồi có studentId trong danh sách allowedStudentIds (đã được validate là học sinh)
    const submittedResponses = await SurveyResponse.find({
      surveyId: survey._id,
      studentId: { $in: allowedStudentIds }, // ✅ Chỉ đếm phản hồi từ học sinh được phép tham gia (đã validate có studentCode)
      isDeleted: { $ne: true }
    })
      .select('studentId')
      .populate('studentId', 'studentCode') // ✅ Populate để validate studentId thực sự là học sinh
      .lean();

    // ✅ Validate: Đảm bảo tất cả phản hồi đều từ học sinh (có studentCode)
    const validResponses = submittedResponses.filter(r => {
      const student = r.studentId;
      // studentId có thể là ObjectId hoặc đã populate thành object
      if (typeof student === 'object' && student !== null) {
        return student.studentCode; // ✅ Có studentCode = là học sinh
      }
      // Nếu chưa populate, vẫn tính (vì đã filter theo allowedStudentIds rồi)
      return true;
    });
    
    const submittedStudentIds = [...new Set(validResponses.map(r => {
      const student = r.studentId;
      return typeof student === 'object' && student !== null ? String(student._id) : String(student);
    }))];
    
    if (submittedResponses.length !== validResponses.length) {
      console.warn(`⚠️ Có ${submittedResponses.length - validResponses.length} phản hồi không có studentCode (có thể không phải từ học sinh)`);
    }
    
    console.log(`📊 Khảo sát ${survey._id}: ${submittedStudentIds.length}/${allowedStudentIds.length} học sinh đã submit`);

    // ✅ Danh sách học sinh chưa làm
    const notSubmittedIds = allowedStudentIds.filter(
      id => !submittedStudentIds.includes(id.toString())
    );

    // ✅ Lấy thông tin học sinh chưa làm (CHỈ LẤY HỌC SINH, KHÔNG LẤY GIÁO VIÊN)
    // Đảm bảo chỉ query từ Student model và validate có studentCode
    // ✅ CHỈ LẤY HỌC SINH ĐANG HỌC (status = 'active')
    const notSubmittedStudents = await Student.find({
      _id: { $in: notSubmittedIds },
      studentCode: { $exists: true, $ne: null }, // ✅ Đảm bảo có studentCode (học sinh mới có)
      status: 'active', // ✅ CHỈ LẤY HỌC SINH ĐANG HỌC
      isDeleted: { $ne: true },
      currentYear: surveyYear // ✅ Chỉ lấy học sinh đúng năm học
    })
      .select('name studentCode classId status')
      .populate('classId', 'className classCode')
      .lean();
    
    // ✅ Validate: Đảm bảo tất cả đều có studentCode và status = 'active'
    const validNotSubmittedStudents = notSubmittedStudents.filter(s => 
      s.studentCode && s.status === 'active'
    );
    
    if (notSubmittedStudents.length !== validNotSubmittedStudents.length) {
      console.warn(`⚠️ Có ${notSubmittedStudents.length - validNotSubmittedStudents.length} bản ghi không hợp lệ trong danh sách học sinh chưa làm`);
    }

    res.json({
      survey: {
        _id: survey._id,
        title: survey.title,
        status: survey.status
      },
      totalAllowed: allowedStudentIds.length,
      totalCount: allowedStudentIds.length, // ✅ Thêm totalCount để tương thích với frontend
      submittedCount: submittedStudentIds.length,
      notSubmittedCount: notSubmittedIds.length,
      completionRate: allowedStudentIds.length > 0 
        ? ((submittedStudentIds.length / allowedStudentIds.length) * 100).toFixed(2)
        : 0,
      notSubmittedStudents: validNotSubmittedStudents // ✅ Chỉ trả về học sinh hợp lệ (có studentCode)
    });
  } catch (error) {
    console.error('❌ Lỗi khi lấy tiến độ khảo sát:', error);
    res.status(500).json({ 
      message: 'Lỗi khi lấy tiến độ khảo sát', 
      error: error.message 
    });
  }
};

