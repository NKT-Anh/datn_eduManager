/**
 * Exam Room Detail Screen - Modern UI
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { studentService } from '../../services/studentService';

const { width } = Dimensions.get('window');

// Màu sắc
const COLORS = {
  primary: '#2563EB',
  background: '#F3F4F6',
  card: '#FFFFFF',
  text: '#1F2937',
  textSecondary: '#6B7280',
  success: '#10B981',
  warning: '#F59E0B',
  border: '#E5E7EB',
};

export default function ExamRoomDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const schedule: any = route?.params?.schedule;
  
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<any>(null);

  const subjectName = useMemo(() => schedule?.subject?.name || 'Môn thi', [schedule]);
  
  // Format Date & Time
  const dateTimeStr = useMemo(() => {
    if (!schedule?.date) return '';
    const date = new Date(schedule.date).toLocaleDateString('vi-VN', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const time = schedule?.startTime ? `${schedule.startTime} - ${schedule.endTime}` : '';
    return { date, time };
  }, [schedule]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const scheduleId = schedule?._id;
      if (!scheduleId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await studentService.getExamRoom(String(scheduleId));
        if (mounted) setRoom(data);
      } catch (err: any) {
        // Có thể không tìm thấy phòng (chưa xếp) -> không crash app
        if (mounted) setRoom(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [schedule?._id]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Đang tải thông tin phòng thi...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* --- HEADER --- */}
      <View style={[styles.header, { paddingTop: insets.top + 10, height: 80 + insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết phòng thi</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* --- SUBJECT CARD --- */}
        <View style={styles.card}>
          <View style={styles.subjectHeader}>
            <View style={styles.iconBox}>
              <Ionicons name="book" size={24} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subjectTitle}>{subjectName}</Text>
              <Text style={styles.examName}>
                {schedule?.exam?.name || 'Kỳ thi'}
              </Text>
            </View>
          </View>
          
          <View style={styles.divider} />

          <View style={styles.timeInfo}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.infoText}>{dateTimeStr.date}</Text>
            </View>
            <View style={[styles.infoRow, { marginTop: 6 }]}>
              <Ionicons name="time-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.infoText}>{dateTimeStr.time} ({schedule?.duration} phút)</Text>
            </View>
          </View>
        </View>

        {/* --- ROOM & SEAT INFO --- */}
        <View style={styles.gridContainer}>
          {/* Room Info */}
          <View style={[styles.gridCard, { flex: 1.2, marginRight: 12 }]}>
            <Text style={styles.gridLabel}>Phòng thi</Text>
            <View style={styles.roomBadge}>
              <Ionicons name="location" size={20} color={COLORS.primary} />
              <Text style={styles.roomCode}>
                {room?.roomCode || room?.room?.roomCode || room?.room?.roomName || '--'}
              </Text>
            </View>
            <Text style={styles.gridSubLabel}>
              Khu vực: {room?.fixedRoomCode || room?.fixedRoom?.code || 'Chính'}
            </Text>
          </View>

          {/* Seat Info (Highlighted) */}
          <View style={[styles.gridCard, styles.seatCard]}>
            <Text style={[styles.gridLabel, { color: '#fff', opacity: 0.9 }]}>Số ghế</Text>
            <Text style={styles.seatNumber}>
              {room?.seatNumber ?? schedule?.seatNumber ?? '--'}
            </Text>
          </View>
        </View>

        {/* --- INVIGILATORS --- */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="people-circle-outline" size={22} color={COLORS.text} />
            <Text style={styles.sectionTitle}>Cán bộ coi thi</Text>
          </View>
          
          {Array.isArray(room?.invigilators) && room.invigilators.length > 0 ? (
            room.invigilators.map((it: any, idx: number) => (
              <View key={idx} style={styles.invigilatorRow}>
                <View style={styles.invigilatorAvatar}>
                  <Text style={styles.avatarText}>
                    {it?.teacher?.name?.charAt(0) || 'G'}
                  </Text>
                </View>
                <View>
                  <Text style={styles.invigilatorName}>
                    {it?.teacher?.name || 'Giám thị'}
                  </Text>
                  <Text style={styles.invigilatorRole}>
                    {it?.role || 'Cán bộ coi thi'}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Chưa có thông tin giám thị</Text>
          )}
        </View>
        
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
    marginTop: 12,
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

  // Content
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },

  // Subject Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  subjectTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 2,
  },
  examName: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  timeInfo: {
    //
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.text,
    textTransform: 'capitalize',
  },

  // Grid (Room & Seat)
  gridContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  gridCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  seatCard: {
    flex: 1,
    backgroundColor: COLORS.primary, // Highlight seat with blue
    alignItems: 'center',
  },
  gridLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  roomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  roomCode: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginLeft: 6,
  },
  gridSubLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  seatNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },

  // Invigilators
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginLeft: 8,
  },
  invigilatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  invigilatorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
  },
  invigilatorName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  invigilatorRole: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginLeft: 4,
  },
});