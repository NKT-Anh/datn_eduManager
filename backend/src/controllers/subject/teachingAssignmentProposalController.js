const TeachingAssignmentProposal = require('../../models/subject/teachingAssignmentProposal');
const TeachingAssignment = require('../../models/subject/teachingAssignment');
const Teacher = require('../../models/user/teacher');
const Class = require('../../models/class/class');
const Subject = require('../../models/subject/subject');
const Department = require('../../models/subject/department');
const { validateTeachingAssignment } = require('./teachingAssignmentController');

/**
 * ✅ Trưởng bộ môn: Tạo proposal phân công cho tổ của mình
 * Ràng buộc:
 * - Chỉ được phân công giáo viên trong tổ
 * - Không được thay đổi cap limit hoặc weeklyLessons của người khác
 * - Proposal lưu ở trạng thái pending, không ảnh hưởng TKB chính thức
 */
exports.createProposal = async (req, res) => {
  try {
    const { teacherId, subjectId, classId, year, semester, notes } = req.body;
    
    if (!teacherId || !subjectId || !classId || !year || !semester) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
    }

    // ✅ Kiểm tra người tạo là trưởng bộ môn
    if (!req.user || req.user.role !== 'teacher' || !req.user.teacherFlags?.isDepartmentHead) {
      return res.status(403).json({ error: "Chỉ trưởng bộ môn mới có quyền tạo proposal" });
    }

    const currentTeacher = await Teacher.findOne({ accountId: req.user.accountId }).lean();
    if (!currentTeacher || !currentTeacher.departmentId) {
      return res.status(403).json({ error: "Bạn không phải trưởng bộ môn hoặc không thuộc tổ bộ môn nào" });
    }

    // ✅ Kiểm tra giáo viên được phân công có thuộc tổ không
    const targetTeacher = await Teacher.findById(teacherId).lean();
    if (!targetTeacher) {
      return res.status(404).json({ error: "Không tìm thấy giáo viên" });
    }

    if (!targetTeacher.departmentId) {
      return res.status(403).json({ error: "Giáo viên này không thuộc tổ bộ môn nào" });
    }

    const currentDeptId = String(currentTeacher.departmentId._id || currentTeacher.departmentId);
    const targetDeptId = String(targetTeacher.departmentId._id || targetTeacher.departmentId);

    if (currentDeptId !== targetDeptId) {
      return res.status(403).json({ error: "Chỉ có thể phân công cho giáo viên trong tổ bộ môn của bạn" });
    }

    // ✅ Kiểm tra môn học có thuộc tổ không
    const subject = await Subject.findById(subjectId).lean();
    if (!subject) {
      return res.status(404).json({ error: "Không tìm thấy môn học" });
    }

    if (subject.departmentId) {
      const subjectDeptId = String(subject.departmentId._id || subject.departmentId);
      if (subjectDeptId !== currentDeptId) {
        return res.status(403).json({ error: "Môn học này không thuộc tổ bộ môn của bạn" });
      }
    }

    // ✅ Kiểm tra lớp học
    const classInfo = await Class.findById(classId).lean();
    if (!classInfo) {
      return res.status(404).json({ error: "Không tìm thấy lớp học" });
    }

    // ✅ Kiểm tra các ràng buộc (môn học, số lớp tối đa, số tiết tối đa/tuần)
    const validation = await validateTeachingAssignment(teacherId, subjectId, classId, year, semester);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // ✅ Kiểm tra proposal đã tồn tại chưa
    const existingProposal = await TeachingAssignmentProposal.findOne({
      teacherId,
      subjectId,
      classId,
      year,
      semester,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingProposal) {
      return res.status(400).json({ error: "Đề xuất phân công này đã tồn tại và đang chờ duyệt" });
    }

    // ✅ Kiểm tra TeachingAssignment đã tồn tại chưa
    const existingAssignment = await TeachingAssignment.findOne({
      teacherId,
      subjectId,
      classId,
      year,
      semester
    });

    if (existingAssignment) {
      return res.status(400).json({ error: "Phân công này đã tồn tại trong TKB chính thức" });
    }

    // ✅ Tạo proposal
    const proposal = await TeachingAssignmentProposal.create({
      teacherId,
      subjectId,
      classId,
      year,
      semester,
      status: 'pending',
      proposedBy: currentTeacher._id,
      departmentId: currentTeacher.departmentId,
      notes: notes || ''
    });

    // ✅ Populate và trả về
    const populated = await TeachingAssignmentProposal.findById(proposal._id)
      .populate('teacherId', 'name teacherCode')
      .populate('subjectId', 'name code')
      .populate('classId', 'className classCode grade year')
      .populate('proposedBy', 'name teacherCode')
      .populate('departmentId', 'name code');

    res.status(201).json({
      message: "Đề xuất phân công đã được tạo thành công và đang chờ duyệt",
      proposal: populated
    });
  } catch (error) {
    console.error('❌ Lỗi khi tạo proposal:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: "Đề xuất phân công này đã tồn tại" });
    }
    res.status(500).json({ error: "Lỗi khi tạo đề xuất phân công", details: error.message });
  }
};

