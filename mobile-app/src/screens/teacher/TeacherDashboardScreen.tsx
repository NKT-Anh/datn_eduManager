/**
 * Teacher Dashboard Screen
 */

import React from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {useAuth} from '../../context/AuthContext';

const TeacherDashboardScreen: React.FC = () => {
  const {user} = useAuth();

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Trang chủ</Text>
      <Text style={styles.greeting}>Xin chào, {user?.name}!</Text>
      {/* Add dashboard content here */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  greeting: {
    fontSize: 18,
    marginBottom: 24,
  },
});

export default TeacherDashboardScreen;

