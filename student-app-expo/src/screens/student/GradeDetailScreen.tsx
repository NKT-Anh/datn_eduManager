/**
 * Student Grade Detail Screen
 * - Chi tiết 1 môn: liệt kê các đầu điểm + điểm tổng kết
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

type Grade = any;

const TYPE_LABELS: Record<string, string> = {
  mieng: 'Điểm miệng',
  '15phut': 'Điểm 15 phút',
  '1tiet': 'Điểm 1 tiết',
  hocky: 'Điểm học kỳ',
};

export default function GradeDetailScreen({ route, navigation }: any) {
  const grade: Grade | undefined = route?.params?.grade;

  const title = useMemo(() => grade?.subjectId?.name || 'Chi tiết điểm', [grade?.subjectId?.name]);
  const semesterLabel = useMemo(() => {
    if (!grade) return '';
    const y = grade.year || grade.schoolYear || '';
    const sem = grade.semester || '';
    return y && sem ? `${y} - Học kỳ ${sem}` : '';
  }, [grade]);

  const itemsByType = useMemo(() => {
    const map: Record<string, number[]> = {};
    const gradeItems = grade?.gradeItems || [];
    for (const it of gradeItems) {
      const type = it?.type;
      const value = typeof it?.value === 'number' ? it.value : Number(it?.value);
      if (!type || Number.isNaN(value)) continue;
      if (!map[type]) map[type] = [];
      map[type].push(value);
    }
    return map;
  }, [grade]);

  if (!grade) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Không có dữ liệu điểm</Text>
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
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{semesterLabel}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Tổng kết</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Điểm tổng kết</Text>
          <Text style={styles.valueStrong}>
            {grade?.summary?.final != null ? Number(grade.summary.final).toFixed(2) : '-'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Chi tiết đầu điểm</Text>
        {Object.keys(TYPE_LABELS).map((typeKey) => {
          const list = itemsByType[typeKey] || [];
          return (
            <View key={typeKey} style={styles.block}>
              <Text style={styles.blockTitle}>
                {TYPE_LABELS[typeKey]} ({list.length})
              </Text>
              {list.length === 0 ? (
                <Text style={styles.emptySubText}>Chưa có</Text>
              ) : (
                <View style={styles.chipsRow}>
                  {list.map((v, idx) => (
                    <View key={`${typeKey}-${idx}`} style={styles.chip}>
                      <Text style={styles.chipText}>{Number(v).toString().replace(/\.0$/, '')}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
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
  title: { fontSize: 18, fontWeight: '800', color: '#111' },
  subtitle: { marginTop: 2, fontSize: 12, color: '#777' },
  card: { backgroundColor: '#fff', margin: 12, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#333', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, color: '#666' },
  valueStrong: { fontSize: 18, fontWeight: '900', color: '#007AFF' },
  block: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  blockTitle: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 10 },
  emptySubText: { fontSize: 13, color: '#999' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#EEF2FF' },
  chipText: { fontSize: 14, fontWeight: '800', color: '#3730A3' },
});


