// import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// import { examService } from '@/services/examService';
// import { useToast } from '@/components/ui/use-toast';

// export const useExamTerms = () => {
//   return useQuery({
//     queryKey: ['examTerms'],
//   queryFn: () => examService.getExamTerms(),
//   });
// };

// export const useCreateExamTerm = () => {
//   const qc = useQueryClient();
//   const { toast } = useToast();

//   return useMutation({
//   mutationFn: (data: any) => examService.createExamTerm(data),
//     onSuccess: () => {
//       qc.invalidateQueries({ queryKey: ['examTerms'] });
//       toast({ title: 'Thành công', description: 'Đã tạo kỳ thi' });
//     },
//     onError: (err: any) => {
//       toast({ variant: 'destructive', title: 'Lỗi', description: err?.response?.data?.message || 'Không thể tạo kỳ thi' });
//     }
//   });
// };

// export const useUpdateExamTerm = () => {
//   const qc = useQueryClient();
//   const { toast } = useToast();

//   return useMutation({
//   mutationFn: ({ id, data }: { id: string; data: any }) => examService.updateExamTerm(id, data),
//     onSuccess: () => {
//       qc.invalidateQueries({ queryKey: ['examTerms'] });
//       toast({ title: 'Thành công', description: 'Đã cập nhật kỳ thi' });
//     },
//     onError: (err: any) => {
//       toast({ variant: 'destructive', title: 'Lỗi', description: err?.response?.data?.message || 'Không thể cập nhật kỳ thi' });
//     }
//   });
// };

// export const useDeleteExamTerm = () => {
//   const qc = useQueryClient();
//   const { toast } = useToast();

//   return useMutation({
//   mutationFn: (id: string) => examService.deleteExamTerm(id),
//     onSuccess: () => {
//       qc.invalidateQueries({ queryKey: ['examTerms'] });
//       toast({ title: 'Thành công', description: 'Đã xóa kỳ thi' });
//     },
//     onError: (err: any) => {
//       toast({ variant: 'destructive', title: 'Lỗi', description: err?.response?.data?.message || 'Không thể xóa kỳ thi' });
//     }
//   });
// };
