const Department = require('../../models/subject/department');
const Teacher = require('../../models/user/teacher');
const Subject = require('../../models/subject/subject');
const Account = require('../../models/user/account');
const TeachingAssignment = require('../../models/subject/teachingAssignment');
const ClassModel = require('../../models/class/class');
const ClassPeriods = require('../../models/class/classPeriods');
const Setting = require('../../models/settings');
const SchoolYearModel = require('../../models/schoolYear');

// ✅ Helper: Lấy năm học hiện tại từ settings hoặc active school year
async function getCurrentSchoolYear() {
  try {
    // Ưu tiên lấy từ active SchoolYear
    const activeYear = await SchoolYearModel.findOne({ isActive: true }).lean();
    if (activeYear && activeYear.code) {
      return String(activeYear.code);
    }
    // Fallback về settings
    const settings = await Setting.findOne().lean();
    if (settings && settings.currentSchoolYear) {
      return String(settings.currentSchoolYear);
    }
    // Fallback về env
    return process.env.SCHOOL_YEAR || null;
  } catch (error) {
    console.error('Error getting current school year:', error);
    return null;
  }
}

// ✅ Helper: Cập nhật yearRoles cho giáo viên
async function updateTeacherYearRole(teacherId, updates, targetYear = null) {
  try {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return;

    // ✅ Sử dụng targetYear nếu được cung cấp, nếu không thì dùng currentYear
    let schoolYear = targetYear;
    if (!schoolYear) {
      schoolYear = await getCurrentSchoolYear();
      if (!schoolYear) {
        console.warn('Không tìm thấy năm học, bỏ qua cập nhật yearRoles');
        return;
      }
    }

    // Đảm bảo yearRoles là array
    if (!Array.isArray(teacher.yearRoles)) {
      teacher.yearRoles = [];
    }

    // ✅ Tìm hoặc tạo yearRole entry cho năm học được chỉ định (targetYear hoặc currentYear)
    let yearRole = teacher.yearRoles.find(yr => String(yr.schoolYear) === String(schoolYear));
    if (!yearRole) {
      yearRole = { schoolYear: schoolYear };
      teacher.yearRoles.push(yearRole);
    }

    // ✅ Cập nhật các trường từ updates (KHÔNG bao gồm isLeader - BGH được set cứng ở top-level)
    if (updates.departmentId !== undefined) {
      yearRole.departmentId = updates.departmentId;
    }
    if (updates.isDepartmentHead !== undefined) {
      yearRole.isDepartmentHead = updates.isDepartmentHead;
    }
    if (updates.isHomeroom !== undefined) {
      yearRole.isHomeroom = updates.isHomeroom;
    }
    // ✅ isLeader đã được loại bỏ khỏi yearRoles - BGH được set cứng ở top-level (teacher.isLeader)
    if (updates.currentHomeroomClassId !== undefined) {
      yearRole.currentHomeroomClassId = updates.currentHomeroomClassId;
    }
    if (updates.permissions !== undefined) {
      yearRole.permissions = Array.isArray(updates.permissions) ? updates.permissions : [];
    }

    await teacher.save();
    console.log(`✅ Đã cập nhật yearRoles cho giáo viên ${teacherId} năm học ${schoolYear}:`, {
      isDepartmentHead: updates.isDepartmentHead,
      departmentId: updates.departmentId,
    });
  } catch (error) {
    console.error('❌ Error updating teacher yearRole:', error);
    throw error; // ✅ Throw error để caller biết có lỗi
  }
}

async function canManageDepartment(req, departmentId) {
  if (!req.user || req.user.role !== 'teacher') return true;
  if (!departmentId) return false;
  const teacher = await Teacher.findOne({ accountId: req.user.accountId })
    .select('isDepartmentHead departmentId')
    .lean();
  if (!teacher || !teacher.isDepartmentHead) return false;
  return teacher.departmentId && teacher.departmentId.toString() === departmentId.toString();
}

const normalizeMaxClassPerGrade = (map = {}) => {
  if (!map) return {};
  if (typeof map.toObject === 'function') return map.toObject();
  if (map instanceof Map) return Object.fromEntries(map);
  return map;
};

const getSubjectPeriodsValue = (classPeriod, subjectId) => {
  if (!classPeriod || !classPeriod.subjectPeriods) return 0;
  if (typeof classPeriod.subjectPeriods.get === 'function') {
    const value = classPeriod.subjectPeriods.get(subjectId) || classPeriod.subjectPeriods.get(subjectId.toString());
    return Number(value) || 0;
  }
  const map = classPeriod.subjectPeriods;
  const value = map?.[subjectId] ?? map?.[subjectId.toString()];
  return Number(value) || 0;
};

// Helper: Populate department data
const populatedDepartment = (query) => {
  return query
    .populate('headTeacherId', 'name teacherCode accountId')
    .populate('teacherIds', 'name teacherCode isDepartmentHead') // ✅ Populate danh sách thành viên
    .populate('subjectIds', 'name code grades');
};

// Lấy tất cả tổ bộ môn
exports.getAllDepartments = async (req, res) => {
  try {
    const { year } = req.query;
    let query = { status: 'active' };
    
    // Lọc theo năm học nếu có
    if (year) {
      query.year = year;
    }

    let departments = await populatedDepartment(Department.find(query));

    if (req.user?.role === 'teacher') {
      const teacher = await Teacher.findOne({ accountId: req.user.accountId })
        .select('isDepartmentHead departmentId')
        .lean();
      if (teacher?.isDepartmentHead && teacher.departmentId) {
        departments = departments.filter(dep => dep._id.toString() === teacher.departmentId.toString());
      } else {
        departments = [];
      }
    }

    res.json(departments);
  } catch (error) {
    console.error('Error getting departments:', error);
    res.status(500).json({ message: 'Lỗi khi lấy danh sách tổ bộ môn', error: error.message });
  }
};

