// src/hooks/exam/useExam.ts
import { useState, useEffect, useCallback } from "react";
import * as api from "@/services/examApi";
import { message } from "antd";

export type Exam = {
  _id: string;
  examId?: string;
  name: string;
  year?: string;
  semester?: string;
  status?: string;
  grades?: string[];
  startDate?: string;
  endDate?: string;
};

export function useExams() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Fetch danh sách exam
  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getExams();
      setExams(res.data);
    } catch (err: any) {
      message.error(err?.message || "Lỗi khi tải danh sách kỳ thi");
    } finally {
      setLoading(false);
    }
  }, []);

  // Thay đổi trạng thái
  const changeStatus = useCallback(async (id: string, status: string) => {
    setBusyAction(id);
    try {
      await api.updateExam(id, { status });
      setExams(prev =>
        prev.map(e => (e._id === id ? { ...e, status } : e))
      );
      message.success("Cập nhật trạng thái thành công");
    } catch (err: any) {
      message.error(err?.message || "Lỗi khi cập nhật trạng thái");
    } finally {
      setBusyAction(null);
    }
  }, []);

  // Xóa exam
  const deleteExam = useCallback(async (id: string) => {
    setBusyAction(id);
    try {
      await api.deleteExam(id);
      setExams(prev => prev.filter(e => e._id !== id));
      message.success("Xóa kỳ thi thành công");
    } catch (err: any) {
      message.error(err?.message || "Lỗi khi xóa kỳ thi");
    } finally {
      setBusyAction(null);
    }
  }, []);

  // Thêm exam mới vào danh sách
  const addExamToList = useCallback((exam: Exam) => {
    setExams(prev => [exam, ...prev]);
  }, []);

  // Tạo SBD
  const generateSBD = useCallback(async (id: string) => {
    setBusyAction(id);
    try {
      await api.generateSBD(id);
      message.success("Tạo SBD xong");
    } catch (err: any) {
      message.error(err?.message || "Lỗi khi tạo SBD");
    } finally {
      setBusyAction(null);
    }
  }, []);

  // Xếp phòng tự động
  const autoAssignRooms = useCallback(async (id: string) => {
    setBusyAction(id);
    try {
      await api.autoAssignRooms(id);
      message.success("Xếp phòng xong");
    } catch (err: any) {
      message.error(err?.message || "Lỗi khi xếp phòng");
    } finally {
      setBusyAction(null);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  return {
    exams,
    loading,
    busyAction,
    fetchExams,
    changeStatus,
    deleteExam,
    addExamToList,
    generateSBD,
    autoAssignRooms,
  };
}
