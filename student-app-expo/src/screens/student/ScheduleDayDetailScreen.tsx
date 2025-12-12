/**
 * Student Schedule Day Detail Screen
 * - Chi tiết lịch học theo 1 ngày (tiết, môn, giáo viên)
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

export default function ScheduleDayDetailScreen({ route, navigation }: any) {
  const day: any = route?.params?.day;
  const meta: any = route?.params?.meta;

  const title = useMemo(() => day?.day || 'Chi tiết lịch học', [day?.day]);
  const subtitle = useMemo(() => {
    const cls = meta?.className || meta?.classId?.className || '';
    const y = meta?.year || '';
    const sem = meta?.semester || '';
    return [cls, y && sem ? `${y} - HK${sem}` : ''].filter(Boolean).join(' • ');
  }, [meta, meta?.className, meta?.year, meta?.semester]);

  const periods = useMemo(() => {
    const arr = Array.isArray(day?.periods) ? day.periods : [];
    return arr
      .filter((p: any) => p?.subject)
      .sort((a: any, b: any) => Number(a.period) - Number(b.period));
  }, [day]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backInline}>
          <Text style={styles.backInlineText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.card}>
        {periods.length === 0 ? (
          <Text style={styles.emptyText}>Không có tiết học</Text>
        ) : (
          periods.map((p: any, idx: number) => (
            <View key={idx} style={styles.item}>
              <View style={styles.left}>
                <Text style={styles.period}>Tiết {p.period}</Text>
              </View>
              <View style={styles.right}>
                <Text style={styles.subject}>{p.subject}</Text>
                {p.teacher ? <Text style={styles.teacher}>GV: {p.teacher}</Text> : null}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#fff', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backInline: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  backInlineText: { fontSize: 18, color: '#333' },
  title: { fontSize: 18, fontWeight: '800', color: '#111' },
  subtitle: { marginTop: 2, fontSize: 12, color: '#777' },
  card: { backgroundColor: '#fff', margin: 12, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  emptyText: { color: '#999', fontStyle: 'italic' },
  item: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  left: { width: 70 },
  period: { fontSize: 14, fontWeight: '800', color: '#666' },
  right: { flex: 1 },
  subject: { fontSize: 16, fontWeight: '800', color: '#111' },
  teacher: { marginTop: 4, fontSize: 13, color: '#666' },
});