// Lấy 1 tổ bộ môn theo id
exports.getDepartment = async (req, res) => {
  const { id } = req.params;
  try {
    const department = await populatedDepartment(Department.findById(id));
    if (!department) {
      return res.status(404).json({ message: 'Không tìm thấy tổ bộ môn' });
    }

    if (req.user?.role === 'teacher') {
      const allowed = await canManageDepartment(req, department._id);
      if (!allowed) {
        return res.status(403).json({ message: 'Bạn không có quyền truy cập tổ bộ môn này' });
      }
    }

    res.json(department);
  } catch (error) {
    console.error('Error getting department:', error);
    res.status(500).json({ message: 'Lỗi khi lấy thông tin tổ bộ môn', error: error.message });
  }
};

// Tạo tổ bộ môn mới
exports.createDepartment = async (req, res) => {
  try {
    const { name, code, description, headTeacherId, subjectIds, notes, year } = req.body;
    
    // ✅ Tự động lấy năm học hiện tại đang active nếu không có year
    const deptYear = year || await getCurrentSchoolYear();
    if (!deptYear) {
      return res.status(400).json({ 
        message: 'Không thể xác định năm học. Vui lòng kích hoạt một năm học trước.' 
      });
    }

    // Tạo code tự động nếu không có
    let departmentCode = code;
    if (!departmentCode && name) {
      // Tạo code từ tên: "Tổ Toán" -> "TOAN"
      departmentCode = name
        .replace(/Tổ\s*/i, '')
        .replace(/\s+/g, '_')
        .replace(/[–-]/g, '_')
        .toUpperCase();
    }

    const department = await Department.create({
      name,
      code: departmentCode,
      description,
      headTeacherId: headTeacherId || null,
      subjectIds: subjectIds || [],
      notes,
      year: deptYear, // ✅ Dùng năm học đã xác định
      schoolYear: deptYear, // ✅ Đảm bảo tương thích với cả 2 field
      status: 'active'
    });

    // Cập nhật subjectIds để có departmentId
    if (subjectIds && subjectIds.length > 0) {
      await Subject.updateMany(
        { _id: { $in: subjectIds } },
        { departmentId: department._id }
      );
    }

    // Cập nhật headTeacherId để có departmentId và set isDepartmentHead = true
    // ✅ RÀNG BUỘC: CHỈ CÓ 1 TỔ TRƯỞNG TRONG 1 TỔ
    // ✅ Lưu ý: Không ảnh hưởng đến isHomeroom, giáo viên có thể vừa là TBM vừa là GVCN
    if (headTeacherId) {
      const headTeacher = await Teacher.findById(headTeacherId);
      if (!headTeacher) {
        return res.status(404).json({ message: 'Không tìm thấy giáo viên' });
      }

      // ✅ Kiểm tra giáo viên có phải GVCN trong năm học đó không
      if (headTeacher.yearRoles && Array.isArray(headTeacher.yearRoles)) {
        const yearRole = headTeacher.yearRoles.find(yr => String(yr.schoolYear) === String(deptYear));
        if (yearRole && yearRole.isHomeroom === true) {
          return res.status(400).json({ 
            message: `Giáo viên ${headTeacher.name} đã là giáo viên chủ nhiệm trong năm học ${deptYear}. Không thể chỉ định làm trưởng bộ môn.` 
          });
        }
      }

      if (headTeacher && headTeacher.isDepartmentHead) {
        // Nếu giáo viên này đã là tổ trưởng của tổ khác, reset tổ cũ
        const oldDepartment = await Department.findOne({ headTeacherId: headTeacherId });
        if (oldDepartment && String(oldDepartment._id) !== String(department._id)) {
          // Reset tổ trưởng cũ - cập nhật yearRoles trước
          const oldDeptYear = oldDepartment.year || oldDepartment.schoolYear || deptYear;
          try {
            await updateTeacherYearRole(headTeacherId, {
              departmentId: null,
              isDepartmentHead: false
            }, oldDeptYear);
          } catch (err) {
            console.error('❌ Lỗi khi reset yearRoles cho tổ cũ:', err);
          }
          
          // Reset tổ trưởng cũ
          await Teacher.findByIdAndUpdate(headTeacherId, { 
            $unset: { departmentId: 1 },
            isDepartmentHead: false 
          });
          // Xóa headTeacherId của tổ cũ
          await Department.findByIdAndUpdate(oldDepartment._id, {
            headTeacherId: null
          });
        }
      }
      
      // ✅ Cập nhật top-level flags trước
      await Teacher.findByIdAndUpdate(headTeacherId, { 
        departmentId: department._id,
        isDepartmentHead: true 
        // Không set isHomeroom ở đây để giữ lại flag nếu giáo viên đã là GVCN
      });

      // ✅ Cập nhật yearRoles cho năm học hiện tại đang active
      try {
        await updateTeacherYearRole(headTeacherId, {
          departmentId: department._id,
          isDepartmentHead: true
        }, deptYear);
        console.log(`✅ Đã cập nhật quyền trưởng bộ môn cho giáo viên ${headTeacherId} năm học ${deptYear}`);
      } catch (yearRoleError) {
        console.error('❌ Lỗi khi cập nhật yearRoles:', yearRoleError);
        // Không throw để không làm gián đoạn việc tạo department, nhưng log lỗi
      }

      // ✅ Cập nhật teacherIds trong Department - đảm bảo headTeacherId có trong danh sách
      await Department.findByIdAndUpdate(department._id, {
        $addToSet: { teacherIds: headTeacherId } // Thêm headTeacherId vào teacherIds nếu chưa có
      });
    }

    const populatedDept = await populatedDepartment(Department.findById(department._id));
    res.status(201).json(populatedDept);
  } catch (error) {
    console.error('Error creating department:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Tên hoặc mã tổ bộ môn đã tồn tại' });
    }
    res.status(400).json({ message: 'Không thể tạo tổ bộ môn', error: error.message });
  }
};

