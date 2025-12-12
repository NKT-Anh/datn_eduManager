/**
 * Student Conduct Screen
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

interface ConductRecord {
  _id: string;
  year: string;
  semester: string;
  conduct: string;
  gpa?: number;
  totalAbsent?: number;
  totalLate?: number;
  academicLevel?: string;
}

interface AttendanceStats {
  absent: number;
  late: number;
  excused?: number;
}

export default function ConductScreen() {
  const { user } = useAuth();
  const [conductRecord, setConductRecord] = useState<ConductRecord | null>(null);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSemester, setSelectedSemester] = useState('1');

  useEffect(() => {
    loadConduct();
  }, [selectedSemester]);

  const loadConduct = async () => {
    try {
      setLoading(true);
      const currentYear = new Date().getFullYear();
      const year = `${currentYear}-${currentYear + 1}`;
      const semester = selectedSemester === '1' ? 'HK1' : selectedSemester === '2' ? 'HK2' : 'CN';

      const [conductData, attendanceData] = await Promise.all([
        studentService.getConducts({ year, semester }),
        studentService.getAttendanceStats({ year, semester }),
      ]);

      if (conductData?.success && conductData?.data && conductData.data.length > 0) {
        setConductRecord(conductData.data[0]);
      } else if (Array.isArray(conductData) && conductData.length > 0) {
        setConductRecord(conductData[0]);
      }

      setAttendanceStats(attendanceData?.data || attendanceData || null);
    } catch (err: any) {
      console.error('Error loading conduct:', err);
    } finally {
      setLoading(false);
    }
  };

  const getConductColor = (conduct?: string) => {
    switch (conduct) {
      case 'Tốt':
        return '#34C759';
      case 'Khá':
        return '#007AFF';
      case 'Trung bình':
        return '#FF9500';
      case 'Yếu':
        return '#FF3B30';
      default:
        return '#999';
    }
  };

  const getAcademicLevelColor = (level?: string) => {
    switch (level) {
      case 'Giỏi':
        return '#34C759';
      case 'Khá':
        return '#007AFF';
      case 'Trung bình':
        return '#FF9500';
      case 'Yếu':
        return '#FF3B30';
      default:
        return '#999';
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
        <Text style={styles.title}>Hạnh kiểm</Text>
        
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
      </View>

      {conductRecord ? (
        <View style={styles.content}>
          {/* Conduct Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Hạnh kiểm</Text>
            <View
              style={[
                styles.conductBadge,
                { backgroundColor: getConductColor(conductRecord.conduct) },
              ]}
            >
              <Text style={styles.conductText}>{conductRecord.conduct || 'Chưa có'}</Text>
            </View>
          </View>

          {/* GPA Card */}
          {conductRecord.gpa !== undefined && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Điểm trung bình</Text>
              <Text style={styles.gpaValue}>{conductRecord.gpa.toFixed(2)}</Text>
            </View>
          )}

          {/* Academic Level Card */}
          {conductRecord.academicLevel && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Học lực</Text>
              <View
                style={[
                  styles.levelBadge,
                  { backgroundColor: getAcademicLevelColor(conductRecord.academicLevel) },
                ]}
              >
                <Text style={styles.levelText}>{conductRecord.academicLevel}</Text>
              </View>
            </View>
          )}

          {/* Attendance Stats */}
          {attendanceStats && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Thống kê điểm danh</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{attendanceStats.absent || 0}</Text>
                  <Text style={styles.statLabel}>Vắng</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{attendanceStats.late || 0}</Text>
                  <Text style={styles.statLabel}>Muộn</Text>
                </View>
                {attendanceStats.excused !== undefined && (
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{attendanceStats.excused}</Text>
                    <Text style={styles.statLabel}>Có phép</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Chưa có thông tin hạnh kiểm</Text>
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
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  conductBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  conductText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  gpaValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  levelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  levelText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
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
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

