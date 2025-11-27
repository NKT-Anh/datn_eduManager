/**
 * Home Screen
 */

import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useAuth} from '../context/AuthContext';

const HomeScreen: React.FC = () => {
  const {user} = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chào mừng, {user?.name}!</Text>
      <Text style={styles.subtitle}>EduManager Mobile</Text>
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

export default HomeScreen;

