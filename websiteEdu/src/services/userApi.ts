// services/userApi.ts
import api from './axiosInstance';
export default {
  createBatchStudents: (data: any) =>
    api.post('/batch/students', data).then(res => res.data),

  createBatchTeachers: (data: any) =>
    api.post('/batch/teachers', data).then(res => res.data),
  resetPasswords: (data:any) =>
    api.post('/batch/reset-password' , data ).then(res => res.data),
  getAllAccounts: () => api.get('/batch/all-accounts').then(res => res.data),
  deleteAccounts: (data: any) =>
    api.post('/batch/delete-accounts', data).then(res => res.data),

};
