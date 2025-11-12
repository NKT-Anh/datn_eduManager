import { useQuery } from '@tanstack/react-query';
import axiosClient from '@/services/axiosInstance';

// ExamClass API service (lấy danh sách lớp thi)
export const examClassApi = {
  getExamClasses: async (examId: string) => {
    const res = await axiosClient.get('/exam/classes', { params: { examId } });
    return res.data;
  },
};

// ExamClasses hook
export const useExamClasses = (examId: string) => {
  return useQuery({
    queryKey: ['examClasses', examId],
    queryFn: () => examClassApi.getExamClasses(examId),
    enabled: !!examId, // Chỉ gọi API khi có examId
  });
};