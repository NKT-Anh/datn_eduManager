/**
 * Student Exams Screen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { studentService } from '../../services/studentService';
import { ExamSchedule } from '../../types';

interface Exam {
  _id: string;
  name: string;
  year: string;
  semester: string;
}

interface ExamGrade {
  _id: string;
  subject: {
    _id: string;
    name: string;
  };
  gradeValue: number;
  teacher?: {
    _id: string;
    name: string;
  };
}

export default function ExamsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [grades, setGrades] = useState<ExamGrade[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'schedule' | 'grades'>('schedule');

  useEffect(() => {
    loadExamSchedules();
    loadExams();
  }, []);

  useEffect(() => {
    if (viewMode === 'grades' && selectedExamId) {
      loadExamGrades();
    }
    if (viewMode === 'schedule' && selectedExamId) {
      loadExamSchedules();
    }
  }, [selectedExamId, viewMode]);

  const loadExamSchedules = async () => {
    try {
      setLoading(true);
      const data = await studentService.getExamSchedule(selectedExamId || undefined);
      setSchedules(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Không thể tải lịch thi');
    } finally {
      setLoading(false);
    }
  };

  const loadExams = async () => {
    try {
      const data = await studentService.getAllExams();
      const publishedExams = (Array.isArray(data) ? data : []).filter(
        (e: any) => e.status === 'published'
      );
      publishedExams.sort((a: any, b: any) => {
        const ad = a.startDate ? new Date(a.startDate).getTime() : 0;
        const bd = b.startDate ? new Date(b.startDate).getTime() : 0;
        return bd - ad;
      });
      setExams(publishedExams);
      if (publishedExams.length > 0) {
        setSelectedExamId(publishedExams[0]._id);
      }
    } catch (err: any) {
      console.error('Error loading exams:', err);
    }
  };

  const loadExamGrades = async () => {
    if (!selectedExamId) return;
    try {
      setLoadingGrades(true);
      const data = await studentService.getExamGrades(selectedExamId);
      setGrades(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error loading exam grades:', err);
      setGrades([]);
    } finally {
      setLoadingGrades(false);
    }
  };

  const getScoreColor = (score?: number) => {
    if (score === undefined || score === null) return '#999';
    if (score >= 9) return '#34C759';
    if (score >= 8) return '#007AFF';
    if (score >= 6.5) return '#FF9500';
    return '#FF3B30';
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Đang tải lịch thi...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // Group by date
  const groupedByDate = schedules.reduce((acc, schedule) => {
    const date = new Date(schedule.date).toLocaleDateString('vi-VN');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(schedule);
    return acc;
  }, {} as Record<string, ExamSchedule[]>);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kỳ thi</Text>
        
        {/* View Mode Toggle */}
        <View style={styles.viewModeRow}>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'schedule' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('schedule')}
          >
            <Text style={[styles.viewModeText, viewMode === 'schedule' && styles.viewModeTextActive]}>
              Lịch thi
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'grades' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('grades')}
          >
            <Text style={[styles.viewModeText, viewMode === 'grades' && styles.viewModeTextActive]}>
              Điểm thi
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'schedule' && (
        <>
          {schedules.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Chưa có lịch thi</Text>
            </View>
          ) : (
            Object.entries(groupedByDate).map(([date, daySchedules]) => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateTitle}>{date}</Text>
              {daySchedules.map((schedule) => (
                  <TouchableOpacity
                    key={schedule._id}
                    style={styles.examCard}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('ExamRoomDetail', { schedule })}
                  >
                  <Text style={styles.subjectName}>
                    {schedule.subject?.name || 'Môn thi'}
                  </Text>
                  <View style={styles.examInfo}>
                    <Text style={styles.examTime}>
                      {schedule.startTime} - {schedule.endTime}
                    </Text>
                    <Text style={styles.examDuration}>
                      {schedule.duration} phút
                    </Text>
                  </View>
                  {schedule.exam && (
                    <Text style={styles.examName}>
                      {schedule.exam.name} - {schedule.exam.year} - Học kỳ {schedule.exam.semester}
                    </Text>
                  )}
                  </TouchableOpacity>
              ))}
            </View>
            ))
          )}
        </>
      )}

      {viewMode === 'grades' && (
        <View style={styles.gradesContainer}>
          {/* Exam Selector */}
          {exams.length > 0 && (
            <View style={styles.examSelector}>
              <Text style={styles.selectorLabel}>Chọn kỳ thi:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {exams.map((exam) => (
                  <TouchableOpacity
                    key={exam._id}
                    style={[
                      styles.examOption,
                      selectedExamId === exam._id && styles.examOptionActive,
                    ]}
                    onPress={() => setSelectedExamId(exam._id)}
                  >
                    <Text
                      style={[
                        styles.examOptionText,
                        selectedExamId === exam._id && styles.examOptionTextActive,
                      ]}
                    >
                      {exam.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Grades List */}
          {loadingGrades ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Đang tải điểm...</Text>
            </View>
          ) : grades.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Chưa có điểm thi</Text>
            </View>
          ) : (
            grades.map((grade) => (
              <View key={grade._id} style={styles.gradeCard}>
                <View style={styles.gradeHeader}>
                  <Text style={styles.gradeSubject}>
                    {grade.subject?.name || 'Môn thi'}
                  </Text>
                  <View
                    style={[
                      styles.gradeBadge,
                      { backgroundColor: getScoreColor(grade.gradeValue) },
                    ]}
                  >
                    <Text style={styles.gradeValue}>
                      {grade.gradeValue !== undefined && grade.gradeValue !== null
                        ? grade.gradeValue.toFixed(1)
                        : 'Chưa có'}
                    </Text>
                  </View>
                </View>
                {grade.teacher && (
                  <Text style={styles.gradeTeacher}>
                    Giáo viên: {grade.teacher.name}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  dateGroup: {
    marginBottom: 20,
  },
  dateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  examCard: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  examInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  examTime: {
    fontSize: 16,
    color: '#666',
  },
  examDuration: {
    fontSize: 14,
    color: '#999',
  },
  examName: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  viewModeRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  viewModeButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  viewModeButtonActive: {
    backgroundColor: '#007AFF',
  },
  viewModeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  viewModeTextActive: {
    color: '#fff',
  },
  gradesContainer: {
    padding: 16,
  },
  examSelector: {
    marginBottom: 16,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  examOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  examOptionActive: {
    backgroundColor: '#007AFF',
  },
  examOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  examOptionTextActive: {
    color: '#fff',
  },
  gradeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gradeSubject: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  gradeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  gradeValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  gradeTeacher: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

