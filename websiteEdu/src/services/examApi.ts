// // src/api/examApi.ts
// import axiosClient from './axiosInstance';

// // === INTERFACE ===
// export interface Exam {
//   _id: string;
//   examId: string;
//   name: string;
//   year: string;
//   semester: '1' | '2';
//   grades: string[];
//   status: 'draft' | 'published' | 'locked';
//   totalStudents: number;
//   createdAt: string;
// }

// // === API ĐÚNG VỚI BACKEND (13 API) ===
// export const examApi = {
//   // 0. LẤY DANH SÁCH KỲ THI
//   getAllExams: async (): Promise<Exam[]> => {
//     const res = await axiosClient.get('/exams/exams');
//     return res.data;
//   },

//   // 1. TẠO KỲ THI
//   createExam: async (data: {
//     name: string;
//     year: string;
//     semester: '1' | '2';
//     type?: 'regular' | 'mock'; 
//     grades: string[];
//     startDate: string;
//     endDate: string;
//     description?: string;
//   }) => {
//     // Log request data
//     const requestData = {
//       ...data,
//       type: data.type || 'regular',
//       description: data.description || '',
//       startDate: new Date(data.startDate),
//       endDate: new Date(data.endDate),
//     };
//     console.log('Request data:', requestData);

//     try {
//       const res = await axiosClient.post('/exams/exams', requestData);
//       return res.data;
//     } catch (error: any) {
//       console.error('Error creating exam:', error.response?.data || error.message);
//       throw error;
//     }
//   },
  

//   // 2. KÉO THẢ LỊCH + CHIA PHÒNG
//   createSchedule: async (data: {
//     examId: string;
//     examClassId: string;
//     subjectId: string;
//     roomId: string;
//     date: string;
//     startTime: string;
//     duration?: number;
//   }) => {
//     const res = await axiosClient.post('/exams/schedule', data);
//     return res.data;
//   },

//   // 3. XÁO TRỘN + SINH SBD
//   generateSBD: async (examId: string) => {
//     const res = await axiosClient.post(`/exams/sbd/${examId}`);
//     return res.data;
//   },

//   // 4. GÁN GIÁM THỊ
//   assignInvigilator: async (data: { scheduleId: string; teacherId: string }) => {
//     const res = await axiosClient.post('/exams/invigilator', data);
//     return res.data;
//   },

//   // 5. GỢI Ý GIÁM THỊ
//   suggestInvigilators: async (examId: string, date: string, startTime: string) => {
//     const res = await axiosClient.get('/exams/suggest-invigilators', {
//       params: { examId, date, startTime },
//     });
//     return res.data;
//   },

//   // 6. IN PHIẾU COI THI (PDF)
//   printInvigilatorSlip: async (teacherId: string, examId: string) => {
//     const res = await axiosClient.get('/exams/print/invigilator', {
//       params: { teacherId, examId },
//       responseType: 'blob',
//     });
//     return res;
//   },

//   // 7. IN 1 PHÒNG (PDF)
//   exportRoomPDF: async (roomId: string, examId: string) => {
//     const res = await axiosClient.get('/exams/export/room', {
//       params: { roomId, examId },
//       responseType: 'blob',
//     });
//     return res;
//   },

//   // 8. DASHBOARD
//   getExamDashboard: async (examId: string) => {
//     const res = await axiosClient.get('/exams/dashboard', {
//       params: { examId },
//     });
//     return res.data;
//   },

//   // 9. VALIDATE TOÀN BỘ
//   validateAllSchedules: async (examId: string) => {
//     const res = await axiosClient.post('/exams/validate', {}, { params: { examId } });
//     return res.data;
//   },

//   // 10. IN TẤT CẢ PHÒNG (ZIP)
//   exportAllRoomsPDF: async (examId: string) => {
//     const res = await axiosClient.get('/exams/export/all-rooms', {
//       params: { examId },
//       responseType: 'blob',
//     });
//     return res;
//   },

//   // 11. DANH SÁCH LỚP (SBD)
//   getClassSBDList: async (classId: string, examId: string) => {
//     const res = await axiosClient.get('/exams/class-sbd', {
//       params: { classId, examId },
//     });
//     return res.data;
//   },

