import { Subject } from "@/types/class";
import { SubjectDetailResponse } from "@/types/class";
import { subjectApi } from "@/services/subjectApi";
import { teacherApi } from "@/services/teacherApi";
import { classApiNoToken } from "@/services/classApi";
import { assignmentApi } from "@/services/assignmentApi";
// import { scheduleApi } from "@/services/scheduleApi"; // nếu có

export const getSubjectDetail = async (
  subjectId: string
): Promise<SubjectDetailResponse> => {
  try {
    // 1. Lấy subject cơ bản
    const subject = await subjectApi.getSubjectById(subjectId);

    // 2. Lấy tất cả assignments liên quan đến môn này
    const allAssignments = await assignmentApi.getAll();
    const assignments = allAssignments.filter(a => a.subjectId._id === subjectId);


    // 3. Lấy tất cả giáo viên và lọc những người liên quan
    const allTeachers = await teacherApi.getAll();
    const teacherIds = assignments.map(a => a.teacherId._id);
    const teachers = allTeachers.filter(t => teacherIds.includes(t._id));


    // 4. Lấy tất cả lớp và lọc lớp liên quan
    const allClasses = await classApiNoToken.getAll();
    const classIds = assignments.map(a => a.classId._id);
    const classes = allClasses.filter(c => classIds.includes(c._id));

    // 5. Lấy schedules (nếu có API, nếu không thì để mảng rỗng)
    // let schedules: any[] = [];
    // try {
    //   schedules = await scheduleApi.getBySubject(subjectId);
    // } catch {
    //   schedules = [];
    // }
    const schedules: any[] = [];

    // Luôn trả về object hợp lệ
    return {
      subject,
      teachers,
      classes,
      assignments,
      schedules,
    };
  } catch (err) {
    console.error("Lấy chi tiết môn học thất bại", err);
    throw new Error("Không thể lấy chi tiết môn học"); // throw lỗi hoặc trả về default object
  }
};