/**
 * ✅ Lấy danh sách proposal
 * - Trưởng bộ môn: chỉ xem proposal của tổ mình
 * - Admin/BGH: xem tất cả
 */
exports.getProposals = async (req, res) => {
  try {
    const { year, semester, status, departmentId } = req.query;
    
    let query = {};
    
    // ✅ Lọc theo năm học và học kỳ
    if (year) query.year = year;
    if (semester) query.semester = semester;
    if (status) query.status = status;
    
    // ✅ Nếu là trưởng bộ môn, chỉ xem proposal của tổ mình
    if (req.user && req.user.role === 'teacher' && req.user.teacherFlags?.isDepartmentHead) {
      const currentTeacher = await Teacher.findOne({ accountId: req.user.accountId }).lean();
      if (currentTeacher && currentTeacher.departmentId) {
        query.departmentId = currentTeacher.departmentId;
      } else {
        return res.json([]); // Không thuộc tổ nào
      }
    } else if (departmentId) {
      // Admin/BGH có thể filter theo tổ
      query.departmentId = departmentId;
    }

    const proposals = await TeachingAssignmentProposal.find(query)
      .populate('teacherId', 'name teacherCode')
      .populate('subjectId', 'name code')
      .populate('classId', 'className classCode grade year')
      .populate('proposedBy', 'name teacherCode')
      .populate('departmentId', 'name code')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.json(proposals);
  } catch (error) {
    console.error('❌ Lỗi khi lấy danh sách proposal:', error);
    res.status(500).json({ error: "Lỗi khi lấy danh sách đề xuất", details: error.message });
  }
};

/**
 * ✅ Admin/BGH: Duyệt proposal
 */
exports.approveProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const proposal = await TeachingAssignmentProposal.findById(id);
    if (!proposal) {
      return res.status(404).json({ error: "Không tìm thấy đề xuất" });
    }

    if (proposal.status !== 'pending') {
      return res.status(400).json({ error: `Đề xuất này đã được xử lý (status: ${proposal.status})` });
    }

    // ✅ Cập nhật proposal
    proposal.status = 'approved';
    proposal.approvedBy = req.user.accountId;
    proposal.approvedAt = new Date();
    if (notes) proposal.notes = notes;
    await proposal.save();

    // ✅ Populate và trả về
    const populated = await TeachingAssignmentProposal.findById(proposal._id)
      .populate('teacherId', 'name teacherCode')
      .populate('subjectId', 'name code')
      .populate('classId', 'className classCode grade year')
      .populate('proposedBy', 'name teacherCode')
      .populate('departmentId', 'name code')
      .populate('approvedBy', 'name email');

    res.json({
      message: "Đề xuất đã được duyệt",
      proposal: populated
    });
  } catch (error) {
    console.error('❌ Lỗi khi duyệt proposal:', error);
    res.status(500).json({ error: "Lỗi khi duyệt đề xuất", details: error.message });
  }
};