//   // 12. KHÓA KỲ THI
//   lockExam: async (examId: string) => {
//     const res = await axiosClient.post('/exams/lock', {}, { params: { examId } });
//     return res.data;
//   },
  
//   // 13. DANH SÁCH LỊCH THI (ADMIN)
//   getExamSchedules: async (params: { examId?: string; classId?: string; roomId?: string; date?: string }) => {
//     const res = await axiosClient.get('/exams/schedules', { params });
//     return res.data as { success: boolean; schedules: any[] };
//   },

//   // 14. CẬP NHẬT LỊCH THI (ADMIN)
//   updateSchedule: async (id: string, body: { roomId?: string; date?: string; startTime?: string; duration?: number; status?: string }) => {
//     const res = await axiosClient.put(`/exams/schedules/${id}`, body);
//     return res.data;
//   },

//   // 15. XÓA LỊCH THI (ADMIN)
//   deleteSchedule: async (id: string) => {
//     const res = await axiosClient.delete(`/exams/schedules/${id}`);
//     return res.data;
//   },

//   // 16. PHÁT HÀNH KỲ THI (ADMIN)
//   publishExam: async (examId: string) => {
//     const res = await axiosClient.post(`/exams/publish/${examId}`);
//     return res.data;
//   },

//   // 17. GIÁO VIÊN XEM LỊCH COI THI
//   getTeacherSchedules: async (teacherId: string, examId?: string) => {
//     const res = await axiosClient.get('/exams/teacher/schedules', { params: { teacherId, examId } });
//     return res.data as { success: boolean; schedules: any[] };
//   },

//   // 18. HỌC SINH XEM LỊCH THI
//   getStudentSchedules: async (studentId: string, examId: string) => {
//     const res = await axiosClient.get('/exams/student/schedules', { params: { studentId, examId } });
//     return res.data as { success: boolean; schedules: any[] };
//   },

//   // 19. LOOKUPS for selects (examClasses, rooms, subjects)
//   getLookups: async (examId: string) => {
//     const res = await axiosClient.get('/exams/lookups', { params: { examId } });
//     return res.data as { success: boolean; examClasses: any[]; rooms: any[]; subjects: any[] };
//   },

//   // 20. TẠO ExamClass cho khối
//   createExamClassesForGrade: async (data: { examId: string; grade: string; year?: string }) => {
//     const res = await axiosClient.post('/exam/schedules/create-exam-classes', data);
//     return res.data;
//   },

//   // 21. Sinh phân phòng & tạo ExamSchedule
//   generateRoomAssignments: async (data: {
//     examId: string;
//     grade?: string;
//     examClassIds?: string[];
//     subjectId: string;
//     date: string;
//     startTime: string;
//     duration?: number;
//     maxPerRoom?: number;
//     mixStudents?: boolean;
//     assignSupervisors?: boolean;
//   }) => {
//     const res = await axiosClient.post('/exam/schedules/generate-room-assignments', data);
//     return res.data;
//   },

//   // 22. Xuất CSV phân phòng
//   exportAssignmentsCSV: async (params: { examId: string; subjectId?: string; date?: string }) => {
//     const res = await axiosClient.get('/exam/schedules/export/assignments', { params, responseType: 'blob' });
//     return res;
//   }
// };



import api from "@/services/axiosInstance";

// ================== EXAM ==================
export const getExams = () => api.get("/exams");
export const getExamById = (id) => api.get(`/exams/${id}`);
export const createExam = (data) => api.post("/exams", data);
export const updateExam = (id, data) => api.put(`/exams/${id}`, data);
export const deleteExam = (id) => api.delete(`/exams/${id}`);

// ================== EXAM CLASS ==================
export const getExamClasses = (examId) => api.get(`/exam/classes?examId=${examId}`);
export const getExamClassById = (id) => api.get(`/exam/classes/${id}`);
export const createExamClass = (data) => api.post("/exam/classes", data);
export const updateExamClass = (id, data) => api.put(`/exam/classes/${id}`, data);
export const deleteExamClass = (id) => api.delete(`/exam/classes/${id}`);
export const handleAutoGenerateClasses = async (examId: string) => {
  try {
    const res = await api.post(`/exam/classes/${examId}/generate-classes`);
    console.log("Lớp thi tạo mới:", res.data?.created || []);
    console.log("Lớp thi bỏ qua:", res.data?.skipped || []);
    return res;
  } catch (err: any) {
    console.error("Lỗi khi tạo tự động lớp thi:", err?.response?.data || err.message || err);
    return { data: { created: [], skipped: [] } };
  }
};


