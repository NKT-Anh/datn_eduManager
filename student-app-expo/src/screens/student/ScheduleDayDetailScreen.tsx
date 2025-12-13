/**
 * Student Schedule Day Detail Screen - Modern UI
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// Màu sắc chủ đạo
const COLORS = {
  primary: '#2563EB',
  background: '#F3F4F6',
  cardBg: '#FFFFFF',
  text: '#1F2937',
  textSecondary: '#6B7280',
  line: '#E5E7EB',
  accent: '#F59E0B',
};

// Hàm chuyển đổi thứ sang tiếng Việt
const convertDayToVietnamese = (dayName: string) => {
  const map: Record<string, string> = {
    'Monday': 'Thứ 2', 'Tuesday': 'Thứ 3', 'Wednesday': 'Thứ 4',
    'Thursday': 'Thứ 5', 'Friday': 'Thứ 6', 'Saturday': 'Thứ 7', 'Sunday': 'Chủ Nhật',
    'Mon': 'Thứ 2', 'Tue': 'Thứ 3', 'Wed': 'Thứ 4', 'Thu': 'Thứ 5', 'Fri': 'Thứ 6', 'Sat': 'Thứ 7', 'Sun': 'CN',
  };
  return map[dayName] || dayName;
};

export default function ScheduleDayDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const day: any = route?.params?.day;
  const meta: any = route?.params?.meta;

  const title = useMemo(() => convertDayToVietnamese(day?.day || ''), [day?.day]);
  
  const subtitle = useMemo(() => {
    const cls = meta?.className || meta?.classId?.className || 'Lớp học';
    const sem = meta?.semester ? `HK${meta.semester}` : '';
    return `${cls} ${sem ? `• ${sem}` : ''}`;
  }, [meta]);

  const periods = useMemo(() => {
    const arr = Array.isArray(day?.periods) ? day.periods : [];
    return arr
      .filter((p: any) => p?.subject)
      .sort((a: any, b: any) => Number(a.period) - Number(b.period));
  }, [day]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* --- HEADER (CÓ NÚT BACK) --- */}
      <View style={[styles.header, { paddingTop: insets.top + 10, height: 80 + insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        </View>
        
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Date Info Card (Optional context) */}
        <View style={styles.dateCard}>
          <Ionicons name="calendar" size={20} color={COLORS.primary} />
          <Text style={styles.dateCardText}>
            Danh sách tiết học trong ngày
          </Text>
        </View>

        {periods.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cafe-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>Ngày nghỉ / Không có tiết học</Text>
          </View>
        ) : (
          <View style={styles.timelineContainer}>
            {periods.map((p: any, idx: number) => {
              const isLast = idx === periods.length - 1;
              return (
                <View key={idx} style={styles.timelineItem}>
                  {/* Cột trái: Số tiết + Đường kẻ */}
                  <View style={styles.leftColumn}>
                    <View style={styles.periodBadge}>
                      <Text style={styles.periodText}>{p.period}</Text>
                    </View>
                    {!isLast && <View style={styles.timelineLine} />}
                  </View>

                  {/* Cột phải: Card thông tin */}
                  <View style={styles.cardContainer}>
                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.subjectName}>{p.subject}</Text>
                      </View>
                      
                      <View style={styles.cardDivider} />
                      
                      <View style={styles.cardRow}>
                        <Ionicons name="person-outline" size={16} color={COLORS.textSecondary} />
                        <Text style={styles.cardDetail}>
                          GV: <Text style={{fontWeight: '600', color: COLORS.text}}>{p.teacher || '---'}</Text>
                        </Text>
                      </View>

                      {/* Nếu có thông tin phòng học thì hiển thị (giả sử p.room) */}
                      {p.room && (
                        <View style={[styles.cardRow, { marginTop: 4 }]}>
                          <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
                          <Text style={styles.cardDetail}>Phòng: {p.room}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
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
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  headerInfo: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },

  // Content Styles
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },

  // Helper Card
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE', // Xanh nhạt
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  dateCardText: {
    marginLeft: 8,
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
  },

  // Timeline Styles
  timelineContainer: {
    //
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 0, 
  },
  leftColumn: {
    alignItems: 'center',
    width: 50,
    marginRight: 10,
  },
  periodBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  periodText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  
  // Detail Card Styles
  cardContainer: {
    flex: 1,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 8,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 8,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardDetail: {
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});