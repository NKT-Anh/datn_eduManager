const Department = require('../../models/subject/department');
const Teacher = require('../../models/user/teacher');
const Subject = require('../../models/subject/subject');
const TeachingAssignment = require('../../models/subject/teachingAssignment');
const TeachingAssignmentProposal = require('../../models/subject/teachingAssignmentProposal');
const ClassModel = require('../../models/class/class');
const Account = require('../../models/user/account');
const ClassPeriods = require('../../models/class/classPeriods');


/**
 * ✅ Kiểm tra quyền quản lý tổ bộ môn
 */
async function canManageDepartment(req, departmentId) {
  if (!req.user || req.user.role !== 'teacher') return false;
  if (!departmentId) return false;
  
  const teacher = await Teacher.findOne({ accountId: req.user.accountId })
    .select('isDepartmentHead departmentId')
    .lean();
    
  if (!teacher || !teacher.isDepartmentHead) return false;
  return teacher.departmentId && teacher.departmentId.toString() === departmentId.toString();
}

/**
 * ✅ Dashboard quản lý bộ môn
 * - Thống kê tổng quan: số giáo viên, số môn học, số lớp đang dạy
 * - Thống kê phân công: số phân công đã có, số đề xuất đang chờ
 */
exports.getDashboard = async (req, res) => {
  try {
    const { semester } = req.query; // ✅ Không lấy year từ query nữa
    
    // ✅ Bước 1: Lấy thông tin giáo viên hiện tại để lấy departmentId
    const currentTeacher = await Teacher.findOne({ accountId: req.user.accountId })
      .select('isDepartmentHead departmentId')
      .lean();
      
    if (!currentTeacher || !currentTeacher.isDepartmentHead || !currentTeacher.departmentId) {
      return res.status(403).json({ 
        message: 'Bạn không phải trưởng bộ môn hoặc không thuộc tổ bộ môn nào' 
      });
    }

    // ✅ Bước 2: Lấy department từ departmentId để lấy year
    const departmentId = currentTeacher.departmentId._id || currentTeacher.departmentId;
    const department = await Department.findById(departmentId)
      .populate('subjectIds', 'name code')
      .populate('teacherIds', 'name teacherCode')
      .select('name code year subjectIds teacherIds')
      .lean();

    if (!department) {
      return res.status(404).json({ message: 'Không tìm thấy tổ bộ môn' });
    }

    // ✅ Bước 3: Lấy year từ department (không phải từ query params)
    const year = department.year;

    // Thống kê giáo viên
    const teacherCount = department.teacherIds?.length || 0;
    const homeroomTeacherCount = await Teacher.countDocuments({ 
      departmentId: departmentId,
      isHomeroom: true 
    });

    // Thống kê môn học
    const subjectCount = department.subjectIds?.length || 0;

    // Thống kê phân công (nếu có year)
    let assignmentStats = null;
    if (year) {
      const subjectIds = (department.subjectIds || []).map(s => s._id || s);
      
      const assignments = await TeachingAssignment.find({
        year,
        subjectId: { $in: subjectIds },
        ...(semester ? { semester } : {})
      }).lean();

      assignmentStats = {
        totalAssignments: assignments.length,
        uniqueTeachers: new Set(assignments.map(a => String(a.teacherId))).size,
        uniqueClasses: new Set(assignments.map(a => String(a.classId))).size,
        uniqueSubjects: new Set(assignments.map(a => String(a.subjectId))).size
      };
    }

    // Thống kê đề xuất phân công
    const proposalStats = {
      pending: await TeachingAssignmentProposal.countDocuments({
        departmentId: departmentId,
        status: 'pending'
      }),
      approved: await TeachingAssignmentProposal.countDocuments({
        departmentId: departmentId,
        status: 'approved'
      }),
      rejected: await TeachingAssignmentProposal.countDocuments({
        departmentId: departmentId,
        status: 'rejected'
      }),
      applied: await TeachingAssignmentProposal.countDocuments({
        departmentId: departmentId,
        status: 'applied'
      })
    };

    res.json({
      department: {
        _id: department._id,
        name: department.name,
        code: department.code,
        year: department.year // ✅ Trả về year từ department
      },
      stats: {
        teachers: {
          total: teacherCount,
          homeroom: homeroomTeacherCount,
          regular: teacherCount - homeroomTeacherCount
        },
        subjects: {
          total: subjectCount
        },
        assignments: assignmentStats,
        proposals: proposalStats
      }
    });
  } catch (error) {
    console.error('Error getting department dashboard:', error);
    res.status(500).json({ 
      message: 'Lỗi khi lấy dashboard quản lý bộ môn', 
      error: error.message 
    });
  }
};

