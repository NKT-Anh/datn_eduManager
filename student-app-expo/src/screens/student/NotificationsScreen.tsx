/**
 * Student Notifications Screen
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
import { Notification } from '../../types';

export default function NotificationsScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await studentService.getNotifications();
      setNotifications(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải thông báo');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (notificationId: string) => {
    navigation.navigate('NotificationDetail', { id: notificationId });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Đang tải thông báo...</Text>
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

  if (notifications.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Chưa có thông báo</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Thông báo</Text>
      </View>

      {notifications.map((notification) => (
        <TouchableOpacity
          key={notification._id}
          style={[
            styles.notificationCard,
            !notification.isRead && styles.unreadCard,
          ]}
          onPress={() => openDetail(notification._id)}
        >
          {!notification.isRead && <View style={styles.unreadDot} />}
          <Text style={styles.notificationTitle}>{notification.title}</Text>
          <Text style={styles.notificationMessage}>
            {notification.message}
          </Text>
          <Text style={styles.notificationDate}>
            {new Date(notification.createdAt).toLocaleString('vi-VN')}
          </Text>
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
  },
  notificationCard: {
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
    position: 'relative',
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  unreadDot: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  notificationDate: {
    fontSize: 12,
    color: '#999',
  },
});

