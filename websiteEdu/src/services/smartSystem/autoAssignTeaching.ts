// import { Subject, ClassType, TeachingAssignmentPayload, TeachingAssignment } from "@/types/class";
// import { Teacher } from "@/types/auth";

// /**
//  * Hàm tự động phân công giảng dạy cho các lớp và môn học
//  * @param classes Danh sách lớp
//  * @param subjects Danh sách môn học
//  * @param teachers Danh sách giáo viên
//  * @param existingAssignments Phân công hiện tại (để tránh trùng)
//  * @param year Năm học
//  * @param semester Học kỳ
//  * @returns Danh sách phân công mới (TeachingAssignmentPayload[])
//  */
// export function autoAssignTeaching(
//   classes: ClassType[],
//   subjects: Subject[],
//   teachers: Teacher[],
//   existingAssignments: TeachingAssignment[],
//   year: string,
//   semester: "1" | "2"
// ): TeachingAssignmentPayload[] {
//   // 1. Map đếm số phân công của giáo viên
//   const teacherLoadMap = new Map<string, number>();
//   teachers.forEach(t => teacherLoadMap.set(t._id, 0));
//   existingAssignments.forEach(a => {
//     if (a.teacherId?._id) {
//       teacherLoadMap.set(
//         a.teacherId._id,
//         (teacherLoadMap.get(a.teacherId._id) || 0) + 1
//       );
//     }
//   });

//   // 2. Map để tránh phân công trùng môn cho cùng lớp
//   const assignedMap = new Map<string, Set<string>>(); // key = classId, value = set subjectId
//   existingAssignments.forEach(a => {
//     if (!assignedMap.has(a.classId._id)) {
//       assignedMap.set(a.classId._id, new Set());
//     }
//     assignedMap.get(a.classId._id)!.add(a.subjectId._id);
//   });

//   const newAssignments: TeachingAssignmentPayload[] = [];
//   const unassigned: { className: string; subjectName: string }[] = [];

//   // 3. Duyệt từng lớp
//   for (const cls of classes) {
//     // Lấy môn phù hợp với lớp (theo grade của lớp)
//     const classSubjects = subjects.filter(s =>
//       s.grades.includes(cls.grade as any)
//     );

//     for (const subj of classSubjects) {
//       // Nếu lớp đã có môn này thì bỏ qua
//       if (assignedMap.get(cls._id)?.has(subj._id)) continue;

//       // Tìm giáo viên có thể dạy môn này (phải có subjectId = subj._id và đúng khối)
//       const candidateTeachers = teachers
//         .filter(t =>
//           t.subjects?.some(
//             s =>
//               s.subjectId._id === subj._id &&
//               s.grades.includes(cls.grade as any)
//           )
//         )
//         .sort(
//           (a, b) =>
//             (teacherLoadMap.get(a._id) || 0) -
//             (teacherLoadMap.get(b._id) || 0)
//         );

//       if (candidateTeachers.length === 0) {
//         unassigned.push({ className: cls.className, subjectName: subj.name });
//         console.warn(
//           `⚠️ Không có giáo viên dạy môn ${subj.name} cho lớp ${cls.className}`
//         );
//         continue;
//       }

//       const MAX_CLASS_PER_TEACHER = 5;
//       const selectedTeacher = candidateTeachers.find(
//         t => (teacherLoadMap.get(t._id) || 0) < MAX_CLASS_PER_TEACHER
//       );

//       if (!selectedTeacher) {
//         console.warn(
//           `⚠️ Tất cả giáo viên dạy môn ${subj.name} đều đã đủ số lớp (max ${MAX_CLASS_PER_TEACHER})`
//         );
//         continue;
//       }

//       // Tạo phân công mới
//       const assignment: TeachingAssignmentPayload = {
//         teacherId: selectedTeacher._id,
//         subjectId: subj._id,
//         classId: cls._id,
//         year,
//         semester,
//       };

//       newAssignments.push(assignment);

