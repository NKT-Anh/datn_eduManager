import api from "./axiosInstance";
import type { Teacher } from "@/types/auth";

// URL cơ sở API
const BASE = "/teachers";

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
    const res = await api.get<Teacher[]>(BASE);
    return res.data;
  },

  // Lấy giáo viên theo ID
  getById: async (id: string): Promise<Teacher> => {
    const res = await api.get<Teacher>(`${BASE}/${id}`);
    return res.data;
  },

  // Tạo giáo viên mới (bắt buộc name)
  create: async (payload: TeacherCreatePayload): Promise<Teacher> => {
    if (!payload.name) {
      throw new Error("Tên giáo viên là bắt buộc");
    }
    const res = await api.post<Teacher>(BASE, payload);
    return res.data;
  },

  // Cập nhật giáo viên theo ID (tất cả field optional)
  update: async (id: string, payload: TeacherUpdatePayload): Promise<Teacher> => {
    const res = await api.put<Teacher>(`${BASE}/${id}`, payload);
    return res.data;
  },

  // Xóa giáo viên theo ID
  delete: async (id: string): Promise<{ message: string }> => {
    const res = await api.delete<{ message: string }>(`${BASE}/${id}`);
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
    const res = await api.get<{ availableMatrix: boolean[][] }>(
      `${BASE}/${id}/availability`
    );
    return res.data.availableMatrix || [];
  },
  // ✅ Cập nhật lịch rảnh bằng ma trận trực tiếp
    updateAvailability: async (
      id: string,
      matrix: boolean[][]
    ): Promise<{ message: string; teacher: Teacher }> => {
      const res = await api.put<{ message: string; teacher: Teacher }>(
        `${BASE}/${id}/availability`,
        { availableMatrix: matrix }
      );
      return res.data;
    },

  // ✅ Lấy ban giám hiệu (public, không cần auth)
  getLeadership: async (): Promise<Array<{
    _id: string;
    name: string;
    position: string;
    avatarUrl?: string;
    greeting: string;
  }>> => {
    const res = await api.get<Array<{
      _id: string;
      name: string;
      position: string;
      avatarUrl?: string;
      greeting: string;
    }>>(`${BASE}/leadership`);
    return res.data;
  },

  // ✅ Batch update maxClasses và weeklyLessons cho giáo viên theo môn học
  batchUpdateLimits: async (payload: {
    subjectId?: string | null;
    maxClasses?: number;
    weeklyLessons?: number;
  }): Promise<{
    message: string;
    modifiedCount: number;
    matchedCount: number;
    teachers: Teacher[];
  }> => {
    const res = await api.put<{
      message: string;
      modifiedCount: number;
      matchedCount: number;
      teachers: Teacher[];
    }>(`${BASE}/batch-update-limits`, payload);
    return res.data;
  },

  // ✅ Xuất danh sách giáo viên ra file Excel
  exportToExcel: async (params?: {
    status?: 'active' | 'inactive';
  }): Promise<Blob> => {
    const res = await api.get(`${BASE}/export/excel`, {
      params,
      responseType: "blob", // Quan trọng: phải set responseType là blob để nhận file
    });
    return res.data;
  },

  // ✅ Kiểm tra tình trạng giáo viên (số tiết đang dạy / còn lại)
  checkStatus: async (params?: { year?: string; semester?: string }) => {
    const res = await api.get(`${BASE}/check-status`, { params });
    return res.data;
  },

  // ✅ Cập nhật giới hạn số lớp tối đa theo từng khối
  updateMaxClassPerGrade: async (
    id: string,
    payload: { maxClassPerGrade: Record<string, number> }
  ) => {
    const res = await api.put(`${BASE}/${id}/max-class-per-grade`, payload);
    return res.data;
  },

};


// cập nhật lịch rảnh
