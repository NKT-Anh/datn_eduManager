/**
 * Exam Room Detail Screen
 * - Hiển thị phòng thi, số ghế, giám thị (nếu backend trả)
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { studentService } from '../../services/studentService';

export default function ExamRoomDetailScreen({ route, navigation }: any) {
  const schedule: any = route?.params?.schedule;
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<any>(null);

  const title = useMemo(() => schedule?.subject?.name || 'Phòng thi', [schedule?.subject?.name]);

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
        Alert.alert('Lỗi', err.message || 'Không thể tải phòng thi');
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backInline}>
          <Text style={styles.backInlineText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {schedule?.date ? new Date(schedule.date).toLocaleDateString('vi-VN') : ''}{' '}
            {schedule?.startTime ? `• ${schedule.startTime}-${schedule.endTime}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Thông tin phòng thi</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Phòng</Text>
          <Text style={styles.value}>{room?.roomCode || room?.room?.roomCode || room?.room?.roomName || '-'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Nhóm phòng</Text>
          <Text style={styles.value}>{room?.fixedRoomCode || room?.fixedRoom?.code || '-'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Số ghế</Text>
          <Text style={styles.valueStrong}>{room?.seatNumber ?? schedule?.seatNumber ?? '-'}</Text>
        </View>
      </View>

      {Array.isArray(room?.invigilators) && room.invigilators.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Giám thị</Text>
          {room.invigilators.map((it: any, idx: number) => (
            <View key={idx} style={styles.invItem}>
              <Text style={styles.invName}>{it?.teacher?.name || 'Giám thị'}</Text>
              <Text style={styles.invMeta}>{it?.role || ''}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, color: '#666' },
  header: { backgroundColor: '#fff', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backInline: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  backInlineText: { fontSize: 18, color: '#333' },
  title: { fontSize: 18, fontWeight: '800', color: '#111' },
  subtitle: { marginTop: 2, fontSize: 12, color: '#777' },
  card: { backgroundColor: '#fff', margin: 12, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#333', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  label: { fontSize: 14, color: '#666' },
  value: { fontSize: 14, fontWeight: '700', color: '#333' },
  valueStrong: { fontSize: 16, fontWeight: '900', color: '#007AFF' },
  invItem: { paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  invName: { fontSize: 14, fontWeight: '800', color: '#333' },
  invMeta: { marginTop: 4, fontSize: 12, color: '#777' },
});


