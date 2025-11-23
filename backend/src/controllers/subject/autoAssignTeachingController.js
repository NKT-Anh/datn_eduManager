const TeachingAssignment = require('../../models/subject/teachingAssignment');
const Teacher = require('../../models/user/teacher');
const Class = require('../../models/class/class');
const Subject = require('../../models/subject/subject');
const ScheduleConfig = require('../../models/subject/scheduleConfig');

/**
 * ✅ Helper: Lấy số tiết/tuần của môn học theo khối từ ScheduleConfig
 */
async function getSubjectPeriodsPerWeek(subjectId, grade, scheduleConfig = null) {
  try {
    // Nếu không có scheduleConfig, lấy config active
    if (!scheduleConfig) {
      scheduleConfig = await ScheduleConfig.findOne({ isActive: true }).lean();
    }
    
    if (!scheduleConfig || !scheduleConfig.gradeConfigs) {
      // Fallback: dùng giá trị mặc định dựa trên tên môn
      return getDefaultPeriodsPerWeek(subjectId);
    }
    
    const gradeConfig = scheduleConfig.gradeConfigs.get?.(grade) || 
                       scheduleConfig.gradeConfigs[grade];
    
    if (!gradeConfig || !gradeConfig.subjects) {
      return getDefaultPeriodsPerWeek(subjectId);
    }
    
    const subjectConfig = gradeConfig.subjects.get?.(subjectId.toString()) ||
                         gradeConfig.subjects[subjectId.toString()];
    
    if (subjectConfig && typeof subjectConfig.periodsPerWeek === 'number') {
      return subjectConfig.periodsPerWeek;
    }
    
    return getDefaultPeriodsPerWeek(subjectId);
  } catch (error) {
    console.error('Lỗi khi lấy số tiết/tuần:', error);
    return getDefaultPeriodsPerWeek(subjectId);
  }
}

/**
 * ✅ Helper: Lấy số tiết/tuần mặc định dựa trên tên môn
 */
async function getDefaultPeriodsPerWeek(subjectId) {
  try {
    const subject = await Subject.findById(subjectId).lean();
    if (!subject) return 2;
    
    const subjectName = (subject.name || '').toLowerCase();
    
    const defaultPeriodsMap = {
      'toán': 4,
      'ngữ văn': 4,
      'văn': 4,
      'tiếng anh': 3,
      'anh': 3,
      'vật lý': 2,
      'hóa học': 2,
      'hóa': 2,
      'sinh học': 2,
      'sinh': 2,
      'lịch sử': 2,
      'địa lý': 2,
      'địa': 2,
      'giáo dục công dân': 1,
      'gdcd': 1,
      'thể dục': 2,
      'công nghệ': 1,
      'tin học': 1,
      'tin': 1,
    };
    
    for (const [key, periods] of Object.entries(defaultPeriodsMap)) {
      if (subjectName.includes(key)) {
        return periods;
      }
    }
    
    return 2; // Mặc định
  } catch (error) {
    return 2;
  }
}

/**
 * ✅ Phân công tự động giảng dạy
 * @param {string} year - Năm học
 * @param {string} semester - Học kỳ ("1" hoặc "2")
 * @param {string[]} grades - Mảng khối lớp (["10", "11", "12"])
 * @param {boolean} shouldDeleteOld - Có xóa phân công cũ không
 * @param {boolean} shouldSupplement - Có bổ sung vào phân công cũ không
 */
