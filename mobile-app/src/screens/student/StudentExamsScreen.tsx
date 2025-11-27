/**
 * Student Exams Screen
 */

import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
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
      <Text style={styles.title}>Lịch thi</Text>

      <FlatList
        data={exams}
        renderItem={renderExamItem}
        keyExtractor={item => item._id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Chưa có kỳ thi nào</Text>
        }
      />

      {selectedExamId && (
        <View style={styles.schedulesContainer}>
          <Text style={styles.schedulesTitle}>Lịch thi chi tiết</Text>
          {schedulesLoading ? (
            <ActivityIndicator />
          ) : (
            <FlatList
              data={schedules}
              renderItem={renderScheduleItem}
              keyExtractor={item => item._id}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Chưa có lịch thi</Text>
              }
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
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 8,
    color: '#666666',
  },
  examItem: {
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDDDDD',
  },
  examItemSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  examName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  examInfo: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  examType: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '500',
  },
  schedulesContainer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#DDDDDD',
  },
  schedulesTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  scheduleItem: {
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#F9F9F9',
    borderRadius: 6,
  },
  scheduleSubject: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  scheduleDate: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  scheduleRoom: {
    fontSize: 12,
    color: '#2196F3',
    marginTop: 4,
  },
  scheduleSeat: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999999',
    marginTop: 24,
  },
});

export default StudentExamsScreen;

