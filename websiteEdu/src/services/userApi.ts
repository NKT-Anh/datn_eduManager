// services/userApi.ts
import api from './axiosInstance';
export default {
  createBatchStudents: (data: any) =>
    api.post('/batch/students', data).then(res => res.data),

  createBatchTeachers: (data: any) =>
    api.post('/batch/teachers', data).then(res => res.data),
  
  createBatchAccounts: (data: { users: any[], role: string }) =>
    api.post('/batch/accounts', data).then(res => res.data),
  
  resetPasswords: (data:any) =>
    api.post('/batch/reset-password' , data ).then(res => res.data),
  getAllAccounts: () => api.get('/batch/all-accounts').then(res => res.data),
  deleteAccounts: (data: any) =>
    api.post('/batch/delete-accounts', data).then(res => res.data),

  // Phân quyền
  getAllAccountsWithPermissions: (year?: string) => 
    api.get('/accounts/permissions', { params: year ? { year } : {} }).then(res => res.data),
  
  updateAccountRole: (accountId: string, role: string) =>
    api.put(`/accounts/${accountId}/role`, { role }).then(res => res.data),
  
  updateTeacherFlags: (teacherId: string, flags: {
    isHomeroom?: boolean;
    isDepartmentHead?: boolean;
    isLeader?: boolean;
    permissions?: string[];
    year?: string; // ✅ Năm học để cập nhật permissions theo năm
  }) =>
    api.put(`/accounts/teacher/${teacherId}/flags`, flags).then(res => res.data),

};