/**
 * ✅ Lấy danh sách giáo viên trong tổ (chi tiết)
 * - Thông tin giáo viên: tên, mã, môn dạy, số lớp đang dạy
 * - Phân công hiện tại (nếu có year)
 */
exports.getDepartmentTeachers = async (req, res) => {
  try {
    const { semester } = req.query; // ✅ Không lấy year từ query nữa
    
    // ✅ Bước 1: Lấy thông tin giáo viên hiện tại để lấy departmentId
    const currentTeacher = await Teacher.findOne({ accountId: req.user.accountId })
      .select('isDepartmentHead departmentId')
      .lean();
      
    if (!currentTeacher || !currentTeacher.isDepartmentHead || !currentTeacher.departmentId) {
      return res.status(403).json({ 
        message: 'Bạn không phải trưởng bộ môn' 
      });
    }

    // ✅ Bước 2: Lấy department từ departmentId để lấy year
    const departmentId = currentTeacher.departmentId._id || currentTeacher.departmentId;
    const department = await Department.findById(departmentId)
      .populate('teacherIds', 'name teacherCode')
      .select('name code year teacherIds')
      .lean();

    if (!department) {
      return res.status(404).json({ message: 'Không tìm thấy tổ bộ môn' });
    }

    // ✅ Bước 3: Lấy year từ department (không phải từ query params)
    const year = department.year;

    // ✅ Bước 4: Lấy danh sách giáo viên từ department
    const teacherIds = (department.teacherIds || []).map(t => t._id || t);
    const teachers = await Teacher.find({ _id: { $in: teacherIds } })
      .populate('accountId', 'email phone')
      .populate('subjects.subjectId', 'name code')
      .populate('mainSubject', 'name code')
      .populate('departmentId', 'name code year')
      .select('name teacherCode phone subjects mainSubject isHomeroom isDepartmentHead departmentId currentHomeroomClassId')
      .lean();

    // ✅ Bước 5: Thêm thông tin phân công dựa trên year từ department
    const teachersWithAssignments = await Promise.all(teachers.map(async (teacher) => {
      let assignmentInfo = null;
      
      if (year) {
        const assignments = await TeachingAssignment.find({
          teacherId: teacher._id,
          year,
          ...(semester ? { semester } : {})
        })
          .populate('subjectId', 'name code')
          .populate('classId', 'className classCode grade')
          .lean();

        assignmentInfo = {
          totalClasses: assignments.length,
          assignments: assignments.map(a => ({
            subject: a.subjectId?.name || 'N/A',
            class: a.classId?.className || 'N/A',
            grade: a.classId?.grade || 'N/A'
          }))
        };
      }

      return {
        ...teacher,
        assignmentInfo
      };
    }));

    res.json({
      department: {
        _id: department._id,
        name: department.name,
        code: department.code,
        year: department.year // ✅ Trả về year từ department
      },
      teachers: teachersWithAssignments
    });
  } catch (error) {
    console.error('Error getting department teachers:', error);
    res.status(500).json({ 
      message: 'Lỗi khi lấy danh sách giáo viên', 
      error: error.message 
    });
  }
};

/**
 * ✅ Thêm giáo viên vào tổ bộ môn
 * - Chỉ được thêm giáo viên dạy môn trong tổ
 */
