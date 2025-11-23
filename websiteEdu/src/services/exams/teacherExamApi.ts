import api from "@/services/axiosInstance";

/* =========================================================
   📡 API SERVICE — Dành cho giáo viên
   Base URL: /teacher-exams
========================================================= */

export interface TeacherExamRoom {
  _id: string;
  exam: {
    _id: string;
    name: string;
    year: string;
    semester: string;
    type: string;
    status: string;
  };
  schedule: {
    _id: string;
    subject: {
      _id: string;
      name: string;
      code: string;
    };
    date: string;
    startTime: string;
    endTime: string;
    grade: string;
    scheduleName: string;
  };
  room: {
    _id: string;
    roomCode: string;
    type: string;
    status: string;
  };
  fixedExamRoom: {
    _id: string;
    code: string;
    grade: string;
    capacity: number;
  };
  invigilatorRole: "supervisor1" | "supervisor2";
  invigilators: Array<{
    teacher: {
      _id: string;
      name: string;
      teacherCode: string;
    };
    role: "supervisor1" | "supervisor2";
  }>;
  capacity: number;
  studentCount: number;
}

export interface TeacherExamSchedule {
  _id: string;
  exam: {
    _id: string;
    name: string;
    year: string;
    semester: string;
    type: string;
    status: string;
  };
  subject: {
    _id: string;
    name: string;
    code: string;
  };
  date: string;
  startTime: string;
  endTime: string;
  grade: string;
  scheduleName: string;
  rooms: Array<{
    _id: string;
    roomCode: string;
    type: string;
    invigilatorRole: "supervisor1" | "supervisor2";
    studentCount: number;
  }>;
}

export const teacherExamApi = {
  /** 📋 Lấy danh sách phòng thi giáo viên được phân công */
  async getRooms(teacherId: string): Promise<{ success: boolean; data: TeacherExamRoom[]; total: number }> {
    const res = await api.get(`/teacher-exams/teacher/${teacherId}/rooms`);
    return res.data;
  },

  /** 🗓️ Lấy lịch coi thi của giáo viên */
  async getSchedules(teacherId: string): Promise<{ success: boolean; data: TeacherExamSchedule[]; total: number }> {
    const res = await api.get(`/teacher-exams/teacher/${teacherId}/schedules`);
    return res.data;
  },
};

