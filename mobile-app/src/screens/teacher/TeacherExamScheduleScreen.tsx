/**
 * Teacher Exam Schedule Screen
 */

import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

const TeacherExamScheduleScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lịch coi thi</Text>
      <Text style={styles.subtitle}>Tính năng đang phát triển...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
});

export default TeacherExamScheduleScreen;

