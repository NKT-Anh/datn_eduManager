import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { studentService } from '../../services/studentService';
import { ExamSchedule } from '../../types';

const { width } = Dimensions.get('window');

// Màu sắc
const COLORS = {
  primary: '#2563EB',
  background: '#F3F4F6',
  card: '#FFFFFF',
  text: '#1F2937',
  textLight: '#6B7280',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  border: '#E5E7EB',
};

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
  const insets = useSafeAreaInsets();
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
      loadExamSchedules(); // Reload schedule when exam changes if needed
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
    if (score === undefined || score === null) return COLORS.textLight;
    if (score >= 8.5) return COLORS.success;
    if (score >= 7) return COLORS.primary;
    if (score >= 5) return COLORS.warning;
    return COLORS.danger;
  };

  // Group schedules by date
  const groupedByDate = schedules.reduce((acc, schedule) => {
    const date = new Date(schedule.date).toLocaleDateString('vi-VN', {
      weekday: 'long', 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric'
    });
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(schedule);
    return acc;
  }, {} as Record<string, ExamSchedule[]>);

  if (loading && !schedules.length) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, height: 80 + insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kỳ thi & Điểm số</Text>
        <View style={{ width: 40 }} /> 
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        
        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, viewMode === 'schedule' && styles.tabButtonActive]}
            onPress={() => setViewMode('schedule')}
          >
            <Text style={[styles.tabText, viewMode === 'schedule' && styles.tabTextActive]}>
              Lịch thi
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, viewMode === 'grades' && styles.tabButtonActive]}
            onPress={() => setViewMode('grades')}
          >
            <Text style={[styles.tabText, viewMode === 'grades' && styles.tabTextActive]}>
              Kết quả thi
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* View Mode: SCHEDULE */}
          {viewMode === 'schedule' && (
            <>
              {schedules.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={64} color="#D1D5DB" />
                  <Text style={styles.emptyText}>Chưa có lịch thi nào sắp tới</Text>
                </View>
              ) : (
                Object.entries(groupedByDate).map(([date, daySchedules]) => (
                  <View key={date} style={styles.dateGroup}>
                    <View style={styles.dateHeader}>
                      <Ionicons name="calendar" size={16} color={COLORS.primary} />
                      <Text style={styles.dateTitle}>{date}</Text>
                    </View>
                    
                    {daySchedules.map((schedule) => (
                      <TouchableOpacity
                        key={schedule._id}
                        style={styles.examCard}
                        activeOpacity={0.9}
                        onPress={() => navigation.navigate('ExamRoomDetail', { schedule })}
                      >
                        <View style={styles.examTimeBox}>
                          <Text style={styles.examTimeText}>{schedule.startTime}</Text>
                          <Text style={styles.examDurationText}>{schedule.duration}'</Text>
                        </View>
                        
                        <View style={styles.examInfo}>
                          <Text style={styles.subjectName}>
                            {schedule.subject?.name || 'Môn thi'}
                          </Text>
                          {schedule.exam && (
                            <Text style={styles.examName} numberOfLines={1}>
                              {schedule.exam.name}
                            </Text>
                          )}
                          <View style={styles.roomTag}>
                             <Ionicons name="location-outline" size={12} color={COLORS.textLight} />
                             <Text style={styles.roomText}>Xem phòng thi</Text>
                          </View>
                        </View>

                        <Ionicons name="chevron-forward" size={20} color={COLORS.border} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ))
              )}
            </>
          )}

          {/* View Mode: GRADES */}
          {viewMode === 'grades' && (
            <View>
              {/* Exam Selector Horizontal Scroll */}
              {exams.length > 0 && (
                <View style={styles.examSelectorContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {exams.map((exam) => (
                      <TouchableOpacity
                        key={exam._id}
                        style={[
                          styles.examChip,
                          selectedExamId === exam._id && styles.examChipActive,
                        ]}
                        onPress={() => setSelectedExamId(exam._id)}
                      >
                        <Text
                          style={[
                            styles.examChipText,
                            selectedExamId === exam._id && styles.examChipTextActive,
                          ]}
                        >
                          {exam.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {loadingGrades ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
              ) : grades.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="school-outline" size={64} color="#D1D5DB" />
                  <Text style={styles.emptyText}>Chưa có điểm thi cho kỳ này</Text>
                </View>
              ) : (
                grades.map((grade) => (
                  <View key={grade._id} style={styles.gradeCard}>
                    <View style={styles.gradeInfo}>
                      <Text style={styles.gradeSubject}>
                        {grade.subject?.name || 'Môn học'}
                      </Text>
                      {grade.teacher && (
                        <View style={styles.teacherRow}>
                          <Ionicons name="person-outline" size={12} color={COLORS.textLight} />
                          <Text style={styles.gradeTeacher}>{grade.teacher.name}</Text>
                        </View>
                      )}
                    </View>
                    
                    <View style={[
                      styles.scoreCircle,
                      { borderColor: getScoreColor(grade.gradeValue) }
                    ]}>
                      <Text style={[
                        styles.scoreText,
                        { color: getScoreColor(grade.gradeValue) }
                      ]}>
                        {grade.gradeValue !== undefined && grade.gradeValue !== null
                          ? grade.gradeValue.toFixed(1)
                          : '--'}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.textLight,
  },

  // Header Styles
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },

  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // Tab Switcher
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  tabTextActive: {
    color: '#fff',
  },

  // Schedule View Styles
  dateGroup: {
    marginBottom: 20,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginLeft: 4,
  },
  dateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 8,
    textTransform: 'capitalize',
  },
  examCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  examTimeBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    minWidth: 70,
  },
  examTimeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  examDurationText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  examInfo: {
    flex: 1,
    paddingLeft: 16,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  examName: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 6,
  },
  roomTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roomText: {
    fontSize: 11,
    color: COLORS.textLight,
    marginLeft: 4,
  },

  // Grades View Styles
  examSelectorContainer: {
    marginBottom: 16,
  },
  examChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  examChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  examChipText: {
    fontSize: 13,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  examChipTextActive: {
    color: '#fff',
  },
  gradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  gradeInfo: {
    flex: 1,
  },
  gradeSubject: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gradeTeacher: {
    fontSize: 12,
    color: COLORS.textLight,
    marginLeft: 4,
  },
  scoreCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Common Styles
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
    padding: 20,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
});