// 👇 Generate Exam SBD (Tự động sinh số báo danh)
export const generateSBD = (examId) =>
  api.post(`/exam/classes/${examId}/generate-sbd`);

// ================== EXAM ROOMS ==================
export const getExamRooms = (examId) => api.get(`/exam/rooms?examId=${examId}`);
export const getExamRoomById = (id) => api.get(`/exam/rooms/${id}`);
export const createExamRoom = (data) => api.post("/exam/rooms", data);
export const updateExamRoom = (id, data) => api.put(`/exam/rooms/${id}`, data);
export const deleteExamRoom = (id) => api.delete(`/exam/rooms/${id}`);

// ================== EXAM SCHEDULE ==================
export const getExamSchedules = (examId) => api.get(`/exam/schedules?examId=${examId}`);
export const getExamScheduleById = (id) => api.get(`/exam/schedules/${id}`);
export const createExamSchedule = (data) => api.post("/exam/schedules", data);
export const updateExamSchedule = (id, data) => api.put(`/exam/schedules/${id}`, data);
export const deleteExamSchedule = (id) => api.delete(`/exam/schedules/${id}`);

// ================== EXAM STUDENTS ==================
export const getExamStudents = (examId) => api.get(`/exam/students?examId=${examId}`);
export const getExamStudentById = (id) => api.get(`/exam/students/${id}`);
export const addStudentToExam = (data) => api.post(`/exam/students`, data);
export const updateExamStudent = (id, data) => api.put(`/exam/students/${id}`, data);
export const deleteExamStudent = (id) => api.delete(`/exam/students/${id}`);

// ================== ROOM ASSIGNMENT ==================
export const getRoomAssignments = (examId) => api.get(`/exam/room-assignments?examId=${examId}`);
export const getRoomAssignmentById = (id) => api.get(`/exam/room-assignments/${id}`);
export const createRoomAssignment = (data) => api.post(`/exam/room-assignments`, data);
export const updateRoomAssignment = (id, data) => api.put(`/exam/room-assignments/${id}`, data);
export const deleteRoomAssignment = (id) => api.delete(`/exam/room-assignments/${id}`);

// 👇 Tự động xếp phòng thi
export const autoAssignRooms = (examId) =>
  api.post(`/exam/room-assignments/${examId}/auto-assign`);

export async function autoAssignRoomSingle(examScheduleId: string) {
  try {
    // 1. Lấy thông tin lịch thi
    const scheduleRes = await api.get(`/api/examSchedules/${examScheduleId}`);
    const schedule = scheduleRes.data;

    // 2. Lấy danh sách học sinh của lớp thi
    const studentsRes = await api.get(`/api/examClasses/${schedule.examClassId}/students`);
    const students = studentsRes.data; // mảng { _id, name }

    // 3. Lấy danh sách phòng thi
    const roomsRes = await api.get(`/api/examRooms?examId=${schedule.examId}`);
    const rooms = roomsRes.data; // mảng { _id, code, capacity }

    if (students.length === 0 || rooms.length === 0) {
      throw new Error("Không có học sinh hoặc phòng để phân bổ");
    }

    // 4. Gán học sinh vào phòng
    const assignments: { studentId: string; roomId: string; seatNumber: number }[] = [];
    let studentIndex = 0;

    for (const room of rooms) {
      for (let seat = 1; seat <= room.capacity; seat++) {
        if (studentIndex >= students.length) break;
        assignments.push({
          studentId: students[studentIndex]._id,
          roomId: room._id,
          seatNumber: seat,
        });
        studentIndex++;
      }
      if (studentIndex >= students.length) break;
    }

    // 5. Lưu assignments lên server
    await api.post(`/api/roomAssignments/autoAssignSingle`, {
      examScheduleId,
      assignments,
    });

    return { success: true, assignedCount: assignments.length };
  } catch (err: any) {
    console.error(err);
    throw new Error(err?.message || "Lỗi khi auto assign phòng cho lịch thi");
  }
}
interface Room {
  _id: string;
  code: string;
  capacity: number;
}

