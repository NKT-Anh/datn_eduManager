import axios from 'axios';
import { Account } from '@/types/student';
// const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';
const API_BASE = import.meta.env.VITE_API_BASE_URL;
const BASE = `${API_BASE}/students`;


export interface StudentUpdatePayload {
  name?: string;
  dob?: string; // ISO string
  gender?: "male" | "female" | "other";
  address?: string;
  phone?: string;
  classId?: string;
  admissionYear?: number;
  grade?: "10" | "11" | "12";
  status?: "active" | "inactive";
  parents?: {
    _id?: string;
    name?: string;
    phone?: string;
    occupation?: string;
  }[];
}

export interface StudentCreatePayload {
  studentCode?: string;
  name: string;
  dob?: string | null;
  gender?: "male" | "female" | "other";
  address?: string;
  phone?: string;
  classId?: string | null;
  admissionYear?: number;
  grade?: "10" | "11" | "12";
  status?: "active" | "inactive";
  parents?: {
    _id?: string;
    name?: string;
    phone?: string;
    relation?: "father" | "mother" | "guardian";
        occupation?: string; 
  }[];
  accountId?: Account | null;
}



export const getStudents = async () => {
  try {
    const res = await axios.get(BASE);
    return res.data;
  } catch (err) {
    console.error('Error fetching students:', err);
    throw err;
  }
};

export const getStudent = async (id: string) => {
  try {
    const res = await axios.get(`${BASE}/${id}`);
    return res.data;
  } catch (err) {
    console.error(`Error fetching student ${id}:`, err);
    throw err;
  }
};

export const createStudent = async (payload: StudentCreatePayload) => {
  try {
    const res = await axios.post(BASE, payload);
    return res.data;
  } catch (err) {
    console.error('Error creating student:', err);
    throw err;
  }
};

export const updateStudent = async (id: string, payload: StudentUpdatePayload) => {
  try {
    const res = await axios.put(`${BASE}/${id}`, payload);
    return res.data;
  } catch (err: any) {
    console.error(`Error updating student ${id}:`, err.response?.data || err.message);
    throw new Error(err.response?.data?.message || "Failed to update student");
  }
};

export const deleteStudent = async (id: string) => {
  try {
    const res = await axios.delete(`${BASE}/${id}`);
    return res.data;
  } catch (err) {
    console.error(`Error deleting student ${id}:`, err);
    throw err;
  }
};