/**
 * ✅ Admin/BGH: Từ chối proposal
 */
exports.rejectProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({ error: "Vui lòng cung cấp lý do từ chối" });
    }

    const proposal = await TeachingAssignmentProposal.findById(id);
    if (!proposal) {
      return res.status(404).json({ error: "Không tìm thấy đề xuất" });
    }

    if (proposal.status !== 'pending') {
      return res.status(400).json({ error: `Đề xuất này đã được xử lý (status: ${proposal.status})` });
    }

    // ✅ Cập nhật proposal
    proposal.status = 'rejected';
    proposal.approvedBy = req.user.accountId;
    proposal.approvedAt = new Date();
    proposal.rejectionReason = rejectionReason;
    await proposal.save();

    // ✅ Populate và trả về
    const populated = await TeachingAssignmentProposal.findById(proposal._id)
      .populate('teacherId', 'name teacherCode')
      .populate('subjectId', 'name code')
      .populate('classId', 'className classCode grade year')
      .populate('proposedBy', 'name teacherCode')
      .populate('departmentId', 'name code')
      .populate('approvedBy', 'name email');

    res.json({
      message: "Đề xuất đã bị từ chối",
      proposal: populated
    });
  } catch (error) {
    console.error('❌ Lỗi khi từ chối proposal:', error);
    res.status(500).json({ error: "Lỗi khi từ chối đề xuất", details: error.message });
  }
};

/**
 * ✅ Admin/BGH: Xem trước sự khác biệt khi áp dụng proposal
 * So sánh proposal với TeachingAssignment hiện tại
 */
exports.previewProposals = async (req, res) => {
  try {
    const { proposalIds } = req.body; // Array of proposal IDs

    if (!Array.isArray(proposalIds) || proposalIds.length === 0) {
      return res.status(400).json({ error: "Vui lòng cung cấp danh sách proposal IDs" });
    }

    const proposals = await TeachingAssignmentProposal.find({
      _id: { $in: proposalIds },
      status: { $in: ['pending', 'approved'] } // Chỉ preview proposal chưa được áp dụng
    })
      .populate('teacherId', 'name teacherCode')
      .populate('subjectId', 'name code')
      .populate('classId', 'className classCode grade year')
      .populate('proposedBy', 'name teacherCode')
      .populate('departmentId', 'name code')
      .lean();

    if (proposals.length === 0) {
      return res.status(400).json({ error: "Không có proposal nào để xem trước" });
    }

    // ✅ Lấy TeachingAssignment hiện tại để so sánh
    const currentAssignments = await TeachingAssignment.find({
      $or: proposals.map(p => ({
        classId: p.classId,
        subjectId: p.subjectId,
        year: p.year,
        semester: p.semester
      }))
    })
      .populate('teacherId', 'name teacherCode')
      .populate('subjectId', 'name code')
      .populate('classId', 'className classCode grade year')
      .lean();

    // ✅ Tạo map để so sánh nhanh
    const currentMap = new Map();
    currentAssignments.forEach(a => {
      const key = `${a.classId._id || a.classId}-${a.subjectId._id || a.subjectId}-${a.year}-${a.semester}`;
      currentMap.set(key, a);
    });

    // ✅ So sánh từng proposal
    const preview = proposals.map(proposal => {
      const key = `${proposal.classId._id || proposal.classId}-${proposal.subjectId._id || proposal.subjectId}-${proposal.year}-${proposal.semester}`;
      const currentAssignment = currentMap.get(key);

      return {
        proposalId: proposal._id,
        proposal: {
          teacher: proposal.teacherId,
          subject: proposal.subjectId,
          class: proposal.classId,
          year: proposal.year,
          semester: proposal.semester,
          proposedBy: proposal.proposedBy,
          department: proposal.departmentId,
          status: proposal.status,
          notes: proposal.notes
        },
        current: currentAssignment ? {
          teacher: currentAssignment.teacherId,
          subject: currentAssignment.subjectId,
          class: currentAssignment.classId,
          year: currentAssignment.year,
          semester: currentAssignment.semester
        } : null,
        changeType: currentAssignment 
          ? (String(currentAssignment.teacherId._id || currentAssignment.teacherId) !== String(proposal.teacherId._id || proposal.teacherId) 
              ? 'teacher_changed' 
              : 'no_change')
          : 'new_assignment',
        canApply: true // Sẽ được validate sau
      };
    });

    // ✅ Validate từng proposal
    for (const item of preview) {
      try {
        const validation = await validateTeachingAssignment(
          item.proposal.teacher._id || item.proposal.teacher,
          item.proposal.subject._id || item.proposal.subject,
          item.proposal.class._id || item.proposal.class,
          item.proposal.year,
          item.proposal.semester
        );
        item.canApply = validation.valid;
        item.validationError = validation.valid ? null : validation.error;
      } catch (error) {
        item.canApply = false;
        item.validationError = error.message;
      }
    }

    res.json({
      message: `Xem trước ${preview.length} đề xuất`,
      preview,
      summary: {
        total: preview.length,
        newAssignments: preview.filter(p => p.changeType === 'new_assignment').length,
        teacherChanges: preview.filter(p => p.changeType === 'teacher_changed').length,
        canApply: preview.filter(p => p.canApply).length,
        cannotApply: preview.filter(p => !p.canApply).length
      }
    });
  } catch (error) {
    console.error('❌ Lỗi khi xem trước proposal:', error);
    res.status(500).json({ error: "Lỗi khi xem trước đề xuất", details: error.message });
  }
};