exports.addTeacher = async (req, res) => {
  try {
    const { teacherId } = req.body;
    
    if (!teacherId) {
      return res.status(400).json({ message: 'Thiếu teacherId' });
    }

    const currentTeacher = await Teacher.findOne({ accountId: req.user.accountId })
      .select('isDepartmentHead departmentId')
      .lean();
      
    if (!currentTeacher || !currentTeacher.isDepartmentHead || !currentTeacher.departmentId) {
      return res.status(403).json({ 
        message: 'Bạn không phải trưởng bộ môn' 
      });
    }

    const departmentId = currentTeacher.departmentId._id || currentTeacher.departmentId;
    const department = await Department.findById(departmentId)
      .populate('subjectIds', 'name code')
      .lean();

    if (!department) {
      return res.status(404).json({ message: 'Không tìm thấy tổ bộ môn' });
    }

    const teacher = await Teacher.findById(teacherId)
      .populate('subjects.subjectId')
      .lean();
      
    if (!teacher) {
      return res.status(404).json({ message: 'Không tìm thấy giáo viên' });
    }

    // Kiểm tra giáo viên đã thuộc tổ khác chưa
    if (teacher.departmentId && teacher.departmentId.toString() !== departmentId.toString()) {
      return res.status(400).json({ 
        message: 'Giáo viên đã thuộc tổ bộ môn khác. Vui lòng xóa khỏi tổ cũ trước.' 
      });
    }

    // Kiểm tra giáo viên có dạy môn trong tổ không
    if (!department.subjectIds || department.subjectIds.length === 0) {
      return res.status(400).json({ 
        message: 'Tổ bộ môn chưa có môn học. Vui lòng thêm môn học vào tổ trước.' 
      });
    }

    const departmentSubjectIds = department.subjectIds.map(s => String(s._id || s));
    const teacherSubjectIds = (teacher.subjects || []).map(sub => {
      const subId = typeof sub.subjectId === 'object' && sub.subjectId !== null
        ? String(sub.subjectId._id || sub.subjectId)
        : String(sub.subjectId || '');
      return subId;
    }).filter(Boolean);

    const hasCommonSubject = departmentSubjectIds.some(deptSubId => 
      teacherSubjectIds.includes(deptSubId)
    );

    if (!hasCommonSubject) {
      return res.status(400).json({ 
        message: 'Giáo viên không dạy môn nào trong tổ bộ môn này. Vui lòng chọn giáo viên dạy các môn trong tổ.' 
      });
    }

    // Thêm giáo viên vào tổ
    teacher.departmentId = departmentId;
    teacher.isDepartmentHead = false; // Đảm bảo không set isDepartmentHead
    await Teacher.findByIdAndUpdate(teacherId, {
      departmentId: departmentId,
      isDepartmentHead: false
    });

    // Cập nhật teacherIds trong Department
    await Department.findByIdAndUpdate(departmentId, {
      $addToSet: { teacherIds: teacherId }
    });

    const updatedTeacher = await Teacher.findById(teacherId)
      .populate('accountId', 'email phone')
      .populate('subjects.subjectId', 'name code')
      .populate('departmentId', 'name code')
      .lean();

    res.json({
      message: 'Đã thêm giáo viên vào tổ bộ môn thành công',
      teacher: updatedTeacher
    });
  } catch (error) {
    console.error('Error adding teacher to department:', error);
    res.status(500).json({ 
      message: 'Lỗi khi thêm giáo viên vào tổ bộ môn', 
      error: error.message 
    });
  }
};

/**
 * ✅ Xóa giáo viên khỏi tổ bộ môn
 */
