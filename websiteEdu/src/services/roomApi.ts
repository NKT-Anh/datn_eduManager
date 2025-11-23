import api from "@/services/axiosInstance";

export interface Room {
  _id?: string;
  roomCode: string;
  name?: string;
  // building?: string;
  type?:string;
  capacity?: number;
  status?: string;
  note?: string;
}

export const roomApi = {
  async getAll(params?: any): Promise<Room[]> {
    const res = await api.get("/rooms", { params });
    return res.data;
  },
  async create(data: Partial<Room>) {
    const res = await api.post("/rooms", data);
    return res.data;
  },
  async update(id: string, data: Partial<Room>) {
    const res = await api.put(`/rooms/${id}`, data);
    return res.data;
  },
  async remove(id: string) {
    const res = await api.delete(`/rooms/${id}`);
    return res.data;
  },
};

export default roomApi;
