/**
 * Student Schedule Screen
 */

import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

const StudentScheduleScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lịch học</Text>
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

export default StudentScheduleScreen;