// Cập nhật tổ bộ môn
// ⚠️ TỔ TRƯỞNG KHÔNG ĐƯỢC TỰ CẤP QUYỀN (chỉ được sửa thông tin tổ, không được thay đổi headTeacherId)
exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, headTeacherId, subjectIds, notes, status } = req.body;
    const account = await Account.findOne({ uid: req.user.uid });
    
    if (!account) {
      return res.status(401).json({ message: 'Không tìm thấy tài khoản' });
    }

    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({ message: 'Không tìm thấy tổ bộ môn' });
    }

    if (req.user?.role === 'teacher') {
      const allowed = await canManageDepartment(req, department._id);
      if (!allowed) {
        return res.status(403).json({ message: 'Bạn không có quyền thêm giáo viên vào tổ bộ môn này' });
      }
    }

    // ✅ TỔ TRƯỞNG KHÔNG ĐƯỢC TỰ CẤP QUYỀN (thay đổi headTeacherId)
    // Chỉ admin mới được thay đổi headTeacherId
    if (headTeacherId !== undefined && account.role !== 'admin') {
      const Teacher = require('../../models/user/teacher');
      const teacher = await Teacher.findOne({ accountId: account._id });
      
      // Nếu là tổ trưởng và cố gắng thay đổi headTeacherId
      if (teacher && teacher.isDepartmentHead && department.headTeacherId && 
          department.headTeacherId.toString() === teacher._id.toString()) {
        // Tổ trưởng không được thay đổi headTeacherId (kể cả chính mình)
        return res.status(403).json({ 
          message: 'Tổ trưởng không được tự cấp quyền. Chỉ admin mới được thay đổi tổ trưởng.' 
        });
      }
    }

    // Cập nhật subjectIds: Xóa departmentId cũ, thêm departmentId mới
    if (subjectIds !== undefined) {
      // Xóa departmentId từ các subject cũ
      await Subject.updateMany(
        { departmentId: department._id },
        { $unset: { departmentId: 1 } }
      );
      // Thêm departmentId cho các subject mới
      if (subjectIds.length > 0) {
        await Subject.updateMany(
          { _id: { $in: subjectIds } },
          { departmentId: department._id }
        );
      }
    }

    // Cập nhật headTeacherId
    if (headTeacherId !== undefined) {
      // ✅ Ưu tiên lấy năm học hiện tại đang active, nếu không có thì dùng năm học của department
      const currentYear = await getCurrentSchoolYear();
      const deptYear = currentYear || department.year || department.schoolYear;
      
      if (!deptYear) {
        return res.status(400).json({ 
          message: 'Không thể xác định năm học. Vui lòng kích hoạt một năm học trước.' 
        });
      }

      // ✅ RÀNG BUỘC: CHỈ CÓ 1 TỔ TRƯỞNG TRONG 1 TỔ
      // Nếu có tổ trưởng mới, kiểm tra xem giáo viên đó đã là tổ trưởng của tổ khác chưa
      if (headTeacherId) {
        const newHeadTeacher = await Teacher.findById(headTeacherId);
        if (!newHeadTeacher) {
          return res.status(404).json({ message: 'Không tìm thấy giáo viên' });
        }

        // ✅ Kiểm tra giáo viên có phải GVCN trong năm học đó không
        if (newHeadTeacher.yearRoles && Array.isArray(newHeadTeacher.yearRoles) && deptYear) {
          const yearRole = newHeadTeacher.yearRoles.find(yr => String(yr.schoolYear) === String(deptYear));
          if (yearRole && yearRole.isHomeroom === true) {
            return res.status(400).json({ 
              message: `Giáo viên ${newHeadTeacher.name} đã là giáo viên chủ nhiệm trong năm học ${deptYear}. Không thể chỉ định làm trưởng bộ môn.` 
            });
          }
        }

        if (newHeadTeacher && newHeadTeacher.isDepartmentHead) {
          // Nếu giáo viên này đã là tổ trưởng của tổ khác, reset tổ cũ
          const oldDepartment = await Department.findOne({ headTeacherId: headTeacherId });
          if (oldDepartment && oldDepartment._id.toString() !== id) {
            // Reset tổ trưởng cũ
            await Teacher.findByIdAndUpdate(headTeacherId, { 
              $unset: { departmentId: 1 },
              isDepartmentHead: false 
            });
            // Xóa headTeacherId của tổ cũ
            await Department.findByIdAndUpdate(oldDepartment._id, {
              headTeacherId: null
            });
          }
        }
      }

      // ✅ Xóa isDepartmentHead từ giáo viên cũ (nếu có) - nhưng vẫn giữ departmentId nếu giáo viên vẫn thuộc tổ
      if (department.headTeacherId && department.headTeacherId.toString() !== headTeacherId?.toString()) {
        const oldHeadTeacher = await Teacher.findById(department.headTeacherId);
        if (oldHeadTeacher && oldHeadTeacher.departmentId && oldHeadTeacher.departmentId.toString() === id) {
          // ✅ Nếu giáo viên cũ vẫn thuộc tổ này, chỉ reset isDepartmentHead = false, giữ lại departmentId
          await Teacher.findByIdAndUpdate(department.headTeacherId, { 
            isDepartmentHead: false 
          });
          // ✅ Cập nhật yearRoles cho giáo viên cũ
          await updateTeacherYearRole(department.headTeacherId, {
            isDepartmentHead: false
          }, deptYear);
        } else {
          // ✅ Nếu giáo viên cũ không thuộc tổ này nữa, xóa departmentId
          await Teacher.findByIdAndUpdate(department.headTeacherId, { 
            $unset: { departmentId: 1 },
            isDepartmentHead: false 
          });
          // ✅ Cập nhật yearRoles cho giáo viên cũ
          await updateTeacherYearRole(department.headTeacherId, {
            departmentId: null,
            isDepartmentHead: false
          }, deptYear);
        }
      }
      
      // ✅ Thêm departmentId và set isDepartmentHead = true CHỈ cho giáo viên mới được chỉ định làm trưởng bộ môn
      // ✅ Đảm bảo giáo viên mới có departmentId và isDepartmentHead = true
      // ✅ Lưu ý: Không ảnh hưởng đến isHomeroom, giáo viên có thể vừa là TBM vừa là GVCN
      if (headTeacherId) {
        // ✅ Đảm bảo giáo viên mới có departmentId và isDepartmentHead = true
      await Teacher.findByIdAndUpdate(headTeacherId, { 
        departmentId: department._id,
        isDepartmentHead: true 
        // Không set isHomeroom ở đây để giữ lại flag nếu giáo viên đã là GVCN
      });
      
      // ✅ Cập nhật yearRoles cho năm học của department
      try {
        await updateTeacherYearRole(headTeacherId, {
          departmentId: department._id,
          isDepartmentHead: true
        }, deptYear);
        console.log(`✅ Đã cập nhật quyền trưởng bộ môn cho giáo viên ${headTeacherId} năm học ${deptYear}`);
      } catch (yearRoleError) {
        console.error('❌ Lỗi khi cập nhật yearRoles:', yearRoleError);
        // Không throw để không làm gián đoạn việc cập nhật department
      }
      
      // ✅ Đảm bảo các giáo viên khác trong tổ KHÔNG có isDepartmentHead = true
      await Teacher.updateMany(
        { 
          departmentId: department._id,
          _id: { $ne: headTeacherId } // Loại trừ trưởng bộ môn mới
        },
        { 
          isDepartmentHead: false 
        }
      );

      // ✅ Reset yearRoles.isDepartmentHead cho các giáo viên khác trong tổ
      if (deptYear) {
        const otherTeachers = await Teacher.find({
          departmentId: department._id,
          _id: { $ne: headTeacherId }
        });
        for (const otherTeacher of otherTeachers) {
          try {
            await updateTeacherYearRole(otherTeacher._id, {
              isDepartmentHead: false
            }, deptYear);
          } catch (err) {
            console.error(`❌ Lỗi khi reset yearRoles cho giáo viên ${otherTeacher._id}:`, err);
          }
        }
      }

      // ✅ Cập nhật teacherIds trong Department - đảm bảo headTeacherId có trong danh sách
      await Department.findByIdAndUpdate(id, {
        $addToSet: { teacherIds: headTeacherId } // Thêm headTeacherId vào teacherIds nếu chưa có
      });
      }
    }

    // Cập nhật thông tin tổ bộ môn
    const updatedDepartment = await populatedDepartment(
      Department.findByIdAndUpdate(
        id,
        { name, code, description, headTeacherId, subjectIds, notes, status },
        { new: true, runValidators: true }
      )
    );

    res.json(updatedDepartment);
  } catch (error) {
    console.error('Error updating department:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Tên hoặc mã tổ bộ môn đã tồn tại' });
    }
    res.status(400).json({ message: 'Không thể cập nhật tổ bộ môn', error: error.message });
  }
};

