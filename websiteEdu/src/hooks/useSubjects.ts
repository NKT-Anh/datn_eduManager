import { useQuery } from '@tanstack/react-query';
import axiosClient from '@/services/axiosInstance';

// Subject API service
export const subjectApi = {
  getSubjects: async () => {
    const res = await axiosClient.get('/subjects');
    return res.data;
  },
};

// Subjects hook
export const useSubjects = () => {
  return useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectApi.getSubjects(),
  });
};