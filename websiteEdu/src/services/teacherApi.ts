import axios from "axios";
import type { Teacher } from "@/types/auth";

// URL cơ sở API
const API_BASE = import.meta.env.VITE_API_BASE_URL;
const BASE = `${API_BASE}/teachers`;

// Payload khi tạo giáo viên
export type TeacherCreatePayload = Omit<
  Teacher,
  "_id" | "accountId" | "createdAt" | "updatedAt"
>;

// Payload khi cập nhật giáo viên (có thể chỉ update một số field)
export type TeacherUpdatePayload = Partial<TeacherCreatePayload>;

export type TeacherAvailabilityPayload = {
  availableMatrix: boolean[][]; 
};


export const teacherApi = {
  // Lấy tất cả giáo viên
  getAll: async (): Promise<Teacher[]> => {
    const res = await axios.get<Teacher[]>(BASE);
    return res.data;
  },

  // Lấy giáo viên theo ID
  getById: async (id: string): Promise<Teacher> => {
    const res = await axios.get<Teacher>(`${BASE}/${id}`);
    return res.data;
  },

  // Tạo giáo viên mới (bắt buộc name)
  create: async (payload: TeacherCreatePayload): Promise<Teacher> => {
    if (!payload.name) {
      throw new Error("Tên giáo viên là bắt buộc");
    }
    const res = await axios.post<Teacher>(BASE, payload);
    return res.data;
  },

  // Cập nhật giáo viên theo ID (tất cả field optional)
  update: async (id: string, payload: TeacherUpdatePayload): Promise<Teacher> => {
    const res = await axios.put<Teacher>(`${BASE}/${id}`, payload);
    return res.data;
  },

  // Xóa giáo viên theo ID
  delete: async (id: string): Promise<{ message: string }> => {
    const res = await axios.delete<{ message: string }>(`${BASE}/${id}`);
    return res.data;
  },

  // cập nhật lịch rảnh

  // updateAvailability : async (id: string, payload : TeacherAvailabilityPayload )
  //                    : Promise<{message: string; teacher: Teacher}> =>{
  //                     const res = await axios.put<{ message: string; teacher: Teacher }>(
  //                       `${BASE}/${id}/availability`,
  //                       payload
  //                     );
  //                     return res.data;
  //                    } 

   getAvailability: async (id: string): Promise<boolean[][]> => {
    const res = await axios.get<{ availableMatrix: boolean[][] }>(
      `${BASE}/${id}/availability`
    );
    return res.data.availableMatrix || [];
  },
  // ✅ Cập nhật lịch rảnh bằng ma trận trực tiếp
    updateAvailability: async (
      id: string,
      matrix: boolean[][]
    ): Promise<{ message: string; teacher: Teacher }> => {
      const res = await axios.put<{ message: string; teacher: Teacher }>(
        `${BASE}/${id}/availability`,
        { availableMatrix: matrix }
      );
      return res.data;
    },

};


// cập nhật lịch rảnh