// Xóa tổ bộ môn
exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const department = await Department.findById(id);
    
    if (!department) {
      return res.status(404).json({ message: 'Không tìm thấy tổ bộ môn' });
    }

    // ✅ Lấy danh sách tất cả giáo viên trong tổ (từ teacherIds và departmentId)
    const teacherIds = department.teacherIds || [];
    const teachersInDepartment = await Teacher.find({ 
      $or: [
        { departmentId: department._id },
        { _id: { $in: teacherIds } }
      ]
    });

    const allTeacherIds = [
      ...new Set([
        ...teacherIds.map(id => id.toString()),
        ...teachersInDepartment.map(t => t._id.toString())
      ])
    ];

    // ✅ Reset tất cả giáo viên về giáo viên bình thường
    const deptYear = department.year || department.schoolYear;
    if (allTeacherIds.length > 0) {
      await Teacher.updateMany(
        { _id: { $in: allTeacherIds } },
        { 
          $unset: { departmentId: 1 },
          isDepartmentHead: false // ✅ Reset isDepartmentHead khi xóa tổ
        }
      );
      
      // ✅ Cập nhật yearRoles cho tất cả giáo viên trong tổ
      if (deptYear) {
        for (const teacherId of allTeacherIds) {
          await updateTeacherYearRole(teacherId, {
            departmentId: null,
            isDepartmentHead: false
          }, deptYear);
        }
      }
    }

    // ✅ Xóa departmentId từ các giáo viên (backup check)s
    await Teacher.updateMany(
      { departmentId: department._id },
      { 
        $unset: { departmentId: 1 },
        isDepartmentHead: false // ✅ Reset isDepartmentHead khi xóa tổ
      }
    );

    // Xóa departmentId từ các subject
    await Subject.updateMany(
      { departmentId: department._id },
      { $unset: { departmentId: 1 } }
    );

    // Xóa các phân công giảng dạy liên quan tới các môn của tổ trong năm của tổ (nếu có)
    try {
      const subjectIds = (department.subjectIds || []).map(s => s.toString());
      if (subjectIds.length > 0 && department.year) {
        await TeachingAssignment.deleteMany({ subjectId: { $in: subjectIds }, year: department.year });
      }
    } catch (err) {
      console.warn('Warning: không thể xóa TeachingAssignment liên quan khi xóa Department', err.message);
    }

    // ✅ Xóa tổ bộ môn (hoặc đánh dấu inactive) - teacherIds sẽ tự động bị xóa
    await Department.findByIdAndUpdate(id, { 
      status: 'inactive',
      teacherIds: [], // ✅ Xóa tất cả teacherIds
      headTeacherId: null // ✅ Reset headTeacherId
    });
    // Hoặc xóa hoàn toàn: await Department.findByIdAndDelete(id);

    res.json({ 
      message: 'Xóa tổ bộ môn thành công. Tất cả giáo viên đã được gỡ khỏi tổ và reset về giáo viên bình thường.',
      affectedTeachers: allTeacherIds.length
    });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(400).json({ message: 'Không thể xóa tổ bộ môn', error: error.message });
  }
};

