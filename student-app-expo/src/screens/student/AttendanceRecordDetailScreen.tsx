/**
 * Attendance Record Detail Screen
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

export default function AttendanceRecordDetailScreen({ route, navigation }: any) {
  const record: any = route?.params?.record;

  const title = useMemo(() => {
    if (!record?.date) return 'Chi tiết điểm danh';
    try {
      return new Date(record.date).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return 'Chi tiết điểm danh';
    }
  }, [record?.date]);

  const statusLabel = useMemo(() => {
    const s = record?.status;
    if (s === 'present') return 'Có mặt';
    if (s === 'absent') return 'Vắng';
    if (s === 'late') return 'Muộn';
    if (s === 'excused') return 'Có phép';
    return s || '-';
  }, [record?.status]);

  const statusColor = useMemo(() => {
    const s = record?.status;
    if (s === 'present') return '#34C759';
    if (s === 'absent') return '#FF3B30';
    if (s === 'late') return '#FF9500';
    if (s === 'excused') return '#007AFF';
    return '#999';
  }, [record?.status]);

  if (!record) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Không có dữ liệu</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backInline}>
          <Text style={styles.backInlineText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Trạng thái</Text>
        <View style={[styles.badge, { backgroundColor: statusColor }]}>
          <Text style={styles.badgeText}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Chi tiết</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Môn</Text>
          <Text style={styles.value}>{record?.subjectId?.name || '-'}</Text>
        </View>
        {record?.period ? (
          <View style={styles.row}>
            <Text style={styles.label}>Tiết</Text>
            <Text style={styles.value}>{String(record.period)}</Text>
          </View>
        ) : null}
        {record?.session ? (
          <View style={styles.row}>
            <Text style={styles.label}>Buổi</Text>
            <Text style={styles.value}>{record.session === 'morning' ? 'Sáng' : 'Chiều'}</Text>
          </View>
        ) : null}
        {record?.notes ? (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.label}>Ghi chú</Text>
            <Text style={styles.note}>{record.notes}</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 16, color: '#333', marginBottom: 12 },
  backBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#007AFF' },
  backText: { color: '#fff', fontWeight: '700' },
  header: { backgroundColor: '#fff', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backInline: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  backInlineText: { fontSize: 18, color: '#333' },
  title: { fontSize: 16, fontWeight: '800', color: '#111', flex: 1 },
  card: { backgroundColor: '#fff', margin: 12, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#333', marginBottom: 12 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  badgeText: { color: '#fff', fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  label: { fontSize: 14, color: '#666' },
  value: { fontSize: 14, fontWeight: '700', color: '#333' },
  note: { marginTop: 6, fontSize: 14, color: '#333', lineHeight: 20 },
});


