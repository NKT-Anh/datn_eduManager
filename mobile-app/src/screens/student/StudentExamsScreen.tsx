/**
 * Student Exams Screen
 */

import React, {useEffect, useState} from 'react';
import {View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator} from 'react-native';
import Text from '../../components/ui/Text';
import Card from '../../components/ui/Card';
import {colors, spacing} from '../../theme';
import {useStudentData, useStudentExamSchedules} from '../../hooks';
import {StudentExam} from '../../services/studentApi';

const StudentExamsScreen: React.FC = () => {
  const {exams, loading, fetchExams} = useStudentData();
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const {schedules, loading: schedulesLoading} = useStudentExamSchedules(
    selectedExamId || '',
  );

  useEffect(() => {
    fetchExams();
  }, []);

  const renderExamItem = ({item}: {item: StudentExam}) => (
    <TouchableOpacity
      style={[
        styles.examItem,
        selectedExamId === item._id && styles.examItemSelected,
      ]}
      onPress={() => setSelectedExamId(item._id)}>
      <Text style={styles.examName}>{item.name}</Text>
      <Text style={styles.examInfo}>
        {item.year} - HK{item.semester}
      </Text>
      <Text style={styles.examType}>
        {item.type === 'midterm' ? 'Giữa kỳ' : 'Cuối kỳ'}
      </Text>
    </TouchableOpacity>
  );

  const renderScheduleItem = ({item}: {item: any}) => (
    <View style={styles.scheduleItem}>
      <Text style={styles.scheduleSubject}>{item.subject?.name}</Text>
      <Text style={styles.scheduleDate}>
        {new Date(item.date).toLocaleDateString('vi-VN')} - {item.startTime}
      </Text>
      {item.room?.roomCode && (
        <Text style={styles.scheduleRoom}>Phòng: {item.room.roomCode}</Text>
      )}
      {item.seatNumber && (
        <Text style={styles.scheduleSeat}>Số thứ tự: {item.seatNumber}</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text variant="h1" style={styles.title}>Lịch thi</Text>

      <FlatList
        data={exams}
        renderItem={renderExamItem}
        keyExtractor={item => item._id}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ListEmptyComponent={<Text muted style={styles.emptyText}>Chưa có kỳ thi nào</Text>}
      />

      {selectedExamId && (
        <View style={styles.schedulesContainer}>
          <Text variant="h2" style={styles.schedulesTitle}>Lịch thi chi tiết</Text>
          {schedulesLoading ? (
            <ActivityIndicator />
          ) : (
            <FlatList
              data={schedules}
              renderItem={renderScheduleItem}
              keyExtractor={item => item._id}
              ListEmptyComponent={<Text muted style={styles.emptyText}>Chưa có lịch thi</Text>}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginBottom: spacing.lg,
  },
  loadingText: {
    marginTop: 8,
    color: '#666666',
  },
  examItem: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  examItemSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  examName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  examInfo: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  examType: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  schedulesContainer: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  schedulesTitle: {
    marginBottom: spacing.md,
  },
  scheduleItem: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scheduleSubject: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  scheduleDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  scheduleRoom: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 4,
  },
  scheduleSeat: {
    fontSize: 12,
    color: colors.success,
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.xl,
  },
});

export default StudentExamsScreen;

