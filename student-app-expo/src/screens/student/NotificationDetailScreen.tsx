/**
 * Student Notification Detail Screen (parity with web)
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
} from 'react-native';
import { studentService } from '../../services/studentService';

export default function NotificationDetailScreen({ route, navigation }: any) {
  const id: string | undefined = route?.params?.id;
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const createdAtLabel = useMemo(() => {
    if (!item?.createdAt) return '';
    try {
      return new Date(item.createdAt).toLocaleString('vi-VN');
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

        // mark read
        if (data && data.isRead === false) {
          try {
            await studentService.markAsRead(id);
            if (mounted) setItem((prev: any) => (prev ? { ...prev, isRead: true } : prev));
          } catch {
            // ignore
          }
        }

        // load replies
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Không tìm thấy thông báo</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backInline}>
          <Text style={styles.backInlineText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Chi tiết thông báo</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.meta}>{createdAtLabel}</Text>
        <Text style={styles.content}>{item.content || item.message || ''}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Phản hồi</Text>
        {replies.length === 0 ? (
          <Text style={styles.emptySubText}>Chưa có phản hồi</Text>
        ) : (
          replies.map((r: any) => (
            <View key={r._id} style={styles.replyItem}>
              <Text style={styles.replyContent}>{r.content}</Text>
              <Text style={styles.replyMeta}>
                {r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : ''}
              </Text>
            </View>
          ))
        )}

        <View style={styles.replyBox}>
          <TextInput
            style={styles.replyInput}
            placeholder="Nhập phản hồi..."
            value={replyContent}
            onChangeText={setReplyContent}
            multiline
          />
          <TouchableOpacity
            style={[styles.replySendBtn, submitting && styles.disabledBtn]}
            onPress={onSubmitReply}
            disabled={submitting}
          >
            <Text style={styles.replySendText}>{submitting ? '...' : 'Gửi'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, color: '#666' },
  emptyText: { color: '#333', fontSize: 16, marginBottom: 12 },
  backBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#007AFF' },
  backText: { color: '#fff', fontWeight: '600' },
  header: { backgroundColor: '#fff', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backInline: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  backInlineText: { fontSize: 18, color: '#333' },
  title: { fontSize: 18, fontWeight: '700', color: '#333' },
  card: { backgroundColor: '#fff', margin: 12, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 6 },
  meta: { fontSize: 12, color: '#888', marginBottom: 10 },
  content: { fontSize: 14, color: '#333', lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 12 },
  emptySubText: { fontSize: 14, color: '#999' },
  replyItem: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12, marginTop: 12 },
  replyContent: { fontSize: 14, color: '#333' },
  replyMeta: { fontSize: 11, color: '#999', marginTop: 6 },
  replyBox: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
  replyInput: { minHeight: 44, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, backgroundColor: '#fff', color: '#333' },
  replySendBtn: { marginTop: 10, backgroundColor: '#007AFF', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  replySendText: { color: '#fff', fontWeight: '700' },
  disabledBtn: { opacity: 0.6 },
});


