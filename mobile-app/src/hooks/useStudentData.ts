/**
 * Custom hook for student data
 */

import {useState, useEffect} from 'react';
import {useAuth} from '../context/AuthContext';
import {studentApi} from '../services/studentApi';
import {
  StudentSchedule,
  StudentGrade,
  StudentExam,
  StudentExamSchedule,
} from '../services/studentApi';

export const useStudentData = () => {
  const {user} = useAuth();
  const studentId = user?._id || '';

  const [schedule, setSchedule] = useState<StudentSchedule[]>([]);
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [exams, setExams] = useState<StudentExam[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = async (schoolYear?: string) => {
    if (!studentId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await studentApi.getSchedule(studentId, schoolYear);
      setSchedule(data || []);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải lịch học');
    } finally {
      setLoading(false);
    }
  };

  const fetchGrades = async (schoolYear?: string, semester?: string) => {
    if (!studentId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await studentApi.getGrades(studentId, schoolYear, semester);
      setGrades(data || []);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải điểm số');
    } finally {
      setLoading(false);
    }
  };

  const fetchExams = async () => {
    if (!studentId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await studentApi.getExams(studentId);
      setExams(data || []);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải danh sách kỳ thi');
    } finally {
      setLoading(false);
    }
  };

  return {
    schedule,
    grades,
    exams,
    loading,
    error,
    fetchSchedule,
    fetchGrades,
    fetchExams,
    studentId,
  };
};

export const useStudentExamSchedules = (examId: string) => {
  const {user} = useAuth();
  const studentId = user?._id || '';

  const [schedules, setSchedules] = useState<StudentExamSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (examId && studentId) {
      fetchSchedules();
    }
  }, [examId, studentId]);

  const fetchSchedules = async () => {
    if (!examId || !studentId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await studentApi.getExamSchedules(examId, studentId);
      setSchedules(data || []);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải lịch thi');
    } finally {
      setLoading(false);
    }
  };

  return {schedules, loading, error, refetch: fetchSchedules};
};