// Lấy danh sách giáo viên trong tổ bộ môn
exports.getDepartmentTeachers = async (req, res) => {
  try {
    const { id } = req.params;
    const { year } = req.query;
    const department = await Department.findById(id);
    
    if (!department) {
      return res.status(404).json({ message: 'Không tìm thấy tổ bộ môn' });
    }

    if (req.user?.role === 'teacher') {
      const allowed = await canManageDepartment(req, department._id);
      if (!allowed) {
        return res.status(403).json({ message: 'Bạn không có quyền xem giáo viên của tổ bộ môn này' });
      }
    }

    // Nếu client yêu cầu theo năm học, sử dụng helper để trả về yearRole phù hợp
    let teachers;
    if (year) {
      // sử dụng Department instance helper getTeachersWithYear
      const teachersWithYear = await department.getTeachersWithYear();
      // Populate account/subjects/mainSubject manually for returned plain objects
      const teacherIds = teachersWithYear.map(t => t._id).filter(Boolean);
      const populated = await Teacher.find({ _id: { $in: teacherIds } })
        .populate('accountId', 'email phone')
        .populate('subjects.subjectId', 'name code')
        .populate('mainSubject', 'name code')
        .lean();

      // Merge yearRole into populated teacher objects
      const popMap = new Map(populated.map(p => [String(p._id), p]));
      teachers = teachersWithYear.map(t => {
        const base = popMap.get(String(t._id)) || {};
        return Object.assign({}, base, {
          schoolYear: t.schoolYear,
          yearRole: t.yearRole || null,
          maxClassPerGrade: normalizeMaxClassPerGrade(base.maxClassPerGrade)
        });
      });
    } else {
      // Không có year: hành vi cũ
      if (department.teacherIds && department.teacherIds.length > 0) {
        // Ưu tiên lấy từ teacherIds trong Department
        teachers = await Teacher.find({ _id: { $in: department.teacherIds } })
          .populate('accountId', 'email phone')
          .populate('subjects.subjectId', 'name code')
          .populate('mainSubject', 'name code')
          .select('name teacherCode phone subjects mainSubject isHomeroom isDepartmentHead departmentId')
          .lean();
      } else {
        // Fallback: lấy từ departmentId trong Teacher
        teachers = await Teacher.find({ departmentId: id })
          .populate('accountId', 'email phone')
          .populate('subjects.subjectId', 'name code')
          .populate('mainSubject', 'name code')
          .select('name teacherCode phone subjects mainSubject isHomeroom isDepartmentHead departmentId')
          .lean();
      }
      teachers = teachers.map(teacher => ({
        ...teacher,
        maxClassPerGrade: normalizeMaxClassPerGrade(teacher.maxClassPerGrade)
      }));
    }

    const normalizedTeachers = teachers.map(teacher => {
      const plain = teacher.toObject ? teacher.toObject() : teacher;
      return {
        ...plain,
        maxClassPerGrade: normalizeMaxClassPerGrade(plain.maxClassPerGrade),
      };
    });

    res.json(normalizedTeachers);
  } catch (error) {
    console.error('Error getting department teachers:', error);
    res.status(500).json({ message: 'Lỗi khi lấy danh sách giáo viên', error: error.message });
  }
};

