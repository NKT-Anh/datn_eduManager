/**
 * Student Attendance Screen
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
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSemester, setSelectedSemester] = useState('1');
  const [viewMode, setViewMode] = useState<'list' | 'stats'>('stats');

  useEffect(() => {
    loadAttendance();
  }, [selectedSemester]);

  const loadAttendance = async () => {
    try {
      setLoading(true);
      const currentYear = new Date().getFullYear();
      const year = `${currentYear}-${currentYear + 1}`;
      
      const [recordsData, statsData] = await Promise.all([
        studentService.getAttendanceRecords({
          year,
          semester: selectedSemester,
        }),
        studentService.getAttendanceStats({
          year,
          semester: selectedSemester,
        }),
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
      case 'present':
        return '#34C759';
      case 'absent':
        return '#FF3B30';
      case 'late':
        return '#FF9500';
      case 'excused':
        return '#007AFF';
      default:
        return '#999';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'present':
        return 'Có mặt';
      case 'absent':
        return 'Vắng';
      case 'late':
        return 'Muộn';
      case 'excused':
        return 'Có phép';
      default:
        return status;
    }
  };

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
        <Text style={styles.title}>Điểm danh</Text>
        
        {/* Semester Selector */}
        <View style={styles.selectorRow}>
          <TouchableOpacity
            style={[styles.selectorButton, selectedSemester === '1' && styles.selectorButtonActive]}
            onPress={() => setSelectedSemester('1')}
          >
            <Text style={[styles.selectorText, selectedSemester === '1' && styles.selectorTextActive]}>
              Học kỳ 1
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.selectorButton, selectedSemester === '2' && styles.selectorButtonActive]}
            onPress={() => setSelectedSemester('2')}
          >
            <Text style={[styles.selectorText, selectedSemester === '2' && styles.selectorTextActive]}>
              Học kỳ 2
            </Text>
          </TouchableOpacity>
        </View>

        {/* View Mode Toggle */}
        <View style={styles.viewModeRow}>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'stats' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('stats')}
          >
            <Text style={[styles.viewModeText, viewMode === 'stats' && styles.viewModeTextActive]}>
              Thống kê
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('list')}
          >
            <Text style={[styles.viewModeText, viewMode === 'list' && styles.viewModeTextActive]}>
              Lịch sử
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'stats' && stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>Tỷ lệ có mặt</Text>
            <Text style={styles.statsValue}>
              {stats.rate ? `${(stats.rate * 100).toFixed(1)}%` : 'N/A'}
            </Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={[styles.statItem, { backgroundColor: '#34C75920' }]}>
              <Text style={styles.statValue}>{stats.present || 0}</Text>
              <Text style={styles.statLabel}>Có mặt</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: '#FF3B3020' }]}>
              <Text style={styles.statValue}>{stats.absent || 0}</Text>
              <Text style={styles.statLabel}>Vắng</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: '#FF950020' }]}>
              <Text style={styles.statValue}>{stats.late || 0}</Text>
              <Text style={styles.statLabel}>Muộn</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: '#007AFF20' }]}>
              <Text style={styles.statValue}>{stats.excused || 0}</Text>
              <Text style={styles.statLabel}>Có phép</Text>
            </View>
          </View>
        </View>
      )}

      {viewMode === 'list' && (
        <View style={styles.listContainer}>
          {records.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Chưa có dữ liệu điểm danh</Text>
            </View>
          ) : (
            records.map((record) => (
              <TouchableOpacity
                key={record._id}
                style={styles.recordCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('AttendanceDetail', { record })}
              >
                <View style={styles.recordHeader}>
                  <Text style={styles.recordDate}>
                    {new Date(record.date).toLocaleDateString('vi-VN', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(record.status) },
                    ]}
                  >
                    <Text style={styles.statusText}>{getStatusText(record.status)}</Text>
                  </View>
                </View>
                {record.subjectId && (
                  <Text style={styles.recordSubject}>Môn: {record.subjectId.name}</Text>
                )}
                {record.notes && (
                  <Text style={styles.recordNotes}>Ghi chú: {record.notes}</Text>
                )}
              </TouchableOpacity>
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
  header: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  selectorRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  selectorButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  selectorButtonActive: {
    backgroundColor: '#007AFF',
  },
  selectorText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  selectorTextActive: {
    color: '#fff',
  },
  viewModeRow: {
    flexDirection: 'row',
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
  statsContainer: {
    padding: 16,
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statsValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  recordCard: {
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
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  recordSubject: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  recordNotes: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
});

