// services/smartSystem/assignmentAuto.ts

import { TeachingAssignmentPayload, ClassType, Subject, TeachingAssignment } from "@/types/class";
import { Teacher } from "@/types/auth";
import { assignmentApi } from "@/services/assignmentApi";

// Hàm lấy năm học hiện tại (vd: 2025-2026)
const getCurrentSchoolYear = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const nextYear = year + 1;
  return `${year}-${nextYear}`;
};

export const autoAssign = async (
  classes: ClassType[],
  subjects: Subject[],
  teachers: Teacher[],
  assignments: TeachingAssignment[],
  setAssignments: React.Dispatch<React.SetStateAction<TeachingAssignment[]>>
): Promise<void> => {
  const newAssignments: TeachingAssignmentPayload[] = [];

  for (const classObj of classes) {
    // lọc ra danh sách môn phù hợp với khối lớp
    const availableSubjects = subjects.filter(s =>
      s.grades.includes(classObj.grade as "10" | "11" | "12")
    );

    for (const subject of availableSubjects) {
      // kiểm tra xem môn này trong lớp đã được phân công chưa
      const alreadyAssigned = assignments.some(
        a => a.classId._id === classObj._id && a.subjectId._id === subject._id
      );
      if (alreadyAssigned) continue;

      // lọc ra danh sách giáo viên có thể dạy môn này
      const candidates = teachers.filter(t =>
        t.subjectIds?.some(s => s._id === subject._id)
      );

      if (candidates.length === 0) continue;

      // chọn ngẫu nhiên một giáo viên
      const teacher = candidates[Math.floor(Math.random() * candidates.length)];

      // tạo payload cho phân công mới
      const payload: TeachingAssignmentPayload = {
        teacherId: teacher._id,
        subjectId: subject._id!,
        classId: classObj._id,
        year: getCurrentSchoolYear(),
        semester: "1",
      };

      newAssignments.push(payload);
    }
  }

  // gọi API tạo phân công
  for (const payload of newAssignments) {
    const created = await assignmentApi.create(payload);
    setAssignments(prev => [created, ...prev]);
  }
};
