import api from "@/services/axiosInstance";

/* =========================================================
   🧩 INTERFACES — Kiểu dữ liệu trả về từ backend
========================================================= */

export interface StudentExam {
  _id: string;
  name: string;
  semester: string;
  year: string;
  grade: number;
  startDate?: string;
  endDate?: string;
}

export interface StudentExamSchedule {
  _id: string;
  subject: {
    _id: string;
    name: string;
    subjectCode?: string;
  };
  date: string;
  startTime: string;
  endTime: string;
  room?: {
    _id: string;
    roomCode: string;
  };
  seatNumber?: number;
}

export interface StudentExamRoom {
  _id: string;
  roomCode: string;
  type?: string;
  capacity?: number;
  invigilators?: {
    teacher: { _id: string; name: string; teacherCode?: string };
    role: string;
  }[];
  seatNumber?: number;
}

export interface StudentExamGrade {
  _id: string;
  subject: {
    _id: string;
    name: string;
    subjectCode?: string;
  };
  gradeValue: number;
  teacher?: { _id: string; name: string };
  note?: string;
  isLocked?: boolean;
}

/* =========================================================
   📡 API SERVICE — Dành cho học sinh
   Base URL: /student-exams
========================================================= */

export const studentExamApi = {
  /** 📋 Lấy danh sách kỳ thi học sinh tham gia */
  async getExams(studentId: string): Promise<StudentExam[]> {
    const res = await api.get(`/student-exams/student/${studentId}/exams`);
    return res.data;
  },

  /** 🗓️ Lấy lịch thi của học sinh trong một kỳ thi */
  async getSchedules(examId: string, studentId: string): Promise<StudentExamSchedule[]> {
    const res = await api.get(
      `/student-exams/exam/${examId}/student/${studentId}/schedules`
    );
    return res.data;
  },

  /** 🏫 Lấy thông tin phòng thi và chỗ ngồi */
  async getRoom(scheduleId: string, studentId: string): Promise<StudentExamRoom> {
    const res = await api.get(
      `/student-exams/schedule/${scheduleId}/student/${studentId}/room`
    );
    return res.data;
  },

  /** 🧮 Lấy điểm thi của học sinh */
  async getGrades(examId: string, studentId: string): Promise<StudentExamGrade[]> {
    const res = await api.get(
      `/student-exams/exam/${examId}/student/${studentId}/grades`
    );
    return res.data;
  },
};
