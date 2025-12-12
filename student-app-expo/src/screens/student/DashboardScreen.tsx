/**
 * Student Dashboard Screen
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { studentService } from '../../services/studentService';

export default function DashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadUnreadCount();
  }, []);

  const loadUnreadCount = async () => {
    try {
      const count = await studentService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    {
      title: 'Thời khóa biểu',
      icon: '📅',
      onPress: () => navigation.navigate('Schedule'),
    },
    {
      title: 'Điểm số',
      icon: '📊',
      onPress: () => navigation.navigate('Grades'),
    },
    {
      title: 'Lịch thi',
      icon: '📝',
      onPress: () => navigation.navigate('Exams'),
    },
    {
      title: 'Thông báo',
      icon: '🔔',
      badge: unreadCount > 0 ? unreadCount : undefined,
      onPress: () => navigation.navigate('Notifications'),
    },
    {
      title: 'Hồ sơ',
      icon: '👤',
      onPress: () => navigation.navigate('Profile'),
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Xin chào 👋</Text>
        <Text style={styles.name}>{user?.name || 'Học sinh'}</Text>
        {user?.email && (
          <Text style={styles.email}>{user.email}</Text>
        )}
      </View>

      <View style={styles.menuGrid}>
        {menuItems.map((item, index) => (
          <View key={index} style={styles.menuItem}>
            <TouchableOpacity style={styles.menuCard} onPress={item.onPress}>
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuTitle}>{item.title}</Text>
              {item.badge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </View>
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
    padding: 20,
    marginBottom: 20,
  },
  greeting: {
    fontSize: 18,
    color: '#666',
    marginBottom: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#999',
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
  },
  menuItem: {
    width: '50%',
    padding: 10,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  menuIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