exports.autoAssignTeaching = async (req, res) => {
  try {
    const { 
      year, 
      semester, 
      grades, 
      shouldDeleteOld = false, 
      shouldSupplement = false,
      applyProposals = false // ✅ Tùy chọn: có áp dụng proposal từ trưởng bộ môn không
    } = req.body;
    
    console.log('📥 ========== autoAssignTeaching START ==========');
    console.log('📥 Request body:', JSON.stringify(req.body, null, 2));
    
    // ✅ Validation
    if (!year || !semester || !grades || !Array.isArray(grades) || grades.length === 0) {
      return res.status(400).json({
        message: 'Vui lòng cung cấp đầy đủ: year, semester, và grades (mảng khối lớp)',
      });
    }
    
    if (!['1', '2'].includes(semester)) {
      return res.status(400).json({
        message: 'Semester phải là "1" hoặc "2"',
      });
    }
    
    // ✅ Lấy dữ liệu từ database
    const TeachingAssignmentProposal = require('../../models/subject/teachingAssignmentProposal');
    
    const [classes, allSubjects, teachers, existingAssignments, scheduleConfig, proposals] = await Promise.all([
      Class.find({ year, grade: { $in: grades } }).lean(),
      Subject.find({ isActive: { $ne: false } }).lean(), // Lấy tất cả môn (isActive không phải false, bao gồm null/undefined)
      Teacher.find({ 
        status: 'active',
        isLeader: { $ne: true } // Loại bỏ BGH
      }).lean(),
      TeachingAssignment.find({ year, semester }).populate('teacherId subjectId classId').lean(),
      ScheduleConfig.findOne({ isActive: true }).lean(),
      // ✅ Lấy proposal đã được duyệt (approved) nếu applyProposals = true
      applyProposals 
        ? TeachingAssignmentProposal.find({ 
            year, 
            semester, 
            status: 'approved' 
          }).populate('teacherId subjectId classId').lean()
        : Promise.resolve([])
    ]);
    
    // ✅ Nếu áp dụng proposal, thêm vào existingAssignments để tôn trọng phân công đề xuất
    let assignmentsToRespect = [...existingAssignments];
    if (applyProposals && proposals.length > 0) {
      console.log(`📋 Áp dụng ${proposals.length} đề xuất từ trưởng bộ môn`);
      // Chuyển proposal thành format giống TeachingAssignment để tính toán
      const proposalAssignments = proposals.map(p => ({
        _id: p._id,
        teacherId: p.teacherId,
        subjectId: p.subjectId,
        classId: p.classId,
        year: p.year,
        semester: p.semester,
        isFromProposal: true // ✅ Đánh dấu để phân biệt
      }));
      assignmentsToRespect = [...assignmentsToRespect, ...proposalAssignments];
    }
    
    // ✅ Lọc môn học có ít nhất một khối trong grades input
    const subjects = allSubjects.filter(subj => {
      if (!subj.grades || !Array.isArray(subj.grades) || subj.grades.length === 0) {
        return false;
      }
      // Kiểm tra xem môn học có ít nhất một khối trong grades input không
      return subj.grades.some(grade => grades.includes(grade));
    });
    
    console.log(`📊 Dữ liệu: ${classes.length} lớp, ${allSubjects.length} môn (tổng), ${subjects.length} môn (sau lọc), ${teachers.length} giáo viên, ${existingAssignments.length} phân công hiện có`);
    console.log(`📊 Grades input:`, grades);
    console.log(`📊 Môn học sau lọc:`, subjects.map(s => ({ name: s.name, grades: s.grades })));
    
    if (classes.length === 0) {
      return res.status(400).json({
        message: `Không có lớp nào cho năm học ${year} và khối ${grades.join(", ")}`,
      });
    }
    
    if (subjects.length === 0) {
      console.warn(`⚠️ Không tìm thấy môn học cho khối ${grades.join(", ")}`);
      console.warn(`⚠️ Tất cả môn học:`, allSubjects.map(s => ({ 
        name: s.name, 
        grades: s.grades, 
        isActive: s.isActive 
      })));
      return res.status(400).json({
        message: `Không có môn học nào cho khối ${grades.join(", ")}. Vui lòng kiểm tra lại cấu hình môn học.`,
        debug: {
          totalSubjects: allSubjects.length,
          requestedGrades: grades,
          subjectsWithGrades: allSubjects.map(s => ({ 
            name: s.name, 
            grades: s.grades 
          }))
        }
      });
    }
    
    if (teachers.length === 0) {
      return res.status(400).json({
        message: 'Không có giáo viên nào phù hợp (đã loại bỏ BGH và giáo viên đã nghỉ việc)',
      });
    }
    
    // ✅ Xóa phân công cũ nếu cần
    if (shouldDeleteOld) {
      const classIds = classes.map(c => c._id);
      const assignmentsToDelete = existingAssignments.filter(a => 
        classIds.some(id => id.toString() === a.classId?._id?.toString())
      );
      
      if (assignmentsToDelete.length > 0) {
        await TeachingAssignment.deleteMany({
          _id: { $in: assignmentsToDelete.map(a => a._id) }
        });
        console.log(`🗑️ Đã xóa ${assignmentsToDelete.length} phân công cũ`);
      }
    }
    
    // ✅ Lấy phân công để tính toán (sau khi xóa nếu cần)
    // Nếu applyProposals = true, đã có assignmentsToRespect bao gồm cả proposal
    // Nếu applyProposals = false, chỉ dùng existingAssignments (không tôn trọng proposal)
    const assignmentsToUse = shouldDeleteOld 
      ? (applyProposals ? assignmentsToRespect.filter(a => !a.isFromProposal) : []) // Nếu xóa cũ, chỉ giữ proposal nếu applyProposals = true
      : shouldSupplement
        ? (applyProposals ? assignmentsToRespect : existingAssignments).filter(a => {
            const classId = a.classId?._id?.toString() || a.classId?.toString();
            return classes.some(c => c._id.toString() === classId);
          })
        : applyProposals 
          ? assignmentsToRespect 
          : await TeachingAssignment.find({ year, semester })
              .populate('teacherId subjectId classId')
              .lean();
    
    // ✅ Tính toán phân công tự động
    // Nếu applyProposals = true, sẽ tôn trọng proposal (chỉ phân công phần còn trống)
    // Nếu applyProposals = false, sẽ phân công toàn quyền (ghi đè proposal)
    const newAssignments = await calculateAutoAssignments(
      classes,
      subjects,
      teachers,
      assignmentsToUse,
      year,
      semester,
      grades,
      scheduleConfig
    );
    
    if (newAssignments.length === 0) {
      return res.json({
        message: 'Không có phân công mới nào được tạo',
        createdCount: 0,
        assignments: [],
      });
    }
    
    // ✅ Kiểm tra trùng lặp trong database trước khi insert
    if (newAssignments.length > 0) {
      // Lấy tất cả phân công hiện có để kiểm tra
      const existingInDb = await TeachingAssignment.find({
        year,
        semester,
        $or: newAssignments.map(a => ({
          teacherId: a.teacherId,
          subjectId: a.subjectId,
          classId: a.classId
        }))
      }).lean();
      
      // Tạo map để kiểm tra nhanh
      const existingKeys = new Set();
      existingInDb.forEach(a => {
        const key = `${a.teacherId}-${a.subjectId}-${a.classId}`;
        existingKeys.add(key);
      });
      
      // Lọc bỏ các phân công trùng lặp
      const uniqueAssignments = newAssignments.filter(a => {
        const key = `${a.teacherId}-${a.subjectId}-${a.classId}`;
        if (existingKeys.has(key)) {
          console.warn(`⚠️ Bỏ qua phân công trùng lặp trong DB: ${key}`);
          return false;
        }
        existingKeys.add(key); // Đánh dấu để tránh trùng trong cùng batch
        return true;
      });
      
      console.log(`📊 Sau khi lọc trùng lặp: ${uniqueAssignments.length}/${newAssignments.length} phân công`);
      
      if (uniqueAssignments.length === 0) {
        return res.json({
          message: 'Tất cả phân công đã tồn tại trong database',
          createdCount: 0,
          assignments: [],
        });
      }
      
      // ✅ Tạo phân công mới (chỉ những cái không trùng)
      const createdAssignments = await TeachingAssignment.insertMany(uniqueAssignments, { ordered: false });
      
      // ✅ Nếu áp dụng proposal, cập nhật status của proposal thành 'applied'
      if (applyProposals && proposals.length > 0) {
        const proposalMap = new Map();
        proposals.forEach(p => {
          const key = `${p.teacherId._id || p.teacherId}-${p.subjectId._id || p.subjectId}-${p.classId._id || p.classId}`;
          proposalMap.set(key, p);
        });
        
        let appliedProposalsCount = 0;
        for (const assignment of createdAssignments) {
          const key = `${assignment.teacherId}-${assignment.subjectId}-${assignment.classId}`;
          const matchingProposal = proposalMap.get(key);
          if (matchingProposal) {
            await TeachingAssignmentProposal.findByIdAndUpdate(matchingProposal._id, {
              status: 'applied',
              appliedAt: new Date(),
              teachingAssignmentId: assignment._id
            });
            appliedProposalsCount++;
          }
        }
        console.log(`✅ Đã áp dụng ${appliedProposalsCount} proposal vào TeachingAssignment`);
      }
      
      // ✅ Populate để trả về
      const populatedAssignments = await TeachingAssignment.find({
        _id: { $in: createdAssignments.map(a => a._id) }
      })
        .populate('teacherId', 'name teacherCode')
        .populate('subjectId', 'name code')
        .populate('classId', 'className grade')
        .lean();
      
      console.log(`✅ Đã tạo ${createdAssignments.length} phân công mới`);
      
      res.json({
        message: `Đã phân công tự động ${createdAssignments.length} môn/lớp cho năm ${year}, học kỳ ${semester}, khối ${grades.join(", ")}`,
        createdCount: createdAssignments.length,
        assignments: populatedAssignments,
        appliedProposalsCount: applyProposals ? (proposals.length > 0 ? appliedProposalsCount : 0) : undefined
      });
    } else {
      res.json({
        message: 'Không có phân công mới nào được tạo',
        createdCount: 0,
        assignments: [],
      });
    }
    
  } catch (error) {
    console.error('❌ Lỗi phân công tự động:', error);
    res.status(500).json({
      message: 'Lỗi khi phân công tự động',
      error: error.message,
    });
  }
};

