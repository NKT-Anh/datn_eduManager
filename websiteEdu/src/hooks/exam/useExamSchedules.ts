// import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// import { examService } from '@/services/examService';
// import { useToast } from '@/components/ui/use-toast';
// import { ExamScheduleFormData, ExamScheduleQueryParams } from '@/types/exam';

// export const useExamSchedules = (params: ExamScheduleQueryParams = {}) => {
//   return useQuery({
//     queryKey: ['examSchedules', params],
//     queryFn: () => examService.getExamSchedules(params),
//   });
// };

// export const useExamSchedule = (id: string) => {
//   return useQuery({
//     queryKey: ['examSchedule', id],
//     queryFn: () => examService.getExamScheduleById(id),
//     enabled: !!id,
//   });
// };

// export const useCreateExamSchedule = () => {
//   const qc = useQueryClient();
//   const { toast } = useToast();

//   return useMutation({
//     mutationFn: (data: ExamScheduleFormData) => examService.createExamSchedule(data),
//     onSuccess: () => {
//       qc.invalidateQueries({ queryKey: ['examSchedules'] });
//       toast({ title: 'Thành công', description: 'Đã tạo lịch thi mới' });
//     },
//     onError: (err: any) => {
//       toast({
//         variant: 'destructive',
//         title: 'Lỗi',
//         description: err?.response?.data?.message || 'Không thể tạo lịch thi',
//       });
//     },
//   });
// };

// export const useUpdateExamSchedule = () => {
//   const qc = useQueryClient();
//   const { toast } = useToast();

//   return useMutation({
//     mutationFn: ({ id, data }: { id: string; data: Partial<ExamScheduleFormData> }) =>
//       examService.updateExamSchedule(id, data),
//     onSuccess: () => {
//       qc.invalidateQueries({ queryKey: ['examSchedules'] });
//       toast({ title: 'Thành công', description: 'Đã cập nhật lịch thi' });
//     },
//     onError: (err: any) => {
//       toast({
//         variant: 'destructive',
//         title: 'Lỗi',
//         description: err?.response?.data?.message || 'Không thể cập nhật lịch thi',
//       });
//     },
//   });
// };

// export const useDeleteExamSchedule = () => {
//   const qc = useQueryClient();
//   const { toast } = useToast();

//   return useMutation({
//     mutationFn: (id: string) => examService.deleteExamSchedule(id),
//     onSuccess: () => {
//       qc.invalidateQueries({ queryKey: ['examSchedules'] });
//       toast({ title: 'Thành công', description: 'Đã xóa lịch thi' });
//     },
//     onError: (err: any) => {
//       toast({
//         variant: 'destructive',
//         title: 'Lỗi',
//         description: err?.response?.data?.message || 'Không thể xóa lịch thi',
//       });
//     },
//   });
// };