exports.removeTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    if (!teacherId) {
      return res.status(400).json({ message: 'Thiếu teacherId' });
    }

    const currentTeacher = await Teacher.findOne({ accountId: req.user.accountId })
      .select('isDepartmentHead departmentId')
      .lean();
      
    if (!currentTeacher || !currentTeacher.isDepartmentHead || !currentTeacher.departmentId) {
      return res.status(403).json({ 
        message: 'Bạn không phải trưởng bộ môn' 
      });
    }

    const departmentId = currentTeacher.departmentId._id || currentTeacher.departmentId;
    const department = await Department.findById(departmentId).lean();

    if (!department) {
      return res.status(404).json({ message: 'Không tìm thấy tổ bộ môn' });
    }

    const teacher = await Teacher.findById(teacherId).lean();
    if (!teacher) {
      return res.status(404).json({ message: 'Không tìm thấy giáo viên' });
    }

    // Kiểm tra giáo viên có thuộc tổ này không
    if (!teacher.departmentId || teacher.departmentId.toString() !== departmentId.toString()) {
      return res.status(400).json({ 
        message: 'Giáo viên không thuộc tổ bộ môn này' 
      });
    }

    // Không cho phép xóa chính mình (trưởng bộ môn)
    if (teacher.isDepartmentHead && teacher._id.toString() === currentTeacher._id.toString()) {
      return res.status(400).json({ 
        message: 'Không thể xóa chính mình khỏi tổ. Vui lòng liên hệ admin để thay đổi trưởng bộ môn.' 
      });
    }

    // Xóa giáo viên khỏi tổ
    await Teacher.findByIdAndUpdate(teacherId, {
      $unset: { departmentId: 1 },
      isDepartmentHead: false
    });

    // Cập nhật teacherIds trong Department
    await Department.findByIdAndUpdate(departmentId, {
      $pull: { teacherIds: teacherId }
    });

    res.json({
      message: 'Đã xóa giáo viên khỏi tổ bộ môn thành công',
      teacher: {
        _id: teacher._id,
        name: teacher.name,
        teacherCode: teacher.teacherCode
      }
    });
  } catch (error) {
    console.error('Error removing teacher from department:', error);
    res.status(500).json({ 
      message: 'Lỗi khi xóa giáo viên khỏi tổ bộ môn', 
      error: error.message 
    });
  }
};

/**
 * ✅ Lấy danh sách đề xuất phân công
 * - Chỉ xem đề xuất của tổ mình
 */
exports.getProposals = async (req, res) => {
  try {
    const { status, year, semester } = req.query;
    
    const currentTeacher = await Teacher.findOne({ accountId: req.user.accountId })
      .select('isDepartmentHead departmentId')
      .lean();
      
    if (!currentTeacher || !currentTeacher.isDepartmentHead || !currentTeacher.departmentId) {
      return res.status(403).json({ 
        message: 'Bạn không phải trưởng bộ môn' 
      });
    }

    const departmentId = currentTeacher.departmentId._id || currentTeacher.departmentId;
    
    const query = { departmentId };
    if (status) query.status = status;
    if (year) query.year = year;
    if (semester) query.semester = semester;

    const proposals = await TeachingAssignmentProposal.find(query)
      .populate('teacherId', 'name teacherCode')
      .populate('subjectId', 'name code')
      .populate('classId', 'className classCode grade')
      .populate('proposedBy', 'name teacherCode')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      department: {
        _id: departmentId,
        name: currentTeacher.departmentId.name || 'N/A'
      },
      proposals
    });
  } catch (error) {
    console.error('Error getting proposals:', error);
    res.status(500).json({ 
      message: 'Lỗi khi lấy danh sách đề xuất phân công', 
      error: error.message 
    });
  }
};

/**
 * ✅ Tạo đề xuất phân công
 * - Chỉ được phân công cho giáo viên trong tổ
 */
