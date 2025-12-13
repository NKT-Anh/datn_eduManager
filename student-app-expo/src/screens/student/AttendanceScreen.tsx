/**
 * Student Attendance Screen - Modern UI
 */

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

const { width } = Dimensions.get('window');

// Màu sắc
const COLORS = {
  primary: '#2563EB',
  background: '#F3F4F6',
  cardBg: '#FFFFFF',
  text: '#1F2937',
  textSecondary: '#6B7280',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  border: '#E5E7EB',
};

interface AttendanceRecord {
  _id: string;
  date: string;
  status: 'present' | 'absent' | 'excused' | 'late';
  subjectId?: {
    _id: string;
    name: string;
  };
  notes?: string;
}

interface AttendanceStats {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  rate: number;
}

export default function AttendanceScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSemester, setSelectedSemester] = useState('1');
  const [viewMode, setViewMode] = useState<'stats' | 'list'>('stats');

  useEffect(() => {
    loadAttendance();
  }, [selectedSemester]);

  const loadAttendance = async () => {
    try {
      setLoading(true);
      const currentYear = new Date().getFullYear();
      // Logic năm học có thể tùy chỉnh
      const year = `${currentYear}-${currentYear + 1}`; 
      
      const [recordsData, statsData] = await Promise.all([
        studentService.getAttendanceRecords({ year, semester: selectedSemester }),
        studentService.getAttendanceStats({ year, semester: selectedSemester }),
      ]);

      setRecords(Array.isArray(recordsData) ? recordsData : []);
      setStats(statsData?.data || statsData || null);
    } catch (err: any) {
      console.error('Error loading attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return COLORS.success;
      case 'absent': return COLORS.danger;
      case 'late': return COLORS.warning;
      case 'excused': return COLORS.info;
      default: return COLORS.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return 'checkmark-circle';
      case 'absent': return 'close-circle';
      case 'late': return 'time';
      case 'excused': return 'document-text';
      default: return 'help-circle';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'present': return 'Có mặt';
      case 'absent': return 'Vắng';
      case 'late': return 'Đi muộn';
      case 'excused': return 'Có phép';
      default: return 'Không xác định';
    }
  };

  if (loading && !stats) {
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
        <Text style={styles.headerTitle}>Điểm danh</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Semester Selector */}
        <View style={styles.semesterContainer}>
          <TouchableOpacity
            style={[styles.semesterTab, selectedSemester === '1' && styles.semesterTabActive]}
            onPress={() => setSelectedSemester('1')}
          >
            <Text style={[styles.semesterText, selectedSemester === '1' && styles.semesterTextActive]}>
              Học kỳ 1
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.semesterTab, selectedSemester === '2' && styles.semesterTabActive]}
            onPress={() => setSelectedSemester('2')}
          >
            <Text style={[styles.semesterText, selectedSemester === '2' && styles.semesterTextActive]}>
              Học kỳ 2
            </Text>
          </TouchableOpacity>
        </View>

        {/* View Mode Toggle */}
        <View style={styles.viewModeContainer}>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'stats' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('stats')}
          >
            <Ionicons 
              name="pie-chart" 
              size={16} 
              color={viewMode === 'stats' ? '#fff' : COLORS.textSecondary} 
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.viewModeText, viewMode === 'stats' && styles.viewModeTextActive]}>
              Thống kê
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons 
              name="list" 
              size={16} 
              color={viewMode === 'list' ? '#fff' : COLORS.textSecondary} 
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.viewModeText, viewMode === 'list' && styles.viewModeTextActive]}>
              Lịch sử
            </Text>
          </TouchableOpacity>
        </View>

        {viewMode === 'stats' && stats && (
          <View style={styles.statsWrapper}>
            {/* Main Rate Card */}
            <View style={styles.rateCard}>
              <View>
                <Text style={styles.rateLabel}>Tỷ lệ chuyên cần</Text>
                <Text style={styles.rateSub}>Tổng số buổi: {stats.total}</Text>
              </View>
              <View style={styles.circularProgress}>
                <Text style={styles.rateValue}>
                  {stats.rate ? `${(stats.rate * 100).toFixed(0)}%` : '0%'}
                </Text>
              </View>
            </View>

            {/* Grid Stats */}
            <View style={styles.gridStats}>
              <View style={[styles.statBox, { borderColor: COLORS.success }]}>
                <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                <Text style={styles.statBoxValue}>{stats.present || 0}</Text>
                <Text style={styles.statBoxLabel}>Có mặt</Text>
              </View>
              
              <View style={[styles.statBox, { borderColor: COLORS.danger }]}>
                <Ionicons name="close-circle" size={24} color={COLORS.danger} />
                <Text style={styles.statBoxValue}>{stats.absent || 0}</Text>
                <Text style={styles.statBoxLabel}>Vắng</Text>
              </View>

              <View style={[styles.statBox, { borderColor: COLORS.warning }]}>
                <Ionicons name="time" size={24} color={COLORS.warning} />
                <Text style={styles.statBoxValue}>{stats.late || 0}</Text>
                <Text style={styles.statBoxLabel}>Muộn</Text>
              </View>

              <View style={[styles.statBox, { borderColor: COLORS.info }]}>
                <Ionicons name="document-text" size={24} color={COLORS.info} />
                <Text style={styles.statBoxValue}>{stats.excused || 0}</Text>
                <Text style={styles.statBoxLabel}>Có phép</Text>
              </View>
            </View>
          </View>
        )}

        {viewMode === 'list' && (
          <View style={styles.listWrapper}>
            {records.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>Chưa có dữ liệu điểm danh</Text>
              </View>
            ) : (
              records.map((record, index) => (
                <View key={record._id || index} style={styles.recordRow}>
                  {/* Left: Date */}
                  <View style={styles.dateColumn}>
                    <Text style={styles.dateDay}>
                      {new Date(record.date).getDate()}
                    </Text>
                    <Text style={styles.dateMonth}>
                      Th{new Date(record.date).getMonth() + 1}
                    </Text>
                  </View>

                  {/* Middle: Info */}
                  <TouchableOpacity 
                    style={styles.recordCard}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('AttendanceDetail', { record })}
                  >
                    <View style={styles.cardTop}>
                      <Text style={styles.subjectName}>
                        {record.subjectId?.name || 'Môn học'}
                      </Text>
                      <Ionicons 
                        name={getStatusIcon(record.status)} 
                        size={20} 
                        color={getStatusColor(record.status)} 
                      />
                    </View>
                    
                    <View style={styles.cardBottom}>
                      <View style={[
                        styles.statusTag, 
                        { backgroundColor: getStatusColor(record.status) + '20' }
                      ]}>
                        <Text style={[
                          styles.statusTagText, 
                          { color: getStatusColor(record.status) }
                        ]}>
                          {getStatusText(record.status)}
                        </Text>
                      </View>
                      
                      {record.notes && (
                        <Text style={styles.noteText} numberOfLines={1}>
                          • {record.notes}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
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
    color: COLORS.textSecondary,
  },

  // Header
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

  scrollContent: {
    padding: 16,
  },

  // Semester Selector
  semesterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  semesterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  semesterTabActive: {
    backgroundColor: COLORS.primary,
  },
  semesterText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  semesterTextActive: {
    color: '#fff',
  },

  // View Mode
  viewModeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 12,
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  viewModeButtonActive: {
    backgroundColor: COLORS.text, // Dark bg for active
    borderColor: COLORS.text,
  },
  viewModeText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  viewModeTextActive: {
    color: '#fff',
  },

  // Stats View
  statsWrapper: {
    gap: 16,
  },
  rateCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  rateLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  rateSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  circularProgress: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  rateValue: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  
  gridStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statBox: {
    flex: 1, // 2 columns
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderLeftWidth: 4, // Colored border left
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statBoxValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginVertical: 4,
  },
  statBoxLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  // List View
  listWrapper: {
    gap: 12,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateColumn: {
    width: 50,
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
  },
  dateDay: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  dateMonth: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  recordCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  noteText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    flex: 1,
  },

  emptyState: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
});