//       // Cập nhật map và load giáo viên
//       if (!assignedMap.has(cls._id)) assignedMap.set(cls._id, new Set());
//       assignedMap.get(cls._id)!.add(subj._id);
//       teacherLoadMap.set(
//         selectedTeacher._id,
//         (teacherLoadMap.get(selectedTeacher._id) || 0) + 1
//       );
//     }
//   }

//   return newAssignments;
// }

// export function autoAssignTeaching(
//   classes: ClassType[],
//   subjects: Subject[],
//   teachers: Teacher[],
//   existingAssignments: TeachingAssignment[],
//   year: string,
//   semester: "1" | "2"
// ): TeachingAssignmentPayload[] {
//   const teacherLoadMap = new Map<string, number>();
//   teachers.forEach(t => teacherLoadMap.set(t._id, 0));

//   existingAssignments.forEach(a => {
//     if (a.teacherId?._id) {
//       teacherLoadMap.set(
//         a.teacherId._id,
//         (teacherLoadMap.get(a.teacherId._id) || 0) + 1
//       );
//     }
//   });

//   // Map để tránh phân công trùng môn trong cùng lớp
//   const assignedMap = new Map<string, Set<string>>();
//   existingAssignments.forEach(a => {
//     if (!assignedMap.has(a.classId._id)) {
//       assignedMap.set(a.classId._id, new Set());
//     }
//     assignedMap.get(a.classId._id)!.add(a.subjectId._id);
//   });

//   const newAssignments: TeachingAssignmentPayload[] = [];
//   const unassigned: { className: string; subjectName: string }[] = [];

//   for (const cls of classes) {
//     const classSubjects = subjects.filter(s => s.grades.includes(cls.grade as any));

//     for (const subj of classSubjects) {
//       // Nếu đã có phân công cho lớp + môn + kỳ này thì bỏ
//       if (assignedMap.get(cls._id)?.has(subj._id)) continue;

//       let selectedTeacher: Teacher | undefined;

//       // 🔹 Nếu là học kỳ 2 → ưu tiên giáo viên đã dạy môn này cho lớp ở học kỳ 1
//       if (semester === "2") {
//         const prev = existingAssignments.find(
//           a =>
//             a.classId._id === cls._id &&
//             a.subjectId._id === subj._id &&
//             a.year === year &&
//             a.semester === "1"
//         );
//         if (prev && teachers.some(t => t._id === prev.teacherId._id)) {
//           selectedTeacher = teachers.find(t => t._id === prev.teacherId._id);
//         }
//       }

//       // 🔹 Nếu chưa có teacher (học kỳ 1 hoặc hk2 mà ko tìm thấy) → chọn theo load
//       if (!selectedTeacher) {
//         const candidateTeachers = teachers
//           .filter(t =>
//             t.subjects?.some(
//               s =>
//                 s.subjectId._id === subj._id &&
//                 s.grades.includes(cls.grade as any)
//             )
//           )
//           .sort(
//             (a, b) =>
//               (teacherLoadMap.get(a._id) || 0) -
//               (teacherLoadMap.get(b._id) || 0)
//           );

//         const MAX_CLASS_PER_TEACHER = 5;
//         selectedTeacher = candidateTeachers.find(
//           t => (teacherLoadMap.get(t._id) || 0) < MAX_CLASS_PER_TEACHER
//         );
//       }

//       if (!selectedTeacher) {
//         unassigned.push({ className: cls.className, subjectName: subj.name });
//         console.warn(`⚠️ Không tìm thấy giáo viên cho môn ${subj.name} lớp ${cls.className}`);
//         continue;
//       }

//       const assignment: TeachingAssignmentPayload = {
//         teacherId: selectedTeacher._id,
//         subjectId: subj._id,
//         classId: cls._id,
//         year,
//         semester,
//       };

//       newAssignments.push(assignment);

//       if (!assignedMap.has(cls._id)) assignedMap.set(cls._id, new Set());
//       assignedMap.get(cls._id)!.add(subj._id);
//       teacherLoadMap.set(
//         selectedTeacher._id,
//         (teacherLoadMap.get(selectedTeacher._id) || 0) + 1
//       );
//     }
//   }

