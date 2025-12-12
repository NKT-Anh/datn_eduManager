/**
 * Student Profile Screen
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { studentService } from '../../services/studentService';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [student, setStudent] = React.useState<any>(null);
  const [loadingStudent, setLoadingStudent] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoadingStudent(true);
        const res = await studentService.getMyStudentProfile();
        if (mounted) setStudent(res);
      } catch {
        // fallback: try internal ensureStudent via schedule call later
        if (mounted) setStudent(null);
      } finally {
        if (mounted) setLoadingStudent(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0).toUpperCase() || 'H'}
          </Text>
        </View>
        <Text style={styles.name}>{user?.name || 'Học sinh'}</Text>
        {user?.email && (
          <Text style={styles.email}>{user.email}</Text>
        )}
        {user?.phone && (
          <Text style={styles.phone}>{user.phone}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Thông tin tài khoản</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Mã số học sinh:</Text>
          <Text style={styles.infoValue}>
            {(student?.studentCode || user?.studentId) ? String(student?.studentCode || user?.studentId) : 'Chưa có'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Lớp:</Text>
          <Text style={styles.infoValue}>
            {student?.classId?.className || (typeof student?.classId === 'string' ? student.classId : 'Chưa có')}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Khối:</Text>
          <Text style={styles.infoValue}>
            {student?.classId?.grade || student?.grade || 'Chưa có'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Vai trò:</Text>
          <Text style={styles.infoValue}>Học sinh</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Đăng xuất</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  phone: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

