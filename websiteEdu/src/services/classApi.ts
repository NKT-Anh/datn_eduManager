// import { join } from 'path';
// import { ClassType } from './../types/class';
// import axios from "axios";

// const API_BASE = import.meta.env.VITE_API_BASE_URL;
// const getAxiosInstance = () =>{
//     const token  = localStorage.getItem('token');
//     return axios.create({
//         baseURL : API_BASE,
//         headers: {
//             Authorization: token ? `Bearer ${token}`:'',
//             "Content-Type": 'application/json',
//         }
//     })
// }

// export const classApi ={
//    getAll: async ()  :  Promise<ClassType[]> => {
//     const res = await getAxiosInstance().get('/class');
//     return res.data;
//    },
//    getById: async (id: string): Promise<ClassType[]> =>{
//     const res = await getAxiosInstance().get(`/class/${id}`);
//      return res.data;
//    },
//    create: async (data: Omit<ClassType, '_id' | 'teacherID' | 'students'>) : Promise<ClassType> =>{
//     try {
//       const res = await getAxiosInstance().post('/class', data);
//       return res.data;
//     } catch (err: any) {
//       console.error('Create class error:', err.response?.data || err.message);
//       throw err;
//     }
//    },
//    update: async (id: string, data: any) :  Promise<ClassType> =>{
//     const res = await getAxiosInstance().put(`/class/${id}`,data);
//     return res.data;
//    },
//     delete: async (id: string, data: any) : Promise<ClassType[]> =>{
//     const res = await getAxiosInstance().delete(`/class/${id}`,data);
//     return res.data;
//    },
//    joinClass : async (data:{userId:string ; classCode:string}) : Promise<ClassType[]> =>{
//      const res = await getAxiosInstance().post('/class/join-class', data);
//      return res.data
//    },
//    autoAssign: async (params: { year?: number; grade?: string; minScore?: number }): Promise<ClassType[]> => {
//     const res = await getAxiosInstance().get('/class/auto-assign', { params });
//     return res.data;
//   },

//   setupYear: async (data: { year?: number; grade?: string; count?: number; capacity?: number }): Promise<ClassType[]> => {
//     const res = await getAxiosInstance().post('/class/setup-year', data);
//     return res.data;
//   },
// };

// export const classApiNoToken = {
//   getAll: async (): Promise<ClassType[]> => {
//     const res = await axios.get(`${API_BASE}/class`);
//     return res.data;
//   },

//   getById: async (id: string): Promise<ClassType> => {
//     const res = await axios.get(`${API_BASE}/class/${id}`);
//     return res.data;
//   },

//   create: async (data: Omit<ClassType, '_id' | 'teacherId' | 'students'| 'classCode'>): Promise<ClassType> => {
//     try {
//       const res = await axios.post(`${API_BASE}/class`, data);
//       return res.data;
//     } catch (err: any) {
//       console.error('Create class error:', err.response?.data || err.message);
//       throw err;
//     }
//   },
//   update: async (id: string, data: any): Promise<ClassType> => {
//     const res = await axios.put(`${API_BASE}/class/${id}`, data);
//     return res.data;
//   },

//   delete: async (id: string): Promise<ClassType[]> => {
//     const res = await axios.delete(`${API_BASE}/class/${id}`);
//     return res.data;
//   },

//   // ---------------- CHỨC NĂNG ĐẶC BIỆT ----------------
//   joinClass: async (data: { userId: string; classCode: string }): Promise<ClassType[]> => {
//     const res = await axios.post(`${API_BASE}/class/join`, data);
//     return res.data;
//   },

//   autoAssign: async (params: { year?: number; grade?: string; minScore?: number }) : Promise<ClassType[]>=> {
//     const res = await axios.get(`${API_BASE}/class/auto-assign`, { params });
//     return res.data;
//   },

//   setupYear: async (data: { year?: number; grade?: string; count?: number; capacity?: number }) : Promise<ClassType[]>=> {
//     const res = await axios.post(`${API_BASE}/class/setup-year`, data);
//     return res.data;
//   },
// }

import axios from "axios";
import { ClassType } from "../types/class";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const getAxiosInstance = () => {
  const token = localStorage.getItem("token");
  return axios.create({
    baseURL: API_BASE,
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
  });
};

export const classApi = {
  getAll: async (): Promise<ClassType[]> => {
    const res = await getAxiosInstance().get("/class");
    return res.data;
  },

  getById: async (id: string): Promise<ClassType> => {
    const res = await getAxiosInstance().get(`/class/${id}`);
    return res.data;
  },

  create: async (data: Omit<ClassType, "_id" | "teacherId" | "students">): Promise<ClassType> => {
    try {
      const res = await getAxiosInstance().post("/class", data);
      return res.data;
    } catch (err: any) {
      console.error("Create class error:", err.response?.data || err.message);
      throw err;
    }
  },

  update: async (id: string, data: any): Promise<ClassType> => {
    try {
      const res = await getAxiosInstance().put(`/class/${id}`, data);
      return res.data;
    } catch (err: any) {
      console.error("Update class error:", err.response?.data || err.message);
      throw err;
    }
  },

  delete: async (id: string): Promise<ClassType[]> => {
    try {
      const res = await getAxiosInstance().delete(`/class/${id}`);
      return res.data;
    } catch (err: any) {
      console.error("Delete class error:", err.response?.data || err.message);
      throw err;
    }
  },

  joinClass: async (data: { userId: string; classCode: string }): Promise<ClassType[]> => {
    const res = await getAxiosInstance().post("/class/join-class", data);
    return res.data;
  },

  autoAssign: async (params: { year?: number; grade?: string; minScore?: number }): Promise<ClassType[]> => {
    const res = await getAxiosInstance().get("/class/auto-assign", { params });
    return res.data;
  },

  setupYear: async (data: { year?: number; grade?: string; count?: number; capacity?: number }): Promise<ClassType[]> => {
    const res = await getAxiosInstance().post("/class/setup-year", data);
    return res.data;
  },
};

export const classApiNoToken = {
  getAll: async (): Promise<ClassType[]> => {
    const res = await axios.get(`${API_BASE}/class`);
    return res.data;
  },

  getById: async (id: string): Promise<ClassType> => {
    const res = await axios.get(`${API_BASE}/class/${id}`);
    return res.data;
  },

  create: async (data: Omit<ClassType, "_id" | "teacherId" | "students" | "classCode">): Promise<ClassType> => {
    try {
      const res = await axios.post(`${API_BASE}/class`, data);
      return res.data;
    } catch (err: any) {
      console.error("Create class error:", err.response?.data || err.message);
      throw err;
    }
  },

  update: async (id: string, data: any): Promise<ClassType> => {
    const res = await axios.put(`${API_BASE}/class/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<ClassType[]> => {
    const res = await axios.delete(`${API_BASE}/class/${id}`);
    return res.data;
  },

  joinClass: async (data: { userId: string; classCode: string }): Promise<ClassType[]> => {
    const res = await axios.post(`${API_BASE}/class/join-class`, data);
    return res.data;
  },

  autoAssign: async (params: { year?: number; grade?: string; minScore?: number }): Promise<ClassType[]> => {
    const res = await axios.get(`${API_BASE}/class/auto-assign`, { params });
    return res.data;
  },

  setupYear: async (data: { year?: number; grade?: string; count?: number; capacity?: number }): Promise<ClassType[]> => {
    const res = await axios.post(`${API_BASE}/class/setup-year`, data);
    return res.data;
  },
};