// Lấy danh sách môn học trong tổ bộ môn
exports.getDepartmentSubjects = async (req, res) => {
  try {
    const { id } = req.params;
    const department = await populatedDepartment(Department.findById(id));
    
    if (!department) {
      return res.status(404).json({ message: 'Không tìm thấy tổ bộ môn' });
    }

    if (req.user?.role === 'teacher') {
      const allowed = await canManageDepartment(req, department._id);
      if (!allowed) {
        return res.status(403).json({ message: 'Bạn không có quyền xem môn học của tổ bộ môn này' });
      }
    }

    res.json(department.subjectIds || []);
  } catch (error) {
    console.error('Error getting department subjects:', error);
    res.status(500).json({ message: 'Lỗi khi lấy danh sách môn học', error: error.message });
  }
};

// Thống kê tổ bộ môn
exports.getDepartmentStats = async (req, res) => {
  try {
    const { id } = req.params;
    const department = await Department.findById(id);
    
    if (!department) {
      return res.status(404).json({ message: 'Không tìm thấy tổ bộ môn' });
    }

    if (req.user?.role === 'teacher') {
      const allowed = await canManageDepartment(req, department._id);
      if (!allowed) {
        return res.status(403).json({ message: 'Bạn không có quyền xem thống kê tổ bộ môn này' });
      }
    }

    const teacherCount = await Teacher.countDocuments({ departmentId: id });
    const subjectCount = await Subject.countDocuments({ departmentId: id });
    const homeroomTeacherCount = await Teacher.countDocuments({ 
      departmentId: id, 
      isHomeroom: true 
    });

    res.json({
      department: {
        _id: department._id,
        name: department.name,
        code: department.code
      },
      stats: {
        teacherCount,
        subjectCount,
        homeroomTeacherCount
      }
    });
  } catch (error) {
    console.error('Error getting department stats:', error);
    res.status(500).json({ message: 'Lỗi khi lấy thống kê', error: error.message });
  }
};

// ✅ Thống kê phân công môn học theo tổ bộ môn
exports.getDepartmentAssignmentStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { year, semester } = req.query;

    if (!year) {
      return res.status(400).json({ message: 'Vui lòng cung cấp năm học (year)' });
    }

    const department = await Department.findById(id).populate('subjectIds', 'name code grades').lean();
    if (!department) {
      return res.status(404).json({ message: 'Không tìm thấy tổ bộ môn' });
    }

    if (req.user?.role === 'teacher') {
      const allowed = await canManageDepartment(req, department._id);
      if (!allowed) {
        return res.status(403).json({ message: 'Bạn không có quyền xem thống kê của tổ bộ môn này' });
      }
    }

    const subjectList = department.subjectIds || [];
    const subjectIds = subjectList
      .map(sub => sub?._id?.toString?.() || sub?.toString?.())
      .filter(Boolean);

    if (subjectIds.length === 0) {
      return res.json({
        department: {
          _id: department._id,
          name: department.name,
          code: department.code
        },
        filters: { year, semester: semester || null },
        stats: [],
        summary: {
          totalSubjects: 0,
          totalClassesNeeded: 0,
          totalClassesAssigned: 0,
          totalClassesMissing: 0,
          totalPeriodsNeeded: 0,
          totalPeriodsAssigned: 0,
          totalPeriodsMissing: 0
        }
      });
    }

    const classes = await ClassModel.find({ year }).lean();
    const classPeriodDocs = await ClassPeriods.find({ year, ...(semester ? { semester } : {}) }).lean();
    const classPeriodMap = new Map(classPeriodDocs.map(cp => [cp.classId.toString(), cp]));

    const assignments = await TeachingAssignment.find({
      year,
      subjectId: { $in: subjectIds },
      ...(semester ? { semester } : {}),
    })
      .populate('subjectId', 'name code')
      .populate('classId', 'className classCode grade')
      .populate('teacherId', 'name teacherCode')
      .lean();

    const stats = subjectList.map(subjectDoc => {
      const subjectId = subjectDoc?._id?.toString?.() || subjectDoc?.toString?.();
      const subjectName = subjectDoc?.name || 'Không rõ tên';
      const grades = (subjectDoc?.grades || []).map(String);

      const relevantClasses = classes.filter(cls => grades.includes(String(cls.grade)));

      let totalClassesNeeded = 0;
      let totalPeriodsNeeded = 0;

      relevantClasses.forEach(cls => {
        const cp = classPeriodMap.get(cls._id.toString());
        const periods = getSubjectPeriodsValue(cp, subjectId);
        if (periods > 0) {
          totalClassesNeeded += 1;
          totalPeriodsNeeded += periods;
        }
      });

      const subjectAssignments = assignments.filter(
        assignment => assignment.subjectId?._id?.toString() === subjectId
      );
      const assignedClassIds = new Set();
      let assignedPeriods = 0;

      subjectAssignments.forEach(assignment => {
        const classId = assignment.classId?._id?.toString() || assignment.classId?.toString();
        if (!classId) return;
        assignedClassIds.add(classId);
        const cp = classPeriodMap.get(classId);
        assignedPeriods += getSubjectPeriodsValue(cp, subjectId);
      });

      const assignedClasses = assignedClassIds.size;
      const missingClasses = Math.max(0, totalClassesNeeded - assignedClasses);
      const missingPeriods = Math.max(0, totalPeriodsNeeded - assignedPeriods);

      return {
        subjectId,
        subjectName,
        grades,
        totalClassesNeeded,
        assignedClasses,
        missingClasses,
        totalPeriodsNeeded,
        assignedPeriods,
        missingPeriods,
      };
    });

    const summary = stats.reduce(
      (acc, item) => {
        acc.totalClassesNeeded += item.totalClassesNeeded;
        acc.totalClassesAssigned += item.assignedClasses;
        acc.totalClassesMissing += item.missingClasses;
        acc.totalPeriodsNeeded += item.totalPeriodsNeeded;
        acc.totalPeriodsAssigned += item.assignedPeriods;
        acc.totalPeriodsMissing += item.missingPeriods;
        return acc;
      },
      {
        totalSubjects: stats.length,
        totalClassesNeeded: 0,
        totalClassesAssigned: 0,
        totalClassesMissing: 0,
        totalPeriodsNeeded: 0,
        totalPeriodsAssigned: 0,
        totalPeriodsMissing: 0,
      }
    );

    res.json({
      department: {
        _id: department._id,
        name: department.name,
        code: department.code,
      },
      filters: { year, semester: semester || null },
      stats,
      summary,
    });
  } catch (error) {
    console.error('Error getting department assignment stats:', error);
    res.status(500).json({ message: 'Lỗi khi lấy thống kê phân công tổ bộ môn', error: error.message });
  }
};

