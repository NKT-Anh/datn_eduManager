/**
 * Student Notifications Screen - Modern UI
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  RefreshControl,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { studentService } from '../../services/studentService';
import { Notification } from '../../types';

const { width } = Dimensions.get('window');

// Màu sắc
const COLORS = {
  primary: '#2563EB',
  background: '#F3F4F6',
  card: '#FFFFFF',
  text: '#1F2937',
  textSecondary: '#6B7280',
  unread: '#EBF5FF', // Nền nhạt cho tin chưa đọc
  border: '#E5E7EB',
};

export default function NotificationsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      if (!refreshing) setLoading(true);
      const data = await studentService.getNotifications();
      // Sắp xếp: Mới nhất lên đầu
      const sortedData = (Array.isArray(data) ? data : []).sort(
        (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setNotifications(sortedData);
    } catch (err: any) {
      setError(err.message || 'Không thể tải thông báo');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const openDetail = (notificationId: string) => {
    navigation.navigate('NotificationDetail', { id: notificationId });
    // Optimistic update: Đánh dấu đã đọc ngay lập tức trên UI
    setNotifications(prev => 
      prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
    );
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + 
           date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Đang tải thông báo...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* --- HEADER CỐ ĐỊNH (KHÔNG BACK) --- */}
      <View style={[styles.header, { paddingTop: insets.top + 10, height: 80 + insets.top }]}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Thông báo</Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadNotifications} style={styles.retryButton}>
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="notifications-off-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>Bạn không có thông báo nào</Text>
          </View>
        ) : (
          notifications.map((item) => (
            <TouchableOpacity
              key={item._id}
              style={[
                styles.card,
                !item.isRead && styles.cardUnread // Style riêng cho tin chưa đọc
              ]}
              activeOpacity={0.7}
              onPress={() => openDetail(item._id)}
            >
              {/* Icon Status */}
              <View style={[
                styles.iconBox, 
                { backgroundColor: item.isRead ? '#F3F4F6' : '#EFF6FF' }
              ]}>
                <Ionicons 
                  name={item.isRead ? "mail-open-outline" : "mail"} 
                  size={24} 
                  color={item.isRead ? COLORS.textSecondary : COLORS.primary} 
                />
              </View>

              {/* Content */}
              <View style={styles.cardContent}>
                <View style={styles.cardTopRow}>
                  <Text 
                    style={[
                      styles.cardTitle, 
                      !item.isRead && styles.cardTitleUnread
                    ]} 
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  {!item.isRead && <View style={styles.unreadDot} />}
                </View>
                
                <Text style={styles.cardMessage} numberOfLines={2}>
                  {item.message}
                </Text>
                
                <View style={styles.cardFooter}>
                  <Ionicons name="time-outline" size={12} color={COLORS.textSecondary} style={{marginRight: 4}} />
                  <Text style={styles.cardTime}>{formatTime(item.createdAt)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
  },
  errorText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },

  scrollContent: {
    padding: 16,
    paddingTop: 20,
  },

  // Card Styles
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardUnread: {
    backgroundColor: '#fff',
    borderColor: COLORS.primary, // Viền xanh cho tin chưa đọc
    shadowOpacity: 0.1,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  cardTitleUnread: {
    fontWeight: '800', // Đậm hơn
    color: COLORS.primary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 6,
  },
  cardMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
});