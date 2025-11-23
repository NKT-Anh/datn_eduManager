// import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// import { examService } from '@/services/examService';
// import { useToast } from '@/components/ui/use-toast';

// export const useExamResults = (examId: string) => {
//   return useQuery({
//     queryKey: ['examResults', examId],
//   queryFn: () => examService.getExamResults(examId),
//     enabled: !!examId
//   });
// };

// export const useStudentExamResults = (studentId: string) => {
//   return useQuery({
//     queryKey: ['studentExamResults', studentId],
//   queryFn: () => examService.getExamResults(studentId),
//     enabled: !!studentId
//   });
// };

// export const useSubmitExamResults = () => {
//   const queryClient = useQueryClient();
//   const { toast } = useToast();

//   return useMutation({
//     mutationFn: ({ examId, results }: { examId: string; results: Array<{ studentId: string; score: number }> }) => 
//   examService.submitExamResults(examId, results),
//     onSuccess: (_, { examId }) => {
//       queryClient.invalidateQueries({ queryKey: ['examResults', examId] });
//       toast({
//         title: 'Thành công',
//         description: 'Đã cập nhật điểm thi thành công',
//       });
//     },
//     onError: (error: any) => {
//       toast({
//         variant: 'destructive',
//         title: 'Lỗi',
//         description: error?.response?.data?.message || 'Có lỗi xảy ra khi cập nhật điểm thi',
//       });
//     }
//   });
// };

// export const useExamStatistics = (examId: string) => {
//   return useQuery({
//     queryKey: ['examStatistics', examId],
//   queryFn: () => examService.getExamStatistics(examId),
//     enabled: !!examId
//   });
// };

// export const usePublishExamResults = () => {
//   const queryClient = useQueryClient();
//   const { toast } = useToast();

//   return useMutation({
//   mutationFn: (examId: string) => examService.submitExamResults(examId, []),
//     onSuccess: (_, examId) => {
//       queryClient.invalidateQueries({ queryKey: ['examResults', examId] });
//       toast({
//         title: 'Thành công',
//         description: 'Đã công bố điểm thi thành công',
//       });
//     },
//     onError: (error: any) => {
//       toast({
//         variant: 'destructive',
//         title: 'Lỗi',
//         description: error?.response?.data?.message || 'Có lỗi xảy ra khi công bố điểm thi',
//       });
//     }
//   });
// };