/**
 * ✅ Tính toán phân công tự động - Logic chuẩn THPT
 * 
 * Yêu cầu:
 * 1. Giáo viên chỉ có thể dạy môn học của họ
 * 2. Giáo viên chỉ có thể dạy những khối họ được phân quyền
 * 3. Không vượt maxClasses
 * 4. Không vượt weeklyLessons
 * 5. Không trùng tiết với thời khóa biểu (availableMatrix)
 * 6. Tránh trường hợp nhiều GV cùng môn dồn vào 1 khối, phải chia đều
 * 7. Ưu tiên mainSubject
 * 8. Ưu tiên giáo viên ít lớp nhất (balance load)
 */
async function calculateAutoAssignments(
  classes,
  subjects,
  teachers,
  existingAssignments,
  year,
  semester,
  grades,
  scheduleConfig
) {
  // ✅ Bước 1: Lọc lớp theo khối
  const targetClasses = classes.filter(c => grades.includes(String(c.grade)));
  
  // ✅ Bước 2: Khởi tạo counters và maps
  const teacherLoadMap = new Map(); // Số lớp mỗi giáo viên đang dạy (tổng)
  const teacherWeeklyLessonsMap = new Map(); // Số tiết/tuần mỗi giáo viên đang dạy
  const teacherSubjectGradeCountMap = new Map(); // Số lớp mỗi giáo viên dạy cho mỗi môn/khối (để chia đều)
  const teacherGradeCountMap = new Map(); // Số lớp mỗi giáo viên dạy cho mỗi khối (để kiểm tra maxClassPerGrade)
  // Format: teacherId -> Map(grade -> count)
  
  teachers.forEach(t => {
    const teacherId = t._id.toString();
    teacherLoadMap.set(teacherId, 0);
    teacherWeeklyLessonsMap.set(teacherId, 0);
    teacherSubjectGradeCountMap.set(teacherId, new Map());
    teacherGradeCountMap.set(teacherId, new Map());
  });
  
  // ✅ Bước 3: Tính tải hiện tại từ phân công cũ (cùng năm học và học kỳ)
  const currentYearAssignments = existingAssignments.filter(a => a.year === year);
  const currentSemesterAssignments = currentYearAssignments.filter(a => a.semester === semester);
  
  for (const assignment of currentSemesterAssignments) {
    const teacherId = assignment.teacherId?._id?.toString();
    if (!teacherId) continue;
    
    const subjectId = assignment.subjectId?._id?.toString();
    const classGrade = String(assignment.classId?.grade || '10');
    
    // Cập nhật số lớp (tổng)
    teacherLoadMap.set(teacherId, (teacherLoadMap.get(teacherId) || 0) + 1);
    
    // Cập nhật số tiết/tuần
    const periodsPerWeek = await getSubjectPeriodsPerWeek(subjectId, classGrade, scheduleConfig);
    teacherWeeklyLessonsMap.set(
      teacherId,
      (teacherWeeklyLessonsMap.get(teacherId) || 0) + periodsPerWeek
    );
    
    // Cập nhật số lớp cho môn/khối cụ thể (để chia đều)
    const subjectGradeKey = `${subjectId}-${classGrade}`;
    const subjectGradeMap = teacherSubjectGradeCountMap.get(teacherId);
    subjectGradeMap.set(subjectGradeKey, (subjectGradeMap.get(subjectGradeKey) || 0) + 1);
    
    // Cập nhật số lớp cho khối (để kiểm tra maxClassPerGrade)
    const gradeMap = teacherGradeCountMap.get(teacherId);
    gradeMap.set(classGrade, (gradeMap.get(classGrade) || 0) + 1);
  }
  
  // ✅ Bước 4: Map để tránh trùng môn trong cùng lớp
  const assignedMap = new Map(); // classId -> Set(subjectId)
  currentSemesterAssignments.forEach(a => {
    const classId = a.classId?._id?.toString();
    const subjectId = a.subjectId?._id?.toString();
    if (!assignedMap.has(classId)) {
      assignedMap.set(classId, new Set());
    }
    assignedMap.get(classId).add(subjectId);
  });
  
  // ✅ Bước 5: Map để tránh trùng lặp phân công
  const existingAssignmentMap = new Map();
  currentSemesterAssignments.forEach(a => {
    const teacherId = a.teacherId?._id?.toString();
    const classId = a.classId?._id?.toString();
    const subjectId = a.subjectId?._id?.toString();
    if (teacherId && classId && subjectId) {
      const key = `${teacherId}-${subjectId}-${classId}-${year}-${semester}`;
      existingAssignmentMap.set(key, true);
    }
  });
  
  // ✅ Bước 6: Generate tasks (lớp + môn)
  const tasks = [];
  for (const cls of targetClasses) {
    const classSubjects = subjects.filter(s => {
      if (!s.grades || !s.grades.includes(String(cls.grade))) return false;
      if (s.isActive === false) return false;
      return true;
    });
    
    for (const subj of classSubjects) {
      const classId = cls._id.toString();
      const subjectId = subj._id.toString();
      
      // Bỏ qua nếu đã có phân công
      if (assignedMap.get(classId)?.has(subjectId)) continue;
      
      tasks.push({
        classId: cls._id,
        className: cls.className,
        classGrade: String(cls.grade),
        subjectId: subj._id,
        subjectName: subj.name,
      });
    }
  }
  
  console.log(`📋 Tổng số tasks cần phân công: ${tasks.length}`);
  
  const newAssignments = [];
  const unassigned = [];
  
  // ✅ Bước 7: Xử lý từng task
  for (const task of tasks) {
    const { classId, className, classGrade, subjectId, subjectName } = task;
    const classIdStr = classId.toString();
    const subjectIdStr = subjectId.toString();
    
    let selectedTeacher = null;
    
    // ✅ Nếu là học kỳ 2 → ưu tiên giáo viên đã dạy môn đó ở học kỳ 1 cùng năm học
    if (semester === "2") {
      const prev = currentYearAssignments.find(a => {
        const aClassId = a.classId?._id?.toString();
        const aSubjectId = a.subjectId?._id?.toString();
        return aClassId === classIdStr && 
               aSubjectId === subjectIdStr && 
               a.semester === "1";
      });
      
      if (prev?.teacherId?._id) {
        const prevTeacher = teachers.find(t => 
          t._id.toString() === prev.teacherId._id.toString()
        );
        if (prevTeacher && !prevTeacher.isLeader && prevTeacher.status === 'active') {
          // ✅ Kiểm tra lại các ràng buộc cho giáo viên cũ
          const periodsPerWeekForPrev = await getSubjectPeriodsPerWeek(subjectIdStr, classGrade, scheduleConfig);
          if (await canTeacherTeach(prevTeacher, subjectIdStr, classGrade, teacherLoadMap, teacherWeeklyLessonsMap, scheduleConfig, existingAssignmentMap, classIdStr, year, semester, periodsPerWeekForPrev, teacherGradeCountMap)) {
            selectedTeacher = prevTeacher;
          }
        }
      }
    }
    
    // ✅ Nếu chưa có giáo viên → tìm giáo viên phù hợp
    if (!selectedTeacher) {
      // Bước 7.1: Tìm danh sách giáo viên có thể dạy môn này
      const candidateTeachers = teachers.filter(t => {
        // ✅ 1. Loại bỏ BGH
        if (t.isLeader) return false;
        
        // ✅ 2. Chỉ giáo viên đang hoạt động
        if (t.status !== 'active') return false;
        
        // ✅ 3. Giáo viên phải có môn học này trong danh sách subjects
        const hasSubject = t.subjects?.some(s => {
          const sSubjectId = s.subjectId?._id?.toString() || s.subjectId?.toString();
          return sSubjectId === subjectIdStr;
        }) || t.mainSubject?.toString() === subjectIdStr;
        
        if (!hasSubject) return false;
        
        // ✅ 4. Giáo viên phải được phân quyền dạy khối này
        const canTeachGrade = t.subjects?.some(s => {
          const sSubjectId = s.subjectId?._id?.toString() || s.subjectId?.toString();
          const sGrades = s.grades || [];
          return sSubjectId === subjectIdStr && sGrades.includes(classGrade);
        });
        
        if (!canTeachGrade && t.mainSubject?.toString() !== subjectIdStr) return false;
        
        return true;
      });
      
      if (candidateTeachers.length === 0) {
        unassigned.push({ className, subjectName });
        continue;
      }
      
      // Bước 7.2: Lọc theo các ràng buộc
      const validTeachers = [];
      const periodsPerWeek = await getSubjectPeriodsPerWeek(subjectIdStr, classGrade, scheduleConfig);
      
      for (const teacher of candidateTeachers) {
        const teacherId = teacher._id.toString();
        
        // ✅ Kiểm tra trùng lặp
        const assignmentKey = `${teacherId}-${subjectIdStr}-${classIdStr}-${year}-${semester}`;
        if (existingAssignmentMap.has(assignmentKey)) continue;
        
        // ✅ Kiểm tra các ràng buộc
        const canTeach = await canTeacherTeach(
          teacher, 
          subjectIdStr, 
          classGrade, 
          teacherLoadMap, 
          teacherWeeklyLessonsMap, 
          scheduleConfig, 
          existingAssignmentMap, 
          classIdStr, 
          year, 
          semester,
          periodsPerWeek,
          teacherGradeCountMap
        );
        
        if (canTeach) {
          validTeachers.push(teacher);
        }
      }
      
      if (validTeachers.length === 0) {
        unassigned.push({ className, subjectName });
        continue;
      }
      
      // Bước 7.3: Sắp xếp và chọn giáo viên
      // ✅ Ưu tiên 1: mainSubject
      // ✅ Ưu tiên 2: Giáo viên ít lớp nhất (balance load)
      // ✅ Ưu tiên 3: Giáo viên ít lớp cho môn/khối này nhất (chia đều)
      validTeachers.sort((a, b) => {
        const aId = a._id.toString();
        const bId = b._id.toString();
        
        // Ưu tiên mainSubject
        const aMainSubject = a.mainSubject?.toString();
        const bMainSubject = b.mainSubject?.toString();
        const aIsMain = aMainSubject === subjectIdStr;
        const bIsMain = bMainSubject === subjectIdStr;
        
        if (aIsMain && !bIsMain) return -1;
        if (!aIsMain && bIsMain) return 1;
        
        // Ưu tiên giáo viên ít lớp cho môn/khối này nhất (chia đều)
        const subjectGradeKey = `${subjectIdStr}-${classGrade}`;
        const aSubjectGradeCount = teacherSubjectGradeCountMap.get(aId)?.get(subjectGradeKey) || 0;
        const bSubjectGradeCount = teacherSubjectGradeCountMap.get(bId)?.get(subjectGradeKey) || 0;
        
        if (aSubjectGradeCount !== bSubjectGradeCount) {
          return aSubjectGradeCount - bSubjectGradeCount;
        }
        
        // Ưu tiên giáo viên ít lớp nhất (tổng)
        const aLoad = teacherLoadMap.get(aId) || 0;
        const bLoad = teacherLoadMap.get(bId) || 0;
        
        return aLoad - bLoad;
      });
      
      selectedTeacher = validTeachers[0];
    }
    
    if (!selectedTeacher) {
      unassigned.push({ className, subjectName });
      continue;
    }
    
    // ✅ Bước 8: Tạo phân công và cập nhật counters
    const teacherId = selectedTeacher._id.toString();
    const assignmentKey = `${teacherId}-${subjectIdStr}-${classIdStr}-${year}-${semester}`;
    
    // Kiểm tra lại trùng lặp
    if (existingAssignmentMap.has(assignmentKey)) {
      if (!assignedMap.has(classIdStr)) {
        assignedMap.set(classIdStr, new Set());
      }
      assignedMap.get(classIdStr).add(subjectIdStr);
      continue;
    }
    
    // Tạo phân công mới
    newAssignments.push({
      teacherId: selectedTeacher._id,
      subjectId: subjectId,
      classId: classId,
      year,
      semester,
    });
    
    // Đánh dấu đã phân công
    existingAssignmentMap.set(assignmentKey, true);
    
    // Cập nhật counters
    if (!assignedMap.has(classIdStr)) {
      assignedMap.set(classIdStr, new Set());
    }
    assignedMap.get(classIdStr).add(subjectIdStr);
    
    // Cập nhật số lớp (tổng)
    teacherLoadMap.set(teacherId, (teacherLoadMap.get(teacherId) || 0) + 1);
    
    // Cập nhật số tiết/tuần
    const periodsPerWeek = await getSubjectPeriodsPerWeek(subjectIdStr, classGrade, scheduleConfig);
    teacherWeeklyLessonsMap.set(
      teacherId,
      (teacherWeeklyLessonsMap.get(teacherId) || 0) + periodsPerWeek
    );
    
    // Cập nhật số lớp cho môn/khối cụ thể (để chia đều)
    const subjectGradeKey = `${subjectIdStr}-${classGrade}`;
    const subjectGradeMap = teacherSubjectGradeCountMap.get(teacherId);
    subjectGradeMap.set(subjectGradeKey, (subjectGradeMap.get(subjectGradeKey) || 0) + 1);
    
    // Cập nhật số lớp cho khối (để kiểm tra maxClassPerGrade)
    const gradeMap = teacherGradeCountMap.get(teacherId);
    gradeMap.set(classGrade, (gradeMap.get(classGrade) || 0) + 1);
    
    console.log(`✅ Phân công: ${selectedTeacher.name || selectedTeacher.teacherCode} → ${subjectName} → ${className}`);
  }
  
  // ✅ Thống kê kết quả
  console.log(`\n📊 ========== KẾT QUẢ PHÂN CÔNG ==========`);
  console.log(`✅ Đã phân công: ${newAssignments.length} môn/lớp`);
  console.log(`⚠️ Chưa phân công: ${unassigned.length} môn/lớp`);
  
  // ✅ Thống kê theo lớp
  const classStats = new Map();
  targetClasses.forEach(cls => {
    const classId = cls._id.toString();
    const assignedSubjects = assignedMap.get(classId)?.size || 0;
    const requiredSubjects = subjects.filter(s => 
      s.grades && s.grades.includes(String(cls.grade)) && s.isActive !== false
    ).length;
    classStats.set(cls.className, { assigned: assignedSubjects, required: requiredSubjects });
  });
  
  console.log(`\n📋 Thống kê theo lớp:`);
  classStats.forEach((stats, className) => {
    const status = stats.assigned === stats.required ? '✅' : '⚠️';
    console.log(`${status} ${className}: ${stats.assigned}/${stats.required} môn`);
  });
  
  if (unassigned.length > 0) {
    console.warn('\n⚠️ Các lớp/môn chưa được phân công:');
    unassigned.forEach(item => {
      console.warn(`  - ${item.className}: ${item.subjectName}`);
    });
  }
  
  return newAssignments;
}