exports.createProposal = async (req, res) => {
  try {
    const { teacherId, subjectId, classId, year, semester, notes } = req.body;
    
    if (!teacherId || !subjectId || !classId || !year || !semester) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }

    const currentTeacher = await Teacher.findOne({ accountId: req.user.accountId })
      .select('isDepartmentHead departmentId')
      .lean();
      
    if (!currentTeacher || !currentTeacher.isDepartmentHead || !currentTeacher.departmentId) {
      return res.status(403).json({ 
        message: 'Bạn không phải trưởng bộ môn' 
      });
    }

    const departmentId = currentTeacher.departmentId._id || currentTeacher.departmentId;
    
    // Kiểm tra giáo viên được phân công có thuộc tổ không
    const targetTeacher = await Teacher.findById(teacherId).lean();
    if (!targetTeacher) {
      return res.status(404).json({ message: 'Không tìm thấy giáo viên' });
    }

    if (!targetTeacher.departmentId || targetTeacher.departmentId.toString() !== departmentId.toString()) {
      return res.status(403).json({ 
        message: 'Chỉ có thể phân công cho giáo viên trong tổ bộ môn của bạn' 
      });
    }

    // Kiểm tra môn học có thuộc tổ không
    const subject = await Subject.findById(subjectId).lean();
    if (!subject) {
      return res.status(404).json({ message: 'Không tìm thấy môn học' });
    }

    const department = await Department.findById(departmentId).lean();
    if (!department || !department.subjectIds || !department.subjectIds.includes(subjectId)) {
      return res.status(403).json({ 
        message: 'Môn học này không thuộc tổ bộ môn của bạn' 
      });
    }

    // Kiểm tra đề xuất đã tồn tại chưa
    const existingProposal = await TeachingAssignmentProposal.findOne({
      teacherId,
      subjectId,
      classId,
      year,
      semester,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingProposal) {
      return res.status(400).json({ 
        message: 'Đề xuất phân công này đã tồn tại và đang chờ duyệt hoặc đã được duyệt' 
      });
    }

    // Tạo đề xuất
    const proposal = await TeachingAssignmentProposal.create({
      teacherId,
      subjectId,
      classId,
      year,
      semester,
      proposedBy: currentTeacher._id,
      departmentId,
      notes,
      status: 'pending'
    });

    const populatedProposal = await TeachingAssignmentProposal.findById(proposal._id)
      .populate('teacherId', 'name teacherCode')
      .populate('subjectId', 'name code')
      .populate('classId', 'className classCode grade')
      .populate('proposedBy', 'name teacherCode')
      .lean();

    res.status(201).json({
      message: 'Đã tạo đề xuất phân công thành công',
      proposal: populatedProposal
    });
  } catch (error) {
    console.error('Error creating proposal:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'Đề xuất phân công này đã tồn tại' 
      });
    }
    res.status(500).json({ 
      message: 'Lỗi khi tạo đề xuất phân công', 
      error: error.message 
    });
  }
};

/**
 * ✅ Hủy đề xuất phân công
 * - Chỉ được hủy đề xuất của mình
 */
exports.cancelProposal = async (req, res) => {
  try {
    const { id } = req.params;
    
    const currentTeacher = await Teacher.findOne({ accountId: req.user.accountId })
      .select('isDepartmentHead departmentId _id')
      .lean();
      
    if (!currentTeacher || !currentTeacher.isDepartmentHead || !currentTeacher.departmentId) {
      return res.status(403).json({ 
        message: 'Bạn không phải trưởng bộ môn' 
      });
    }

    const proposal = await TeachingAssignmentProposal.findById(id).lean();
    if (!proposal) {
      return res.status(404).json({ message: 'Không tìm thấy đề xuất phân công' });
    }

    // Kiểm tra đề xuất có thuộc tổ mình không
    const departmentId = currentTeacher.departmentId._id || currentTeacher.departmentId;
    if (proposal.departmentId.toString() !== departmentId.toString()) {
      return res.status(403).json({ 
        message: 'Bạn không có quyền hủy đề xuất này' 
      });
    }

    // Chỉ được hủy đề xuất đang pending hoặc approved
    if (!['pending', 'approved'].includes(proposal.status)) {
      return res.status(400).json({ 
        message: 'Chỉ có thể hủy đề xuất đang chờ duyệt hoặc đã được duyệt' 
      });
    }

    await TeachingAssignmentProposal.findByIdAndUpdate(id, {
      status: 'cancelled'
    });

    res.json({
      message: 'Đã hủy đề xuất phân công thành công'
    });
  } catch (error) {
    console.error('Error cancelling proposal:', error);
    res.status(500).json({ 
      message: 'Lỗi khi hủy đề xuất phân công', 
      error: error.message 
    });
  }
};

/**
 * ✅ Hủy toàn bộ đề xuất (batch cancel)
 * - Chỉ được hủy đề xuất của tổ mình
 * - Chỉ hủy được đề xuất đang pending hoặc approved
 */
