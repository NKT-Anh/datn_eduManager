import axios from "axios";
import { TeachingAssignment, TeachingAssignmentPayload } from "@/types/class";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_URL = `${BASE_URL}/teachingAssignments`;

export const assignmentApi = {
  getAll: async (): Promise<TeachingAssignment[]> => {
    const res = await axios.get(API_URL);
    return res.data;
  },
  getById: async (id: string): Promise<TeachingAssignment> => {
    const res = await axios.get(`${API_URL}/${id}`);
    return res.data;
  },
  create: async (data: TeachingAssignmentPayload): Promise<TeachingAssignment> => {
    const res = await axios.post(API_URL, data);
    return res.data;
  },
  update: async (id: string, data: TeachingAssignmentPayload): Promise<TeachingAssignment> => {
    const res = await axios.put(`${API_URL}/${id}`, data);
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await axios.delete(`${API_URL}/${id}`);
  },
  createBulk: async (data: TeachingAssignmentPayload[]): Promise<TeachingAssignment[]> => {
    const res = await axios.post(`${API_URL}/bulk`, data);
    return res.data;
  },

  // 🆕 Thêm hàm này:
getByTeacher: async (
  teacherId: string,
  year?: string,
  semester?: string
): Promise<TeachingAssignment[]> => {
  const params: any = {};
  if (year) params.year = year;
  if (semester) params.semester = semester;

  const res = await axios.get(`${API_URL}/teacher/${teacherId}`, { params });
  return res.data;
},

};