/**
 * ✅ Admin/BGH: Áp dụng proposal vào TeachingAssignment chính thức
 * Có thể áp dụng một hoặc nhiều proposal cùng lúc
 * Hỗ trợ thay thế assignment cũ nếu có thay đổi giáo viên
 */
exports.applyProposals = async (req, res) => {
  try {
    const { proposalIds, replaceExisting = true } = req.body; 
    // proposalIds: Array of proposal IDs
    // replaceExisting: Nếu true, sẽ thay thế assignment cũ nếu có thay đổi giáo viên

    if (!Array.isArray(proposalIds) || proposalIds.length === 0) {
      return res.status(400).json({ error: "Vui lòng cung cấp danh sách proposal IDs" });
    }

    const proposals = await TeachingAssignmentProposal.find({
      _id: { $in: proposalIds },
      status: { $in: ['pending', 'approved'] } // Có thể áp dụng cả pending và approved
    })
      .populate('teacherId', 'name teacherCode')
      .populate('subjectId', 'name code')
      .populate('classId', 'className classCode grade year')
      .lean();

    if (proposals.length === 0) {
      return res.status(400).json({ error: "Không có proposal nào để áp dụng" });
    }

    const appliedAssignments = [];
    const replacedAssignments = [];
    const errors = [];

    for (const proposal of proposals) {
      try {
        // ✅ Kiểm tra TeachingAssignment đã tồn tại chưa (theo class + subject + year + semester)
        const existingAssignment = await TeachingAssignment.findOne({
          classId: proposal.classId,
          subjectId: proposal.subjectId,
          year: proposal.year,
          semester: proposal.semester
        });

        // ✅ Nếu đã có assignment và giáo viên khác nhau
        if (existingAssignment) {
          const existingTeacherId = String(existingAssignment.teacherId._id || existingAssignment.teacherId);
          const proposalTeacherId = String(proposal.teacherId._id || proposal.teacherId);

          // Nếu giáo viên giống nhau, bỏ qua
          if (existingTeacherId === proposalTeacherId) {
            // Cập nhật proposal status nếu chưa applied
            if (proposal.status !== 'applied') {
              await TeachingAssignmentProposal.findByIdAndUpdate(proposal._id, {
                status: 'applied',
                appliedAt: new Date(),
                teachingAssignmentId: existingAssignment._id
              });
            }
            continue;
          }

          // ✅ Nếu giáo viên khác nhau và replaceExisting = true
          if (replaceExisting) {
            // Xóa assignment cũ
            await TeachingAssignment.findByIdAndDelete(existingAssignment._id);
            replacedAssignments.push({
              old: existingAssignment,
              proposalId: proposal._id
            });
          } else {
            // Không thay thế, báo lỗi
            errors.push({
              proposalId: proposal._id,
              error: "Đã có phân công khác cho lớp/môn này. Vui lòng xóa phân công cũ trước hoặc bật tùy chọn thay thế."
            });
            continue;
          }
        }

        // ✅ Kiểm tra lại ràng buộc
        const validation = await validateTeachingAssignment(
          proposal.teacherId._id || proposal.teacherId,
          proposal.subjectId._id || proposal.subjectId,
          proposal.classId._id || proposal.classId,
          proposal.year,
          proposal.semester
        );

        if (!validation.valid) {
          errors.push({
            proposalId: proposal._id,
            error: validation.error
          });
          continue;
        }

        // ✅ Tạo TeachingAssignment mới
        const assignment = await TeachingAssignment.create({
          teacherId: proposal.teacherId._id || proposal.teacherId,
          subjectId: proposal.subjectId._id || proposal.subjectId,
          classId: proposal.classId._id || proposal.classId,
          year: proposal.year,
          semester: proposal.semester
        });

        // ✅ Populate assignment để trả về
        const populatedAssignment = await TeachingAssignment.findById(assignment._id)
          .populate('teacherId', 'name teacherCode')
          .populate('subjectId', 'name code')
          .populate('classId', 'className classCode grade year')
          .lean();

        // ✅ Cập nhật proposal
        await TeachingAssignmentProposal.findByIdAndUpdate(proposal._id, {
          status: 'applied',
          appliedAt: new Date(),
          teachingAssignmentId: assignment._id
        });

        appliedAssignments.push(populatedAssignment);
      } catch (error) {
        errors.push({
          proposalId: proposal._id,
          error: error.message
        });
      }
    }

    res.json({
      message: `Đã áp dụng ${appliedAssignments.length} đề xuất thành công${replacedAssignments.length > 0 ? `, thay thế ${replacedAssignments.length} phân công cũ` : ''}`,
      appliedCount: appliedAssignments.length,
      replacedCount: replacedAssignments.length,
      errorCount: errors.length,
      appliedAssignments,
      replacedAssignments,
      errors
    });
  } catch (error) {
    console.error('❌ Lỗi khi áp dụng proposal:', error);
    res.status(500).json({ error: "Lỗi khi áp dụng đề xuất", details: error.message });
  }
};

