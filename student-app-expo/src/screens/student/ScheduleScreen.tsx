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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { studentService } from '../../services/studentService';
import { Schedule } from '../../types';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#2563EB',
  primaryLight: '#DBEAFE',
  background: '#F3F4F6',
  cardBg: '#FFFFFF',
  text: '#1F2937',
  textSecondary: '#6B7280',
  accent: '#F59E0B',
  line: '#E5E7EB',
};

// --- HÀM CHUYỂN ĐỔI TIẾNG ANH -> TIẾNG VIỆT ---
const convertDayToVietnamese = (dayName: string) => {
  const map: Record<string, string> = {
    'Monday': 'Thứ 2',
    'Tuesday': 'Thứ 3',
    'Wednesday': 'Thứ 4',
    'Thursday': 'Thứ 5',
    'Friday': 'Thứ 6',
    'Saturday': 'Thứ 7',
    'Sunday': 'Chủ Nhật',
    // Phòng hờ trường hợp viết tắt hoặc chữ thường
    'Mon': 'Thứ 2', 'Tue': 'Thứ 3', 'Wed': 'Thứ 4', 'Thu': 'Thứ 5', 'Fri': 'Thứ 6', 'Sat': 'Thứ 7', 'Sun': 'CN',
    'monday': 'Thứ 2', 'tuesday': 'Thứ 3', 'wednesday': 'Thứ 4', 'thursday': 'Thứ 5', 'friday': 'Thứ 6', 'saturday': 'Thứ 7', 'sunday': 'Chủ Nhật',
  };
  // Nếu tìm thấy trong map thì trả về tiếng Việt, không thì trả về nguyên gốc
  return map[dayName] || dayName;
};

export default function ScheduleScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const data = await studentService.getSchedule();
      setSchedule(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải thời khóa biểu');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.accent} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadSchedule}>
          <Text style={styles.retryText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!schedule || !schedule.timetable || schedule.timetable.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="calendar-outline" size={64} color="#D1D5DB" />
        <Text style={styles.emptyText}>Chưa có lịch học nào</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="transparent" 
        translucent={true} 
      />
      
      {/* Header Cố Định */}
      <View style={styles.fixedHeaderSection}>
        <View style={[styles.headerBackground, { height: 160 + insets.top }]} />

        <View style={[styles.headerContent, { paddingTop: insets.top + 20 }]}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.screenTitle}>Thời khóa biểu</Text>
          </View>
          
          <View style={styles.classInfoCard}>
            <View style={styles.classInfoRow}>
              <Ionicons name="business-outline" size={20} color={COLORS.primary} />
              <Text style={styles.className}>{schedule.classId?.className || 'Lớp học'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.semesterInfo}>
              <Text style={styles.semesterText}>
                Năm học: {schedule.year} • HK {schedule.semester}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {schedule.timetable.map((day, dayIndex) => {
          const hasPeriods = day.periods && day.periods.length > 0;
          
          return (
            <View key={dayIndex} style={styles.dayContainer}>
              <View style={styles.dayHeader}>
                <View style={styles.dayBadge}>
                  {/* --- SỬ DỤNG HÀM CHUYỂN ĐỔI Ở ĐÂY --- */}
                  <Text style={styles.dayText}>{convertDayToVietnamese(day.day)}</Text>
                </View>
                <View style={styles.dayLine} />
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() =>
                  navigation.navigate('ScheduleDayDetail', {
                    day,
                    meta: {
                      className: schedule.classId?.className,
                      year: schedule.year,
                      semester: schedule.semester,
                    },
                  })
                }
                style={styles.dayCard}
              >
                {hasPeriods ? (
                  day.periods
                    .filter((p) => p.subject)
                    .map((period, pIndex) => (
                      <View key={pIndex} style={styles.periodRow}>
                        <View style={styles.periodTimeCol}>
                          <View style={styles.periodBadge}>
                            <Text style={styles.periodNumber}>{period.period}</Text>
                          </View>
                          {pIndex < day.periods.length - 1 && <View style={styles.timelineLine} />}
                        </View>

                        <View style={styles.periodInfoCard}>
                          <Text style={styles.subjectName} numberOfLines={1}>
                            {period.subject}
                          </Text>
                          <View style={styles.metaRow}>
                            <View style={styles.metaItem}>
                              <Ionicons name="person-outline" size={14} color={COLORS.textSecondary} />
                              <Text style={styles.metaText} numberOfLines={1}>
                                {period.teacher || 'Chưa cập nhật'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    ))
                ) : (
                  <View style={styles.emptyDay}>
                    <Ionicons name="cafe-outline" size={24} color="#9CA3AF" />
                    <Text style={styles.emptyDayText}>Không có tiết học</Text>
                  </View>
                )}
                
                {hasPeriods && (
                  <View style={styles.cardFooter}>
                    <Text style={styles.detailsLink}>Xem chi tiết</Text>
                    <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
        <View style={{ height: 100 }} />
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
    backgroundColor: COLORS.background,
  },
  
  // Header Styles
  fixedHeaderSection: {
    zIndex: 1,
    backgroundColor: COLORS.background,
    paddingBottom: 10,
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  headerTitleRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  
  // Class Info Box
  classInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  classInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginLeft: 8,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
  },
  semesterInfo: {
    flex: 1.2,
  },
  semesterText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'right',
  },

  // Main Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },

  // Day Section
  dayContainer: {
    marginBottom: 24,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 12,
  },
  dayText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  dayLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },

  // Day Card Content
  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  
  // Period Row
  periodRow: {
    flexDirection: 'row',
    marginBottom: 0,
    minHeight: 70,
  },
  periodTimeCol: {
    alignItems: 'center',
    width: 40,
    marginRight: 12,
  },
  periodBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    zIndex: 1,
  },
  periodNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
  },
  
  periodInfoCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    justifyContent: 'center',
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  metaText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 6,
  },

  // Empty State
  emptyDay: {
    alignItems: 'center',
    paddingVertical: 20,
    opacity: 0.7,
  },
  emptyDayText: {
    marginTop: 8,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  detailsLink: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    marginRight: 2,
  },

  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  errorText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyText: {
    marginTop: 16,
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});