exports.cancelAllProposals = async (req, res) => {
  try {
    const { year, semester, status } = req.body;
    
    const currentTeacher = await Teacher.findOne({ accountId: req.user.accountId })
      .select('isDepartmentHead departmentId _id')
      .lean();
      
    if (!currentTeacher || !currentTeacher.isDepartmentHead || !currentTeacher.departmentId) {
      return res.status(403).json({ 
        message: 'Bạn không phải trưởng bộ môn' 
      });
    }

    const departmentId = currentTeacher.departmentId._id || currentTeacher.departmentId;
    
    // Xây dựng query
    const query = { 
      departmentId,
      status: { $in: ['pending', 'approved'] } // Chỉ hủy được pending hoặc approved
    };
    
    if (year) query.year = year;
    if (semester) query.semester = semester;
    if (status) query.status = status;

    const result = await TeachingAssignmentProposal.updateMany(query, {
      status: 'cancelled'
    });

    res.json({
      message: `Đã hủy ${result.modifiedCount} đề xuất phân công`,
      cancelledCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error cancelling all proposals:', error);
    res.status(500).json({ 
      message: 'Lỗi khi hủy đề xuất phân công', 
      error: error.message 
    });
  }
};

/**
 * ✅ Tạo nhiều đề xuất phân công cùng lúc (batch create)
 * - Nhận mảng các proposal: [{ teacherId, subjectId, classIds: [] }]
 * - Tạo proposal cho mỗi lớp đã chọn
 */
exports.createBatchProposals = async (req, res) => {
  try {
    const { proposals, year, semester, notes } = req.body;
    
    if (!proposals || !Array.isArray(proposals) || proposals.length === 0) {
      return res.status(400).json({ message: 'Vui lòng cung cấp danh sách đề xuất phân công' });
    }

    if (!year || !semester) {
      return res.status(400).json({ message: 'Thiếu năm học hoặc học kỳ' });
    }

    const currentTeacher = await Teacher.findOne({ accountId: req.user.accountId })
      .select('isDepartmentHead departmentId _id')
      .lean();
      
    if (!currentTeacher || !currentTeacher.isDepartmentHead || !currentTeacher.departmentId) {
      return res.status(403).json({ 
        message: 'Bạn không phải trưởng bộ môn' 
      });
    }

    const departmentId = currentTeacher.departmentId._id || currentTeacher.departmentId;
    const department = await Department.findById(departmentId).lean();
    
    if (!department) {
      return res.status(404).json({ message: 'Không tìm thấy tổ bộ môn' });
    }

    const results = {
      success: [],
      failed: [],
      total: 0,
      created: 0
    };

    // Xử lý từng proposal
    for (const proposalData of proposals) {
      const { teacherId, subjectId, classIds } = proposalData;
      
      if (!teacherId || !subjectId || !classIds || !Array.isArray(classIds) || classIds.length === 0) {
        results.failed.push({
          teacherId,
          subjectId,
          error: 'Thiếu thông tin bắt buộc hoặc danh sách lớp rỗng'
        });
        continue;
      }

      // Kiểm tra giáo viên có thuộc tổ không
      const targetTeacher = await Teacher.findById(teacherId).lean();
      if (!targetTeacher) {
        results.failed.push({
          teacherId,
          subjectId,
          error: 'Không tìm thấy giáo viên'
        });
        continue;
      }

      if (!targetTeacher.departmentId || targetTeacher.departmentId.toString() !== departmentId.toString()) {
        results.failed.push({
          teacherId,
          subjectId,
          error: 'Giáo viên không thuộc tổ bộ môn của bạn'
        });
        continue;
      }

      // Kiểm tra môn học có thuộc tổ không
      const subject = await Subject.findById(subjectId).lean();
      if (!subject) {
        results.failed.push({
          teacherId,
          subjectId,
          error: 'Không tìm thấy môn học'
        });
        continue;
      }

      // Kiểm tra môn học có thuộc tổ không (so sánh ID đúng cách)
      const departmentSubjectIds = (department.subjectIds || []).map(id => String(id._id || id));
      if (!departmentSubjectIds.includes(String(subjectId))) {
        results.failed.push({
          teacherId,
          subjectId,
          error: 'Môn học không thuộc tổ bộ môn của bạn'
        });
        continue;
      }

      // Tạo proposal cho mỗi lớp
      for (const classId of classIds) {
        results.total++;
        
        try {
          // Kiểm tra lớp học
          const classInfo = await ClassModel.findById(classId).lean();
          if (!classInfo) {
            results.failed.push({
              teacherId,
              subjectId,
              classId,
              error: 'Không tìm thấy lớp học'
            });
            continue;
          }

          // Kiểm tra proposal đã tồn tại chưa
          const existingProposal = await TeachingAssignmentProposal.findOne({
            teacherId,
            subjectId,
            classId,
            year,
            semester,
            status: { $in: ['pending', 'approved'] }
          });

          if (existingProposal) {
            results.failed.push({
              teacherId,
              subjectId,
              classId,
              error: 'Đề xuất phân công này đã tồn tại và đang chờ duyệt'
            });
            continue;
          }

          // Kiểm tra TeachingAssignment đã tồn tại chưa
          const existingAssignment = await TeachingAssignment.findOne({
            teacherId,
            subjectId,
            classId,
            year,
            semester
          });

          if (existingAssignment) {
            results.failed.push({
              teacherId,
              subjectId,
              classId,
              error: 'Phân công này đã tồn tại trong TKB chính thức'
            });
            continue;
          }

          // Tạo proposal
          const proposal = await TeachingAssignmentProposal.create({
            teacherId,
            subjectId,
            classId,
            year,
            semester,
            proposedBy: currentTeacher._id,
            departmentId,
            notes: notes || '',
            status: 'pending'
          });

          const populatedProposal = await TeachingAssignmentProposal.findById(proposal._id)
            .populate('teacherId', 'name teacherCode')
            .populate('subjectId', 'name code')
            .populate('classId', 'className classCode grade')
            .populate('proposedBy', 'name teacherCode')
            .lean();

          results.success.push(populatedProposal);
          results.created++;
        } catch (error) {
          results.failed.push({
            teacherId,
            subjectId,
            classId,
            error: error.message || 'Lỗi khi tạo đề xuất'
          });
        }
      }
    }

    res.status(201).json({
      message: `Đã tạo ${results.created}/${results.total} đề xuất phân công`,
      results
    });
  } catch (error) {
    console.error('Error creating batch proposals:', error);
    res.status(500).json({ 
      message: 'Lỗi khi tạo đề xuất phân công', 
      error: error.message 
    });
  }
};

/**
 * ✅ Lấy số tiết/tuần của môn học trong các lớp (từ ClassPeriods)
 */
exports.getClassPeriodsForSubject = async (req, res) => {
  try {
    const { year, semester, subjectId, classIds } = req.query;
    
    if (!year || !semester || !subjectId) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }

    const classIdsArray = Array.isArray(classIds) ? classIds : (classIds ? [classIds] : []);
    
    if (classIdsArray.length === 0) {
      return res.json({ periods: {} });
    }

    // Lấy ClassPeriods cho các lớp
    const classPeriods = await ClassPeriods.find({
      year,
      semester,
      classId: { $in: classIdsArray }
    })
      .populate('classId', 'className classCode grade')
      .lean();

    const periodsMap = {};
    
    classPeriods.forEach(cp => {
      const classId = cp.classId?._id?.toString() || cp.classId?.toString();
      if (!classId) return;

      let subjectPeriodsObj = {};
      if (cp.subjectPeriods instanceof Map) {
        for (const [sid, periods] of cp.subjectPeriods.entries()) {
          subjectPeriodsObj[sid.toString()] = periods;
        }
      } else if (typeof cp.subjectPeriods === 'object' && cp.subjectPeriods !== null) {
        subjectPeriodsObj = cp.subjectPeriods;
      }

      const periods = subjectPeriodsObj[subjectId.toString()] || 0;
      periodsMap[classId] = periods;
    });

    // Thêm các lớp không có ClassPeriods (mặc định 0)
    classIdsArray.forEach(classId => {
      const classIdStr = classId.toString();
      if (!periodsMap[classIdStr]) {
        periodsMap[classIdStr] = 0;
      }
    });

    res.json({ periods: periodsMap });
  } catch (error) {
    console.error('Error getting class periods:', error);
    res.status(500).json({ 
      message: 'Lỗi khi lấy số tiết', 
      error: error.message 
    });
  }
};

