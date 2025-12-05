/**
 * Student Notifications Screen
 */

import React, {useEffect, useMemo, useState} from 'react';
import {View, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity} from 'react-native';
import Text from '../../components/ui/Text';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import {colors, spacing} from '../../theme';
import {useAuth} from '../../context/AuthContext';
import {studentApi} from '../../services/studentApi';
import {useNavigation} from '@react-navigation/native';

interface NotificationItem {
  _id: string;
  title: string;
  content?: string;
  sender?: string; // Phòng ban
  type?: string; // system, info, warning
  createdAt: string;
  attachments?: Array<{ name: string; size?: string; url?: string }>;
  read?: boolean;
}

const badgeByType = (type?: string) => {
  switch (type) {
    case 'warning':
      return { label: 'Cảnh báo', color: colors.warning };
    case 'info':
      return { label: 'Thông báo', color: colors.info };
    default:
      return { label: 'Hệ thống', color: colors.primary };
  }
};

const StudentNotificationsScreen: React.FC = () => {
  const {user} = useAuth();
  const navigation = useNavigation();
  const studentId = user?._id || user?.id;
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!studentId) return;
      setLoading(true);
      try {
        const data = await studentApi.getNotifications(studentId);
        setItems(
          (data || []).map((n: any) => ({
            _id: n._id,
            title: n.title,
            content: n.content,
            sender: n.sender || n.department || 'Hệ thống',
            type: n.type,
            createdAt: n.createdAt,
            attachments: n.attachments || [],
            read: !!n.read,
          })),
        );
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [studentId]);

  const unread = useMemo(() => items.filter(i => !i.read), [items]);
  const read = useMemo(() => items.filter(i => i.read), [items]);

  const headerStats = useMemo(() => ({
    total: items.length,
    unread: unread.length,
  }), [items, unread]);

  const goDetail = (item: NotificationItem) => {
    (navigation as any).navigate('StudentNotificationDetail', { id: item._id, item });
  };

  const renderItem = ({item}: {item: NotificationItem}) => {
    const badge = badgeByType(item.type);
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => goDetail(item)}>
        <Card style={[styles.rowCard, !item.read && styles.rowCardUnread]}>
          <View style={styles.rowTop}>
            <View style={[styles.badge, { backgroundColor: badge.color }]}>
              <Text variant="caption" style={{ color: '#fff' }}>{badge.label}</Text>
            </View>
            {!item.read && (
              <View style={styles.newBadge}>
                <Text variant="caption" style={{ color: colors.primary }}>Mới</Text>
              </View>
            )}
          </View>
          <Text variant="title" style={{ marginBottom: spacing.xs }}>{item.title}</Text>
          {!!item.content && (
            <Text muted numberOfLines={2} style={{ marginBottom: spacing.sm }}>{item.content}</Text>
          )}
          <View style={styles.rowMeta}>
            <Text muted variant="caption">{item.sender}</Text>
            <Text muted variant="caption">•</Text>
            <Text muted variant="caption">{new Date(item.createdAt).toLocaleString('vi-VN')}</Text>
          </View>
          {!!item.attachments?.length && (
            <Text variant="caption" style={{ color: colors.info, marginTop: spacing.sm }}>
              {item.attachments.length} tệp đính kèm
            </Text>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Card style={styles.headerCard}>
        <Text variant="title">Thông báo</Text>
        <Text muted variant="caption" style={{ marginTop: spacing.xs }}>
          {headerStats.unread} chưa đọc • {headerStats.total} tổng
        </Text>
      </Card>

      {loading ? (
        <ActivityIndicator />
      ) : (
        <>
          <Text variant="title" style={styles.sectionTitle}>Chưa đọc</Text>
          <FlatList
            data={unread}
            renderItem={renderItem}
            keyExtractor={i => i._id}
            ListEmptyComponent={<Text muted style={{ textAlign: 'center' }}>Không có thông báo mới</Text>}
          />

          <Text variant="title" style={styles.sectionTitle}>Đã đọc</Text>
          <FlatList
            data={read}
            renderItem={renderItem}
            keyExtractor={i => i._id}
            ListEmptyComponent={<Text muted style={{ textAlign: 'center' }}>Không có mục đã đọc</Text>}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
          />
        </>
      )}

      <View style={styles.footerActions}>
        <Button title="Đánh dấu tất cả đã đọc" variant="outline" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  headerCard: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  rowCard: {
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
  },
  rowCardUnread: {
    borderColor: colors.primary,
    borderLeftColor: colors.primary,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  newBadge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  rowMeta: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  footerActions: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
  },
});

export default StudentNotificationsScreen;