interface Student {
  _id: string;
  name: string;
}

interface ExamSchedule {
  _id: string;
  examId: string;
  examClassId: string;
  roomId?: string;
  date: string;
  startTime: string;
  duration: number; // phút
}

/**
 * Auto assign students to rooms for multiple schedules, balancing students and avoiding room conflicts
 * @param scheduleIds - mảng các lịch thi cần assign
 */
export async function autoAssignRoomsAdvanced(scheduleIds: string[]) {
  const results: { scheduleId: string; assignedCount: number }[] = [];

  for (const scheduleId of scheduleIds) {
    try {
      // 1. Lấy lịch thi
      const scheduleRes = await api.get(`/api/examSchedules/${scheduleId}`);
      const schedule: ExamSchedule = scheduleRes.data;

      // 2. Lấy danh sách học sinh của lớp
      const studentsRes = await api.get(`/api/examClasses/${schedule.examClassId}/students`);
      const students: Student[] = studentsRes.data;

      // 3. Lấy danh sách phòng khả dụng cho kỳ thi (lọc theo xung đột thời gian)
      const roomsRes = await api.get(`/api/examRooms?examId=${schedule.examId}`);
      const allRooms: Room[] = roomsRes.data;

      // Lọc các phòng chưa bị trùng giờ
      const assignedRoomsRes = await api.get(`/api/roomAssignments?examId=${schedule.examId}`);
      const assignedRooms = assignedRoomsRes.data as any[];
      const scheduleStart = new Date(`${schedule.date}T${schedule.startTime}`);
      const scheduleEnd = new Date(scheduleStart.getTime() + schedule.duration * 60 * 1000);

      const availableRooms = allRooms.filter((room) => {
        return !assignedRooms.some((a) => 
          a.roomId === room._id && (
            (new Date(`${a.date}T${a.startTime}`) < scheduleEnd &&
             new Date(`${a.date}T${a.startTime}`).getTime() + a.duration*60000 > scheduleStart.getTime())
          )
        );
      });

      if (students.length === 0 || availableRooms.length === 0) {
        console.warn(`Schedule ${scheduleId} không có học sinh hoặc phòng khả dụng`);
        results.push({ scheduleId, assignedCount: 0 });
        continue;
      }

      // 4. Cân bằng học sinh giữa các phòng
      const assignments: { studentId: string; roomId: string; seatNumber: number }[] = [];
      let studentIndex = 0;
      let roomIndex = 0;

      while (studentIndex < students.length) {
        const room = availableRooms[roomIndex % availableRooms.length];
        const currentAssignments = assignments.filter(a => a.roomId === room._id);
        if (currentAssignments.length < room.capacity) {
          assignments.push({
            studentId: students[studentIndex]._id,
            roomId: room._id,
            seatNumber: currentAssignments.length + 1,
          });
          studentIndex++;
        }
        roomIndex++;
      }

      // 5. Gửi assignments về server
      await api.post(`/api/roomAssignments/autoAssignSingle`, {
        examScheduleId: scheduleId,
        assignments,
      });

      results.push({ scheduleId, assignedCount: assignments.length });
    } catch (err: any) {
      console.error(`Error in schedule ${scheduleId}:`, err?.message || err);
      results.push({ scheduleId, assignedCount: 0 });
    }
  }

  return results;
}
export interface ExamClass {
  _id: string;
  name: string;
}

export interface ExamRoom {
  _id: string;
  name: string;
}

export interface Subject {
  _id: string;
  name: string;
}

export interface LookupsResponse {
  success: boolean;
  examClasses: ExamClass[];
  rooms: ExamRoom[];
  subjects: Subject[];
}

/**
 * Lấy danh sách examClasses, rooms, subjects cho 1 kỳ thi
 */
export const getLookups = async (examId: string): Promise<LookupsResponse> => {
  if (!examId) throw new Error("examId is required");

  const res = await api.get(`/exams/lookups`, { params: { examId } });
  return res.data as LookupsResponse;
};