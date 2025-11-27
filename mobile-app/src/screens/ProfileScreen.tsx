/**
 * Profile Screen
 */

import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {useAuth} from '../context/AuthContext';

const ProfileScreen: React.FC = () => {
  const {user, logout} = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hồ sơ</Text>
      <View style={styles.infoContainer}>
        <Text style={styles.label}>Tên:</Text>
        <Text style={styles.value}>{user?.name}</Text>
      </View>
      {user?.email && (
        <View style={styles.infoContainer}>
          <Text style={styles.label}>Email:</Text>
          <Text style={styles.value}>{user.email}</Text>
        </View>
      )}
      {user?.phone && (
        <View style={styles.infoContainer}>
          <Text style={styles.label}>Số điện thoại:</Text>
          <Text style={styles.value}>{user.phone}</Text>
        </View>
      )}
      <View style={styles.infoContainer}>
        <Text style={styles.label}>Vai trò:</Text>
        <Text style={styles.value}>{user?.role}</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </TouchableOpacity>
    </View>
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
    marginBottom: 24,
  },
  infoContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#000000',
  },
  logoutButton: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;