//   return newAssignments;
// }
import { Subject, ClassType, TeachingAssignmentPayload, TeachingAssignment } from "@/types/class";
import { Teacher } from "@/types/auth";

/**
 * Hàm tự động phân công giảng dạy thông minh
 * - Reset lại tải giảng viên mỗi học kỳ
 * - Ưu tiên giáo viên cũ khi sang học kỳ 2
 * - Reset toàn bộ mỗi năm học
 */
// 🔹 Tính MAX_CLASS_PER_TEACHER dựa trên số lớp cần phân công và số giáo viên đủ điều kiện
function calculateMaxClassPerTeacher(
  classes: ClassType[],
  subjects: Subject[],
  teachers: Teacher[],
  grade: string
) {
  let maxPerTeacherMap = new Map<string, number>();

  for (const subj of subjects.filter(s => s.grades.includes(grade as any))) {
    // Số lớp cần phân công môn này
    const numClasses = classes.filter(c => c.grade === grade).length;

    // Giáo viên có thể dạy môn này
    const eligibleTeachers = teachers.filter(t =>
      t.subjects?.some(
        s => s.subjectId._id === subj._id && s.grades.includes(grade as any)
      )
    );

    const maxPerTeacher = Math.ceil(numClasses / eligibleTeachers.length);
    eligibleTeachers.forEach(t => maxPerTeacherMap.set(`${t._id}-${subj._id}`, maxPerTeacher));
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

  // 🔹 Tạo map tải giảng viên (chỉ tính trong học kỳ hiện tại)
  const teacherLoadMap = new Map<string, number>();
  teachers.forEach(t => teacherLoadMap.set(t._id, 0));
  
  const currentSemesterAssignments = currentYearAssignments.filter(a => a.semester === semester);
  currentSemesterAssignments.forEach(a => {
    if (a.teacherId?._id) {
      teacherLoadMap.set(
        a.teacherId._id,
        (teacherLoadMap.get(a.teacherId._id) || 0) + 1
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

  // 🔹 Bắt đầu phân công
  for (const cls of targetClasses) {
    const classSubjects = subjects.filter(s => s.grades.includes(cls.grade as any));

    for (const subj of classSubjects) {
      // Nếu đã có phân công môn này trong học kỳ hiện tại thì bỏ
      if (assignedMap.get(cls._id)?.has(subj._id)) continue;

      let selectedTeacher: Teacher | undefined;

      // ✅ Nếu là học kỳ 2 → ưu tiên giáo viên đã dạy môn đó ở học kỳ 1 cùng năm học
      if (semester === "2") {
        const prev = currentYearAssignments.find(
          a =>
            a.classId._id === cls._id &&
            a.subjectId._id === subj._id &&
            a.semester === "1"
        );
        if (prev && teachers.some(t => t._id === prev.teacherId._id)) {
          selectedTeacher = teachers.find(t => t._id === prev.teacherId._id);
        }
      }

      // ✅ Nếu chưa có giáo viên → chọn theo tải hiện tại (reset mỗi học kỳ)
      if (!selectedTeacher) {
        const candidateTeachers = teachers
          .filter(t =>
            t.subjects?.some(
              s =>
                s.subjectId._id === subj._id &&
                s.grades.includes(cls.grade as any)
            )
          )
          .sort(
            (a, b) =>
              (teacherLoadMap.get(a._id) || 0) - (teacherLoadMap.get(b._id) || 0)
          );
          const maxClassMap = calculateMaxClassPerTeacher(targetClasses, subjects, teachers, cls.grade as string);

          selectedTeacher = candidateTeachers.find(t => {
          const maxClass = maxClassMap.get(`${t._id}-${subj._id}`) || 5;
          return (teacherLoadMap.get(t._id) || 0) < maxClass;
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

      // Cập nhật tải giảng viên và map
      if (!assignedMap.has(cls._id)) assignedMap.set(cls._id, new Set());
      assignedMap.get(cls._id)!.add(subj._id);
      teacherLoadMap.set(
        selectedTeacher._id,
        (teacherLoadMap.get(selectedTeacher._id) || 0) + 1
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