/**
 * ✅ Trưởng bộ môn: Hủy proposal của mình
 */
exports.cancelProposal = async (req, res) => {
  try {
    const { id } = req.params;

    const proposal = await TeachingAssignmentProposal.findById(id);
    if (!proposal) {
      return res.status(404).json({ error: "Không tìm thấy đề xuất" });
    }

    // ✅ Kiểm tra quyền: chỉ người tạo mới được hủy
    if (req.user && req.user.role === 'teacher' && req.user.teacherFlags?.isDepartmentHead) {
      const currentTeacher = await Teacher.findOne({ accountId: req.user.accountId }).lean();
      if (!currentTeacher || String(currentTeacher._id) !== String(proposal.proposedBy)) {
        return res.status(403).json({ error: "Chỉ người tạo đề xuất mới có quyền hủy" });
      }
    }

    if (proposal.status !== 'pending') {
      return res.status(400).json({ error: `Chỉ có thể hủy đề xuất đang chờ duyệt (status: ${proposal.status})` });
    }

    // ✅ Cập nhật proposal
    proposal.status = 'cancelled';
    await proposal.save();

    res.json({
      message: "Đề xuất đã được hủy",
      proposal
    });
  } catch (error) {
    console.error('❌ Lỗi khi hủy proposal:', error);
    res.status(500).json({ error: "Lỗi khi hủy đề xuất", details: error.message });
  }
};