// ✅ Thêm giáo viên vào tổ bộ môn
exports.addTeacherToDepartment = async (req, res) => {
  try {
    const { id } = req.params; // departmentId
    const { teacherId } = req.body;

    if (!teacherId) {
      return res.status(400).json({ message: 'Thiếu teacherId' });
    }

    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({ message: 'Không tìm thấy tổ bộ môn' });
    }

    if (req.user?.role === 'teacher') {
      const allowed = await canManageDepartment(req, department._id);
      if (!allowed) {
        return res.status(403).json({ message: 'Bạn không có quyền thêm giáo viên vào tổ bộ môn này' });
      }
    }

    const teacher = await Teacher.findById(teacherId).populate('subjects.subjectId');
    if (!teacher) {
      return res.status(404).json({ message: 'Không tìm thấy giáo viên' });
    }

    // ✅ RÀNG BUỘC: CHỈ CÓ 1 TỔ TRƯỞNG TRONG 1 TỔ
    // Kiểm tra giáo viên đã thuộc tổ khác chưa
    if (teacher.departmentId && teacher.departmentId.toString() !== id) {
      // Nếu giáo viên này đã là tổ trưởng của tổ khác, reset tổ cũ
      if (teacher.isDepartmentHead) {
        const oldDepartment = await Department.findOne({ headTeacherId: teacherId });
        if (oldDepartment) {
          // Reset tổ trưởng cũ
          await Teacher.findByIdAndUpdate(teacherId, { 
            $unset: { departmentId: 1 },
            isDepartmentHead: false 
          });
          // Xóa headTeacherId của tổ cũ
          await Department.findByIdAndUpdate(oldDepartment._id, {
            headTeacherId: null
          });
        }
      } else {
        return res.status(400).json({ 
          message: `Giáo viên đã thuộc tổ bộ môn khác. Vui lòng xóa khỏi tổ cũ trước.` 
        });
      }
    }

    // ✅ Kiểm tra giáo viên có dạy ít nhất một môn trong tổ không
    if (!department.subjectIds || department.subjectIds.length === 0) {
      return res.status(400).json({ 
        message: 'Tổ bộ môn chưa có môn học. Vui lòng thêm môn học vào tổ trước.' 
      });
    }

    const departmentSubjectIds = department.subjectIds.map(s => s.toString());
    const teacherSubjectIds = (teacher.subjects || []).map(sub => {
      const subId = typeof sub.subjectId === 'object' && sub.subjectId !== null
        ? sub.subjectId._id.toString()
        : sub.subjectId?.toString();
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

    // ✅ Thêm giáo viên vào tổ - CHỈ set departmentId, KHÔNG set isDepartmentHead
    // isDepartmentHead CHỈ được set khi giáo viên đó là headTeacherId trong Department
    teacher.departmentId = department._id;
    
    // ✅ CHỈ set isDepartmentHead = true nếu giáo viên này là trưởng bộ môn (headTeacherId)
    // ✅ Nếu KHÔNG phải trưởng bộ môn, đảm bảo isDepartmentHead = false
    if (department.headTeacherId && department.headTeacherId.toString() === teacherId) {
      teacher.isDepartmentHead = true;
    } else {
      // ✅ Đảm bảo thành viên bộ môn KHÔNG có isDepartmentHead = true
      teacher.isDepartmentHead = false;
    }
    
    await teacher.save();
    
    // ✅ Cập nhật yearRoles cho giáo viên theo năm học của department
    const deptYear = department.year || department.schoolYear;
    if (deptYear) {
      await updateTeacherYearRole(teacherId, {
        departmentId: department._id,
        isDepartmentHead: (department.headTeacherId && department.headTeacherId.toString() === teacherId) ? true : false
      }, deptYear);
    }

    // ✅ Cập nhật teacherIds trong Department - thêm giáo viên vào danh sách thành viên
    // Sử dụng $addToSet để tránh trùng lặp (MongoDB tự động kiểm tra)
    await Department.findByIdAndUpdate(id, {
      $addToSet: { teacherIds: teacherId } // Thêm teacherId vào teacherIds nếu chưa có
    });

    const updatedTeacher = await Teacher.findById(teacherId)
      .populate('accountId', 'email phone')
      .populate('subjects.subjectId', 'name code')
      .populate('departmentId', 'name code');

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

// ✅ Xóa giáo viên khỏi tổ bộ môn
exports.removeTeacherFromDepartment = async (req, res) => {
  try {
    const { id } = req.params; // departmentId
    // DELETE method có thể gửi data qua query hoặc body
    const teacherId = req.body?.teacherId || req.query?.teacherId;

    if (!teacherId) {
      return res.status(400).json({ message: 'Thiếu teacherId' });
    }

    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({ message: 'Không tìm thấy tổ bộ môn' });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Không tìm thấy giáo viên' });
    }

    // Kiểm tra giáo viên có thuộc tổ này không
    if (!teacher.departmentId || teacher.departmentId.toString() !== id) {
      return res.status(400).json({ 
        message: 'Giáo viên không thuộc tổ bộ môn này' 
      });
    }

    // ✅ Nếu là trưởng bộ môn, reset về giáo viên bình thường (không chặn xóa)
    const isHeadTeacher = department.headTeacherId && department.headTeacherId.toString() === teacherId;
    
    if (isHeadTeacher) {
      // ✅ Reset headTeacherId trong Department về null
      await Department.findByIdAndUpdate(id, {
        headTeacherId: null
      });
    }

    // ✅ Xóa giáo viên khỏi tổ - reset departmentId và isDepartmentHead
    teacher.departmentId = null;
    teacher.isDepartmentHead = false; // ✅ Đảm bảo reset isDepartmentHead khi xóa khỏi tổ (kể cả tổ trưởng)
    await teacher.save();
    
    // ✅ Cập nhật yearRoles cho giáo viên theo năm học của department
    const deptYear = department.year || department.schoolYear;
    if (deptYear) {
      await updateTeacherYearRole(teacherId, {
        departmentId: null,
        isDepartmentHead: false
      }, deptYear);
    }

    // ✅ Cập nhật teacherIds trong Department - xóa giáo viên khỏi danh sách thành viên
    await Department.findByIdAndUpdate(id, {
      $pull: { teacherIds: teacherId } // Xóa teacherId khỏi mảng teacherIds
    });

    res.json({
      message: isHeadTeacher 
        ? 'Đã xóa trưởng bộ môn khỏi tổ và reset về giáo viên bình thường' 
        : 'Đã xóa giáo viên khỏi tổ bộ môn thành công',
      teacher: {
        _id: teacher._id,
        name: teacher.name,
        teacherCode: teacher.teacherCode,
        isDepartmentHead: false // ✅ Đã reset về false
      },
      wasHeadTeacher: isHeadTeacher // ✅ Thông báo nếu giáo viên này là tổ trưởng
    });
  } catch (error) {
    console.error('Error removing teacher from department:', error);
    res.status(500).json({ 
      message: 'Lỗi khi xóa giáo viên khỏi tổ bộ môn', 
      error: error.message 
    });
  }
};

// Sao chép tổ bộ môn từ năm học khác
exports.copyDepartmentsFromYear = async (req, res) => {
  try {
    const { fromYear, toYear } = req.body;

    if (!fromYear || !toYear) {
      return res.status(400).json({ message: 'Năm học nguồn và năm học đích là bắt buộc' });
    }

    if (fromYear === toYear) {
      return res.status(400).json({ message: 'Năm học nguồn và năm học đích không được giống nhau' });
    }

    // Lấy tất cả tổ bộ môn từ năm học nguồn
    const sourceDepartments = await Department.find({ year: fromYear, status: 'active' });

    if (sourceDepartments.length === 0) {
      return res.status(404).json({ message: `Không tìm thấy tổ bộ môn nào trong năm học ${fromYear}` });
    }

    const copiedDepartments = [];
    const errors = [];

    for (const sourceDept of sourceDepartments) {
      try {
        // Kiểm tra xem tổ bộ môn đã tồn tại trong năm học đích chưa (theo code)
        const existingDept = await Department.findOne({ 
          code: sourceDept.code, 
          year: toYear 
        });

        if (existingDept) {
          errors.push({
            code: sourceDept.code,
            name: sourceDept.name,
            error: 'Đã tồn tại trong năm học đích'
          });
          continue;
        }

        // Tạo tổ bộ môn mới cho năm học đích
        const newDepartment = await Department.create({
          name: sourceDept.name,
          code: sourceDept.code,
          description: sourceDept.description,
          headTeacherId: null, // Không sao chép trưởng bộ môn
          subjectIds: sourceDept.subjectIds || [],
          teacherIds: [], // Không sao chép danh sách giáo viên
          notes: sourceDept.notes || '',
          year: toYear,
          status: 'active'
        });

        copiedDepartments.push({
          _id: newDepartment._id,
          name: newDepartment.name,
          code: newDepartment.code,
          year: newDepartment.year
        });
      } catch (error) {
        errors.push({
          code: sourceDept.code,
          name: sourceDept.name,
          error: error.message
        });
      }
    }

    res.json({
      message: `Đã sao chép ${copiedDepartments.length} tổ bộ môn từ năm học ${fromYear} sang ${toYear}`,
      copied: copiedDepartments,
      errors: errors.length > 0 ? errors : undefined,
      total: sourceDepartments.length,
      success: copiedDepartments.length,
      failed: errors.length
    });
  } catch (error) {
    console.error('Error copying departments from year:', error);
    res.status(500).json({ 
      message: 'Lỗi khi sao chép tổ bộ môn', 
      error: error.message 
    });
  }
};

