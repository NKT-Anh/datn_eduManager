import { Subject, ClassType, TeachingAssignmentPayload, TeachingAssignment } from "@/types/class";
import { Teacher } from "@/types/auth";

/**
 * ✅ Helper: Lấy số tiết/tuần của môn học theo khối
 * Nếu không có thông tin, dùng giá trị mặc định dựa trên tên môn
 */
function getSubjectPeriodsPerWeek(
  subjectId: string,
  grade: string,
  subjects?: Subject[],
  defaultPeriods: number = 2
): number {
  // ✅ Tìm môn học trong danh sách để lấy tên
  const subject = subjects?.find(s => s._id === subjectId);
  if (!subject) return defaultPeriods;
  
  const subjectName = subject.name.toLowerCase();
  
  // ✅ Map số tiết/tuần mặc định cho các môn học phổ biến
  const defaultPeriodsMap: Record<string, number> = {
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
  
  // ✅ Tìm số tiết/tuần từ map
  for (const [key, periods] of Object.entries(defaultPeriodsMap)) {
    if (subjectName.includes(key)) {
      return periods;
    }
  }
  
  // ✅ Mặc định: 2 tiết/tuần cho các môn khác
  return defaultPeriods;
}

/**
 * Hàm tự động phân công giảng dạy thông minh
 * - Reset lại tải giảng viên mỗi học kỳ
 * - Ưu tiên giáo viên cũ khi sang học kỳ 2
 * - Reset toàn bộ mỗi năm học
 */
// 🔹 Tính MAX_CLASS_PER_TEACHER dựa trên số lớp cần phân công và số giáo viên đủ điều kiện
// ✅ Tối ưu: Tính một lần cho tất cả các khối và môn học
function calculateMaxClassPerTeacher(
  classes: ClassType[],
  subjects: Subject[],
  teachers: Teacher[],
  grades: string[]
): Map<string, number> {
  const maxPerTeacherMap = new Map<string, number>();

  // Tính cho từng khối
  for (const grade of grades) {
    const gradeClasses = classes.filter(c => String(c.grade) === grade);
    const gradeSubjects = subjects.filter(s => s.grades.includes(grade as "10" | "11" | "12"));

    for (const subj of gradeSubjects) {
      // Số lớp cần phân công môn này
      const numClasses = gradeClasses.length;

      // Giáo viên có thể dạy môn này (loại bỏ BGH)
      const eligibleTeachers = teachers.filter(t =>
        !t.isLeader && // ✅ Loại bỏ giáo viên BGH
        t.subjects?.some(
          s => s.subjectId._id === subj._id && s.grades.includes(grade as "10" | "11" | "12")
        )
      );

      // ✅ Tránh chia cho 0
      if (eligibleTeachers.length === 0) {
        // Nếu không có giáo viên, set max = 0 (sẽ không phân công được)
        continue;
      }

      const maxPerTeacher = Math.ceil(numClasses / eligibleTeachers.length);
      eligibleTeachers.forEach(t => {
        maxPerTeacherMap.set(`${t._id}-${subj._id}`, maxPerTeacher);
      });
    }
  }

  return maxPerTeacherMap;
}

export function autoAssignTeaching(
  classes: ClassType[],
  subjects: Subject[],
  teachers: Teacher[],
  existingAssignments: TeachingAssignment[],
  year: string,
  semester: "1" | "2",
  grades: string[]
): TeachingAssignmentPayload[] {
  // 🔹 Chỉ lấy phân công của cùng năm học (để reset mỗi năm)
  const currentYearAssignments = existingAssignments.filter(a => a.year === year);

  // 🔹 Tạo map tải giảng viên theo số lớp (chỉ tính trong học kỳ hiện tại)
  const teacherLoadMap = new Map<string, number>();
  teachers.forEach(t => teacherLoadMap.set(t._id, 0));
  
  // ✅ Tạo map số tiết/tuần của giáo viên (tính tổng số tiết từ các phân công)
  const teacherWeeklyLessonsMap = new Map<string, number>();
  teachers.forEach(t => {
    // ✅ Sử dụng effectiveWeeklyLessons (đã áp dụng cap limit từ weeklyLessons)
    // effectiveWeeklyLessons = base (17) - reduction + optional, và đã bị cap bởi weeklyLessons
    const maxWeeklyLessons = t.effectiveWeeklyLessons || 17;
    teacherWeeklyLessonsMap.set(t._id, 0); // Số tiết hiện tại
  });
  
  const currentSemesterAssignments = currentYearAssignments.filter(a => a.semester === semester);
  currentSemesterAssignments.forEach(a => {
    if (a.teacherId?._id) {
      // Cập nhật số lớp
      teacherLoadMap.set(
        a.teacherId._id,
        (teacherLoadMap.get(a.teacherId._id) || 0) + 1
      );
      
      // ✅ Cập nhật số tiết/tuần
      // Lấy số tiết/tuần của môn học theo khối lớp
      const classGrade = a.classId?.grade || '10';
      const periodsPerWeek = getSubjectPeriodsPerWeek(a.subjectId._id, classGrade, subjects);
      teacherWeeklyLessonsMap.set(
        a.teacherId._id,
        (teacherWeeklyLessonsMap.get(a.teacherId._id) || 0) + periodsPerWeek
      );
    }
  });

  // 🔹 Map để tránh trùng môn trong cùng lớp
  const assignedMap = new Map<string, Set<string>>();
  currentSemesterAssignments.forEach(a => {
    if (!assignedMap.has(a.classId._id)) assignedMap.set(a.classId._id, new Set());
    assignedMap.get(a.classId._id)!.add(a.subjectId._id);
  });

  const newAssignments: TeachingAssignmentPayload[] = [];
  const unassigned: { className: string; subjectName: string }[] = [];

  // 🔹 Lọc lớp theo khối được chọn
  const targetClasses = classes.filter(c => grades.includes(String(c.grade)));

  // ✅ Tối ưu: Tính maxClassMap một lần cho tất cả các khối (thay vì tính lại trong vòng lặp)
  const maxClassMap = calculateMaxClassPerTeacher(targetClasses, subjects, teachers, grades);

  // 🔹 Bắt đầu phân công
  for (const cls of targetClasses) {
    const classSubjects = subjects.filter(s => s.grades.includes(String(cls.grade) as "10" | "11" | "12"));

    for (const subj of classSubjects) {
      // Nếu đã có phân công môn này trong học kỳ hiện tại thì bỏ
      if (assignedMap.get(cls._id)?.has(subj._id)) continue;

      let selectedTeacher: Teacher | undefined;

      // ✅ Nếu là học kỳ 2 → ưu tiên giáo viên đã dạy môn đó ở học kỳ 1 cùng năm học (loại bỏ BGH)
      if (semester === "2") {
        const prev = currentYearAssignments.find(
          a =>
            a.classId._id === cls._id &&
            a.subjectId._id === subj._id &&
            a.semester === "1"
        );
        if (prev?.teacherId?._id) {
          const prevTeacher = teachers.find(t => t._id === prev.teacherId._id);
          // ✅ Chỉ ưu tiên nếu giáo viên cũ không phải BGH
          if (prevTeacher && !prevTeacher.isLeader) {
            selectedTeacher = prevTeacher;
          }
        }
      }

      // ✅ Nếu chưa có giáo viên → chọn theo tải hiện tại (reset mỗi học kỳ)
      if (!selectedTeacher) {
        const candidateTeachers = teachers
          .filter(t =>
            !t.isLeader && // ✅ Loại bỏ giáo viên BGH
            t.subjects?.some(
              s =>
                s.subjectId._id === subj._id &&
                s.grades.includes(String(cls.grade) as "10" | "11" | "12")
            )
          )
          .sort((a, b) => {
            // ✅ Ưu tiên giáo viên có mainSubject trùng với môn học
            const aMainSubject = typeof a.mainSubject === 'object' && a.mainSubject !== null 
              ? a.mainSubject._id 
              : a.mainSubject;
            const bMainSubject = typeof b.mainSubject === 'object' && b.mainSubject !== null 
              ? b.mainSubject._id 
              : b.mainSubject;
            
            const aIsMainSubject = aMainSubject === subj._id;
            const bIsMainSubject = bMainSubject === subj._id;
            
            // Ưu tiên giáo viên có mainSubject trùng với môn học
            if (aIsMainSubject && !bIsMainSubject) return -1;
            if (!aIsMainSubject && bIsMainSubject) return 1;
            
            // Nếu cùng ưu tiên, sắp xếp theo tải hiện tại
            return (teacherLoadMap.get(a._id) || 0) - (teacherLoadMap.get(b._id) || 0);
          });

        // ✅ Ưu tiên kiểm tra số tiết/tuần (từ cấu hình thời khóa biểu)
        // Tính số tiết/tuần của môn học cho lớp này
        const periodsPerWeek = getSubjectPeriodsPerWeek(subj._id, String(cls.grade), subjects);
        
        // ✅ Tìm giáo viên phù hợp: ưu tiên kiểm tra số tiết trước
        selectedTeacher = candidateTeachers.find(t => {
          // ✅ Kiểm tra số tiết/tuần (ưu tiên hàng đầu)
          const currentWeeklyLessons = teacherWeeklyLessonsMap.get(t._id) || 0;
          // ✅ Sử dụng effectiveWeeklyLessons (đã áp dụng cap limit từ weeklyLessons)
          // effectiveWeeklyLessons = base (17) - reduction + optional, và đã bị cap bởi weeklyLessons
          const maxWeeklyLessons = t.effectiveWeeklyLessons || 17;
          const newWeeklyLessons = currentWeeklyLessons + periodsPerWeek;
          
          // ✅ Tính số lớp tối đa dựa trên số tiết: nếu max tiết là 19, môn có 6 tiết/tuần → chỉ phân được 3 lớp (3 x 6 = 18 <= 19)
          const maxClassesByLessons = Math.floor(maxWeeklyLessons / periodsPerWeek);
          
          // ✅ Kiểm tra số tiết/tuần
          const withinWeeklyLessonsLimit = newWeeklyLessons <= maxWeeklyLessons;
          
          // ✅ Kiểm tra số lớp dựa trên số tiết
          const currentLoad = teacherLoadMap.get(t._id) || 0;
          const withinClassLimitByLessons = currentLoad < maxClassesByLessons;
          
          // ✅ Kiểm tra số lớp tối đa của giáo viên theo khối (sử dụng maxClassPerGrade)
          // Lấy maxClassPerGrade cho khối hiện tại
          let maxClassPerGradeForThisGrade = 0;
          if (t.maxClassPerGrade) {
            if (t.maxClassPerGrade instanceof Map) {
              maxClassPerGradeForThisGrade = t.maxClassPerGrade.get(String(cls.grade)) || 0;
            } else if (typeof t.maxClassPerGrade === 'object') {
              maxClassPerGradeForThisGrade = t.maxClassPerGrade[String(cls.grade)] || 0;
            }
          }
          
          // Nếu không có maxClassPerGrade, fallback về tính toán dựa trên maxClasses
          const calculatedMax = maxClassMap.get(`${t._id}-${subj._id}`) || 5;
          const teacherMaxClasses = t.maxClasses || calculatedMax;
          
          // ✅ Ưu tiên sử dụng maxClassPerGrade theo khối, nếu không có thì dùng calculatedMax
          const effectiveMaxClasses = maxClassPerGradeForThisGrade > 0 
            ? maxClassPerGradeForThisGrade 
            : Math.min(calculatedMax, teacherMaxClasses);
          
          const withinClassLimit = currentLoad < effectiveMaxClasses;
          
          // ✅ Phải thỏa mãn cả số tiết và số lớp (ưu tiên số tiết)
          return withinWeeklyLessonsLimit && withinClassLimitByLessons && withinClassLimit;
        });
      }

      // ✅ Nếu vẫn chưa có → ghi log cảnh báo
      if (!selectedTeacher) {
        unassigned.push({ className: cls.className, subjectName: subj.name });
        console.warn(`⚠️ Không tìm thấy giáo viên cho môn ${subj.name} lớp ${cls.className}`);
        continue;
      }

      // ✅ Tạo phân công mới
      const assignment: TeachingAssignmentPayload = {
        teacherId: selectedTeacher._id,
        subjectId: subj._id,
        classId: cls._id,
        year,
        semester,
      };

      newAssignments.push(assignment);

      // ✅ Cập nhật tải giảng viên (số lớp) và số tiết/tuần
      if (!assignedMap.has(cls._id)) assignedMap.set(cls._id, new Set());
      assignedMap.get(cls._id)!.add(subj._id);
      teacherLoadMap.set(
        selectedTeacher._id,
        (teacherLoadMap.get(selectedTeacher._id) || 0) + 1
      );
      
      // ✅ Cập nhật số tiết/tuần
      const periodsPerWeek = getSubjectPeriodsPerWeek(subj._id, String(cls.grade), subjects);
      teacherWeeklyLessonsMap.set(
        selectedTeacher._id,
        (teacherWeeklyLessonsMap.get(selectedTeacher._id) || 0) + periodsPerWeek
      );
    }
  }

  if (unassigned.length > 0) {
    console.warn("⚠️ Các lớp chưa được phân công:", unassigned);
  }

  return newAssignments;
}



export function payloadsToAssignments(
  payloads: TeachingAssignmentPayload[],
  teachers: Teacher[],
  subjects: Subject[],
  classes: ClassType[]
): TeachingAssignment[] {
  return payloads.map(payload => {
    const teacher = teachers.find(t => t._id === payload.teacherId);
    const subject = subjects.find(s => s._id === payload.subjectId);
    const classObj = classes.find(c => c._id === payload.classId);

    return {
      _id: `temp-${Date.now()}-${Math.random()}`, // ID tạm thời (thay bằng ID thật khi save API)
      teacherId: teacher
        ? { _id: teacher._id, name: teacher.name }
        : { _id: "", name: "" },
      subjectId: subject
        ? { _id: subject._id, name: subject.name }
        : { _id: "", name: "" },
      classId: classObj
        ? { _id: classObj._id, className: classObj.className }
        : { _id: "", className: "" },
      year: payload.year,
      semester: payload.semester,
    } as TeachingAssignment;
  });
}
