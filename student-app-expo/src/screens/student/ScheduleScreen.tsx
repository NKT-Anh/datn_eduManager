/**
 * Student Schedule Screen
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
import { studentService } from '../../services/studentService';
import { Schedule } from '../../types';

const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

export default function ScheduleScreen({ navigation }: any) {
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Đang tải thời khóa biểu...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!schedule || !schedule.timetable || schedule.timetable.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Chưa có thời khóa biểu</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Thời khóa biểu</Text>
        <Text style={styles.subtitle}>
          {schedule.classId?.className} - {schedule.year} - Học kỳ {schedule.semester}
        </Text>
      </View>

      {schedule.timetable.map((day, dayIndex) => (
        <TouchableOpacity
          key={dayIndex}
          style={styles.dayCard}
          activeOpacity={0.85}
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
        >
          <Text style={styles.dayTitle}>{day.day}</Text>
          {day.periods && day.periods.length > 0 ? (
            day.periods
              .filter((p) => p.subject)
              .map((period, periodIndex) => (
                <View key={periodIndex} style={styles.periodItem}>
                  <Text style={styles.periodNumber}>Tiết {period.period}</Text>
                  <View style={styles.periodContent}>
                    <Text style={styles.subjectName}>{period.subject}</Text>
                    {period.teacher && (
                      <Text style={styles.teacherName}>GV: {period.teacher}</Text>
                    )}
                  </View>
                </View>
              ))
          ) : (
            <Text style={styles.noPeriods}>Không có tiết học</Text>
          )}
        </TouchableOpacity>
      ))}
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
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  dayCard: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 12,
  },
  periodItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  periodNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    width: 60,
  },
  periodContent: {
    flex: 1,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  teacherName: {
    fontSize: 14,
    color: '#666',
  },
  noPeriods: {
    color: '#999',
    fontStyle: 'italic',
  },
});

