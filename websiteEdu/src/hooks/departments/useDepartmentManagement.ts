import { useState, useEffect, useCallback } from "react";
import { departmentManagementApi } from "@/services/departmentManagementApi";
import type { DepartmentDashboard, DepartmentTeachersResponse, ProposalsResponse, CreateProposalPayload } from "@/services/departmentManagementApi";
import { useToast } from "@/hooks/use-toast";

export function useDepartmentManagement() {
  const [dashboard, setDashboard] = useState<DepartmentDashboard | null>(null);
  const [teachers, setTeachers] = useState<DepartmentTeachersResponse | null>(null);
  const [proposals, setProposals] = useState<ProposalsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // ✅ Lấy dashboard
  const fetchDashboard = useCallback(async (params?: { year?: string; semester?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await departmentManagementApi.getDashboard(params);
      setDashboard(data);
      return data;
    } catch (err: any) {
      const message = err.response?.data?.message || "Không thể tải dashboard";
      setError(message);
      toast({
        title: "Lỗi",
        description: message,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // ✅ Lấy danh sách giáo viên
  const fetchTeachers = useCallback(async (params?: { year?: string; semester?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await departmentManagementApi.getTeachers(params);
      setTeachers(data);
      return data;
    } catch (err: any) {
      const message = err.response?.data?.message || "Không thể tải danh sách giáo viên";
      setError(message);
      toast({
        title: "Lỗi",
        description: message,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // ✅ Lấy danh sách đề xuất
  const fetchProposals = useCallback(async (params?: { status?: string; year?: string; semester?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await departmentManagementApi.getProposals(params);
      setProposals(data);
      return data;
    } catch (err: any) {
      const message = err.response?.data?.message || "Không thể tải danh sách đề xuất";
      setError(message);
      toast({
        title: "Lỗi",
        description: message,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // ✅ Thêm giáo viên
  const addTeacher = useCallback(async (teacherId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await departmentManagementApi.addTeacher(teacherId);
      toast({
        title: "Thành công",
        description: result.message || "Đã thêm giáo viên vào tổ",
      });
      // Refresh danh sách giáo viên
      await fetchTeachers();
      return result;
    } catch (err: any) {
      const message = err.response?.data?.message || "Không thể thêm giáo viên";
      setError(message);
      toast({
        title: "Lỗi",
        description: message,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast, fetchTeachers]);

  // ✅ Xóa giáo viên
  const removeTeacher = useCallback(async (teacherId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await departmentManagementApi.removeTeacher(teacherId);
      toast({
        title: "Thành công",
        description: result.message || "Đã xóa giáo viên khỏi tổ",
      });
      // Refresh danh sách giáo viên
      await fetchTeachers();
      return result;
    } catch (err: any) {
      const message = err.response?.data?.message || "Không thể xóa giáo viên";
      setError(message);
      toast({
        title: "Lỗi",
        description: message,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast, fetchTeachers]);

  // ✅ Tạo đề xuất phân công
  const createProposal = useCallback(async (payload: CreateProposalPayload) => {
    setLoading(true);
    setError(null);
    try {
      const result = await departmentManagementApi.createProposal(payload);
      toast({
        title: "Thành công",
        description: result.message || "Đã tạo đề xuất phân công",
      });
      // Refresh danh sách đề xuất
      await fetchProposals();
      return result;
    } catch (err: any) {
      const message = err.response?.data?.message || "Không thể tạo đề xuất";
      setError(message);
      toast({
        title: "Lỗi",
        description: message,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast, fetchProposals]);

  // ✅ Hủy đề xuất
  const cancelProposal = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await departmentManagementApi.cancelProposal(id);
      toast({
        title: "Thành công",
        description: result.message || "Đã hủy đề xuất",
      });
      // Refresh danh sách đề xuất
      await fetchProposals();
      return result;
    } catch (err: any) {
      const message = err.response?.data?.message || "Không thể hủy đề xuất";
      setError(message);
      toast({
        title: "Lỗi",
        description: message,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast, fetchProposals]);

  // ✅ Hủy toàn bộ đề xuất
  const cancelAllProposals = useCallback(async (params?: { year?: string; semester?: "1" | "2"; status?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await departmentManagementApi.cancelAllProposals(params || {});
      toast({
        title: "Thành công",
        description: result.message || "Đã hủy toàn bộ đề xuất",
      });
      await fetchProposals();
      return result;
    } catch (err: any) {
      const message = err.response?.data?.message || "Không thể hủy đề xuất";
      setError(message);
      toast({
        title: "Lỗi",
        description: message,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast, fetchProposals]);

  // ✅ Tạo nhiều đề xuất cùng lúc (batch)
  const createBatchProposals = useCallback(async (payload: {
    proposals: Array<{ teacherId: string; subjectId: string; classIds: string[] }>;
    year: string;
    semester: "1" | "2";
    notes?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await departmentManagementApi.createBatchProposals(payload);
      toast({
        title: "Thành công",
        description: result.message || "Đã tạo đề xuất phân công",
      });
      await fetchProposals();
      return result;
    } catch (err: any) {
      const message = err.response?.data?.message || "Không thể tạo đề xuất";
      setError(message);
      toast({
        title: "Lỗi",
        description: message,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast, fetchProposals]);

  return {
    dashboard,
    teachers,
    proposals,
    loading,
    error,
    fetchDashboard,
    fetchTeachers,
    fetchProposals,
    addTeacher,
    removeTeacher,
    createProposal,
    cancelProposal,
    cancelAllProposals,
    createBatchProposals,
  };
}

