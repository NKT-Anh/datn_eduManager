import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import surveyApi, { Survey, SurveyQuestion, CreateSurveyData, UpdateSurveyData } from "@/services/surveyApi";

export interface SurveyFilters {
  subjectId?: string;
  semester?: string;
  year?: string;
  status?: string;
  isDeleted?: string;
}

export interface SurveyProgress {
  survey: {
    _id: string;
    title: string;
    status: string;
  };
  totalAllowed: number;
  totalCount: number;
  submittedCount: number;
  notSubmittedCount: number;
  completionRate: string;
  notSubmittedStudents: Array<{
    _id: string;
    name: string;
    studentCode: string;
    classId?: {
      _id: string;
      className: string;
      classCode: string;
    };
  }>;
}

/**
 * Hook để quản lý khảo sát (Surveys)
 * - Lấy danh sách khảo sát với filters
 * - Lấy chi tiết khảo sát
 * - Tạo, cập nhật, xóa khảo sát
 * - Mở/tạm dừng/tiếp tục khảo sát
 * - Lấy tiến độ khảo sát
 */
export function useSurveys(filters?: SurveyFilters) {
  const queryClient = useQueryClient();

  // 📘 Lấy danh sách khảo sát
  const {
    data: surveysData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["surveys", filters],
    queryFn: async () => {
      const data = await surveyApi.getAllSurveys({
        status: filters?.status !== 'all' ? filters?.status : undefined,
        year: filters?.year !== 'all' ? filters?.year : undefined,
        semester: filters?.semester !== 'all' ? filters?.semester : undefined,
        subjectId: filters?.subjectId !== 'all' ? filters?.subjectId : undefined,
        isDeleted: filters?.isDeleted || 'false',
      });
      return Array.isArray(data) ? data : data.surveys || [];
    },
    staleTime: 2 * 60 * 1000, // 2 phút
  });

  const surveys = surveysData || [];

  // ➕ Tạo khảo sát mới
  const createSurvey = useMutation({
    mutationFn: (data: CreateSurveyData) => surveyApi.createSurvey(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
    },
  });

  // ✏️ Cập nhật khảo sát
  const updateSurvey = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSurveyData }) =>
      surveyApi.updateSurvey(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      queryClient.invalidateQueries({ queryKey: ["survey", variables.id] });
    },
  });

  // 🗑 Xóa khảo sát
  const deleteSurvey = useMutation({
    mutationFn: (id: string) => surveyApi.deleteSurvey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
    },
  });

  // 🔓 Mở khảo sát cho học sinh
  const openSurveyForStudents = useMutation({
    mutationFn: ({ id, data }: { 
      id: string; 
      data?: { 
        classIds?: string[]; 
        studentIds?: string[]; 
        sendNotification?: boolean; 
      } 
    }) => surveyApi.openSurveyForStudents(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      queryClient.invalidateQueries({ queryKey: ["survey", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["survey-progress", variables.id] });
    },
  });

  return {
    surveys,
    isLoading,
    error,
    refetch,
    createSurvey: createSurvey.mutateAsync,
    updateSurvey: updateSurvey.mutateAsync,
    deleteSurvey: deleteSurvey.mutateAsync,
    openSurveyForStudents: openSurveyForStudents.mutateAsync,
    isCreating: createSurvey.isPending,
    isUpdating: updateSurvey.isPending,
    isDeleting: deleteSurvey.isPending,
    isOpening: openSurveyForStudents.isPending,
  };
}

/**
 * Hook để lấy chi tiết một khảo sát
 */
export function useSurvey(id?: string) {
  return useQuery({
    queryKey: ["survey", id],
    queryFn: () => (id ? surveyApi.getSurvey(id) : null),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook để lấy tiến độ khảo sát
 */
export function useSurveyProgress(id?: string) {
  return useQuery({
    queryKey: ["survey-progress", id],
    queryFn: () => (id ? surveyApi.getSurveyProgress(id) : null),
    enabled: !!id,
    staleTime: 30 * 1000, // 30 giây (tiến độ thay đổi thường xuyên)
  });
}

/**
 * Hook để lấy danh sách khảo sát có thể tham gia (cho học sinh)
 */
export function useAvailableSurveys() {
  return useQuery({
    queryKey: ["available-surveys"],
    queryFn: () => surveyApi.getAvailableSurveys(),
    staleTime: 1 * 60 * 1000, // 1 phút
  });
}

