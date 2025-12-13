/**
 * Student Notification Detail Screen - Comment Style
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { studentService } from '../../services/studentService';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');

// Màu sắc
const COLORS = {
  primary: '#2563EB',
  background: '#F3F4F6',
  card: '#FFFFFF',
  text: '#1F2937',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  inputBg: '#F9FAFB',
};

export default function NotificationDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const id: string | undefined = route?.params?.id;
  
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Format Date
  const createdAtLabel = useMemo(() => {
    if (!item?.createdAt) return '';
    try {
      const date = new Date(item.createdAt);
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ', ' + 
             date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return String(item.createdAt);
    }
  }, [item?.createdAt]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await studentService.getNotificationById(id);
        if (!mounted) return;
        setItem(data);

        // Mark read
        if (data && data.isRead === false) {
          try {
            await studentService.markAsRead(id);
            if (mounted) setItem((prev: any) => (prev ? { ...prev, isRead: true } : prev));
          } catch {
            // ignore
          }
        }

        // Load replies
        try {
          const r = await studentService.getNotificationReplies(id);
          if (mounted) setReplies(r);
        } catch {
          if (mounted) setReplies([]);
        }
      } catch (err: any) {
        Alert.alert('Lỗi', err.message || 'Không thể tải thông báo');
        if (mounted) setItem(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [id]);

  const onSubmitReply = async () => {
    if (!id) return;
    const content = replyContent.trim();
    if (!content) return;
    try {
      setSubmitting(true);
      await studentService.createNotificationReply(id, content);
      setReplyContent('');
      const r = await studentService.getNotificationReplies(id);
      setReplies(r);
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể gửi phản hồi');
    } finally {
      setSubmitting(false);
    }
  };

  // Render từng dòng phản hồi (Kiểu danh sách cũ nhưng đẹp hơn)
  const renderReplyItem = (r: any) => {
    const time = r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '';
    // Giả sử có trường tên người gửi, nếu không thì hiện 'Người dùng'
    const senderName = r.senderName || r.sender?.name || 'Người dùng'; 

    return (
      <View key={r._id} style={styles.replyItem}>
        <View style={styles.replyHeader}>
          <Text style={styles.replySender}>{senderName}</Text>
          <Text style={styles.replyTime}>{time}</Text>
        </View>
        <Text style={styles.replyContent}>{r.content}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Đang tải nội dung...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.textSecondary} />
        <Text style={styles.emptyText}>Không tìm thấy thông báo</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonCenter}>
          <Text style={styles.backTextCenter}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* --- HEADER --- */}
      <View style={[styles.header, { paddingTop: insets.top + 10, height: 80 + insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết thông báo</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Notification Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <Ionicons name="notifications" size={24} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.metaTime}>{createdAtLabel}</Text>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <Text style={styles.content}>{item.content || item.message || ''}</Text>
        </View>

        {/* Replies Section - Dạng danh sách */}
        <View style={styles.repliesSection}>
          <Text style={styles.sectionTitle}>Phản hồi ({replies.length})</Text>
          
          {replies.length === 0 ? (
            <View style={styles.emptyReplies}>
              <Text style={styles.emptyRepliesText}>Chưa có phản hồi nào.</Text>
            </View>
          ) : (
            replies.map((r) => renderReplyItem(r))
          )}
        </View>
        
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Input Area */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 10 }]}>
        <TextInput
          style={styles.input}
          placeholder="Nhập phản hồi của bạn..."
          value={replyContent}
          onChangeText={setReplyContent}
          multiline
          placeholderTextColor="#9CA3AF"
        />
        <TouchableOpacity
          style={[styles.sendButton, (!replyContent.trim() || submitting) && styles.sendButtonDisabled]}
          onPress={onSubmitReply}
          disabled={!replyContent.trim() || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.textSecondary,
  },
  
  // Header
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 100, // Space for input area
  },

  // Notification Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  metaTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 16,
  },
  content: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 24,
  },

  // Replies Section (Kiểu danh sách)
  repliesSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
    marginLeft: 4,
  },
  // Style cho từng item phản hồi
  replyItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  replyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  replySender: {
    fontWeight: '700',
    fontSize: 14,
    color: COLORS.primary, // Tên người gửi màu xanh nổi bật
  },
  replyTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  replyContent: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },

  emptyReplies: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyRepliesText: {
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },

  // Input Area
  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingRight: 40,
    maxHeight: 100,
    fontSize: 15,
    color: COLORS.text,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },

  // Empty State & Buttons
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  backButtonCenter: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
  },
  backTextCenter: {
    color: '#fff',
    fontWeight: 'bold',
  },
});