/**
 * ✅ Kiểm tra giáo viên có thể dạy môn/lớp này không
 * 
 * Ràng buộc:
 * 1. Không vượt maxClasses
 * 2. Không vượt weeklyLessons
 * 3. Không vượt maxClassPerGrade
 * 4. Không trùng lặp phân công
 */
async function canTeacherTeach(
  teacher,
  subjectId,
  classGrade,
  teacherLoadMap,
  teacherWeeklyLessonsMap,
  scheduleConfig,
  existingAssignmentMap,
  classId,
  year,
  semester,
  periodsPerWeek = null,
  teacherGradeCountMap = null
) {
  const teacherId = teacher._id.toString();
  
  // ✅ 1. Kiểm tra trùng lặp
  const assignmentKey = `${teacherId}-${subjectId}-${classId}-${year}-${semester}`;
  if (existingAssignmentMap.has(assignmentKey)) {
    return false;
  }
  
  // ✅ 2. Kiểm tra maxClasses (tổng)
  const currentLoad = teacherLoadMap.get(teacherId) || 0;
  const maxClasses = teacher.maxClasses || 5;
  if (currentLoad >= maxClasses) {
    return false;
  }
  
  // ✅ 3. Kiểm tra weeklyLessons
  if (periodsPerWeek === null) {
    periodsPerWeek = await getSubjectPeriodsPerWeek(subjectId, classGrade, scheduleConfig);
  }
  const currentWeeklyLessons = teacherWeeklyLessonsMap.get(teacherId) || 0;
  // ✅ Sử dụng effectiveWeeklyLessons (đã áp dụng cap limit từ weeklyLessons)
  // effectiveWeeklyLessons = base (17) - reduction + optional, và đã bị cap bởi weeklyLessons
  const maxWeeklyLessons = teacher.effectiveWeeklyLessons || 17;
  const newWeeklyLessons = currentWeeklyLessons + periodsPerWeek;
  
  if (newWeeklyLessons > maxWeeklyLessons) {
    return false;
  }
  
  // ✅ 4. Kiểm tra maxClassPerGrade
  let maxClassPerGradeForThisGrade = 0;
  if (teacher.maxClassPerGrade) {
    if (teacher.maxClassPerGrade instanceof Map) {
      maxClassPerGradeForThisGrade = teacher.maxClassPerGrade.get(classGrade) || 0;
    } else if (typeof teacher.maxClassPerGrade === 'object') {
      maxClassPerGradeForThisGrade = teacher.maxClassPerGrade[classGrade] || 0;
    }
  }
  
  // Đếm số lớp giáo viên đang dạy cho khối này
  let currentLoadForGrade = 0;
  if (teacherGradeCountMap) {
    const gradeMap = teacherGradeCountMap.get(teacherId);
    currentLoadForGrade = gradeMap?.get(classGrade) || 0;
  } else {
    // Fallback: dùng currentLoad (tổng) làm ước lượng
    currentLoadForGrade = currentLoad;
  }
  
  if (maxClassPerGradeForThisGrade > 0) {
    // Nếu có maxClassPerGrade, kiểm tra nghiêm ngặt
    if (currentLoadForGrade >= maxClassPerGradeForThisGrade) {
      return false;
    }
  }
  
  // ✅ 5. Kiểm tra số lớp dựa trên số tiết
  const maxClassesByLessons = periodsPerWeek > 0 ? Math.floor(maxWeeklyLessons / periodsPerWeek) : 999;
  if (currentLoad >= maxClassesByLessons) {
    return false;
  }
  
  // ✅ 6. Kiểm tra availableMatrix (lịch rảnh)
  // Note: Ở đây chỉ phân công, chưa xếp thời khóa biểu cụ thể
  // Có thể kiểm tra cơ bản: giáo viên có ít nhất một slot rảnh không
  if (teacher.availableMatrix && Array.isArray(teacher.availableMatrix)) {
    let hasAvailableSlot = false;
    for (let day = 0; day < teacher.availableMatrix.length; day++) {
      if (Array.isArray(teacher.availableMatrix[day])) {
        for (let period = 0; period < teacher.availableMatrix[day].length; period++) {
          if (teacher.availableMatrix[day][period] === true) {
            hasAvailableSlot = true;
            break;
          }
        }
      }
      if (hasAvailableSlot) break;
    }
    if (!hasAvailableSlot) {
      return false; // Giáo viên không có slot rảnh nào
    }
  }
  
  return true;
}

